#!/usr/bin/env python3
"""Daily-backup retention tests; temporary directories only, no production access."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

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

    def test_keeps_newest_complete_and_drops_incomplete(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            backups = [self.make(root, day) for day in range(1, 18)]
            broken = self.make(root, 18, complete=False)
            migration = root / 'sitov-migration-20260901T000000Z'
            migration.mkdir()
            doomed = MODULE.expired(list(root.iterdir()), keep=14)
            self.assertEqual(sorted(doomed), sorted(backups[:3] + [broken]))
            self.assertNotIn(migration, doomed)

    def test_nothing_expires_below_the_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for day in range(1, 5):
                self.make(root, day)
            self.assertEqual(MODULE.expired(list(root.iterdir()), keep=14), [])


if __name__ == '__main__':
    unittest.main()
