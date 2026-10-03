"""Reuse tests use tiny synthetic fixtures and never load a speech model."""
import fcntl
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave

import sitov_qwen_reuse as reuse
from sitov_qwen_runtime import canonical_json, load_profile, map_word_timings, sha256_file


class SitovQwenReuseTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.profile, _, _, self.fingerprint = load_profile()
        self.lock = self.root / "generation.lock"
        self.rows = []
        for index, text in enumerate(("Der Kaffee.", "Ein Brot.")):
            cache_path = reuse.expected_address(text, self.profile, self.fingerprint)
            self.rows.append({"id": cache_path.split("/")[-1][:-4], "text": text, "cachePath": cache_path,
                              "sources": [f"final-source:{index}"]})
        self.catalog = self.root / "catalog.json"
        self.catalog.write_text(json.dumps({"profileFingerprint": self.fingerprint, "rows": self.rows}))
        self.source = self.make_manifest("source", self.rows, 1)
        self.target = self.make_manifest("target", self.rows, 2)

    def make_manifest(self, name, rows, fill):
        directory = self.root / name
        directory.mkdir()
        value = {key: self.profile[key] for key in ("engine", "voice", "revision")}
        value.update(profileFingerprint=self.fingerprint, entries={})
        for row in rows:
            raw, output, metadata = [directory / f"{row['id']}.{extension}" for extension in ("wav", "mp3", "json")]
            with wave.open(str(raw), "wb") as handle:
                handle.setparams((1, 2, 24000, 0, "NONE", "not compressed"))
                handle.writeframes(bytes([fill, 0]) * 24000)
            audio = b"ID3" + bytes([fill]) * 200
            output.write_bytes(audio)
            learned = [{"text": token.rstrip("."), "start": .1 + index * .3, "end": .3 + index * .3}
                       for index, token in enumerate(row["text"].split())]
            details = {**row, **value, "rate": 1.0, "status": "complete", "output": str(output),
                       "metadata": str(metadata), "raw": str(raw), "rawSha256": sha256_file(raw), "rawSeconds": 1.0,
                       "audioSha256": hashlib.sha256(audio).hexdigest(), "sha256": hashlib.sha256(audio).hexdigest(),
                       "textSha256": hashlib.sha256(row["text"].encode()).hexdigest(),
                       "itemFingerprint": hashlib.sha256(canonical_json({"profile": self.fingerprint, "text": row["text"], "rate": 1.0}).encode()).hexdigest(),
                       "sourceModel": self.profile["tts"]["sourceModel"], "mlxModel": self.profile["tts"]["mlxModel"],
                       "modelRevision": self.profile["tts"]["mlxRevision"], "referenceSha256": self.profile["reference"]["audioSha256"],
                       "alignmentModel": self.profile["alignment"], "sampleRate": 24000, "bitrate": "48k", "channels": 1,
                       "rawAlignedWords": learned, "wordTimings": map_word_timings(row["text"], learned, 1.0),
                       "normalization": {"measurement": {key: "0" for key in ("input_i", "input_tp", "input_lra", "input_thresh", "target_offset")}}}
            details.pop("entries")
            metadata.write_text(json.dumps(details))
            value["entries"][row["id"]] = details
        manifest = directory / "sitov-qwen-manifest.json"
        manifest.write_text(json.dumps(value))
        return manifest

    def invoke(self, apply=False):
        return reuse.reuse_prepared_assets(self.source, self.target, self.catalog, self.lock, apply)

    def snapshot(self):
        return {str(path.relative_to(self.target.parent)): path.read_bytes() for path in self.target.parent.iterdir() if path.is_file()}

    def test_dry_run_then_apply_preserve_exact_source_bytes_and_final_sources(self):
        before = self.snapshot()
        self.assertFalse(self.invoke()["applied"])
        self.assertEqual(self.snapshot(), before)
        source = json.loads(self.source.read_text())
        source["entries"][self.rows[0]["id"]]["sources"] = ["old-pilot-source"]
        self.source.write_text(json.dumps(source))
        self.assertTrue(self.invoke(True)["applied"])
        target = json.loads(self.target.read_text())
        for row in self.rows:
            entry = target["entries"][row["id"]]
            for key in ("raw", "output"):
                self.assertEqual(Path(entry[key]).read_bytes(), Path(source["entries"][row["id"]][key]).read_bytes())
            self.assertEqual(entry["sources"], row["sources"])
            self.assertEqual(entry, json.loads(Path(entry["metadata"]).read_text()))
            self.assertTrue(Path(entry["raw"]).is_relative_to(self.target.parent))
        self.assertFalse((self.target.parent / ".sitov-qwen-reuse-transaction.json").exists())
        self.assertEqual(self.invoke()["completedTargetCatalog"], 2)

    def test_every_input_is_checked_before_any_target_mutation(self):
        before = self.snapshot()
        source = json.loads(self.source.read_text())
        late = source["entries"][self.rows[-1]["id"]]
        Path(late["output"]).write_bytes(b"ID3" + b"corrupt" * 30)
        with self.assertRaisesRegex(ValueError, "checksum"):
            self.invoke(True)
        self.assertEqual(self.snapshot(), before)
        self.assertFalse((self.target.parent / ".sitov-qwen-reuse-backups").exists())

    def test_pilot_subset_preserves_other_complete_assets_and_requires_a_clean_journal(self):
        source = json.loads(self.source.read_text())
        untouched = source["entries"].pop(self.rows[-1]["id"])
        self.source.write_text(json.dumps(source))
        target_entry = json.loads(self.target.read_text())["entries"][untouched["id"]]
        before = {key: Path(target_entry[key]).read_bytes() for key in ("raw", "output", "metadata")}
        journal = self.target.parent / "sitov-qwen-progress.jsonl"
        journal.write_text('{"pending":"checkpoint"}\n')
        with self.assertRaisesRegex(ValueError, "uncheckpointed"):
            self.invoke(True)
        journal.write_text("")
        self.assertEqual(self.invoke(True)["validatedSource"], 1)
        for key, value in before.items():
            self.assertEqual(Path(target_entry[key]).read_bytes(), value)

    def test_incomplete_target_and_non_native_rate_are_refused(self):
        target = json.loads(self.target.read_text())
        target["entries"][self.rows[-1]["id"]]["status"] = "raw"
        self.target.write_text(json.dumps(target))
        with self.assertRaisesRegex(ValueError, "Unfinished"):
            self.invoke(True)
        target["entries"][self.rows[-1]["id"]]["status"] = "complete"
        self.target.write_text(json.dumps(target))
        source = json.loads(self.source.read_text())
        entry = source["entries"][self.rows[0]["id"]]
        metadata = json.loads(Path(entry["metadata"]).read_text())
        metadata["rate"] = .5
        Path(entry["metadata"]).write_text(json.dumps(metadata))
        with self.assertRaisesRegex(ValueError, "metadata"):
            self.invoke(True)
        metadata["rate"] = 1
        Path(entry["metadata"]).write_text(json.dumps(metadata))
        entry["rate"] = .5
        self.source.write_text(json.dumps(source))
        with self.assertRaisesRegex(ValueError, "Unfinished"):
            self.invoke(True)

    def test_active_generation_lock_refuses_without_mutation(self):
        before = self.snapshot()
        with self.lock.open("a+") as lock:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            with self.assertRaisesRegex(ValueError, "lock is busy"):
                self.invoke(True)
        self.assertEqual(self.snapshot(), before)

    def test_missing_only_unknown_and_null_catalog_scopes_are_refused_before_mutation(self):
        catalog = json.loads(self.catalog.read_text())
        before = self.snapshot()
        for scope in ("missing-only", "unknown", None):
            catalog["preparationScope"] = scope
            self.catalog.write_text(json.dumps(catalog))
            with self.assertRaisesRegex(ValueError, "full catalog"):
                self.invoke(True)
            self.assertEqual(self.snapshot(), before)
        catalog["preparationScope"] = "full"
        self.catalog.write_text(json.dumps(catalog))
        self.assertEqual(self.invoke()["completedTargetCatalog"], 2)

    def test_every_target_manifest_id_must_match_the_full_catalog_including_extra_raw_entries(self):
        target = json.loads(self.target.read_text())
        target["entries"]["extra-unfinished"] = {"status": "raw"}
        self.target.write_text(json.dumps(target))
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "every target manifest ID"):
            self.invoke(True)
        self.assertEqual(self.snapshot(), before)
        target["entries"].pop("extra-unfinished")
        self.target.write_text(json.dumps(target))
        catalog = json.loads(self.catalog.read_text())
        catalog["rows"].pop()
        self.catalog.write_text(json.dumps(catalog))
        # Keep the pilot a valid subset so the exact target/catalog set guard
        # itself, rather than the separate pilot subset guard, rejects this case.
        source = json.loads(self.source.read_text())
        source["entries"].pop(self.rows[-1]["id"])
        self.source.write_text(json.dumps(source))
        with self.assertRaisesRegex(ValueError, "every target manifest ID"):
            self.invoke(True)

    def test_copy_failure_rolls_back_all_existing_files(self):
        before = self.snapshot()
        original = reuse.atomic_bytes
        failures = []
        def fail_once(path, value):
            if path.parent == self.target.parent and path.suffix == ".mp3" and not failures:
                failures.append(path)
                raise OSError("simulated replacement failure")
            return original(path, value)
        with patch.object(reuse, "atomic_bytes", side_effect=fail_once):
            with self.assertRaisesRegex(OSError, "simulated"):
                self.invoke(True)
        self.assertEqual(self.snapshot(), before)

    def test_recovery_validates_all_backups_before_restore_and_handles_missing_target(self):
        backup = self.target.parent / "backup"
        backup.write_bytes(self.target.read_bytes())
        marker = self.target.parent / ".sitov-qwen-reuse-transaction.json"
        record = {"profileFingerprint": self.fingerprint, "manifest": str(self.target), "files": [
            {"target": str(self.target), "backup": str(backup), "backupSha256": "wrong"}]}
        marker.write_text(json.dumps(record))
        before = self.target.read_bytes()
        with self.assertRaisesRegex(ValueError, "checksum"):
            reuse.recover_reuse(self.target, self.lock)
        self.assertEqual(self.target.read_bytes(), before)
        record["files"][0]["backupSha256"] = sha256_file(backup)
        marker.write_text(json.dumps(record))
        self.target.unlink()
        self.assertEqual(reuse.recover_reuse(self.target, self.lock)["recovered"], 1)
        self.assertEqual(self.target.read_bytes(), before)
        self.assertFalse(marker.exists())


if __name__ == "__main__":
    unittest.main()
