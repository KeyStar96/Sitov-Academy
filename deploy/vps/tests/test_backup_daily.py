#!/usr/bin/env python3
"""Daily-backup retention tests; temporary directories only, no production access."""
import contextlib
import hashlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'backup-daily.py'
SPEC = importlib.util.spec_from_file_location('sitov_backup_daily', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class RetentionTest(unittest.TestCase):
    def make(self, root, day, complete=True):
        path = root / f'sitov-daily-202609{day:02d}T033000000000Z'
        path.mkdir()
        if complete:
            (path / 'COMPLETE').write_text('x\n')
        return path

    def encrypted(self, root, day):
        path = root / f'sitov-daily-202609{day:02d}T033000000000Z.age'
        path.write_bytes(b'encrypted fixture ' + str(day).encode())
        path.with_suffix('.age.sha256').write_text(hashlib.sha256(path.read_bytes()).hexdigest() + '  ' + path.name + '\n')
        return path

    def test_keeps_one_verified_encrypted_pair_and_removes_daily_plaintext(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            encrypted = root / 'encrypted'
            encrypted.mkdir()
            backups = [self.make(root, day) for day in range(1, 4)]
            broken = self.make(root, 4, complete=False)
            archives = [self.encrypted(encrypted, day) for day in range(1, 4)]
            untouched = [root / 'sitov-migration-20260901T000000Z', root / 'sitov-daily-not-a-timestamp',
                         encrypted / 'sitov-cluster-recovery.age']
            for path in untouched:
                path.mkdir()
            plan = MODULE.retention_plan(root, encrypted)
            self.assertEqual(plan['keep'], archives[-1])
            self.assertEqual(plan['remove_directories'], backups + [broken])
            self.assertEqual(set(plan['remove_files']), {p for a in archives[:-1] for p in (a, a.with_suffix('.age.sha256'))})
            with contextlib.redirect_stdout(io.StringIO()):
                MODULE.apply_retention(plan, root, encrypted)
            self.assertTrue(archives[-1].is_file())
            self.assertTrue(archives[-1].with_suffix('.age.sha256').is_file())
            self.assertTrue(all(path.exists() for path in untouched))
            self.assertFalse(any(path.exists() for path in backups + [broken]))

    def test_invalid_newest_cannot_replace_previous_verified_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            encrypted = root / 'encrypted'
            encrypted.mkdir()
            old = self.encrypted(encrypted, 1)
            invalid = self.encrypted(encrypted, 2)
            invalid.write_bytes(b'tampered')
            missing = self.encrypted(encrypted, 3)
            missing.with_suffix('.age.sha256').unlink()
            partial = encrypted / 'sitov-daily-20260904T033000000000Z.age.partial'
            partial.write_text('incomplete')
            plan = MODULE.retention_plan(root, encrypted)
            self.assertEqual(plan['keep'], old)
            self.assertIn(invalid, plan['remove_files'])
            self.assertIn(missing, plan['remove_files'])
            self.assertIn(partial, plan['remove_files'])

    def test_no_verified_archive_deletes_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            encrypted = root / 'encrypted'
            encrypted.mkdir()
            old = self.make(root, 1)
            invalid = self.encrypted(encrypted, 1)
            invalid.with_suffix('.age.sha256').write_text('0' * 64 + '  wrong-filename.age\n')
            with self.assertRaisesRegex(ValueError, 'No verified'):
                MODULE.retention_plan(root, encrypted)
            self.assertTrue(old.exists())
            self.assertTrue(invalid.exists())

    def test_tampering_after_plan_blocks_every_deletion(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            encrypted = root / 'encrypted'
            encrypted.mkdir()
            old = self.encrypted(encrypted, 1)
            latest = self.encrypted(encrypted, 2)
            staging = self.make(root, 2)
            plan = MODULE.retention_plan(root, encrypted)
            latest.write_bytes(b'corruption')
            with self.assertRaisesRegex(ValueError, 'mismatch'):
                MODULE.apply_retention(plan, root, encrypted)
            self.assertTrue(old.exists())
            self.assertTrue(staging.exists())

    def test_symlinks_and_unrelated_names_are_never_retention_candidates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            encrypted = root / 'encrypted'
            encrypted.mkdir()
            real = self.encrypted(encrypted, 1)
            foreign = root / 'foreign'
            foreign.mkdir()
            directory_link = root / 'sitov-daily-20260902T033000000000Z'
            directory_link.symlink_to(foreign)
            archive_link = encrypted / 'sitov-daily-20260902T033000000000Z.age'
            archive_link.symlink_to(real)
            plan = MODULE.retention_plan(root, encrypted)
            self.assertNotIn(directory_link, plan['remove_directories'])
            self.assertNotIn(archive_link, plan['remove_files'])
            with self.assertRaisesRegex(ValueError, 'unexpected staging'):
                MODULE.remove_staging(directory_link, root)


class DailyRunTest(unittest.TestCase):
    make = RetentionTest.make
    encrypted = RetentionTest.encrypted

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / 'daily'
        self.root.mkdir()
        self.encrypted_root = Path(self.directory.name) / 'encrypted'
        self.encrypted_root.mkdir()
        self.recipient = Path(self.directory.name) / 'recipient.txt'
        self.recipient.write_text('age1-test-public-recipient\n')
        self.lock = Path(self.directory.name) / 'sitov-backup.lock'
        self.old = self.encrypted(self.encrypted_root, 1)
        self.old_staging = self.make(self.root, 1)
        self.runner = SimpleNamespace(sql=lambda _: '1024', inventory=lambda: [],
                                      backup=lambda **_: self.make(self.root, 2))
        self.recovery = SimpleNamespace(estimated_bytes=1024, assert_unchanged=lambda: None,
                                        write=lambda _: None)
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        for name, value in [('ROOT', self.root), ('ENCRYPTED', self.encrypted_root),
                            ('RECIPIENT', self.recipient), ('LOCK', self.lock)]:
            self.stack.enter_context(patch.object(MODULE, name, value))
        self.stack.enter_context(patch.object(MODULE, 'load_runner', return_value=self.runner))
        self.stack.enter_context(patch.object(MODULE, 'capture_recovery', return_value=self.recovery))
        self.stack.enter_context(patch.object(MODULE.shutil, 'disk_usage', return_value=SimpleNamespace(free=100 * 1024 ** 3)))
        self.stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
        self.stack.enter_context(contextlib.redirect_stderr(io.StringIO()))

    def test_failed_encryption_keeps_existing_recovery_point_and_removes_own_staging(self):
        with patch.object(MODULE.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, ['age'])):
            self.assertEqual(MODULE.main([]), 1)
        self.assertTrue(self.old.is_file())
        self.assertTrue(self.old_staging.is_dir())
        self.assertEqual(MODULE.daily_directories(self.root), [self.old_staging])

    def test_configuration_rotation_during_dump_preserves_previous_backup_and_does_not_export(self):
        self.recovery.assert_unchanged = lambda: (_ for _ in ()).throw(RuntimeError('Configuration changed'))
        with patch.object(MODULE.subprocess, 'run') as export:
            self.assertEqual(MODULE.main([]), 1)
            export.assert_not_called()
        self.assertTrue(self.old.is_file())
        self.assertEqual(MODULE.daily_directories(self.root), [self.old_staging])

    def test_configuration_rotation_during_encryption_removes_only_failed_new_archive(self):
        checks = iter([None, RuntimeError('Configuration changed')])
        def unchanged():
            error = next(checks)
            if error is not None:
                raise error
        self.recovery.assert_unchanged = unchanged
        with patch.object(MODULE.subprocess, 'run', side_effect=lambda *a, **k: self.encrypted(self.encrypted_root, 2)):
            self.assertEqual(MODULE.main([]), 1)
        self.assertTrue(self.old.is_file())
        self.assertEqual(sorted(self.encrypted_root.iterdir()), [self.old, self.old.with_suffix('.age.sha256')])

    def test_invalid_new_export_keeps_previous_pair_and_cleans_failed_output(self):
        def export(*args, **kwargs):
            new = self.encrypted(self.encrypted_root, 2)
            new.write_bytes(b'corruption')
        with patch.object(MODULE.subprocess, 'run', side_effect=export):
            self.assertEqual(MODULE.main([]), 1)
        self.assertTrue(self.old.is_file())
        self.assertEqual(sorted(self.encrypted_root.iterdir()), [self.old, self.old.with_suffix('.age.sha256')])
        self.assertEqual(MODULE.daily_directories(self.root), [self.old_staging])

    def test_success_replaces_previous_pair_and_removes_all_daily_staging(self):
        with patch.object(MODULE.subprocess, 'run', side_effect=lambda *a, **k: self.encrypted(self.encrypted_root, 2)):
            self.assertEqual(MODULE.main([]), 0)
        self.assertFalse(self.old.exists())
        self.assertEqual(len(list(self.encrypted_root.glob('*.age'))), 1)
        self.assertEqual(MODULE.daily_directories(self.root), [])

    def test_missing_recipient_and_insufficient_disk_never_prune_old_backups(self):
        self.recipient.unlink()
        with patch.object(MODULE.subprocess, 'run') as export:
            self.assertEqual(MODULE.main([]), 1)
            export.assert_not_called()
        self.recipient.write_text('public recipient')
        with patch.object(MODULE.shutil, 'disk_usage', return_value=SimpleNamespace(free=1)):
            self.assertEqual(MODULE.main([]), 1)
        self.assertTrue(self.old.exists())
        self.assertTrue(self.old_staging.exists())

    def test_failed_source_retry_cleans_only_new_staging(self):
        def fail(**kwargs):
            self.make(self.root, 2, complete=False)
            raise RuntimeError('Storage changed')
        self.runner.backup = fail
        with patch.object(MODULE.time, 'sleep'):
            self.assertEqual(MODULE.main([]), 1)
        self.assertTrue(self.old.exists())
        self.assertEqual(MODULE.daily_directories(self.root), [self.old_staging])

    def test_source_process_failure_also_removes_only_new_staging(self):
        def fail(**kwargs):
            self.make(self.root, 2, complete=False)
            raise subprocess.CalledProcessError(1, ['pg_dump'])
        self.runner.backup = fail
        self.assertEqual(MODULE.main([]), 1)
        self.assertTrue(self.old.exists())
        self.assertEqual(MODULE.daily_directories(self.root), [self.old_staging])

    def test_retention_plan_is_read_only_and_prune_only_applies_it(self):
        newer = self.encrypted(self.encrypted_root, 2)
        self.assertEqual(MODULE.main(['--retention-plan']), 0)
        self.assertTrue(self.old.exists())
        self.assertTrue(self.old_staging.exists())
        self.assertEqual(MODULE.main(['--prune-only']), 0)
        self.assertTrue(newer.exists())
        self.assertFalse(self.old.exists())
        self.assertFalse(self.old_staging.exists())

    def test_next_backup_succeeds_after_mac_ack_removed_previous_archive(self):
        self.old.unlink()
        self.old.with_suffix('.age.sha256').unlink()
        with patch.object(MODULE.subprocess, 'run', side_effect=lambda *a, **k: self.encrypted(self.encrypted_root, 2)):
            self.assertEqual(MODULE.main([]), 0)
        self.assertEqual(len(list(self.encrypted_root.glob('*.age'))), 1)
        self.assertEqual(MODULE.daily_directories(self.root), [])

    def test_locked_backup_blocks_maintenance_without_deletion(self):
        with self.lock.open('a') as lock:
            MODULE.fcntl.flock(lock, MODULE.fcntl.LOCK_EX | MODULE.fcntl.LOCK_NB)
            self.assertEqual(MODULE.main(['--prune-only']), 1)
        self.assertTrue(self.old.exists())
        self.assertTrue(self.old_staging.exists())

    def test_existing_output_collision_cannot_overwrite_or_delete_existing_pair(self):
        collision = self.encrypted(self.encrypted_root, 2)
        checksum = collision.with_suffix('.age.sha256').read_text()
        with patch.object(MODULE.subprocess, 'run') as export:
            self.assertEqual(MODULE.main([]), 1)
            export.assert_not_called()
        self.assertEqual(collision.with_suffix('.age.sha256').read_text(), checksum)
        self.assertTrue(collision.exists())
        self.assertTrue(self.old.exists())
        self.assertEqual(MODULE.daily_directories(self.root), [self.old_staging])


if __name__ == '__main__':
    unittest.main()
