"""Offline CPU/pipe safety tests; no Docker, database or network required."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

import table_hashes as subject


class RowHashTests(unittest.TestCase):
    def test_empty_matches_legacy_coalesce(self):
        self.assertEqual(subject.RowHasher().result()["md5"], "d41d8cd98f00b204e9800998ecf8427e")

    def test_pg_canonical_spacing_unicode_and_escapes_remain_exact(self):
        rows = ['{"a": "Grüße", "b": "\\\"quoted\\\"\\nnext"}'.encode(),
                b'{"number": 1.00, "unicode": "\\u00e4"}']
        expected = b'[' + b', '.join(rows) + b']'
        hasher = subject.RowHasher()
        for row in rows:
            hasher.feed(row)
        self.assertEqual(hasher.result()["md5"], hashlib.md5(expected).hexdigest())
        self.assertEqual(hasher.result()["sha256"], hashlib.sha256(expected).hexdigest())
        # Parsing and dumping would alter PostgreSQL numeric/escape/spacing bytes.
        self.assertNotEqual(expected, json.dumps([json.loads(r) for r in rows]).encode())

    def test_large_cpu_stream_keeps_no_row_collection(self):
        hasher = subject.RowHasher()
        expected = hashlib.md5()
        expected.update(b'[')
        for n in range(10000):
            row = ('{"n": %d, "text": "Deutsch"}' % n).encode()
            hasher.feed(row)
            if n:
                expected.update(b', ')
            expected.update(row)
        expected.update(b']')
        self.assertEqual(hasher.result()["md5"], expected.hexdigest())
        self.assertEqual(hasher.result()["rows"], 10000)
        self.assertFalse(any(isinstance(v, (list, bytearray)) for v in vars(hasher).values()))

    def test_invalid_json_fails_without_row_disclosure(self):
        with self.assertRaisesRegex(subject.TableHashError, "invalid canonical JSON") as result:
            subject.RowHasher().feed(b'{"secret": bad}')
        self.assertNotIn("secret", str(result.exception))


class ChildSafetyTests(unittest.TestCase):
    def run_child(self, script, **kwargs):
        hasher = subject.RowHasher()
        subject.stream_process([sys.executable, "-c", script], "", hasher.feed,
                               time.monotonic() + kwargs.pop("seconds", 2), **kwargs)
        return hasher.result()

    def test_nonempty_and_empty_pipe_success(self):
        self.assertEqual(self.run_child('print("{}")')["rows"], 1)
        self.assertEqual(self.run_child('pass')["rows"], 0)

    def test_nonzero_after_valid_row_rejects_partial_digest_and_hides_stderr(self):
        with self.assertRaisesRegex(subject.TableHashError, "child failed") as result:
            self.run_child('import sys; print("{}"); print("PRIVATE",file=sys.stderr);sys.exit(7)')
        self.assertNotIn("PRIVATE", str(result.exception))

    def test_stalled_open_stdout_is_killed_before_eof(self):
        start = time.monotonic()
        with self.assertRaisesRegex(subject.TableHashError, "deadline"):
            self.run_child('import time;print("{}",flush=True);time.sleep(30)', seconds=0.15)
        self.assertLess(time.monotonic() - start, 2)

    def test_no_spawn_after_whole_deadline(self):
        with patch.object(subject.subprocess, "Popen") as spawn:
            with self.assertRaises(subject.TableHashError):
                subject.stream_process([], "", lambda _: None, time.monotonic() - 1)
            spawn.assert_not_called()

    def test_oversized_unterminated_line_and_total_stderr_are_bounded(self):
        for script, limits in [('print("x"*1024,end="",flush=True)', {"row_limit": 32}),
                               ('import sys;sys.stderr.write("x"*1024)', {"total_limit": 32})]:
            with self.subTest(script=script), self.assertRaisesRegex(subject.TableHashError, "byte limit"):
                self.run_child(script, **limits)

    def test_unterminated_row_is_not_accepted(self):
        with self.assertRaisesRegex(subject.TableHashError, "unterminated"):
            self.run_child('print("{}",end="")')


class BindingTests(unittest.TestCase):
    def test_identifier_injection_and_wrong_inventory_fail_closed(self):
        for name in ['public.x;DROP TABLE x', 'public."x"', 'x', 'a.b.c', 'pg_catalog.x\n']:
            with self.subTest(name=name), self.assertRaises(subject.TableHashError):
                subject.qualified_table(name)
        expected = {f"public.t{n}": "d41d8cd98f00b204e9800998ecf8427e" for n in range(188)}
        subject.validate_inventory(list(expected), expected)
        with self.assertRaises(subject.TableHashError):
            subject.validate_inventory(list(expected)[:-1] + ['public.unexpected'], expected)

    def test_expected_file_must_match_hash_and_exact188(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'expected.json'
            path.write_text(json.dumps({"actual": {f"public.t{n}": "d41d8cd98f00b204e9800998ecf8427e" for n in range(188)}}))
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            self.assertEqual(len(subject.load_expected(path, digest)), 188)
            with self.assertRaises(subject.TableHashError):
                subject.load_expected(path, '0' * 64)
            path.write_text('{"actual": {}}')
            with self.assertRaises(subject.TableHashError):
                subject.load_expected(path, hashlib.sha256(path.read_bytes()).hexdigest())

    def test_runtime_hash_binding_rejects_modified_guard(self):
        with patch.object(subject, "RUNTIME_SHA256", "0" * 64):
            with self.assertRaisesRegex(subject.TableHashError, "runtime binding"):
                subject.pinned_runtime()

    def test_whole_timer_bounds_non_stream_guard_work(self):
        with self.assertRaisesRegex(subject.TableHashError, "whole operation"):
            with subject.operation_timer(1):
                time.sleep(3)


if __name__ == "__main__":
    unittest.main()
