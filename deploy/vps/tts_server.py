#!/usr/bin/env python3
"""Offline, bounded speech service. Piper inference is isolated from the Next app."""
from __future__ import annotations
import gc
import hmac
import io
import json
import multiprocessing
import os
import signal
import subprocess
import threading
import tempfile
import time
import unicodedata
import wave
from collections import OrderedDict
from dataclasses import replace
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VOICES = {"de": "de_DE-thorsten-high", "en": "en_US-ljspeech-high", "ru": "ru_RU-denis-medium", "uk": "uk_UA-ukrainian_tts-medium", "tr": "espeak-ng-tr"}
FEMALE_MODEL = "de_DE-mls-medium"
FEMALE_SPEAKER_ID = 2  # MLS donor 2037: female in metainfo.txt (CC BY 4.0).
FEMALE_SYNTHESIS_REVISION = "sitov-mls-context-v1"
FEMALE_MIN_PHONEME_IDS = 300
MAX_BODY = 16 * 1024
MAX_CHARS = 3000
MAX_AUDIO = 2 * 1024 * 1024
MAX_WAV = 32 * 1024 * 1024
SYNTHESIS_SECONDS = 65
MAX_TIMINGS_HEADER = 32 * 1024
SITOV_GERMAN_LEAD_IN_SECONDS = 0.35


def validate_request(raw: bytes) -> tuple[str, str, str | None]:
    if not raw or len(raw) > MAX_BODY:
        raise ValueError("request_too_large")
    body = json.loads(raw)
    if not isinstance(body, dict):
        raise ValueError("invalid_request")
    text, language = body.get("text"), body.get("language")
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHARS or not isinstance(language, str) or language not in VOICES:
        raise ValueError("invalid_request")
    if any(ord(char) < 32 and char not in "\n\r\t" for char in text):
        raise ValueError("invalid_request")
    profile = body.get("voice")
    if "voice" in body and (not isinstance(profile, str) or profile not in {"male", "female"}):
        raise ValueError("invalid_voice")
    if language != "de" and "voice" in body:
        raise ValueError("invalid_voice_language")
    return " ".join(text.split()), language, profile


class BoundedBuffer(io.BytesIO):
    def write(self, value: bytes) -> int:
        if self.tell() + len(value) > MAX_WAV:
            raise ValueError("audio_too_large")
        return super().write(value)


class VoiceCache:
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self.voices: OrderedDict[str, object] = OrderedDict()

    def get(self, language: str, profile: str | None = None):
        name = FEMALE_MODEL if language == "de" and profile == "female" else VOICES[language]
        if name in self.voices:
            self.voices.move_to_end(name)
            return self.voices[name]
        # Evict before loading a third model, keeping peak model memory bounded.
        if len(self.voices) >= 2:
            self.voices.popitem(last=False)
            gc.collect()
        import onnxruntime
        from piper import PiperVoice
        from piper.config import PiperConfig
        class CompatibleVoice(PiperVoice):
            def phonemize(self, text: str):
                return model_phonemes(super().phonemize(text), self.config.phoneme_id_map)

        model = self.model_dir / f"{name}.onnx"
        with Path(f"{model}.json").open(encoding="utf-8") as handle:
            config = PiperConfig.from_dict(json.load(handle))
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.execution_mode = onnxruntime.ExecutionMode.ORT_SEQUENTIAL
        # Installer exposes the VITS phoneme duration tensor once. Original,
        # checksum-pinned downloads stay intact; runtime needs no ONNX patcher.
        inference_model = self.model_dir / f"{name}.aligned.onnx" if language == "de" else model
        voice = CompatibleVoice(config=config, session=onnxruntime.InferenceSession(str(inference_model), sess_options=options, providers=["CPUExecutionProvider"]), download_dir=self.model_dir)
        if language == "de" and len(voice.session.get_outputs()) != 2:
            raise RuntimeError("alignment_model_required")
        self.voices[name] = voice
        return voice


