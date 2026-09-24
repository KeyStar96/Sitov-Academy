#!/usr/bin/env python3
"""Exact-byte Auth HIBP patch tests; no production access or subprocesses."""
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'patch-auth-hibp.py'
SPEC = importlib.util.spec_from_file_location('sitov_auth_hibp', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
RUNTIME = {'Memory': 268435456, 'MemorySwap': 268435456, 'NanoCpus': 500000000}
CONFIG = b'''services:
  supabase-db:
    environment:
    - GOTRUE_PASSWORD_HIBP_ENABLED=false
    mem_limit: 1728m
    cpus: 2
  supabase-auth:
    image: supabase/gotrue:v2.186.0
    healthcheck:
      test:
      - CMD
      - wget
      timeout: 5s
    environment:
    - GOTRUE_API_HOST=0.0.0.0
    - GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:${SERVICE_PASSWORD_POSTGRES}@db/postgres
    - GOTRUE_JWT_SECRET=${SERVICE_PASSWORD_JWT}
    - GOTRUE_SMS_AUTOCONFIRM=${ENABLE_PHONE_AUTOCONFIRM:-true}
    - ADDITIONAL_REDIRECT_URLS=None
    - SERVICE_NAME_SUPABASE_AUTH=supabase-auth
    container_name: supabase-auth-eknmzxvqilojjicinatnllbt
    env_file:
    - .env
    mem_limit: 256m
    cpus: 0.5
  supabase-kong:
    mem_limit: 512m
    cpus: 1
volumes:
  retained: {}
'''
ADDED = b'    - GOTRUE_PASSWORD_HIBP_ENABLED=true\n    - GOTRUE_PASSWORD_HIBP_FAIL_CLOSED=false\n'


class AuthHibpPatchTests(unittest.TestCase):
    def test_only_two_auth_settings_and_the_live_swap_cap_are_added(self):
        changed, report = MODULE.patch_content(CONFIG, RUNTIME)
        expected = CONFIG.replace(b'    - GOTRUE_SMS_AUTOCONFIRM=${ENABLE_PHONE_AUTOCONFIRM:-true}\n',
                                  b'    - GOTRUE_SMS_AUTOCONFIRM=${ENABLE_PHONE_AUTOCONFIRM:-true}\n' + ADDED)
        expected = expected.replace(b'    mem_limit: 256m\n', b'    mem_limit: 256m\n    memswap_limit: 268435456\n')
        self.assertEqual(changed, expected)
        # Another service with the same key stays untouched.
        self.assertIn(b'    - GOTRUE_PASSWORD_HIBP_ENABLED=false\n    mem_limit: 1728m', changed)
        self.assertEqual(MODULE.ram_cpu_caps(changed), MODULE.ram_cpu_caps(CONFIG))
        self.assertEqual(report['ram_cpu_limits_original_sha256'], report['ram_cpu_limits_final_sha256'])
        self.assertEqual(report['before'], {'GOTRUE_PASSWORD_HIBP_ENABLED': None, 'GOTRUE_PASSWORD_HIBP_FAIL_CLOSED': None})
        self.assertEqual(report['after'], {'GOTRUE_PASSWORD_HIBP_ENABLED': 'true', 'GOTRUE_PASSWORD_HIBP_FAIL_CLOSED': 'false'})
        self.assertEqual(report['auth_memswap'], {'before_bytes': None, 'after_bytes': 268435456, 'added': True})
        self.assertNotIn('SERVICE_PASSWORD', json.dumps(report))
        self.assertNotIn('postgres://', json.dumps(report))

    def test_idempotence_and_line_endings_are_preserved(self):
        changed, _ = MODULE.patch_content(CONFIG.replace(b'\n', b'\r\n'), RUNTIME)
        repeated, report = MODULE.patch_content(changed, RUNTIME)
        self.assertEqual(changed, repeated)
        self.assertFalse(report['changed'])
        self.assertEqual(report['before'], {'GOTRUE_PASSWORD_HIBP_ENABLED': 'true', 'GOTRUE_PASSWORD_HIBP_FAIL_CLOSED': 'false'})
        self.assertNotIn(b'\n', changed.replace(b'\r\n', b''))

    def test_conflicting_duplicate_or_mapping_settings_abort(self):
        for config in (
            CONFIG.replace(b'    - ADDITIONAL_REDIRECT_URLS=None\n', b'    - GOTRUE_PASSWORD_HIBP_ENABLED=false\n    - ADDITIONAL_REDIRECT_URLS=None\n'),
            CONFIG.replace(b'    - ADDITIONAL_REDIRECT_URLS=None\n', b'    - GOTRUE_PASSWORD_HIBP_FAIL_CLOSED=true\n    - ADDITIONAL_REDIRECT_URLS=None\n'),
            CONFIG.replace(b'    - ADDITIONAL_REDIRECT_URLS=None\n', b'    - GOTRUE_PASSWORD_HIBP_ENABLED=${HIBP:-true}\n    - ADDITIONAL_REDIRECT_URLS=None\n'),
            CONFIG.replace(b'    - ADDITIONAL_REDIRECT_URLS=None\n', (b'    - GOTRUE_PASSWORD_HIBP_ENABLED=true\n' * 2) + b'    - ADDITIONAL_REDIRECT_URLS=None\n'),
            CONFIG.replace(b'    image: supabase/gotrue:v2.186.0', b'    image: supabase/gotrue:v1.0.0'),
            CONFIG.replace(b'  supabase-auth:', b'  unrelated-auth:'),
        ):
            with self.subTest(config=config[300:420]), self.assertRaises(RuntimeError):
                MODULE.patch_content(config, RUNTIME)

    def test_existing_equivalent_swap_is_kept_and_unexpected_caps_abort(self):
        configured = CONFIG.replace(b'    mem_limit: 256m\n', b'    mem_limit: 256m\n    memswap_limit: "256m" # pinned\n')
        changed, report = MODULE.patch_content(configured, RUNTIME)
        self.assertIn(b'    memswap_limit: "256m" # pinned\n', changed)
        self.assertEqual(changed.count(b'memswap_limit'), 1)
        self.assertFalse(report['auth_memswap']['added'])
        for invalid in (0, -1, 536870912):
            with self.subTest(live_swap=invalid), self.assertRaises(RuntimeError):
                MODULE.patch_content(CONFIG, dict(RUNTIME, MemorySwap=invalid))
        with self.assertRaises(RuntimeError):
            MODULE.patch_content(CONFIG, dict(RUNTIME, Memory=536870912))
        for invalid in (b'    memswap_limit: 536870912\n', b'    memswap_limit: 256m\n    memswap_limit: 256m\n'):
            with self.subTest(configured=invalid), self.assertRaises(RuntimeError):
                MODULE.patch_content(CONFIG.replace(b'    mem_limit: 256m\n', b'    mem_limit: 256m\n' + invalid), RUNTIME)
        with self.assertRaises(RuntimeError):
            MODULE.patch_content(CONFIG.replace(b'    mem_limit: 256m\n', b'    mem_limit: 512m\n'), RUNTIME)

    def test_runtime_inspection_requests_only_resource_fields_from_auth(self):
        with patch.object(MODULE.subprocess, 'run') as run:
            run.return_value.stdout = json.dumps(RUNTIME)
            self.assertEqual(MODULE.read_runtime_limits(), RUNTIME)
        command = run.call_args.args[0]
        self.assertEqual(command[:3], ['docker', 'inspect', '--format'])
        self.assertEqual(command[-1], MODULE.AUTH)
        self.assertNotIn('.Config', command[3])

    def test_apply_creates_private_verified_backup_without_losing_source_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'docker-compose.yml'
            path.write_bytes(CONFIG)
            path.chmod(0o600)
            backup_root = Path(directory) / 'backups'
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
            self.assertTrue(report['changed'])
            self.assertFalse(repeated['changed'])
            self.assertFalse(repeated['auth_memswap']['added'])
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
