#!/usr/bin/env python3
"""Create separate alignment candidates from completed, SHA-verified MP3s."""
import argparse
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

from sitov_qwen_runtime import DEFAULT_CONFIG, load_profile, validate_checkpoint, ffmpeg_binary, wav_duration, atomic_json, sha256_file
from sitov_qwen_alignment import (DECODER_VERSION, METHOD, verified_source, captured_alignment,
                                 exact_display_timings, array_sha256, receipt_digest, verify_resume)


def run(args):
    os.umask(0o077)
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    config, _, _, fingerprint = load_profile(args.config)
    manifest = json.loads(args.manifest.read_text())
    if manifest.get("profileFingerprint") != fingerprint:
        raise ValueError("manifest_profile_mismatch")
    entries = manifest["entries"]
    chosen = args.id or list(entries)
    sources = [verified_source(args.manifest, identifier, entries[identifier], fingerprint) for identifier in chosen]
    output = args.output_dir.resolve()
    if output == args.manifest.resolve().parent or any(output == Path(s["mp3"]).parent or output == Path(s["metadata"]).parent for s in sources):
        raise ValueError("separate_candidate_directory_required")
    output.mkdir(parents=True, exist_ok=True)
    lock_path = args.lock.expanduser().resolve()
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    completed = 0
    with lock_path.open("a+") as lock:
        # The generation process uses this same lock. No model import/load before it.
        fcntl.flock(lock, fcntl.LOCK_EX)
        validate_checkpoint(args.aligner_path, config["alignment"]["mlxRevision"], "aligner")
        model = None
        for source, identifier in zip(sources, chosen):
            # Revalidate after waiting for the lock; inputs may have changed meanwhile.
            current = verified_source(args.manifest, identifier, entries[identifier], fingerprint)
            if source != current:
                raise ValueError("source_changed_while_waiting")
            provenance = {**source, "modelRevision": config["alignment"]["mlxRevision"],
                          "decoderVersion": DECODER_VERSION, "method": METHOD}
            dest = output / (hashlib.sha256(identifier.encode()).hexdigest() + ".json")
            if dest.exists():
                verify_resume(dest, provenance)
                completed += 1
                continue
            arrays_path = dest.with_suffix(".npz")
            if arrays_path.exists():
                raise ValueError("orphan_candidate_arrays_require_review")
            if model is None:
                import numpy as np
                import mlx.core as mx
                from mlx_audio.stt import load
                model = load(str(args.aligner_path))
                model = getattr(model, "_model", model)
            with tempfile.TemporaryDirectory(prefix=".sitov-alignment-", dir=output) as temporary:
                wav = Path(temporary) / "decoded.wav"
                subprocess.run([ffmpeg_binary(args.ffmpeg), "-nostdin", "-threads", "1", "-i", source["mp3"],
                                "-ac", "1", "-ar", "24000", "-c:a", "pcm_s16le", str(wav)],
                               check=True, capture_output=True, timeout=90)
                duration = wav_duration(wav)
                if not math.isfinite(duration) or not 0 < duration <= config["limits"]["maxAudioSeconds"]:
                    raise ValueError("decoded_audio_duration_out_of_bounds")
                with captured_alignment(model, duration, lambda a: np.asarray(a.astype(mx.float32)) if a.dtype != mx.int32 else np.asarray(a)) as state:
                    aligned = model.generate(str(wav), text=source["text"], language="German").segments
                timings = exact_display_timings(source["text"], aligned, duration)
                decision = state["decision"]
                temp_arrays = Path(temporary) / "arrays.npz"
                np.savez_compressed(temp_arrays, timestampLogits=state["timestampLogits"], inputIds=state["inputIdsArray"])
                result = {"provenance": provenance, "decoderVersion": DECODER_VERSION, "method": METHOD,
                          "accepted": decision["accepted"], "modelDecision": decision,
                          "timestampTokenId": state["timestampTokenId"], "timestampTokenPositions": state["timestampTokenPositions"],
                          "rawArgmaxMilliseconds": state["rawArgmaxMilliseconds"], "wordTimings": timings,
                          "actualDecodedDuration": duration, "decodedSampleRate": 24000, "leadInSeconds": 0, "rate": 1,
                          "rawLogitsSha256": array_sha256(state["timestampLogits"]),
                          "inputIdsSha256": array_sha256(state["inputIdsArray"]), "arraysSha256": sha256_file(temp_arrays),
                          "candidateOnly": True, "humanListening": False, "publicationAuthorized": False,
                          "thresholdsEmpiricallyCalibrated": False}
                if verified_source(args.manifest, identifier, entries[identifier], fingerprint) != source:
                    raise ValueError("source_changed_during_alignment")
                # Exclusive creation prevents replacing any existing candidate asset.
                with arrays_path.open("xb") as handle:
                    handle.write(temp_arrays.read_bytes())
                    handle.flush()
                    os.fsync(handle.fileno())
                result["receiptSha256"] = receipt_digest(result)
                temporary_receipt = Path(temporary) / "receipt.json"
                atomic_json(temporary_receipt, result)
                os.link(temporary_receipt, dest)  # Atomic publish, refuses any existing destination.
            completed += 1
            print(json.dumps({"completed": completed, "accepted": decision["accepted"], "candidate": str(dest)}), flush=True)
    return completed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--aligner-path", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--lock", type=Path, default=Path(os.environ.get("SITOV_QWEN_LOCK", str(Path.home() / ".cache/sitov-qwen/generation.lock"))))
    parser.add_argument("--ffmpeg")
    parser.add_argument("--id", action="append")
    args = parser.parse_args()
    print(json.dumps({"completed": run(args), "candidateOnly": True}))


if __name__ == "__main__":
    main()