def model_phonemes(sentences: list[list[str]], id_map) -> list[list[str]]:
    """Respect a voice's alphabet across old/new eSpeak Unicode encodings."""
    result = []
    for sentence in sentences:
        normalized = []
        for phoneme in sentence:
            if phoneme in id_map:
                normalized.append(phoneme)
            elif normalized:
                # Older maps use precomposed ç; Piper 1.8 emits c + cedilla.
                composed = unicodedata.normalize("NFC", normalized[-1] + phoneme)
                if composed in id_map:
                    normalized[-1] = composed
                # Other unsupported symbols are skipped just as Piper does.
        result.append(normalized)
    return result


def lexical_phoneme(phoneme: str) -> bool:
    """Exclude BOS/EOS, separators and sentence punctuation, retain IPA marks."""
    return bool(phoneme) and phoneme not in {"^", "$", "_"} and not phoneme.isspace() and not all(unicodedata.category(char).startswith("P") for char in phoneme)


def phonetic_word_count(sentences: list[list[str]]) -> int:
    return len(phonetic_words(sentences))


def phonetic_words(sentences: list[list[str]]) -> list[list[str]]:
    words = []
    for sentence in sentences:
        active = None
        for phoneme in sentence:
            if phoneme.isspace():
                active = None
            elif lexical_phoneme(phoneme):
                if active is None:
                    active = []
                    words.append(active)
                active.append(phoneme)
    return words


def phonetic_spans(alignments, sample_rate: int, offset: float) -> list[dict]:
    """Word boundaries measured in the samples generated for this sentence."""
    spans = []
    cursor = 0
    active = None
    for alignment in alignments:
        start = offset + cursor / sample_rate
        cursor += int(alignment.num_samples)
        end = offset + cursor / sample_rate
        if alignment.phoneme.isspace() or alignment.phoneme in {"^", "$"}:
            active = None
        elif lexical_phoneme(alignment.phoneme):
            if active is None:
                active = {"start": start, "end": end, "phonemes": []}
                spans.append(active)
            else:
                active["end"] = end
            active["phonemes"].append({"phoneme": alignment.phoneme, "start": start, "end": end})
    return spans


def unstressed(phonemes) -> str:
    return "".join(phoneme for phoneme in phonemes if phoneme not in {"ˈ", "ˌ"})


def split_merged_span(span: dict, words: list[list[str]]) -> list[dict] | None:
    """Split eSpeak phrase contractions at verified phoneme sample boundaries."""
    phonemes = [item for item in span.get("phonemes", []) if item["phoneme"] not in {"ˈ", "ˌ"}]
    if unstressed(item["phoneme"] for item in phonemes) != "".join(unstressed(word) for word in words):
        return None
    fragments = []
    cursor = 0
    for word in words:
        target = len(unstressed(word))
        start = cursor
        size = 0
        while cursor < len(phonemes) and size < target:
            size += len(phonemes[cursor]["phoneme"])
            cursor += 1
        if size != target or start == cursor:
            return None
        fragments.append({"start": phonemes[start]["start"], "end": phonemes[cursor - 1]["end"]})
    fragments[0]["start"] = span["start"]
    fragments[-1]["end"] = span["end"]
    return fragments


