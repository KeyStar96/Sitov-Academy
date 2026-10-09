"""CPU-only integrity and constrained-path tests; no MLX/model/audio jobs."""
import itertools
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
import importlib.util
import fcntl
import sys
import wave

import numpy as np
from sitov_qwen_alignment import (decode_learned_timestamp_classes as decode, captured_alignment,
                                 exact_display_timings, verified_source, array_sha256,
                                 receipt_digest, verify_resume, DECODER_VERSION, METHOD)
from sitov_qwen_runtime import sha256_file
import hashlib


class DecoderTests(unittest.TestCase):
    def peaks(self):
        scores = np.full((4, 10), -15.)
        scores[np.arange(4), [1, 3, 3, 5]] = 4
        return scores

    def test_monotone_and_strong_nonmonotone_second_path(self):
        scores = self.peaks()
        self.assertEqual(decode(scores, .8)["classIndices"], [1, 3, 3, 5])
        scores[2, 7] = 5
        result = decode(scores, .8)
        self.assertTrue(result["accepted"])
        self.assertEqual(result["classIndices"], [1, 3, 3, 5])
        self.assertEqual(result["argmaxClassIndices"][2], 7)

    def test_global_optimum_matches_exhaustive_paths(self):
        rng = np.random.default_rng(2718)
        paths = [p for p in itertools.product(range(5), repeat=4) if p[0] < p[1] <= p[2] < p[3]]
        for _ in range(25):
            scores = rng.normal(size=(4, 5))
            result = decode(scores, 1)
            best = max(sum(scores[i, p[i]] for i in range(4)) for p in paths)
            chosen = result["classIndices"]
            self.assertAlmostEqual(sum(scores[i, chosen[i]] for i in range(4)), best)

    def test_ties_are_deterministic_and_strict(self):
        self.assertEqual(decode(np.zeros((4, 5)), 1)["classIndices"], [0, 1, 1, 2])

    def test_flat_and_missing_word_reject(self):
        self.assertFalse(decode(np.zeros((4, 5000)), .8)["accepted"])
        missing = np.full((4, 10), -40.)
        missing[:, 3] = 10
        self.assertFalse(decode(missing, .8)["accepted"])

    def test_audio_boundary_and_outside_mass(self):
        scores = self.peaks()
        result = decode(scores, .399999999)
        self.assertLessEqual(max(result["seconds"]), .399999999)
        scores[:, 9] = 100
        self.assertFalse(decode(scores, .4)["accepted"])
        with self.assertRaises(ValueError):
            decode(scores, .01)

    def test_invalid_shape_empty_odd_and_nonfinite(self):
        for scores in [[], np.zeros((0, 5)), np.zeros((3, 5)), np.zeros((4, 0)),
                       np.zeros((4, 1)), np.zeros((1, 4, 5)), [[0, float("nan")], [0, 1]],
                       [[0, float("inf")], [0, 1]]]:
            with self.subTest(shape=np.shape(scores)), self.assertRaises(ValueError):
                decode(scores, 1)

    def test_invalid_step_duration_and_thresholds(self):
        for name in ["duration_seconds", "step_seconds", "min_probability", "min_peak_ratio"]:
            for value in [-1, 0, float("nan"), float("inf")]:
                args = {"duration_seconds": 1, name: value}
                with self.subTest(name=name, value=value), self.assertRaises(ValueError):
                    decode(self.peaks(), **args)
        for name in ["min_probability", "min_peak_ratio"]:
            with self.assertRaises(ValueError):
                decode(self.peaks(), 1, **{name: 1.01})

    def test_threshold_boundary_inclusive(self):
        result = decode(self.peaks(), 1)
        self.assertTrue(decode(self.peaks(), 1, min_probability=result["minimumProbability"],
                               min_peak_ratio=result["minimumPeakRatio"])["accepted"])
        self.assertFalse(decode(self.peaks(), 1, min_probability=1)["accepted"])

    def test_exact_display_tokens_positive_and_bounded(self):
        aligned = [{"text": "Hallo", "start": .08, "end": .16}, {"text": "Welt", "start": .16, "end": .24}]
        self.assertEqual(len(exact_display_timings("Hallo , Welt!", aligned, .24)), 3)
        with self.assertRaises(ValueError):
            exact_display_timings("Anders Welt!", aligned, .24)
        with self.assertRaises(ValueError):
            exact_display_timings("Hallo Welt", [{**aligned[0], "end": .08}, aligned[1]], .24)
        with self.assertRaises(ValueError):
            exact_display_timings("Hallo Welt", aligned, .239)


