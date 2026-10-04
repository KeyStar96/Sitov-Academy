"""Offline Sitov Academy German audio preparation. Never used by learner routes."""
from __future__ import annotations

import fcntl
import gc
import hashlib
import importlib.metadata
import json
import math
import os
import platform
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import unicodedata
import wave

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = REPO_ROOT / "lib/audio/models/sitov-qwen-male-de/config.json"


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, prefix=".sitov-", delete=False) as handle:
        temporary = Path(handle.name)
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def load_profile(path=DEFAULT_CONFIG):
    path = Path(path).resolve()
    config = json.loads(path.read_text(encoding="utf-8"))
    if config.get("engine") != "qwen3-tts" or config.get("profile") != "male" or config.get("language") != "German":
        raise ValueError("The profile must select the Sitov Academy male German Qwen voice.")
    reference = path.parent / config["reference"]["audioFile"]
    if sha256_file(reference) != config["reference"]["audioSha256"]:
        raise ValueError("Reference audio checksum differs from the selected listening comparison.")
    transcript_path = path.parent / config["reference"]["textFile"]
    if sha256_file(transcript_path) != config["reference"]["textSha256"]:
        raise ValueError("Reference transcript checksum differs from the selected listening comparison.")
    fingerprint = hashlib.sha256(canonical_json(config).encode("utf-8")).hexdigest()
    return config, reference, transcript_path.read_text(encoding="utf-8").strip(), fingerprint


def normalize_text(value, maximum=3000):
    if not isinstance(value, str):
        raise ValueError("Audio text must be a string.")
    text = " ".join(unicodedata.normalize("NFC", value).split())
    if not text or len(text) > maximum or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", text):
        raise ValueError("German audio requires 1–3000 characters without control characters.")
    return text


def text_chunks(text, maximum):
    """Use complete sentences when possible; retain every original visible token."""
    chunks, current = [], ""
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        parts = [sentence]
        if len(sentence) > maximum:
            parts, part = [], ""
            for word in sentence.split():
                if len(word) > maximum:
                    raise ValueError("An individual token exceeds the model chunk limit.")
                candidate = f"{part} {word}".strip()
                if len(candidate) > maximum:
                    parts.append(part)
                    part = word
                else:
                    part = candidate
            if part:
                parts.append(part)
        for part in parts:
            candidate = f"{current} {part}".strip()
            if len(candidate) > maximum and current:
                chunks.append(current)
                current = part
            else:
                current = candidate
    if current:
        chunks.append(current)
    if " ".join(chunks) != text:
        raise ValueError("Chunking changed the authored text.")
    return chunks


def lexical_token(token):
    # The forced aligner uses this same letter/number/apostrophe cleaning rule.
    return "".join(c for c in token if c == "'" or unicodedata.category(c)[0] in "LN").casefold()


def map_word_timings(text, aligned, raw_duration, lead_in=0.35, rate=1.0):
    """Map learned spans to displayed tokens; never estimate phoneme durations."""
    tokens = text.split()
    expected = [lexical_token(t) for t in tokens if lexical_token(t)]
    observed = [lexical_token(item["text"]) for item in aligned]
    if not expected or expected != observed:
        raise ValueError("Forced alignment does not cover the exact authored tokens.")
    previous = 0.0
    for item in aligned:
        start, end = float(item["start"]), float(item["end"])
        if not math.isfinite(start) or not math.isfinite(end) or start < previous or end < start or end > raw_duration + 0.1:
            raise ValueError(f"Forced alignment returned invalid/overlapping lexical span {item!r}; previous end={previous}; duration={raw_duration}.")
        previous = end
    timings, index = [], 0
    for token in tokens:
        if lexical_token(token):
            item = aligned[index]
            index += 1
            start, end = item["start"], item["end"]
        else:
            # A punctuation-only visible token has no spoken interval.
            start = end = aligned[index - 1]["end"] if index else aligned[0]["start"]
        timings.append({"start": round(float(start) / rate + lead_in, 6), "end": round(float(end) / rate + lead_in, 6)})
    return timings


