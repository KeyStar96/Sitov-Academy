#!/usr/bin/env python3
"""Bounded local translation speech. German uses prepared Qwen assets only."""
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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VOICES = {"en": "en_US-ljspeech-high", "ru": "ru_RU-denis-medium", "uk": "uk_UA-ukrainian_tts-medium", "tr": "espeak-ng-tr"}
MAX_BODY = 16 * 1024
MAX_CHARS = 3000
MAX_AUDIO = 2 * 1024 * 1024
MAX_WAV = 32 * 1024 * 1024
SYNTHESIS_SECONDS = 65


def validate_request(raw: bytes) -> tuple[str, str, str | None]:
    if not raw or len(raw) > MAX_BODY:
        raise ValueError("request_too_large")
    body = json.loads(raw)
    if not isinstance(body, dict):
        raise ValueError("invalid_request")
    text, language = body.get("text"), body.get("language")
    if language == "de":
        raise ValueError("german_audio_prepared_offline")
    if set(body) != {"text", "language"}:
        raise ValueError("invalid_request")
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_CHARS or not isinstance(language, str) or language not in VOICES:
        raise ValueError("invalid_request")
    if any(ord(char) < 32 and char not in "\n\r\t" for char in text):
        raise ValueError("invalid_request")
    return " ".join(unicodedata.normalize("NFC", text).split()), language, None


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
        if language not in VOICES or profile is not None:
            raise ValueError("unsupported_voice")
        name = VOICES[language]
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
        voice = CompatibleVoice(config=config, session=onnxruntime.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"]), download_dir=self.model_dir)
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


def synthesize(text: str, language: str, voices: VoiceCache, profile: str | None = None) -> tuple[bytes, None]:
    if language not in VOICES or profile is not None:
        raise ValueError("unsupported_voice")
    if language == "tr":
        # The Turkish Piper model is non-commercial; keep the licensed local engine.
        wav_audio = subprocess.run(["espeak-ng", "-v", "tr", "-s", "145", "--stdout", "--stdin"], input=text.encode(), capture_output=True, timeout=15, check=True).stdout
    else:
        from piper import SynthesisConfig
        output = BoundedBuffer()
        voice = voices.get(language)
        config = SynthesisConfig(length_scale=1.0, noise_scale=0.667, noise_w_scale=0.8, speaker_id=2 if language == "uk" else None)
        with wave.open(output, "wb") as wav_file:
            wav_file.setframerate(voice.config.sample_rate)
            wav_file.setsampwidth(2)
            wav_file.setnchannels(1)
            for chunk in voice.synthesize(text, syn_config=config):
                wav_file.writeframes(chunk.audio_int16_bytes)
        wav_audio = output.getvalue()
    if len(wav_audio) > MAX_WAV:
        raise ValueError("audio_too_large")
    # A seekable MP3 retains Xing/LAME gapless metadata and the spoken samples.
    with tempfile.TemporaryDirectory(prefix="sitov-tts-") as directory:
        mp3_file = Path(directory) / "speech.mp3"
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-threads", "1", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "48k", "-write_xing", "1", "-f", "mp3", str(mp3_file)], input=wav_audio, capture_output=True, timeout=10, check=True)
        if mp3_file.stat().st_size > MAX_AUDIO:
            raise ValueError("audio_too_large")
        audio = mp3_file.read_bytes()
    if not 100 <= len(audio) <= MAX_AUDIO:
        raise ValueError("invalid_audio_size")
    return audio, None


def inference_process(connection, model_dir: str) -> None:
    # A separate process lets the supervisor stop stuck native ONNX calls.
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["OPENBLAS_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    voices = VoiceCache(Path(model_dir))
    try:
        voices.get("en")  # Keep the common translation fast after service startup.
        connection.send((True, b"ready"))
        while True:
            text, language, profile = connection.recv()
            started = time.monotonic()
            try:
                audio, timings = synthesize(text, language, voices, profile)
                connection.send((True, (audio, timings)))
                print(json.dumps({"event":"tts_ready", "language":language, "voice":VOICES[language], "seconds":round(time.monotonic()-started,3), "bytes":len(audio), "aligned":timings is not None}), flush=True)
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
    server_version = "SitovTranslationSpeech/3"
    engine: Engine
    token = ""

    def log_message(self, _format: str, *args: object) -> None:
        pass  # Never log request text, tokens or student vocabulary.

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(5)

    def respond(self, status: int, body: bytes, content_type: str="application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.respond(404,b'{"error":"not_found"}')
            return
        ready = self.engine.ready and bool(self.engine.process and self.engine.process.is_alive())
        self.respond(200 if ready else 503,json.dumps({"ready":ready,"engine":"piper-local-v2","languages":list(VOICES),"german":"prepared-qwen-cache-only"}).encode())

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
            self.respond(200,audio,"audio/mpeg")
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
