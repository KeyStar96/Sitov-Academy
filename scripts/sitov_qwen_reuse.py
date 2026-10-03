"""Adopt byte-identical prepared assets after generation; never load a model."""
from __future__ import annotations

from datetime import datetime, timezone
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import tempfile
import uuid
import wave

from sitov_qwen_runtime import DEFAULT_CONFIG, canonical_json, load_profile, map_word_timings, normalize_text, sha256_file


def safe_file(root, value):
    path = Path(value)
    if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(root):
        raise ValueError("Prepared file is missing, linked, or outside its manifest directory.")
    return path.resolve()


def safe_destination(root, value):
    path = Path(value)
    if path.is_symlink() or not path.parent.is_dir() or not path.resolve().is_relative_to(root) or path.exists() and not path.is_file():
        raise ValueError("Recovery destination is linked, outside the manifest directory, or not a file.")
    return path.resolve()


def expected_address(text, profile, fingerprint):
    identity = {"text": text, "voice": profile["voice"], "rate": "qwen-native-1-lufs-18-aligned-v1",
                "format": "audio-24khz-48kbitrate-mono-mp3", "leadIn": profile["output"]["leadInSeconds"], "profile": fingerprint}
    digest = hashlib.sha256(json.dumps(identity, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return f"sitov-qwen-v1/de/{digest}.mp3"


def read_manifest(path, profile, fingerprint):
    path = Path(path).resolve()
    value = json.loads(path.read_text())
    if any(value.get(key) != profile[key] for key in ("engine", "voice", "revision")) or value.get("profileFingerprint") != fingerprint or not isinstance(value.get("entries"), dict):
        raise ValueError("Prepared manifest differs from the canonical Qwen profile.")
    return value


def validate_prepared(entry, row, root, profile, fingerprint):
    text = normalize_text(row["text"])
    item = hashlib.sha256(canonical_json({"profile": fingerprint, "text": text, "rate": 1.0}).encode()).hexdigest()
    if row["cachePath"] != expected_address(text, profile, fingerprint) or row["id"] != row["cachePath"].split("/")[-1][:-4]:
        raise ValueError("Catalog address does not match the exact canonical text.")
    if not isinstance(entry, dict) or entry.get("status") != "complete" or any(entry.get(key) != row[key] for key in ("id", "text", "cachePath")) or entry.get("itemFingerprint") != item or entry.get("rate") != 1:
        raise ValueError(f"Unfinished or mismatched prepared entry: {row['id']}")
    paths = {key: safe_file(root, entry[key]) for key in ("raw", "output", "metadata")}
    metadata = json.loads(paths["metadata"].read_text())
    audio = paths["output"].read_bytes()
    raw_hash, audio_hash = sha256_file(paths["raw"]), hashlib.sha256(audio).hexdigest()
    if not 100 <= len(audio) <= 2 * 1024 * 1024 or not (audio.startswith(b"ID3") or audio[0] == 255 and audio[1] & 224 == 224):
        raise ValueError("Prepared audio is not a bounded MP3.")
    for value in (entry, metadata):
        if value.get("rawSha256") != raw_hash or value.get("audioSha256") != audio_hash or value.get("sha256") != audio_hash:
            raise ValueError("Prepared raw/MP3 checksum mismatch.")
    required = {"status": "complete", "rate": 1, "engine": profile["engine"], "voice": profile["voice"], "revision": profile["revision"],
                "profileFingerprint": fingerprint, "textSha256": hashlib.sha256(text.encode()).hexdigest(),
                "modelRevision": profile["tts"]["mlxRevision"], "referenceSha256": profile["reference"]["audioSha256"],
                "sourceModel": profile["tts"]["sourceModel"], "mlxModel": profile["tts"]["mlxModel"],
                "alignmentModel": profile["alignment"], "sampleRate": profile["output"]["sampleRate"],
                "bitrate": profile["output"]["bitRate"], "channels": profile["output"]["channels"]}
    if any(metadata.get(key) != value for key, value in required.items()) or any(metadata.get(key) != row[key] for key in ("id", "text", "cachePath")):
        raise ValueError("Prepared metadata profile, provenance, or text differs.")
    with wave.open(str(paths["raw"]), "rb") as raw:
        if raw.getnchannels() != 1 or raw.getframerate() != 24000 or raw.getsampwidth() != 2:
            raise ValueError("Prepared raw audio must be mono 24 kHz PCM16.")
        seconds = raw.getnframes() / raw.getframerate()
    if not 0 < seconds <= profile["limits"]["maxAudioSeconds"] or abs(seconds - metadata.get("rawSeconds", -1)) > 1 / 24000:
        raise ValueError("Prepared raw duration differs.")
    measured = map_word_timings(text, metadata.get("rawAlignedWords", []), seconds, profile["output"]["leadInSeconds"])
    if metadata.get("wordTimings") != measured or entry.get("wordTimings") != measured:
        raise ValueError("Prepared word timings differ from the learned raw boundaries.")
    measurement = metadata.get("normalization", {}).get("measurement", {})
    if not all(math.isfinite(float(measurement.get(key, "nan"))) for key in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")):
        raise ValueError("Prepared normalization has no finite measurement.")
    return paths, metadata, audio


def atomic_bytes(path, value):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".sitov-reuse-", delete=False) as temporary:
        temporary_path = Path(temporary.name)
        temporary.write(value)
        temporary.flush()
        os.fsync(temporary.fileno())
    try:
        temporary_path.replace(path)
        descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        temporary_path.unlink(missing_ok=True)


def recover_reuse(target_manifest, lock_path, config_path=DEFAULT_CONFIG):
    target = Path(target_manifest).resolve()
    root = target.parent
    profile, _, _, fingerprint = load_profile(config_path)
    with Path(lock_path).open("a+") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Generation lock is busy; retry after the active preparation ends.") from None
        marker = root / ".sitov-qwen-reuse-transaction.json"
        record = json.loads(safe_file(root, marker).read_text())
        if record.get("profileFingerprint") != fingerprint or record.get("manifest") != str(target):
            raise ValueError("Recovery record differs from this manifest/profile.")
        restore = []
        for item in record["files"]:
            destination, backup = safe_destination(root, item["target"]), safe_file(root, item["backup"])
            value = backup.read_bytes()
            if hashlib.sha256(value).hexdigest() != item["backupSha256"]:
                raise ValueError("Recovery backup checksum differs; nothing restored.")
            restore.append((destination, value))
        for destination, value in restore:
            atomic_bytes(destination, value)
        marker.unlink()
    return {"recovered": len(restore), "manifest": str(target)}


def reuse_prepared_assets(source_manifest, target_manifest, catalog_path, lock_path, apply=False, config_path=DEFAULT_CONFIG):
    profile, _, _, fingerprint = load_profile(config_path)
    source_path, target_path = Path(source_manifest).resolve(), Path(target_manifest).resolve()
    if source_path == target_path:
        raise ValueError("Source and target manifests must be different.")
    root = target_path.parent
    with Path(lock_path).open("a+") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError("Generation lock is busy; retry after the active preparation ends.") from None
        marker = root / ".sitov-qwen-reuse-transaction.json"
        if marker.exists():
            raise ValueError("Incomplete reuse transaction: run --recover before continuing.")
        journal = root / "sitov-qwen-progress.jsonl"
        if journal.exists() and journal.read_text().strip():
            raise ValueError("Target has uncheckpointed generation progress; finish its preparation first.")
        source = read_manifest(source_path, profile, fingerprint)
        target = read_manifest(target_path, profile, fingerprint)
        catalog = json.loads(Path(catalog_path).read_text())
        if catalog.get("profileFingerprint") != fingerprint or not isinstance(catalog.get("rows"), list) or not catalog["rows"]:
            raise ValueError("Current complete catalog required.")
        # Older complete catalogs omitted this field. Delta/unknown scopes must
        # never authorize adoption into the initial complete production corpus.
        if catalog.get("preparationScope", "full") != "full":
            raise ValueError("Reuse requires a full catalog; missing-only or unknown preparation scopes are refused.")
        rows = {row["id"]: row for row in catalog["rows"]}
        if len(rows) != len(catalog["rows"]) or not source["entries"] or not set(source["entries"]).issubset(rows):
            raise ValueError("Duplicate catalog IDs or reuse source outside the current catalog.")
        if set(target["entries"]) != set(rows):
            raise ValueError("The complete catalog must match every target manifest ID exactly.")
        # Every target item must already be completed. No partial corpus becomes
        # publishable simply because a handful of immutable assets were copied.
        validated_target = {identifier: validate_prepared(target["entries"].get(identifier), row, root, profile, fingerprint)[0]
                            for identifier, row in rows.items()}
        planned = []
        now = datetime.now(timezone.utc).isoformat()
        for identifier, entry in source["entries"].items():
            source_files, metadata, audio = validate_prepared(entry, rows[identifier], source_path.parent, profile, fingerprint)
            destination = validated_target[identifier]
            details = {**metadata, **rows[identifier], **{key: str(path) for key, path in destination.items()},
                       "itemFingerprint": target["entries"][identifier]["itemFingerprint"],
                       "reusedAt": now, "reusedFrom": {"manifest": str(source_path), "audioSha256": metadata["audioSha256"], "rawSha256": metadata["rawSha256"]}}
            planned.extend([(destination["raw"], source_files["raw"].read_bytes()),
                            (destination["output"], audio),
                            (destination["metadata"], (json.dumps(details, ensure_ascii=False, indent=2) + "\n").encode())])
            target["entries"][identifier] = details
        if len({str(path) for path, _ in planned}) != len(planned):
            raise ValueError("Reuse targets overlap; nothing copied.")
        result = {"validatedSource": len(source["entries"]), "completedTargetCatalog": len(rows),
                  "profileFingerprint": fingerprint, "applied": bool(apply), "manifest": str(target_path)}
        if not apply:
            return result
        planned.append((target_path, (json.dumps(target, ensure_ascii=False, indent=2) + "\n").encode()))
        # Validate all inputs above; retain original bytes for rollback before
        # the first target replacement. The manifest is replaced last.
        backup_root = root / ".sitov-qwen-reuse-backups" / uuid.uuid4().hex
        backup_root.mkdir(parents=True, mode=0o700)
        transaction = {"profileFingerprint": fingerprint, "manifest": str(target_path), "files": []}
        for index, (destination, _) in enumerate(planned):
            original = destination.read_bytes()
            backup = backup_root / str(index)
            atomic_bytes(backup, original)
            transaction["files"].append({"target": str(destination), "backup": str(backup), "backupSha256": hashlib.sha256(original).hexdigest()})
        atomic_bytes(marker, (json.dumps(transaction, ensure_ascii=False, indent=2) + "\n").encode())
        try:
            for destination, incoming in planned:
                atomic_bytes(destination, incoming)
            marker.unlink()
        except BaseException:
            # Ordinary failures roll back immediately. A hard process stop
            # leaves the verified backup record for the explicit --recover CLI.
            for item in transaction["files"]:
                atomic_bytes(Path(item["target"]), Path(item["backup"]).read_bytes())
            marker.unlink()
            raise
        result["backup"] = str(backup_root)
        return result