def ffmpeg_binary(explicit=None):
    candidate = explicit or os.environ.get("SITOV_QWEN_FFMPEG") or shutil.which("ffmpeg")
    if not candidate:
        try:
            import imageio_ffmpeg
            candidate = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            pass
    if not candidate or not Path(candidate).is_file():
        raise RuntimeError("Set SITOV_QWEN_FFMPEG to an existing FFmpeg binary.")
    return str(Path(candidate).resolve())


def wav_duration(path):
    with wave.open(str(path), "rb") as audio:
        return audio.getnframes() / audio.getframerate()


def validate_checkpoint(path, revision, kind):
    """Require the prepared snapshot's source revision before assigning its identity."""
    path = Path(path)
    if not path.is_dir():
        raise ValueError(f"Missing local {kind} checkpoint.")
    for filename in ("config.json", "model.safetensors"):
        metadata = path / ".cache/huggingface/download" / f"{filename}.metadata"
        if metadata.exists():
            if metadata.read_text().splitlines()[0] != revision:
                raise ValueError(f"Prepared {kind} checkpoint revision differs from the selected profile.")
        elif path.name != revision:
            raise ValueError(f"Checkpoint provenance unavailable; use sitov-qwen-prepare.py for {kind}.")
    configuration = json.loads((path / "config.json").read_text())
    if kind == "tts" and (configuration.get("tts_model_type") != "base" or configuration.get("tts_model_size") != "1b7" or configuration.get("quantization")):
        raise ValueError("Selected German voice requires the unchanged bf16 1.7B Base checkpoint.")


def encode_mp3(raw_path, output_path, config, ffmpeg, rate=1.0):
    """Two-pass loudness normalization followed by the fixed silent lead-in."""
    settings = config["output"]
    target = f"I={settings['loudnessLufs']}:TP={settings['truePeakDb']}:LRA={settings['loudnessRangeLu']}"
    spoken_duration = wav_duration(raw_path) / rate
    # EBU R128 cannot measure integrated loudness below its 400 ms window.
    # Measure a silent tail only for tiny words, then remove it before adding
    # the standard lead-in. The authored speech and alignment do not change.
    measurement_padding = max(0.0, 0.4 - spoken_duration)
    prefix = f"atempo={rate}," if rate != 1 else ""
    if measurement_padding:
        prefix += "apad=whole_dur=0.4,"
    common = [ffmpeg, "-nostdin", "-hide_banner", "-threads", "1", "-filter_threads", "1", "-i", str(raw_path), "-vn"]
    measure = subprocess.run(common + ["-af", prefix + "loudnorm=" + target + ":print_format=json", "-f", "null", "-"], capture_output=True, text=True, timeout=180, check=True)
    matches = re.findall(r"\{\s*\"input_i\".*?\}", measure.stderr, flags=re.S)
    if not matches:
        raise RuntimeError("FFmpeg did not return loudness measurements.")
    loudness = json.loads(matches[-1])
    names = {"input_i": "measured_I", "input_tp": "measured_TP", "input_lra": "measured_LRA", "input_thresh": "measured_thresh", "target_offset": "offset"}
    if not all(math.isfinite(float(loudness[name])) for name in names):
        raise RuntimeError("Speech is too short or silent for measured loudness normalization.")
    measured = ":".join(f"{target_name}={loudness[name]}" for name, target_name in names.items())
    delay_ms = round(settings["leadInSeconds"] * 1000)
    filters = prefix + "loudnorm=" + target + ":" + measured + ":linear=true:print_format=json"
    if measurement_padding:
        filters += f",atrim=duration={spoken_duration:.8f},asetpts=PTS-STARTPTS"
    filters += f",adelay={delay_ms}:all=1"
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_name(output_path.name + ".sitov.tmp.mp3")
    try:
        encoded = subprocess.run(common + ["-af", filters, "-ac", str(settings["channels"]), "-ar", str(settings["sampleRate"]), "-codec:a", "libmp3lame", "-b:a", settings["bitRate"], "-write_xing", "1", "-id3v2_version", "3", "-map_metadata", "-1", "-f", "mp3", "-y", str(temporary)], capture_output=True, text=True, timeout=180, check=True)
        data = temporary.read_bytes()
        if len(data) < 100 or len(data) > 2 * 1024 * 1024 or not (data.startswith(b"ID3") or data[0] == 255 and data[1] & 224 == 224):
            raise RuntimeError("Generated MP3 is invalid or exceeds the audio limit.")
        temporary.replace(output_path)
        final_matches = re.findall(r"\{\s*\"input_i\".*?\}", encoded.stderr, flags=re.S)
        return {"measurement": loudness, "result": json.loads(final_matches[-1]) if final_matches else None, "measurementPaddingSeconds": measurement_padding, "measurementWindowSeconds": max(0.4, spoken_duration)}
    finally:
        temporary.unlink(missing_ok=True)