class CaptureTests(unittest.TestCase):
    def model(self):
        class Processor:
            def parse_timestamp(self, words, times):
                raise AssertionError("vendor repair must not run")
        class Model:
            config = types.SimpleNamespace(timestamp_token_id=99, timestamp_segment_time=80)
            aligner_processor = Processor()
            def __call__(self, ids):
                scores = np.full((1, ids.shape[1], 10), -15., dtype=np.float32)
                for i, c in enumerate([1, 3, 3, 5]):
                    if i < ids.shape[1]:
                        scores[0, i, c] = 4
                return scores
        return Model()

    def test_capture_exact_logits_and_restore_after_failure(self):
        model = self.model()
        old_call = type(model).__call__
        old_parse = model.aligner_processor.parse_timestamp
        with self.assertRaisesRegex(RuntimeError, "stop"):
            with captured_alignment(model, .8, np.asarray) as state:
                model(np.array([[99, 99, 99, 99]]))
                spans = model.aligner_processor.parse_timestamp(["Hallo", "Welt"], np.array([80, 240, 240, 400]))
                self.assertEqual(len(spans), 2)
                self.assertEqual(state["timestampTokenPositions"], [0, 1, 2, 3])
                self.assertEqual(state["timestampLogits"].shape, (4, 10))
                raise RuntimeError("stop")
        self.assertIs(type(model).__call__, old_call)
        self.assertEqual(model.aligner_processor.parse_timestamp, old_parse)
        self.assertNotIn("parse_timestamp", vars(model.aligner_processor))

    def test_missing_tokens_bad_shape_and_argmax_reject(self):
        for ids, raw in [(np.array([[99, 99, 99, 0]]), [80, 240, 240, 400]),
                         (np.array([99, 99, 99, 99]), [80, 240, 240, 400]),
                         (np.array([[99, 99, 99, 99]]), [80, 240, 240, 480])]:
            model = self.model()
            with captured_alignment(model, .8, np.asarray):
                if ids.ndim == 1:
                    with self.assertRaises((ValueError, IndexError)):
                        model(ids)
                else:
                    model(ids)
                    with self.assertRaises(ValueError):
                        model.aligner_processor.parse_timestamp(["Hallo", "Welt"], np.array(raw))

    def test_logits_batch_sequence_and_class_shape(self):
        for shape in [(4, 10), (2, 4, 10), (1, 3, 10), (1, 4, 0)]:
            model = self.model()
            with patch.object(type(model), "__call__", return_value=np.zeros(shape, dtype=np.float32)):
                with captured_alignment(model, .8, np.asarray):
                    model(np.array([[99]*4]))
                    with self.assertRaises(ValueError):
                        model.aligner_processor.parse_timestamp(["Hallo", "Welt"], np.array([0]*4))


