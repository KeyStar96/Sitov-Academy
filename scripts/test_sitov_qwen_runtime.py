import json
import subprocess
import tempfile
import types
import unittest
import wave
from pathlib import Path
from unittest.mock import patch
from sitov_qwen_runtime import DEFAULT_CONFIG, SitovQwenBatch, canonical_json, load_profile, map_word_timings, sha256_file, text_chunks


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


class SitovQwenNativeChunkTest(unittest.TestCase):
    """Exercise real disk receipts and WAV assembly without loading a voice model."""

    def setUp(self):
        import numpy as np
        self.np = np
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.runner = self.new_runner()
        self.core = types.ModuleType("mlx.core")
        self.core.random = types.SimpleNamespace(seed=lambda _: None)
        self.core.eval = lambda _: None
        self.core.clear_cache = lambda: None
        self.core.get_peak_memory = lambda: 0
        mlx = types.ModuleType("mlx")
        mlx.core = self.core
        mlx_audio = types.ModuleType("mlx_audio")
        tts = types.ModuleType("mlx_audio.tts")
        utils = types.ModuleType("mlx_audio.tts.utils")
        self.model = self.Model(self.np)
        utils.load_model = lambda _: self.model
        tts.utils = utils
        mlx_audio.tts = tts
        mocked = patch.dict("sys.modules", {"mlx": mlx, "mlx.core": self.core, "mlx_audio": mlx_audio,
                                           "mlx_audio.tts": tts, "mlx_audio.tts.utils": utils})
        mocked.start()
        self.addCleanup(mocked.stop)

    def new_runner(self, continue_on_error=False, chunk_limit=40, batch_size=4):
        runner = SitovQwenBatch.__new__(SitovQwenBatch)
        runner.config, runner.reference, runner.reference_text, _ = load_profile()
        # Tiny test chunks only; the production profile and its fingerprint stay unchanged.
        runner.config["limits"]["maxChunkCharacters"] = chunk_limit
        runner.fingerprint = "test-only-samples-never-publish"
        runner.output_dir = self.directory
        runner.model_path = self.directory / "fake-model"
        runner.batch_size = batch_size
        runner.continue_on_error = continue_on_error
        runner.manifest_path = self.directory / "manifest.json"
        runner.journal_path = self.directory / "progress.jsonl"
        runner.restore_progress()
        return runner

    class Model:
        def __init__(self, np, fail_after_first=False, rejected_text=None, duplicate=False):
            self.np, self.fail_after_first, self.rejected_text, self.duplicate = np, fail_after_first, rejected_text, duplicate
            self.batch_calls, self.individual_calls = [], []

        def values(self, text):
            amplitude = (sum(ord(character) for character in text) % 20 + 1) / 40
            return self.np.full(16, amplitude, dtype=self.np.float32)

        def batch_generate(self, **kwargs):
            self.batch_calls.append(kwargs)
            # The real API identifies each output explicitly; completion order is irrelevant.
            for count, index in enumerate(reversed(range(len(kwargs["texts"])))):
                if self.fail_after_first and count == 1:
                    raise RuntimeError("interrupted test batch")
                text = kwargs["texts"][index]
                if text == self.rejected_text:
                    continue
                result = types.SimpleNamespace(sequence_idx=index, audio=self.values(text), sample_rate=24000)
                yield result
                if self.duplicate:
                    yield result

        def generate(self, **kwargs):
            self.individual_calls.append(kwargs)
            if kwargs["text"] == self.rejected_text:
                raise RuntimeError("test chunk has no valid speech")
            yield types.SimpleNamespace(audio=self.values(kwargs["text"]), sample_rate=24000)

    def planned(self, text=None):
        return self.runner.plan([{"id": "long-row", "text": text or "Max fährt morgen zum Bahnhof. Danach trifft er seinen Bruder. Gemeinsam kaufen sie neue Fahrkarten. Am Abend gehen sie nach Hause."}])

    def spoken_texts(self):
        return [text for call in self.model.batch_calls for text in call["texts"]]

    def assert_wave_matches(self, row, specs):
        values = self.np.concatenate([self.model.values(spec["text"]) for spec in specs])
        expected = (values * 32767).astype("<i2").tobytes()
        with wave.open(row["raw"], "rb") as audio:
            self.assertEqual((audio.getframerate(), audio.getnchannels(), audio.getsampwidth()), (24000, 1, 2))
            self.assertEqual(audio.readframes(audio.getnframes()), expected)

    def test_long_rows_batch_independent_chunks_and_reassemble_out_of_order_results(self):
        planned = self.planned()
        specs = self.runner.native_chunk_specs(planned[0])
        self.assertGreater(len(specs), 1)
        self.runner.synthesize_native_batch(planned)
        self.assertCountEqual(self.spoken_texts(), [spec["text"] for spec in specs])
        self.assertEqual(self.model.individual_calls, [])
        for call in self.model.batch_calls:
            self.assertEqual(call["ref_audio"], str(self.runner.reference))
            self.assertEqual(call["ref_text"], self.runner.reference_text)
            self.assertEqual(call["lang_code"], "German")
            self.assertFalse(call["stream"])
            for key, value in self.runner.config["tts"]["generation"].items():
                self.assertEqual(call[key], value)
            self.assertTrue(all(len(text) <= 40 for text in call["texts"]))
        self.assert_wave_matches(planned[0], specs)
        self.assertEqual(self.runner.manifest["entries"]["long-row"]["chunks"], len(specs))
        self.assertEqual(self.runner.manifest["entries"]["long-row"]["status"], "raw")

    def test_interrupted_long_row_resumes_only_committed_missing_chunks_from_journal(self):
        planned = self.planned()
        self.model = self.Model(self.np, fail_after_first=True)
        with self.assertRaisesRegex(RuntimeError, "interrupted"):
            self.runner.synthesize_native_batch(planned)
        committed = self.runner.manifest["entries"]["long-row"]["nativeChunkRecords"]
        self.assertEqual(len(committed), 1)
        self.assertFalse(Path(planned[0]["raw"]).exists())
        self.runner = self.new_runner()
        self.model = self.Model(self.np)
        self.runner.synthesize_native_batch(planned)
        specs = self.runner.native_chunk_specs(planned[0])
        self.assertEqual(len(self.spoken_texts()), len(specs) - 1)
        self.assert_wave_matches(planned[0], specs)

    def test_corrupted_partial_chunk_is_regenerated_instead_of_reused(self):
        planned = self.planned()
        self.model = self.Model(self.np, fail_after_first=True)
        with self.assertRaises(RuntimeError):
            self.runner.synthesize_native_batch(planned)
        record = self.runner.manifest["entries"]["long-row"]["nativeChunkRecords"][0]
        Path(record["path"]).write_bytes(b"incomplete test samples")
        self.runner = self.new_runner()
        self.model = self.Model(self.np)
        self.runner.synthesize_native_batch(planned)
        specs = self.runner.native_chunk_specs(planned[0])
        self.assertEqual(len(self.spoken_texts()), len(specs))
        self.assert_wave_matches(planned[0], specs)

    def test_complete_chunks_recover_lost_raw_assembly_without_resynthesis(self):
        planned = self.planned()
        self.runner.synthesize_native_batch(planned)
        original = sha256_file(planned[0]["raw"])
        Path(planned[0]["raw"]).unlink()
        self.runner = self.new_runner()
        self.model = self.Model(self.np)
        self.runner.synthesize_native_batch(planned)
        self.assertEqual(self.spoken_texts(), [])
        self.assertEqual(sha256_file(planned[0]["raw"]), original)

    def test_missing_chunk_fails_only_its_recording_and_preserves_other_rows(self):
        self.runner.continue_on_error = True
        planned = self.planned() + self.runner.plan([{"id": "other-row", "text": "Daniel kommt am Freitag."}])
        rejected = self.runner.native_chunk_specs(planned[0])[0]["text"]
        self.model = self.Model(self.np, rejected_text=rejected)
        self.runner.synthesize_native_batch(planned)
        self.assertEqual(self.runner.manifest["entries"]["long-row"]["status"], "failed")
        self.assertFalse(Path(planned[0]["raw"]).exists())
        self.assertEqual(self.runner.manifest["entries"]["other-row"]["status"], "raw")
        self.assertEqual([call["text"] for call in self.model.individual_calls], [rejected])

    def test_duplicate_sequence_identity_is_rejected_without_assembling_wrong_speech(self):
        planned = self.planned()
        self.model = self.Model(self.np, duplicate=True)
        with self.assertRaisesRegex(RuntimeError, "sequence identity"):
            self.runner.synthesize_native_batch(planned)
        self.assertFalse(Path(planned[0]["raw"]).exists())

    def test_same_text_and_different_rates_share_raw_chunks_without_new_inference(self):
        text = self.planned()[0]["text"]
        planned = self.runner.plan([{"id": "native", "text": text, "rate": 1}, {"id": "slower", "text": text, "rate": 0.85}])
        self.runner.synthesize_native_batch(planned)
        specs = self.runner.native_chunk_specs(planned[0])
        self.assertEqual(len(self.spoken_texts()), len(specs))
        self.assertEqual(self.runner.manifest["entries"]["native"]["rawSha256"], self.runner.manifest["entries"]["slower"]["rawSha256"])
        self.assertEqual(self.runner.manifest["entries"]["slower"]["rate"], 0.85)

    def test_long_chunk_batches_keep_existing_four_sequence_memory_bound(self):
        self.runner = self.new_runner(chunk_limit=1200, batch_size=16)
        rows = [{"id": "short", "text": "Max kommt."}] + [{"id": f"long-{index}", "text": (f"Daniel {index} plant den Ausflug. " * 12).strip()} for index in range(7)]
        planned = self.runner.plan(rows)
        self.runner.synthesize_native_batch(planned)
        self.assertTrue(all(len(call["texts"]) <= 4 for call in self.model.batch_calls if any(len(text) > 250 for text in call["texts"])))


if __name__ == "__main__":
    unittest.main()