class SitovQwenBatch:
    """Resident per-stage models, disk progress, and resumable exact profile identity."""

    def __init__(self, config_path, model_path, aligner_path, output_dir, lock_path=None, ffmpeg=None, batch_size=1, continue_on_error=False):
        self.config, self.reference, self.reference_text, self.fingerprint = load_profile(config_path)
        self.model_path = Path(model_path).resolve()
        self.aligner_path = Path(aligner_path).resolve()
        validate_checkpoint(self.model_path, self.config["tts"]["mlxRevision"], "tts")
        validate_checkpoint(self.aligner_path, self.config["alignment"]["mlxRevision"], "aligner")
        self.output_dir = Path(output_dir).resolve()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.lock_path = Path(lock_path or os.environ.get("SITOV_QWEN_LOCK", str(Path.home() / ".cache/sitov-qwen/generation.lock")))
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        self.ffmpeg = ffmpeg_binary(ffmpeg)
        self.batch_size = int(batch_size)
        self.continue_on_error = bool(continue_on_error)
        if not 1 <= self.batch_size <= 20:
            raise ValueError("Native batch size must be between 1 and 20.")
        self.manifest_path = self.output_dir / "sitov-qwen-manifest.json"
        self.journal_path = self.output_dir / "sitov-qwen-progress.jsonl"
        self.pending_progress = 0
        self.restore_progress()

    def restore_progress(self):
        marker = self.manifest_path.parent / ".sitov-qwen-reuse-transaction.json"
        if marker.exists() or marker.is_symlink():
            raise ValueError("Incomplete audio reuse transaction: run scripts/sitov-qwen-reuse.py --recover before resuming generation.")
        self.journal_repair_offset = None
        self.manifest = {"schemaVersion": 1, "engine": self.config["engine"], "voice": self.config["voice"], "revision": self.config["revision"], "profileFingerprint": self.fingerprint, "entries": {}}
        if self.manifest_path.exists():
            existing = json.loads(self.manifest_path.read_text())
            if existing.get("profileFingerprint") != self.fingerprint:
                raise ValueError("Output directory contains a different audio profile. Use a new directory.")
            self.manifest = existing
        if self.journal_path.exists():
            complete_bytes = 0
            with self.journal_path.open("rb") as journal:
                for line in journal:
                    # An interrupted final write can leave one incomplete line.
                    # Only complete, fsynced records establish a resumable state.
                    if not line.endswith(b"\n"):
                        self.journal_repair_offset = complete_bytes
                        break
                    record = json.loads(line)
                    if record["profileFingerprint"] != self.fingerprint:
                        raise ValueError("Progress journal contains a different audio profile.")
                    self.manifest["entries"][record["id"]] = record["entry"]
                    complete_bytes += len(line)
        self.pending_progress = 0

    def set_entry(self, identifier, entry):
        """Commit one result before announcing it; avoid quadratic manifest writes."""
        if self.journal_repair_offset is not None:
            with self.journal_path.open("r+b") as journal:
                journal.truncate(self.journal_repair_offset)
            self.journal_repair_offset = None
        record = {"profileFingerprint": self.fingerprint, "id": identifier, "entry": entry}
        with self.journal_path.open("a", encoding="utf-8") as journal:
            journal.write(canonical_json(record) + "\n")
            journal.flush()
            os.fsync(journal.fileno())
        self.manifest["entries"][identifier] = entry
        self.pending_progress += 1

    def save(self, force=False):
        if not force and self.pending_progress < 64 and self.manifest_path.exists():
            return
        atomic_json(self.manifest_path, self.manifest)
        # Replaying an old journal after a crash between these two writes is
        # harmless: it contains the same committed entries as the checkpoint.
        with self.journal_path.open("w", encoding="utf-8") as journal:
            journal.flush()
            os.fsync(journal.fileno())
        self.pending_progress = 0
        self.journal_repair_offset = None

    def plan(self, rows):
        planned, identifiers = [], {}
        for row in rows:
            text = normalize_text(row["text"], self.config["limits"]["maxTextLength"])
            rate = float(row.get("rate", 1.0))
            if not math.isfinite(rate) or not self.config["limits"]["minRate"] <= rate <= self.config["limits"]["maxRate"]:
                raise ValueError("Unsupported offline audio rate.")
            item_fingerprint = hashlib.sha256(canonical_json({"profile": self.fingerprint, "text": text, "rate": rate}).encode()).hexdigest()
            identifier = str(row.get("id", item_fingerprint))
            if identifier in identifiers and identifiers[identifier] != item_fingerprint:
                raise ValueError("One catalog ID refers to different text/rate.")
            identifiers[identifier] = item_fingerprint
            output = Path(row["output"]).resolve() if row.get("output") else self.output_dir / f"{item_fingerprint}.mp3"
            metadata = Path(row["metadata"]).resolve() if row.get("metadata") else output.with_suffix(".json")
            raw_key = hashlib.sha256(text.encode()).hexdigest()
            raw = self.output_dir / "raw" / f"{raw_key}.wav"
            planned.append({**row, "id": identifier, "text": text, "rate": rate, "output": str(output), "metadata": str(metadata), "raw": str(raw), "itemFingerprint": item_fingerprint})
        return planned

    def run(self, rows, stage="all"):
        if platform.system() != "Darwin" or platform.machine() != "arm64":
            raise RuntimeError("The pinned MLX authoring pipeline requires an Apple Silicon Mac; learner servers only serve prepared audio.")
        planned = self.plan(rows)
        # Loading/inference are local only after explicitly prepared model files.
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        for package, expected in (("mlx-audio", self.config["tts"]["mlxAudioVersion"]), ("mlx", self.config["tts"]["mlxVersion"])):
            if importlib.metadata.version(package) != expected:
                raise RuntimeError(f"{package} version differs from the pinned selected voice profile.")
        with self.lock_path.open("a+") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
            self.restore_progress()
            try:
                if stage in ("all", "synthesize"):
                    if self.batch_size > 1:
                        self.synthesize_native_batch(planned)
                    else:
                        self.synthesize(planned)
                if stage in ("all", "finalize"):
                    self.finalize(planned)
            finally:
                self.save(force=True)
        return self.manifest

    def save_raw(self, row, values, elapsed, batch_size=1, chunks=1, chunk_records=None):
        import mlx.core as mx
        import numpy as np
        raw = Path(row["raw"])
        audio = np.asarray(values, dtype=np.float32).reshape(-1)
        if not audio.size or not np.isfinite(audio).all() or np.max(np.abs(audio)) == 0:
            raise RuntimeError("Model returned invalid/silent audio.")
        duration = audio.size / self.config["output"]["sampleRate"]
        if not 0 < duration <= self.config["limits"]["maxAudioSeconds"]:
            raise RuntimeError("Raw audio duration exceeds the alignment limit.")
        raw.parent.mkdir(parents=True, exist_ok=True)
        temporary = raw.with_suffix(".sitov.tmp.wav")
        with wave.open(str(temporary), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(self.config["output"]["sampleRate"])
            output.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
        temporary.replace(raw)
        self.set_entry(row["id"], {**row, "status": "raw", "rawSha256": sha256_file(raw), "rawSeconds": duration, "generationSeconds": elapsed, "chunks": chunks, "nativeBatchSize": batch_size, "peakMlxBytes": int(mx.get_peak_memory()), **({"nativeChunkRecords": chunk_records} if chunk_records is not None else {})})
        self.save()
        print(canonical_json({"id": row["id"], "stage": "raw", "seconds": duration, "batchSize": batch_size}), flush=True)

    def native_chunk_specs(self, row):
        """Independent model inputs retain the exact existing sentence/token split."""
        chunks = text_chunks(row["text"], self.config["limits"]["maxChunkCharacters"])
        directory = self.output_dir / "raw" / "native-chunks" / hashlib.sha256(row["text"].encode()).hexdigest()
        return [{"index": index, "text": text, "textSha256": hashlib.sha256(text.encode()).hexdigest(),
                 "path": str(directory / f"{index}-{hashlib.sha256(text.encode()).hexdigest()}.npy")}
                for index, text in enumerate(chunks)]

    def load_native_chunk(self, spec, record):
        """Only checksummed, exact-text, non-pickled float samples are resumable."""
        import numpy as np
        if not record or any(record.get(key) != spec[key] for key in ("index", "textSha256", "path")):
            return None
        path = Path(spec["path"])
        try:
            if not math.isfinite(record.get("generationSeconds", -1)) or record.get("generationSeconds", -1) < 0:
                return None
            if not isinstance(record.get("nativeBatchSize"), int) or not 1 <= record["nativeBatchSize"] <= 20:
                return None
            if not path.is_file() or path.stat().st_size > self.config["limits"]["maxAudioSeconds"] * self.config["output"]["sampleRate"] * 4 + 4096:
                return None
            if record.get("sha256") != sha256_file(path):
                return None
            values = np.load(path, allow_pickle=False, mmap_mode="r")
            if values.dtype != np.dtype("float32") or values.ndim != 1 or values.size != record.get("samples") or not values.size:
                return None
            if not np.isfinite(values).all() or not np.max(np.abs(values)) > 0:
                return None
            if not 0 < values.size / self.config["output"]["sampleRate"] <= self.config["limits"]["maxAudioSeconds"]:
                return None
            return values
        except (OSError, ValueError, EOFError, TypeError):
            return None

    def save_native_chunk(self, row, spec, values, elapsed, batch_size, records, chunk_count):
        """Fsync genuine model samples before the existing durable progress receipt."""
        import numpy as np
        values = np.asarray(values, dtype=np.float32).reshape(-1)
        if not values.size or not np.isfinite(values).all() or not np.max(np.abs(values)) > 0:
            raise RuntimeError("Model returned invalid/silent audio.")
        if not 0 < values.size / self.config["output"]["sampleRate"] <= self.config["limits"]["maxAudioSeconds"]:
            raise RuntimeError("Raw audio duration exceeds the alignment limit.")
        path = Path(spec["path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".sitov-chunk-", delete=False) as handle:
                temporary = Path(handle.name)
                np.save(handle, values, allow_pickle=False)
                handle.flush()
                os.fsync(handle.fileno())
            temporary.replace(path)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        record = {"index": spec["index"], "textSha256": spec["textSha256"], "path": spec["path"],
                  "sha256": sha256_file(path), "samples": int(values.size), "generationSeconds": elapsed, "nativeBatchSize": batch_size}
        records[spec["index"]] = record
        self.set_entry(row["id"], {**row, "status": "raw-chunks", "chunks": chunk_count,
                                  "nativeChunkRecords": [records[index] for index in sorted(records)]})
        self.save()
        print(canonical_json({"id": row["id"], "stage": "raw-chunk", "chunk": spec["index"] + 1,
                              "chunks": chunk_count, "seconds": values.size / self.config["output"]["sampleRate"], "batchSize": batch_size}), flush=True)

    def assemble_native_chunks(self, row, specs, records):
        """Concatenate once in authored order; whole-recording forced alignment follows."""
        import numpy as np
        if len(records) != len(specs):
            return False
        outputs = [self.load_native_chunk(spec, records.get(spec["index"])) for spec in specs]
        if any(values is None for values in outputs):
            raise RuntimeError("A prepared native chunk changed before assembly.")
        ordered = [records[spec["index"]] for spec in specs]
        self.save_raw(row, np.concatenate(outputs), sum(record["generationSeconds"] for record in ordered),
                      max(record["nativeBatchSize"] for record in ordered), len(specs), ordered)
        return True

    def synthesize_native_batch(self, planned):
        """Batch independent ICL chunks, including long rows; never join text jobs."""
        import mlx.core as mx
        import numpy as np
        from mlx_audio.tts.utils import load_model
        raw_states = {e["raw"]: e for e in self.manifest["entries"].values() if e.get("rawSha256")}
        jobs, completed_raw = {}, set()
        for row in planned:
            raw = Path(row["raw"])
            state = raw_states.get(str(raw), {})
            if raw.exists() and state.get("rawSha256") == sha256_file(raw):
                completed_raw.add(row["raw"])
                previous = self.manifest["entries"].get(row["id"], {})
                if previous.get("itemFingerprint") != row["itemFingerprint"]:
                    self.set_entry(row["id"], {**row, "status": "raw", **{k: state[k] for k in ("rawSha256", "rawSeconds", "generationSeconds", "chunks")}})
                continue
            jobs.setdefault(row["raw"], row)
        self.save()
        chunk_states = {e["raw"]: e for e in self.manifest["entries"].values() if e.get("nativeChunkRecords")}
        rows, specs_by_raw, records_by_raw, pending = {}, {}, {}, []
        for row in jobs.values():
            raw_key = row["raw"]
            rows[raw_key] = row
            specs = specs_by_raw[raw_key] = self.native_chunk_specs(row)
            stored = {record.get("index"): record for record in chunk_states.get(raw_key, {}).get("nativeChunkRecords", [])}
            records = records_by_raw[raw_key] = {spec["index"]: stored[spec["index"]] for spec in specs
                                                if self.load_native_chunk(spec, stored.get(spec["index"])) is not None}
            if len(records) == len(specs):
                try:
                    self.assemble_native_chunks(row, specs, records)
                    completed_raw.add(raw_key)
                except Exception as error:
                    self.set_entry(row["id"], {**row, "status": "failed", "failedStage": "chunk-assembly", "error": str(error),
                                              "chunks": len(specs), "nativeChunkRecords": [records[index] for index in sorted(records)]})
                    self.save()
                    if not self.continue_on_error:
                        raise
            else:
                pending.extend({"row": row, "spec": spec} for spec in specs if spec["index"] not in records)
        pending.sort(key=lambda job: len(job["spec"]["text"]))
        model = load_model(str(self.model_path)) if pending else None
        cursor = 0
        retries = []

        def save_result(job, values, elapsed, width):
            row, spec = job["row"], job["spec"]
            raw_key = row["raw"]
            self.save_native_chunk(row, spec, values, elapsed, width, records_by_raw[raw_key], len(specs_by_raw[raw_key]))
            if self.assemble_native_chunks(row, specs_by_raw[raw_key], records_by_raw[raw_key]):
                completed_raw.add(raw_key)

        def failed(job, error):
            row = job["row"]
            self.set_entry(row["id"], {**row, "status": "failed", "failedStage": "batched-synthesis", "error": str(error),
                                      "chunks": len(specs_by_raw[row["raw"]]),
                                      "nativeChunkRecords": [records_by_raw[row["raw"]][index] for index in sorted(records_by_raw[row["raw"]])]})
            self.save()

        try:
            while cursor < len(pending):
                # Long utterance vocoders use more temporary memory; short catalog
                # entries can share a wider batched token generation pass.
                width = min(self.batch_size, len(pending) - cursor, 4 if len(pending[cursor]["spec"]["text"]) > 250 else self.batch_size)
                while width > 4 and len(pending[cursor + width - 1]["spec"]["text"]) > 250:
                    width -= 1
                group = pending[cursor:cursor + width]
                mx.random.seed(self.config["tts"]["seed"])
                began = time.monotonic()
                seen = set()
                try:
                    for result in model.batch_generate(texts=[job["spec"]["text"] for job in group], ref_audio=str(self.reference), ref_text=self.reference_text, lang_code="German", stream=False, verbose=False, **self.config["tts"]["generation"]):
                        if result.sequence_idx in seen or not 0 <= result.sequence_idx < len(group):
                            raise RuntimeError("Native batched synthesis returned an invalid sequence identity.")
                        mx.eval(result.audio)
                        if getattr(result, "sample_rate", self.config["output"]["sampleRate"]) != self.config["output"]["sampleRate"]:
                            raise RuntimeError("Native batched synthesis returned a different sample rate.")
                        save_result(group[result.sequence_idx], np.asarray(result.audio), time.monotonic() - began, len(group))
                        seen.add(result.sequence_idx)
                    if len(seen) != len(group):
                        raise RuntimeError("Native batched synthesis did not return every authored sequence.")
                except Exception as error:
                    for index, job in enumerate(group):
                        if index not in seen:
                            failed(job, error)
                            retries.append(job)
                    self.save()
                    if not self.continue_on_error:
                        raise
                    print(canonical_json({"stage": "batch-failed", "ids": [job["row"]["id"] for i, job in enumerate(group) if i not in seen], "error": str(error), "retry": "individual-chunk-after-batch"}), flush=True)
                mx.clear_cache()
                cursor += len(group)
            # Retry only missing independent chunks, keeping already committed speech.
            for job in retries:
                try:
                    mx.random.seed(self.config["tts"]["seed"])
                    began, outputs = time.monotonic(), []
                    for result in model.generate(text=job["spec"]["text"], ref_audio=str(self.reference), ref_text=self.reference_text,
                                                 lang_code="German", speed=1.0, stream=False, verbose=False, **self.config["tts"]["generation"]):
                        mx.eval(result.audio)
                        values = np.asarray(result.audio, dtype=np.float32).reshape(-1)
                        if getattr(result, "sample_rate", self.config["output"]["sampleRate"]) != self.config["output"]["sampleRate"]:
                            raise RuntimeError("Individual synthesis returned a different sample rate.")
                        if not values.size or not np.isfinite(values).all() or not np.max(np.abs(values)) > 0:
                            raise RuntimeError("Model returned invalid/silent audio.")
                        outputs.append(values)
                    if not outputs:
                        raise RuntimeError("Individual synthesis did not return its authored chunk.")
                    save_result(job, np.concatenate(outputs), time.monotonic() - began, 1)
                except Exception as error:
                    failed(job, error)
                    print(canonical_json({"id": job["row"]["id"], "stage": "failed", "error": str(error)}), flush=True)
                mx.clear_cache()
            for raw_key, row in rows.items():
                if raw_key not in completed_raw:
                    failed({"row": row}, RuntimeError("Not every authored chunk has valid prepared speech; this recording must not be published."))
        finally:
            del model
            gc.collect()
            mx.clear_cache()
        # Populate other IDs/rates that share one exact raw text recording.
        self.synthesize([row for row in planned if row["raw"] in completed_raw])

    def synthesize(self, planned):
        import mlx.core as mx
        import numpy as np
        from mlx_audio.tts.utils import load_model
        model = None
        raw_states = {e["raw"]: e for e in self.manifest["entries"].values() if e.get("rawSha256")}
        for row in planned:
            previous = self.manifest["entries"].get(row["id"], {})
            raw = Path(row["raw"])
            raw_state = raw_states.get(str(raw), {})
            reusable = raw.exists() and raw_state.get("rawSha256") == sha256_file(raw)
            if reusable:
                if previous.get("itemFingerprint") != row["itemFingerprint"]:
                    self.set_entry(row["id"], {**row, "status": "raw", "rawSha256": raw_state["rawSha256"], "rawSeconds": raw_state["rawSeconds"], "generationSeconds": raw_state["generationSeconds"], "chunks": raw_state["chunks"], "peakMlxBytes": raw_state.get("peakMlxBytes")})
                    self.save()
                continue
            try:
                if model is None:
                    model = load_model(str(self.model_path))
                mx.random.seed(self.config["tts"]["seed"])
                began = time.monotonic()
                chunks = text_chunks(row["text"], self.config["limits"]["maxChunkCharacters"])
                outputs = []
                for chunk in chunks:
                    for result in model.generate(text=chunk, ref_audio=str(self.reference), ref_text=self.reference_text, lang_code="German", speed=1.0, stream=False, verbose=False, **self.config["tts"]["generation"]):
                        mx.eval(result.audio)
                        values = np.asarray(result.audio, dtype=np.float32).reshape(-1)
                        if not np.isfinite(values).all() or not values.size or np.max(np.abs(values)) == 0:
                            raise RuntimeError("Model returned invalid/silent audio.")
                        outputs.append(values)
                audio = np.concatenate(outputs)
                duration = audio.size / self.config["output"]["sampleRate"]
                if not 0 < duration <= self.config["limits"]["maxAudioSeconds"]:
                    raise RuntimeError("Raw audio duration exceeds the alignment limit.")
                raw.parent.mkdir(parents=True, exist_ok=True)
                temporary = raw.with_suffix(".sitov.tmp.wav")
                with wave.open(str(temporary), "wb") as output:
                    output.setnchannels(1)
                    output.setsampwidth(2)
                    output.setframerate(self.config["output"]["sampleRate"])
                    output.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
                temporary.replace(raw)
                self.set_entry(row["id"], {**row, "status": "raw", "rawSha256": sha256_file(raw), "rawSeconds": duration, "generationSeconds": time.monotonic() - began, "chunks": len(chunks), "peakMlxBytes": int(mx.get_peak_memory())})
                raw_states[str(raw)] = self.manifest["entries"][row["id"]]
                self.save()
                print(canonical_json({"id": row["id"], "stage": "raw", "seconds": duration}), flush=True)
            except Exception as error:
                self.set_entry(row["id"], {**row, "status": "failed", "failedStage": "synthesis", "error": str(error)})
                self.save()
                if not self.continue_on_error:
                    raise
                print(canonical_json({"id": row["id"], "stage": "failed", "error": str(error)}), flush=True)
        del model
        gc.collect()
        mx.clear_cache()

    def finalize(self, planned):
        import mlx.core as mx
        from mlx_audio.stt import load
        aligner = None
        for row in planned:
            previous = self.manifest["entries"].get(row["id"], {})
            output, metadata, raw = Path(row["output"]), Path(row["metadata"]), Path(row["raw"])
            if previous.get("itemFingerprint") != row["itemFingerprint"] or not raw.exists() or previous.get("rawSha256") != sha256_file(raw):
                error = f"Missing or mismatched prepared raw audio for {row['id']}."
                if not self.continue_on_error:
                    raise RuntimeError(error)
                self.set_entry(row["id"], {**row, **previous, "status": "failed", "failedStage": previous.get("failedStage", "missing-raw"), "error": previous.get("error", error)})
                self.save()
                print(canonical_json({"id": row["id"], "stage": "failed", "error": error}), flush=True)
                continue
            if previous.get("status") == "complete" and output.exists() and metadata.exists() and previous.get("sha256") == sha256_file(output):
                continue
            try:
                if aligner is None:
                    aligner = load(str(self.aligner_path))
                began = time.monotonic()
                aligned = aligner.generate(str(raw), text=row["text"], language="German").segments
                previous["rawAlignedWords"] = aligned
                timings = map_word_timings(row["text"], aligned, wav_duration(raw), self.config["output"]["leadInSeconds"], row["rate"])
                normalized = encode_mp3(raw, output, self.config, self.ffmpeg, row["rate"])
                details = {**previous, "status": "complete", "engine": self.config["engine"], "voice": self.config["voice"], "revision": self.config["revision"], "profileFingerprint": self.fingerprint, "sourceModel": self.config["tts"]["sourceModel"], "mlxModel": self.config["tts"]["mlxModel"], "modelRevision": self.config["tts"]["mlxRevision"], "referenceSha256": self.config["reference"]["audioSha256"], "alignmentModel": self.config["alignment"], "wordTimings": timings, "rawAlignedWords": aligned, "normalization": normalized, "sha256": sha256_file(output), "audioSha256": sha256_file(output), "textSha256": hashlib.sha256(row["text"].encode("utf-8")).hexdigest(), "sampleRate": self.config["output"]["sampleRate"], "bitrate": self.config["output"]["bitRate"], "channels": self.config["output"]["channels"], "bytes": output.stat().st_size, "finalizeSeconds": time.monotonic() - began}
                atomic_json(metadata, details)
                self.set_entry(row["id"], details)
                self.save()
                print(canonical_json({"id": row["id"], "stage": "complete", "output": str(output), "words": len(timings)}), flush=True)
            except Exception as error:
                self.set_entry(row["id"], {**previous, "status": "failed", "failedStage": "alignment-or-encoding", "error": str(error)})
                self.save()
                if not self.continue_on_error:
                    raise
                print(canonical_json({"id": row["id"], "stage": "failed", "error": str(error)}), flush=True)
        del aligner
        gc.collect()
        mx.clear_cache()