class IntegrityTests(unittest.TestCase):
    def test_candidate_cli_lock_provenance_resume_and_no_source_writes(self):
        spec = importlib.util.spec_from_file_location("sitov_candidate_cli", Path(__file__).with_name("sitov-qwen-align-prepared.py"))
        cli = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cli)
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            inputs = root / "inputs"
            inputs.mkdir()
            mp3, metadata, manifest = inputs/"a.mp3", inputs/"a.json", inputs/"manifest.json"
            mp3.write_bytes(b"source fixture")
            entry = {"status": "complete", "profileFingerprint": "profile", "text": "Hallo Welt",
                     "output": str(mp3), "metadata": str(metadata), "sha256": sha256_file(mp3),
                     "textSha256": hashlib.sha256(b"Hallo Welt").hexdigest()}
            metadata.write_text(json.dumps({**entry, "audioSha256": entry["sha256"]}))
            manifest.write_text(json.dumps({"profileFingerprint": "profile", "entries": {"a": entry}}))
            originals = {p: p.read_bytes() for p in [mp3, metadata, manifest]}
            args = types.SimpleNamespace(config=root/"config", manifest=manifest, id=None,
                                         output_dir=root/"candidates", lock=root/"generation.lock",
                                         aligner_path=root/"model", ffmpeg="fake")
            model = CaptureTests().model()
            def generate(*a, **kw):
                model(np.array([[99]*4], dtype=np.int32))
                spans = model.aligner_processor.parse_timestamp(["Hallo", "Welt"], np.array([80, 240, 240, 400]))
                return types.SimpleNamespace(segments=[{"text": x["text"], "start": x["start_time"]/1000, "end": x["end_time"]/1000} for x in spans])
            model.generate = generate
            loads = []
            def load(path):
                with args.lock.open("a+") as competing:
                    with self.assertRaises(BlockingIOError):
                        fcntl.flock(competing, fcntl.LOCK_EX | fcntl.LOCK_NB)
                loads.append(path)
                return model
            def ffmpeg(command, **kw):
                with wave.open(command[-1], "wb") as audio:
                    audio.setnchannels(1)
                    audio.setsampwidth(2)
                    audio.setframerate(24000)
                    audio.writeframes(b"\0\0"*24000)
            mlx = types.ModuleType("mlx")
            core = types.ModuleType("mlx.core")
            core.float32, core.int32 = np.float32, np.int32
            stt = types.ModuleType("mlx_audio.stt")
            stt.load = load
            with patch.dict(sys.modules, {"mlx": mlx, "mlx.core": core, "mlx_audio.stt": stt}), \
                    patch.object(cli, "load_profile", return_value=({"alignment": {"mlxRevision": "pinned"}, "limits": {"maxAudioSeconds": 300}}, None, None, "profile")), \
                    patch.object(cli, "validate_checkpoint"), patch.object(cli, "ffmpeg_binary", return_value="fake"), \
                    patch.object(cli.subprocess, "run", side_effect=ffmpeg), patch("builtins.print"):
                self.assertEqual(cli.run(args), 1)
                self.assertEqual(cli.run(args), 1)
                self.assertEqual(len(loads), 1)
            dest = next(args.output_dir.glob("*.json"))
            value = json.loads(dest.read_text())
            self.assertTrue(value["accepted"])
            self.assertFalse(value["publicationAuthorized"])
            self.assertEqual(value["provenance"]["modelRevision"], "pinned")
            self.assertEqual(value["wordTimings"], [{"start": .08, "end": .24}, {"start": .24, "end": .4}])
            self.assertEqual(originals, {p: p.read_bytes() for p in originals})

    def test_source_and_resume_tampering(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            mp3, metadata, manifest = root/"a.mp3", root/"a.json", root/"manifest.json"
            mp3.write_bytes(b"source MP3 fixture")
            entry = {"status": "complete", "profileFingerprint": "profile", "text": "Hallo Welt",
                     "output": "a.mp3", "metadata": "a.json", "sha256": sha256_file(mp3),
                     "textSha256": hashlib.sha256(b"Hallo Welt").hexdigest()}
            metadata.write_text(json.dumps({**entry, "audioSha256": entry["sha256"]}))
            manifest.write_text(json.dumps({"entries": {"a": entry}}))
            source = verified_source(manifest, "a", entry, "profile")
            candidate = root/"candidate.json"
            logits, ids = np.zeros((4, 10), dtype=np.float32), np.array([[99]*4], dtype=np.int64)
            np.savez_compressed(candidate.with_suffix(".npz"), timestampLogits=logits, inputIds=ids)
            result = {"provenance": source, "decoderVersion": DECODER_VERSION, "method": METHOD,
                      "arraysSha256": sha256_file(candidate.with_suffix(".npz")),
                      "rawLogitsSha256": array_sha256(logits), "inputIdsSha256": array_sha256(ids)}
            result["receiptSha256"] = receipt_digest(result)
            candidate.write_text(json.dumps(result))
            self.assertEqual(verify_resume(candidate, source), result)
            with self.assertRaises(ValueError):
                verify_resume(candidate, {**source, "metadataSha256": "changed"})
            candidate.write_text(json.dumps({**result, "accepted": True}))
            with self.assertRaises(ValueError):
                verify_resume(candidate, source)
            candidate.write_text(json.dumps(result))
            candidate.with_suffix(".npz").write_bytes(b"corrupt")
            with self.assertRaises(ValueError):
                verify_resume(candidate, source)
            mp3.write_bytes(b"changed source")
            with self.assertRaises(ValueError):
                verified_source(manifest, "a", entry, "profile")


if __name__ == "__main__":
    unittest.main()
