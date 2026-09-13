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
import time
import wave
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VOICES = {"de": "de_DE-thorsten-high", "en": "en_US-ljspeech-high", "ru": "ru_RU-denis-medium", "uk": "uk_UA-ukrainian_tts-medium", "tr": "espeak-ng-tr"}
MAX_BODY = 16 * 1024
MAX_CHARS = 3000
MAX_AUDIO = 2 * 1024 * 1024
MAX_WAV = 32 * 1024 * 1024
SYNTHESIS_SECONDS = 65


def validate_request(raw: bytes) -> tuple[str, str]:
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
    return text.strip(), language


class BoundedBuffer(io.BytesIO):
    def write(self, value: bytes) -> int:
        if self.tell() + len(value) > MAX_WAV:
            raise ValueError("audio_too_large")
        return super().write(value)


class VoiceCache:
    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self.voices: OrderedDict[str, object] = OrderedDict()

    def get(self, language: str):
        if language in self.voices:
            self.voices.move_to_end(language)
            return self.voices[language]
        # Evict before loading a third model, keeping peak model memory bounded.
        if len(self.voices) >= 2:
            self.voices.popitem(last=False)
            gc.collect()
        import onnxruntime
        from piper import PiperVoice
        from piper.config import PiperConfig
        model = self.model_dir / f"{VOICES[language]}.onnx"
        with Path(f"{model}.json").open(encoding="utf-8") as handle:
            config = PiperConfig.from_dict(json.load(handle))
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.execution_mode = onnxruntime.ExecutionMode.ORT_SEQUENTIAL
        voice = PiperVoice(config=config, session=onnxruntime.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"]), download_dir=self.model_dir)
        self.voices[language] = voice
        return voice


def synthesize(text: str, language: str, voices: VoiceCache) -> bytes:
    if language == "tr":
        # The official Turkish Piper model is non-commercial. eSpeak-NG keeps
        # Turkish available locally without deploying that restricted model.
        wav_audio = subprocess.run(["espeak-ng", "-v", "tr", "-s", "145", "--stdout", "--stdin"], input=text.encode(), capture_output=True, timeout=15, check=True).stdout
    else:
        from piper import SynthesisConfig
        output = BoundedBuffer()
        with wave.open(output, "wb") as wav_file:
            voices.get(language).synthesize_wav(text, wav_file, syn_config=SynthesisConfig(length_scale=1.08, noise_scale=0.667, noise_w_scale=0.8, speaker_id=2 if language == "uk" else None))
        wav_audio = output.getvalue()
    if len(wav_audio) > MAX_WAV:
        raise ValueError("audio_too_large")
    audio = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-threads", "1", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "pipe:1"], input=wav_audio, capture_output=True, timeout=10, check=True).stdout
    if not 100 <= len(audio) <= MAX_AUDIO:
        raise ValueError("invalid_audio_size")
    return audio


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
            text, language = connection.recv()
            started = time.monotonic()
            try:
                audio = synthesize(text, language, voices)
                connection.send((True, audio))
                print(json.dumps({"event":"tts_ready", "language":language, "seconds":round(time.monotonic()-started,3), "bytes":len(audio)}), flush=True)
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

    def speak(self, text: str, language: str) -> bytes:
        if not self.ready or not self.process or not self.process.is_alive():
            raise RuntimeError("service_unavailable")
        try:
            self.connection.send((text,language))
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
    server_version = "SitovSpeech/1"
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
        self.respond(200 if ready else 503,json.dumps({"ready":ready,"engine":"piper-local-v1","languages":list(VOICES)}).encode())

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
            text, language = validate_request(self.rfile.read(length))
        except (ValueError, UnicodeError, TimeoutError):
            self.respond(400,b'{"error":"invalid_request"}')
            return
        if not self.engine.lock.acquire(blocking=False):
            self.respond(503,b'{"error":"busy"}')
            return
        try:
            audio = self.engine.speak(text,language)
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
