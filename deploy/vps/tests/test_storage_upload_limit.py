#!/usr/bin/env python3
"""Exact-byte configuration patch tests; no production access or subprocesses."""
import importlib.util
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'patch-storage-upload-limit.py'
SPEC = importlib.util.spec_from_file_location('sitov_storage_limit', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
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
        changed, report = MODULE.patch_content(CONFIG)
        expected = CONFIG.replace(b"'524288000' #", b"'536870912' #").replace(b'"524288000"', b'"536870912"')
        self.assertEqual(changed, expected)
        self.assertEqual(MODULE.CAPS.findall(changed), MODULE.CAPS.findall(CONFIG))
        self.assertEqual(report['before'], {'UPLOAD_FILE_SIZE_LIMIT': 524288000, 'UPLOAD_FILE_SIZE_LIMIT_STANDARD': 524288000})
        self.assertNotIn('do-not-print', str(report))

    def test_idempotence_and_line_endings_are_preserved(self):
        changed, _ = MODULE.patch_content(CONFIG.replace(b'\n', b'\r\n'))
        repeated, report = MODULE.patch_content(changed)
        self.assertEqual(changed, repeated)
        self.assertFalse(report['changed'])
        self.assertEqual(changed.count(b'\r\n'), CONFIG.count(b'\n'))

    def test_missing_duplicate_interpolated_or_unexpected_limits_abort(self):
        for config in (
            CONFIG.replace(b'      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"\n', b''),
            CONFIG.replace(b'      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"', b'      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"\n      UPLOAD_FILE_SIZE_LIMIT_STANDARD: "524288000"'),
            CONFIG.replace(b'"524288000"', b'"${UPLOAD_LIMIT}"'),
            CONFIG.replace(b'"524288000"', b'"123456789"'),
            CONFIG.replace(b'  supabase-storage:', b'  unrelated-storage:'),
        ):
            with self.subTest(config=config[-100:]), self.assertRaises(RuntimeError):
                MODULE.patch_content(config)

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

            with patch.object(Path, 'lstat', root_metadata), patch.object(Path, 'stat', root_backup_metadata), patch.object(MODULE.os, 'fchown'):
                report = MODULE.apply_patch(path, backup_root)
                self.assertFalse(MODULE.apply_patch(path, backup_root)['changed'])
            backup = Path(report['backup'])
            self.assertEqual(backup.read_bytes(), CONFIG)
            self.assertEqual(stat.S_IMODE(backup.stat().st_mode), 0o600)
            self.assertEqual(stat.S_IMODE(backup_root.stat().st_mode), 0o700)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
            self.assertEqual(path.stat().st_uid, real_owner)
            self.assertEqual(report['backup_sha256'], MODULE.sha256(CONFIG))
            self.assertEqual(len(list(backup_root.iterdir())), 1)
            self.assertEqual(path.read_bytes(), MODULE.patch_content(CONFIG)[0])


if __name__ == '__main__':
    unittest.main()
