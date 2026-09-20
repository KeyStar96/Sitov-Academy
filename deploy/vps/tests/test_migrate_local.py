#!/usr/bin/env python3
"""Mocked migration failure contracts. No SQL, Docker or systemd execution."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'migrate-local.py'
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


if __name__ == '__main__':
    unittest.main()
