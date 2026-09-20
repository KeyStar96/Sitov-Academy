#!/usr/bin/env python3
"""Exact-byte configuration patch tests; no production access or subprocesses."""
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'patch-storage-upload-limit.py'
SPEC = importlib.util.spec_from_file_location('sitov_storage_limit', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
RUNTIME = {'Memory': 402653184, 'MemorySwap': 402653184, 'NanoCpus': 1000000000}
CONFIG = b'''services:
  other-service:
    environment:
      UPLOAD_FILE_SIZE_LIMIT: '524288000'
    mem_limit: 1536m
    cpus: 2
  supabase-storage:
    environment:
      SECRET: 'do-not-print-or-change'
      UPLOAD_FILE_SIZE_LIMIT: '524288000' # preserve comment
      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"
    mem_limit: 384m
    cpus: 1
    deploy:
      resources:
        limits:
          memory: 384M
          cpus: '1.0'
  final-service:
    mem_limit: 512m
    cpus: 0.5
volumes:
  retained: {}
'''


class StorageUploadLimitTests(unittest.TestCase):
    def test_only_two_storage_numeric_values_change_and_caps_are_byte_identical(self):
        changed, report = MODULE.patch_content(CONFIG, RUNTIME)
        expected = CONFIG.replace(b"'524288000' #", b"'536870912' #").replace(b'"524288000"', b'"536870912"')
        expected = expected.replace(b'    mem_limit: 384m\n', b'    mem_limit: 384m\n    memswap_limit: 402653184\n')
        self.assertEqual(changed, expected)
        self.assertEqual(MODULE.ram_cpu_caps(changed), MODULE.ram_cpu_caps(CONFIG))
        self.assertEqual(report['ram_cpu_limits_original_sha256'], report['ram_cpu_limits_final_sha256'])
        self.assertEqual(report['storage_memswap'], {'before_bytes': None, 'after_bytes': 402653184, 'added': True})
        self.assertEqual(report['before'], {'UPLOAD_FILE_SIZE_LIMIT': 524288000, 'UPLOAD_FILE_SIZE_LIMIT_STANDARD': 524288000})
        self.assertNotIn('do-not-print', str(report))

    def test_idempotence_and_line_endings_are_preserved(self):
        changed, _ = MODULE.patch_content(CONFIG.replace(b'\n', b'\r\n'), RUNTIME)
        repeated, report = MODULE.patch_content(changed, RUNTIME)
        self.assertEqual(changed, repeated)
        self.assertFalse(report['changed'])
        self.assertEqual(changed.count(b'\r\n'), CONFIG.count(b'\n') + 1)

    def test_existing_equivalent_swap_is_preserved_and_unexpected_live_or_configured_caps_abort(self):
        configured = CONFIG.replace(b'    mem_limit: 384m\n', b'    mem_limit: 384m\n    memswap_limit: "384m" # existing cap\n')
        changed, report = MODULE.patch_content(configured, RUNTIME)
        self.assertIn(b'    memswap_limit: "384m" # existing cap\n', changed)
        self.assertFalse(report['storage_memswap']['added'])
        for invalid in (0, -1, 805306368):
            with self.subTest(live_swap=invalid), self.assertRaises(RuntimeError):
                MODULE.patch_content(CONFIG, dict(RUNTIME, MemorySwap=invalid))
        for key in ('Memory',):
            with self.assertRaises(RuntimeError):
                MODULE.patch_content(CONFIG, dict(RUNTIME, **{key: 805306368}))
        for invalid in (b'    memswap_limit: 805306368\n', b'    memswap_limit: -1\n', b'    memswap_limit: 402653184\n    memswap_limit: 402653184\n'):
            with self.assertRaises(RuntimeError):
                MODULE.patch_content(CONFIG.replace(b'    mem_limit: 384m\n', b'    mem_limit: 384m\n' + invalid), RUNTIME)

    def test_runtime_inspection_requests_only_resource_fields_from_storage(self):
        with patch.object(MODULE.subprocess, 'run') as run:
            run.return_value.stdout = json.dumps(RUNTIME)
            self.assertEqual(MODULE.read_runtime_limits(), RUNTIME)
        command = run.call_args.args[0]
        self.assertEqual(command[:3], ['docker', 'inspect', '--format'])
        self.assertEqual(command[-1], MODULE.STORAGE)
        self.assertNotIn('.Config', command[3])

    def test_missing_duplicate_interpolated_or_unexpected_limits_abort(self):
        for config in (
            CONFIG.replace(b'      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"\n', b''),
            CONFIG.replace(b'      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"', b'      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"\n      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"'),
            CONFIG.replace(b'"524288000"', b'"${UPLOAD_LIMIT}"'),
            CONFIG.replace(b'"524288000"', b'"123456789"'),
            CONFIG.replace(b'  supabase-storage:', b'  unrelated-storage:'),
        ):
            with self.subTest(config=config[-100:]), self.assertRaises(RuntimeError):
                MODULE.patch_content(config, RUNTIME)

    def test_apply_creates_private_verified_backup_without_losing_source_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'docker-compose.yml'
            path.write_bytes(CONFIG)
            path.chmod(0o600)
            backup_root = Path(directory) / 'backups'
            # The real CLI requires root. Unit fixtures may belong to a developer.
            real_stat = Path.lstat
            real_owner = path.stat().st_uid

            def root_metadata(target, *args, **kwargs):
                value = real_stat(target, *args, **kwargs)
                if target == path:
                    values = list(value)
                    values[4] = 0
                    return type(value)(values)
                return value

            real_backup_stat = Path.stat

            def root_backup_metadata(target, *args, **kwargs):
                value = real_backup_stat(target, *args, **kwargs)
                if target == backup_root:
                    values = list(value)
                    values[4] = 0
                    return type(value)(values)
                return value

            captured = io.StringIO()
            with patch.object(Path, 'lstat', root_metadata), patch.object(Path, 'stat', root_backup_metadata), patch.object(MODULE.os, 'fchown'), patch.object(MODULE.os, 'geteuid', return_value=0), patch.object(MODULE, 'COMPOSE', path), patch.object(MODULE, 'BACKUPS', backup_root), patch.object(MODULE, 'read_runtime_limits', return_value=RUNTIME), patch('sys.argv', [str(SCRIPT), '--apply']), contextlib.redirect_stdout(captured):
                MODULE.main()
                MODULE.main()
            report, repeated = map(json.loads, captured.getvalue().splitlines())
            self.assertFalse(repeated['changed'])
            self.assertFalse(repeated['storage_memswap']['added'])
            backup = Path(report['backup'])
            self.assertEqual(backup.read_bytes(), CONFIG)
            self.assertEqual(stat.S_IMODE(backup.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(backup_root.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(path.stat().st_uid, real_owner)
            self.assertEqual(report['backup_sha256'], MODULE.sha256(CONFIG))
            self.assertEqual(len(list(backup_root.iterdir())), 1)
            self.assertEqual(path.read_bytes(), MODULE.patch_content(CONFIG, RUNTIME)[0])


if __name__ == '__main__':
    unittest.main()