def token_timings(text: str, voice, spans: list[dict]) -> list[dict[str, float]] | None:
    # Phonemization supplies lexical ownership, never audio durations. Numbers
    # may expand to several spoken words belonging to one visible token. Audio
    # itself is synthesized in full sentences, preserving stress and prosody.
    token_words = [phonetic_words(voice.phonemize(token)) for token in text.split()]
    counts = [len(words) for words in token_words]
    references = [word for words in token_words for word in words]
    if not spans or len(references) < len(spans):
        return None
    if len(references) != len(spans):
        # eSpeak contracts phrases such as "Es ist" and "gar nicht" into one
        # phonetic word. Split only exact lexical matches, using each generated
        # phoneme's samples; uncertain context changes keep audio without marks.
        expanded = []
        cursor = 0
        for index, span in enumerate(spans):
            extra = len(references) - cursor - (len(spans) - index)
            fragments = None
            for count in range(2, min(extra + 1, 6) + 1):
                fragments = split_merged_span(span, references[cursor:cursor + count])
                if fragments is not None:
                    expanded.extend(fragments)
                    cursor += count
                    break
            if fragments is None:
                expanded.append(span)
                cursor += 1
        if cursor != len(references):
            return None
        spans = expanded
    result = []
    cursor = 0
    for count in counts:
        if count == 0:
            # A separate punctuation token has no spoken phoneme. Retain its
            # original index with an empty interval that is never highlighted.
            boundary = round(spans[cursor - 1]["end"], 5) if cursor else 0.0
            result.append({"start": boundary, "end": boundary})
            continue
        result.append({"start": round(spans[cursor]["start"], 5), "end": round(spans[cursor + count - 1]["end"], 5)})
        cursor += count
    return result


def female_context_chunks(text: str, voice, syn_config):
    """Give the audiobook MLS model enough context, returning one utterance.

    Upstream documents that MLS short phrases need at least 300 phoneme IDs.
    Repetitions are inference context only: generated phoneme durations locate
    the final repetition exactly, so no extra words reach the MP3 or timings.
    """
    phonemes = []
    for sentence in voice.phonemize(text):
        if phonemes:
            phonemes.append(" ")
        phonemes.extend(sentence)
    if not phonemes:
        raise ValueError("invalid_phonemes")
    padded = list(phonemes)
    last_start = 0
    while len(voice.phonemes_to_ids(padded)) < FEMALE_MIN_PHONEME_IDS:
        padded.append(" ")
        last_start = len(padded)
        padded.extend(phonemes)
    # A raw phoneme block bypasses Piper's sentence splitter. Even a request
    # containing several short sentences must reach the model as one context.
    chunks = list(voice.synthesize("[[" + "".join(padded) + "]]", syn_config=syn_config, include_alignments=True))
    if len(chunks) != 1:
        raise RuntimeError("context_alignment_required")
    chunk = chunks[0]
    alignments = chunk.phoneme_alignments
    if (not alignments or len(alignments) != len(padded) + 2
            or [item.phoneme for item in alignments] != ["^", *padded, "$"]
            or any(int(item.num_samples) < 0 for item in alignments)
            or sum(int(item.num_samples) for item in alignments) != len(chunk.audio_float_array)):
        raise RuntimeError("context_alignment_required")
    first = last_start + 1  # BOS is the first alignment entry.
    sample_start = sum(int(item.num_samples) for item in alignments[:first])
    if sample_start >= len(chunk.audio_float_array):
        raise RuntimeError("context_alignment_required")
    kept = alignments[first:]
    id_start = sum(len(item.phoneme_ids) for item in alignments[:first])
    yield replace(chunk, audio_float_array=chunk.audio_float_array[sample_start:],
                  phonemes=phonemes, phoneme_ids=chunk.phoneme_ids[id_start:],
                  phoneme_id_samples=chunk.phoneme_id_samples[id_start:] if chunk.phoneme_id_samples is not None else None,
                  phoneme_alignments=kept, _audio_int16_array=None, _audio_int16_bytes=None)


