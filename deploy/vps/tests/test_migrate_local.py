#!/usr/bin/env python3
"""Mocked migration failure contracts. No SQL, Docker or systemd execution."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'migrate-local.py'
# MIGRATION.BASE points at the production checkout, which does not exist on a
# developer machine. Resolve the SQL directory from this file instead.
SQL_DIR = Path(__file__).resolve().parents[3] / 'supabase/vps'
SPEC = importlib.util.spec_from_file_location('sitov_migrate_local', SCRIPT)
MIGRATION = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIGRATION)


class MigrationFailureTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / '02_identity_alignment.sql').write_text('SELECT 1;\n')
        self.backup = self.root / 'backup'
        self.backup.mkdir()
        self.commands = []
        self.sql_commands = []
        self.result = subprocess.CompletedProcess([], 0, 'BEGIN\nCOMMIT\n', '')
        self.patches = [
            patch('sys.argv', [str(SCRIPT), '--apply', '02_identity_alignment.sql',
                  '--sql-dir', str(self.root), '--keep-stopped']),
            patch.object(MIGRATION.os, 'umask'),
            patch.object(MIGRATION, 'backup', return_value=self.backup),
            patch.object(MIGRATION, 'run', side_effect=self.run_command),
            patch.object(MIGRATION.subprocess, 'run', side_effect=self.subprocess_run),
        ]
        self.mocks = [item.start() for item in self.patches]
        for item in self.patches:
            self.addCleanup(item.stop)

    def run_command(self, command, **kwargs):
        self.commands.append(command)
        return ''

    def subprocess_run(self, command, **kwargs):
        self.commands.append(command)
        if command[:2] == ['systemctl', 'is-active']:
            return subprocess.CompletedProcess(command, 0)
        self.sql_commands.append(kwargs.get('input', ''))
        if isinstance(self.result, Exception):
            raise self.result
        return self.result

    def assert_services_stopped(self):
        for service in ('sitov-app', 'sitov-mail'):
            self.assertIn(['systemctl', 'stop', service], self.commands)
            self.assertNotIn(['systemctl', 'start', service], self.commands)

    def test_commit_followed_by_log_write_failure_never_restarts_old_release(self):
        original_write = Path.write_text

        def write(path, *args, **kwargs):
            if path.name == 'migration.log':
                raise OSError('disk full after COMMIT')
            return original_write(path, *args, **kwargs)

        with patch.object(Path, 'write_text', write), self.assertRaisesRegex(OSError, 'disk full'):
            MIGRATION.main()
        self.assert_services_stopped()

    def test_psql_failure_is_not_assumed_to_mean_rollback(self):
        self.result = subprocess.CompletedProcess([], 2, 'BEGIN\n', 'connection lost')
        with self.assertRaisesRegex(RuntimeError, 'commit status is unverified'):
            MIGRATION.main()
        self.assert_services_stopped()
        self.assertIn('connection lost', (self.backup / 'migration.log').read_text())

    def test_sql_process_exception_keeps_services_stopped(self):
        self.result = OSError('docker connection lost')
        with self.assertRaisesRegex(OSError, 'docker connection lost'):
            MIGRATION.main()
        self.assert_services_stopped()

    def test_backup_failure_restores_services_without_starting_sql(self):
        self.mocks[2].side_effect = RuntimeError('backup incomplete')
        with self.assertRaisesRegex(RuntimeError, 'backup incomplete'):
            MIGRATION.main()
        for service in ('sitov-app', 'sitov-mail'):
            self.assertIn(['systemctl', 'start', service], self.commands)
        self.assertFalse(any(command[0] == 'docker' for command in self.commands))

    def test_successful_commit_waits_for_matching_release_activation(self):
        MIGRATION.main()
        self.assert_services_stopped()
        self.assertTrue((self.backup / 'applied.json').is_file())

    def test_phase3_migration_is_accepted_and_waits_for_matching_app(self):
        (self.root / '06_soft_errors.sql').write_text('SELECT 1;\n')
        with patch('sys.argv', [str(SCRIPT), '--apply', '06_soft_errors.sql',
                   '--sql-dir', str(self.root), '--keep-stopped']):
            MIGRATION.main()
        self.assert_services_stopped()
        self.assertIn('06_soft_errors.sql', (self.backup / 'applied.json').read_text())

    def test_every_migration_file_is_registered_in_order(self):
        """A file missing from ORDER cannot be passed to --apply at all.

        argparse gates --apply on choices=ORDER, so an unregistered migration
        fails on the production VPS with "invalid choice" - after the release
        that needs it is already built. The previous literal tail assertion went
        stale when 19_vocabulary_self_rating_fix.sql was added; deriving both
        sides from the directory keeps it honest.
        """
        available = sorted(path.name for path in SQL_DIR.glob('*.sql') if path.name[:2].isdigit())
        self.assertEqual(sorted(MIGRATION.ORDER), available, 'ORDER and supabase/vps/*.sql disagree')
        # The first five files carry a hand-picked order (identity before the
        # critical fixes). Everything from 04 onward runs by ascending number.
        numbered = [name for name in MIGRATION.ORDER if name >= '04_']
        self.assertEqual(numbered, sorted(numbered), 'migrations from 04 onward must stay in ascending order')

    def test_content_quality_migration_precedes_phase4_and_waits_for_matching_app(self):
        (self.root / '07_content_quality.sql').write_text('SELECT 1;\n')
        with patch('sys.argv', [str(SCRIPT), '--apply', '07_content_quality.sql',
                   '--sql-dir', str(self.root), '--keep-stopped']):
            MIGRATION.main()
        self.assert_services_stopped()
        self.assertIn('07_content_quality.sql', (self.backup / 'applied.json').read_text())

    def test_concurrent_indexes_use_bounded_autocommit_and_next_file_is_transactional(self):
        (self.root / '08_performance_indexes.sql').write_text('CREATE INDEX CONCURRENTLY x ON t(id);\n')
        (self.root / '09_progress_aggregate.sql').write_text('SELECT 9;\n')
        with patch('sys.argv', [str(SCRIPT), '--apply', '08_performance_indexes.sql',
                   '09_progress_aggregate.sql', '--sql-dir', str(self.root), '--keep-stopped']):
            MIGRATION.main()
        sql = self.sql_commands[-1]
        first, second = sql.split('BEGIN;')
        self.assertIn("SET lock_timeout='10s'", first)
        self.assertIn("SET statement_timeout='180s'", first)
        self.assertIn('CREATE INDEX CONCURRENTLY', first)
        self.assertIn('RESET statement_timeout;', first)
        self.assertIn('SELECT 9;', second)
        self.assertIn('COMMIT;', second)
        self.assert_services_stopped()

    def test_concurrently_in_comment_does_not_remove_transaction(self):
        (self.root / '02_identity_alignment.sql').write_text('-- CONCURRENTLY is only a comment\nSELECT 1;\n')
        MIGRATION.main()
        self.assertTrue(self.sql_commands[-1].startswith('BEGIN;'))

    def test_migration_with_own_transaction_is_rejected_before_services_stop(self):
        (self.root / '06_soft_errors.sql').write_text('BEGIN;\nSELECT 1;\nCOMMIT;\n')
        with patch('sys.argv', [str(SCRIPT), '--apply', '06_soft_errors.sql',
                   '--sql-dir', str(self.root), '--keep-stopped']), self.assertRaisesRegex(RuntimeError, 'Own transaction boundary'):
            MIGRATION.main()
        self.assertEqual(self.commands, [])


if __name__ == '__main__':
    unittest.main()
