import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from sitov_qwen_runtime import DEFAULT_CONFIG, SitovQwenBatch, canonical_json, load_profile, map_word_timings, text_chunks


class SitovQwenIdentityAndTimingTest(unittest.TestCase):
    def test_python_and_javascript_profile_fingerprints_match(self):
        js = "const fs=require('fs');const crypto=require('crypto');const sort=v=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;console.log(crypto.createHash('sha256').update(JSON.stringify(sort(JSON.parse(fs.readFileSync(process.argv[1],'utf8'))))).digest('hex'));"
        javascript = subprocess.check_output(["node", "-e", js, str(DEFAULT_CONFIG)], text=True).strip()
        self.assertEqual(load_profile()[3], javascript)
        self.assertEqual(javascript, "96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5")

    def test_only_learned_word_boundaries_reach_media_timeline(self):
        learned = [{"text": "Ich", "start": 0.1, "end": 0.3}, {"text": "komme", "start": 0.35, "end": 0.8}]
        self.assertEqual(map_word_timings("Ich — komme.", learned, 1, 0.35, 0.5), [{"start": 0.55, "end": 0.95}, {"start": 0.95, "end": 0.95}, {"start": 1.05, "end": 1.95}])
        with self.assertRaises(ValueError):
            map_word_timings("Ich komme heute.", learned, 1)
        with self.assertRaises(ValueError):
            map_word_timings("Ich komme.", [{"text": "Ich", "start": 0.1, "end": 0.5}, {"text": "komme", "start": 0.4, "end": 0.8}], 1)

    def test_grid_collapsed_span_is_preserved_without_estimated_duration(self):
        self.assertEqual(map_word_timings("in", [{"text": "in", "start": 0.16, "end": 0.16}], 1), [{"start": 0.51, "end": 0.51}])

    def test_chunking_preserves_authored_words_and_punctuation(self):
        text = "Ich komme morgen. Danach gehe ich nach Hause und trinke Tee."
        self.assertEqual(" ".join(text_chunks(text, 25)), text)

    def test_progress_recovers_committed_rows_and_repairs_interrupted_tail(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = SitovQwenBatch.__new__(SitovQwenBatch)
            runner.config = {"engine": "qwen3-tts", "voice": "male", "revision": "test"}
            runner.fingerprint = "selected-profile"
            runner.manifest_path = Path(directory) / "manifest.json"
            runner.journal_path = Path(directory) / "progress.jsonl"
            runner.restore_progress()
            runner.save(force=True)
            runner.set_entry("first", {"status": "raw"})
            runner.save()
            self.assertNotIn("first", json.loads(runner.manifest_path.read_text())["entries"])
            with runner.journal_path.open("ab") as journal:
                journal.write(b'{"interrupted":')
            runner.restore_progress()
            self.assertEqual(runner.manifest["entries"]["first"]["status"], "raw")
            runner.set_entry("second", {"status": "complete"})
            runner.restore_progress()
            self.assertEqual(set(runner.manifest["entries"]), {"first", "second"})
            runner.save(force=True)
            self.assertEqual(runner.journal_path.read_bytes(), b"")
            runner.restore_progress()
            self.assertEqual(runner.manifest["entries"]["second"]["status"], "complete")

    def test_open_reuse_transaction_blocks_restore_before_any_manifest_or_journal_read(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = SitovQwenBatch.__new__(SitovQwenBatch)
            runner.manifest_path = Path(directory) / "manifest.json"
            runner.journal_path = Path(directory) / "progress.jsonl"
            runner.manifest_path.write_text('not yet a readable manifest')
            runner.journal_path.write_bytes(b'{"uncheckpointed":')
            marker = Path(directory) / ".sitov-qwen-reuse-transaction.json"
            marker.write_text('{}')
            original = (runner.manifest_path.read_bytes(), runner.journal_path.read_bytes())
            with self.assertRaisesRegex(ValueError, "--recover"):
                runner.restore_progress()
            self.assertEqual((runner.manifest_path.read_bytes(), runner.journal_path.read_bytes()), original)


if __name__ == "__main__":
    unittest.main()