def synthesize(text: str, language: str, voices: VoiceCache, profile: str | None = None) -> tuple[bytes, list[dict[str, float]] | None]:
    timings = None
    if language == "tr":
        # The official Turkish Piper model is non-commercial. eSpeak-NG keeps
        # Turkish available locally without deploying that restricted model.
        wav_audio = subprocess.run(["espeak-ng", "-v", "tr", "-s", "145", "--stdout", "--stdin"], input=text.encode(), capture_output=True, timeout=15, check=True).stdout
    else:
        from piper import SynthesisConfig
        output = BoundedBuffer()
        voice = voices.get(language, profile)
        spans = []
        samples = 0
        aligned = language == "de"
        female = language == "de" and profile == "female"
        config = SynthesisConfig(length_scale=1.0, noise_scale=0.333 if female else 0.667, noise_w_scale=0.333 if female else 0.8, speaker_id=FEMALE_SPEAKER_ID if female else 2 if language == "uk" else None)
        chunks = female_context_chunks(text, voice, config) if female else voice.synthesize(text, syn_config=config, include_alignments=aligned)
        with wave.open(output, "wb") as wav_file:
            wav_file.setframerate(voice.config.sample_rate)
            wav_file.setsampwidth(2)
            wav_file.setnchannels(1)
            if language == "de":
                # Native mobile output can take a moment to wake, especially
                # with Bluetooth. Keep every spoken sample and move alignment
                # by exactly the inserted PCM samples, never by a wall clock.
                samples = round(voice.config.sample_rate * SITOV_GERMAN_LEAD_IN_SECONDS)
                wav_file.writeframes(b"\x00\x00" * samples)
            for chunk in chunks:
                if aligned:
                    if not chunk.phoneme_alignments or sum(int(item.num_samples) for item in chunk.phoneme_alignments) != len(chunk.audio_int16_array):
                        aligned = False
                    else:
                        spans.extend(phonetic_spans(chunk.phoneme_alignments, chunk.sample_rate, samples / chunk.sample_rate))
                wav_file.writeframes(chunk.audio_int16_bytes)
                samples += len(chunk.audio_int16_array)
        if aligned:
            timings = token_timings(text, voice, spans)
        wav_audio = output.getvalue()
    if len(wav_audio) > MAX_WAV:
        raise ValueError("audio_too_large")
    # A seekable output includes Xing/LAME gapless metadata. Streaming an MP3
    # to stdout leaves encoder priming in the playback timeline, shifting marks.
    with tempfile.TemporaryDirectory(prefix="sitov-tts-") as directory:
        mp3_file = Path(directory) / "speech.mp3"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-threads", "1", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "48k", "-write_xing", "1", "-f", "mp3", str(mp3_file)], input=wav_audio, capture_output=True, timeout=10, check=True)
        if mp3_file.stat().st_size > MAX_AUDIO:
            raise ValueError("audio_too_large")
        audio = mp3_file.read_bytes()
    if not 100 <= len(audio) <= MAX_AUDIO:
        raise ValueError("invalid_audio_size")
    return audio, timings


def inference_process(connection, model_dir: str) -> None:
    # A separate process lets the supervisor stop stuck native ONNX calls.
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["OPENBLAS_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    voices = VoiceCache(Path(model_dir))
    try:
        voices.get("de")  # Keep the common first word fast after service startup.
        connection.send((True, b"ready"))
        while True:
            text, language, profile = connection.recv()
            started = time.monotonic()
            try:
                audio, timings = synthesize(text, language, voices, profile)
                connection.send((True, (audio, timings)))
                print(json.dumps({"event":"tts_ready", "language":language, "voice":FEMALE_MODEL if language == "de" and profile == "female" else VOICES[language], "seconds":round(time.monotonic()-started,3), "bytes":len(audio), "aligned":timings is not None}), flush=True)
            except Exception:
                connection.send((False, b"synthesis_failed"))
    except (EOFError, BrokenPipeError):
        pass
    except Exception:
        try:
            connection.send((False, b"model_load_failed"))
        except (EOFError, BrokenPipeError):
            pass
    finally:
        connection.close()


class Engine:
    def __init__(self, model_dir: str):
        self.model_dir = model_dir
        self.lock = threading.Lock()
        self.process = None
        self.connection = None
        self.ready = False
        self.start()

    def start(self) -> None:
        context = multiprocessing.get_context("spawn")
        self.connection, child = context.Pipe()
        self.process = context.Process(target=inference_process, args=(child,self.model_dir), daemon=True)
        self.process.start()
        child.close()
        if not self.connection.poll(60):
            self.close()
            raise RuntimeError("model_startup_timeout")
        self.ready, _ = self.connection.recv()
        if not self.ready:
            self.close()
            raise RuntimeError("model_startup_failed")

    def close(self) -> None:
        self.ready = False
        if self.process and self.process.is_alive():
            self.process.terminate()
            self.process.join(3)
            if self.process.is_alive():
                self.process.kill()
                self.process.join(2)
        if self.connection:
            self.connection.close()

    def speak(self, text: str, language: str, profile: str | None = None) -> tuple[bytes, list[dict[str, float]] | None]:
        if not self.ready or not self.process or not self.process.is_alive():
            raise RuntimeError("service_unavailable")
        try:
            self.connection.send((text,language,profile))
            if not self.connection.poll(SYNTHESIS_SECONDS):
                raise TimeoutError("synthesis_timeout")
            success, audio = self.connection.recv()
        except (TimeoutError, EOFError, BrokenPipeError, OSError):
            self.close()
            # systemd restarts a wedged inference process; no unbounded background work.
            threading.Timer(0.2, lambda: os._exit(1)).start()
            raise RuntimeError("synthesis_unavailable")
        if not success:
            raise RuntimeError("synthesis_failed")
        return audio


class SpeechHandler(BaseHTTPRequestHandler):
    server_version = "SitovSpeech/2"
    engine: Engine
    token = ""

    def log_message(self, _format: str, *args: object) -> None:
        pass  # Never log request text, tokens or student vocabulary.

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(5)

    def respond(self, status: int, body: bytes, content_type: str="application/json", timings=None, profile=None) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if timings is not None:
            header = json.dumps(timings, separators=(",", ":"))
            if len(header) <= MAX_TIMINGS_HEADER:
                self.send_header("X-Word-Timings", header)
        if profile:
            self.send_header("X-TTS-Voice", profile)
        if profile == "female":
            self.send_header("X-TTS-Revision", FEMALE_SYNTHESIS_REVISION)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.respond(404,b'{"error":"not_found"}')
            return
        ready = self.engine.ready and bool(self.engine.process and self.engine.process.is_alive())
        self.respond(200 if ready else 503,json.dumps({"ready":ready,"engine":"piper-local-v2","languages":list(VOICES),"voices":{"de":["male"] + (["female"] if Path(self.engine.model_dir, f"{FEMALE_MODEL}.aligned.onnx").is_file() else [])}}).encode())

    def do_POST(self) -> None:
        if self.path != "/synthesize":
            self.respond(404,b'{"error":"not_found"}')
            return
        if self.token and not hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {self.token}"):
            self.respond(401,b'{"error":"unauthorized"}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY or self.headers.get("Transfer-Encoding"):
                self.respond(413,b'{"error":"request_too_large"}')
                return
            if self.headers.get_content_type() != "application/json":
                self.respond(415,b'{"error":"json_required"}')
                return
            text, language, profile = validate_request(self.rfile.read(length))
        except (ValueError, UnicodeError, TimeoutError):
            self.respond(400,b'{"error":"invalid_request"}')
            return
        if not self.engine.lock.acquire(blocking=False):
            self.respond(503,b'{"error":"busy"}')
            return
        try:
            audio, timings = self.engine.speak(text,language,profile)
            self.respond(200,audio,"audio/mpeg",timings,(profile or "male") if language == "de" else None)
        except (RuntimeError,TimeoutError,EOFError,BrokenPipeError):
            self.respond(503,b'{"error":"synthesis_unavailable"}')
        finally:
            self.engine.lock.release()


def main() -> None:
    model_dir = os.environ.get("TTS_MODEL_DIR", "/opt/sitov-tts/models")
    engine = Engine(model_dir)
    SpeechHandler.engine = engine
    SpeechHandler.token = os.environ.get("LOCAL_TTS_TOKEN", "")
    server = ThreadingHTTPServer(("127.0.0.1",9070), SpeechHandler)
    server.daemon_threads = True
    signal.signal(signal.SIGTERM, lambda *_: threading.Thread(target=server.shutdown,daemon=True).start())
    try:
        server.serve_forever()
    finally:
        server.server_close()
        engine.close()


if __name__ == "__main__":
    main()
