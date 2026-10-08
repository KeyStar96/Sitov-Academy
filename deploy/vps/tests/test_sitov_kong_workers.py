#!/usr/bin/env python3
"""Byte-preserving Kong patch contracts; no production Docker/config access."""
import ast
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'sitov-patch-kong-workers.py'
SPEC = importlib.util.spec_from_file_location('sitov_kong_workers', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
RUNTIME = {'Memory': 536870912, 'MemorySwap': 536870912, 'NanoCpus': 1000000000}
CONFIG = b'''# secret-bearing Coolify configuration
services:
  supabase-auth:
    image: supabase/gotrue:v2.186.0
    environment:
      KONG_NGINX_WORKER_PROCESSES: '4'
      SECRET: "false"
    mem_limit: 256m
    cpus: 0.5
  supabase-kong:
    image: kong/kong:3.9.1
    environment:
    - KONG_DATABASE=off
    - KONG_DECLARATIVE_CONFIG=/home/kong/kong.yml
    - SERVICE_PASSWORD_JWT=${SERVICE_PASSWORD_JWT}
    - KONG_DNS_ORDER=LAST,A,CNAME
    ports:
    - 127.0.0.1:9080:8000
    healthcheck:
      test: [CMD, kong, health]
    mem_limit: 512m
    cpus: 1
  supabase-db:
    mem_limit: 1728m
    cpus: 2
volumes:
  postgres: {}
'''


class KongWorkersTests(unittest.TestCase):
    def test_list_patch_changes_only_worker_line_and_adds_pinned_swap(self):
        changed, report = MODULE.patch_content(CONFIG, RUNTIME)
        expected = CONFIG.replace(b'    - KONG_DNS_ORDER=LAST,A,CNAME\n',
                                  b'    - KONG_DNS_ORDER=LAST,A,CNAME\n    - KONG_NGINX_WORKER_PROCESSES=1\n')
        expected = expected.replace(b'    mem_limit: 512m\n', b'    mem_limit: 512m\n    memswap_limit: 512m\n')
        self.assertEqual(changed, expected)
        self.assertIsNone(report['before_workers'])
        self.assertEqual(report['after_workers'], '1')
        self.assertTrue(report['swap_added'])
        self.assertNotIn('SERVICE_PASSWORD', json.dumps(report))

    def test_mapping_patch_preserves_other_yaml_types_secrets_and_comments_byte_for_byte(self):
        environment = b'''      KONG_DATABASE: off
      KONG_NGINX_WORKER_PROCESSES: auto # host CPU count
      OTHER_BOOL: false
      OTHER_NULL: null
      OTHER_NUMBER: 123
      SECRET: '${SERVICE_PASSWORD_JWT}'
'''
        original = CONFIG.replace(CONFIG.split(b'    environment:\n')[2].split(b'    ports:')[0], environment)
        changed, report = MODULE.patch_content(original, RUNTIME)
        expected = original.replace(b'KONG_NGINX_WORKER_PROCESSES: auto', b"KONG_NGINX_WORKER_PROCESSES: '1'")
        expected = expected.replace(b'    mem_limit: 512m\n', b'    mem_limit: 512m\n    memswap_limit: 512m\n')
        self.assertEqual(changed, expected)
        self.assertEqual(report['environment_format'], 'mapping')

    def test_list_indent_quoted_entry_and_mapping_quotes_are_preserved(self):
        for entry, expected in ((b'    - "KONG_NGINX_WORKER_PROCESSES=auto" # keep', b'    - "KONG_NGINX_WORKER_PROCESSES=1" # keep'),
                                (b'      - KONG_NGINX_WORKER_PROCESSES=4', b'      - KONG_NGINX_WORKER_PROCESSES=1'),
                                (b'      KONG_NGINX_WORKER_PROCESSES: "4" # keep', b'      KONG_NGINX_WORKER_PROCESSES: "1" # keep')):
            with self.subTest(entry=entry):
                environment = b'\n' + entry + b'\n'
                changed, before, _ = MODULE.patch_environment(environment)
                self.assertEqual(changed, b'\n' + expected + b'\n')
                self.assertIn(before, ('auto', '4'))

    def test_mapping_absent_worker_is_added_as_a_string(self):
        environment = b'\n      KONG_DATABASE: off\n      SECRET: "false"\n'
        changed, before, style = MODULE.patch_environment(environment)
        self.assertEqual(changed, environment + b"      KONG_NGINX_WORKER_PROCESSES: '1'\n")
        self.assertIsNone(before)
        self.assertEqual(style, 'mapping')

    def test_idempotence_crlf_and_existing_equivalent_resource_literals(self):
        original = CONFIG.replace(b'    mem_limit: 512m\n', b'    mem_limit: "512m" # cap\n    memswap_limit: 536870912\n')
        original = original.replace(b'    cpus: 1\n', b"    cpus: '1.0' # cap\n").replace(b'\n', b'\r\n')
        changed, report = MODULE.patch_content(original, RUNTIME)
        repeated, repeated_report = MODULE.patch_content(changed, RUNTIME)
        self.assertEqual(changed, repeated)
        self.assertFalse(report['swap_added'])
        self.assertFalse(repeated_report['changed'])
        self.assertNotIn(b'\n', changed.replace(b'\r\n', b''))

    def test_uncertain_environment_values_duplicates_or_inheritance_are_refused(self):
        for environment in (b'\n    - KONG_NGINX_WORKER_PROCESSES=${COUNT:-4}\n',
                            b'\n    - KONG_NGINX_WORKER_PROCESSES=0\n',
                            b'\n    - KONG_NGINX_WORKER_PROCESSES\n',
                            b'\n    - KONG_NGINX_WORKER_PROCESSES=4\n    - KONG_NGINX_WORKER_PROCESSES=4\n',
                            b'\n      <<: *shared-env\n      KONG_DATABASE: off\n',
                            b'\n    - KONG_DATABASE=off\n      KONG_OTHER: 1\n',
                            b'\n    - KONG_DATABASE=off\n      - KONG_OTHER=1\n'):
            with self.subTest(environment=environment), self.assertRaises(RuntimeError):
                MODULE.patch_environment(environment)

    def test_missing_duplicate_unknown_service_or_image_is_refused(self):
        for original in (CONFIG.replace(b'  supabase-kong:', b'  unknown-gateway:'),
                         CONFIG.replace(b'  supabase-db:\n', b'  supabase-kong:\n  supabase-db:\n'),
                         CONFIG.replace(b'    image: kong/kong:3.9.1', b'    image: kong/kong:3.10.0'),
                         CONFIG.replace(b'    image: kong/kong:3.9.1', b'    image: ${KONG_IMAGE}'),
                         CONFIG.replace(b'services:', b'containers:'),
                         CONFIG.replace(b'  supabase-kong:\n', b'  supabase-kong:\n    image: kong/kong:3.9.1\n')):
            with self.subTest(original=original[-50:]), self.assertRaises(RuntimeError):
                MODULE.patch_content(original, RUNTIME)

    def test_changed_missing_duplicate_or_interpolated_resource_caps_are_refused(self):
        for original in (CONFIG.replace(b'    mem_limit: 512m', b'    mem_limit: 1024m'),
                         CONFIG.replace(b'    mem_limit: 512m\n', b''),
                         CONFIG.replace(b'    cpus: 1\n', b'    cpus: 2\n'),
                         CONFIG.replace(b'    cpus: 1\n', b'    cpus: ${CPU}\n'),
                         CONFIG.replace(b'    mem_limit: 512m\n', b'    mem_limit: 512m\n    memswap_limit: -1\n'),
                         CONFIG.replace(b'    mem_limit: 512m\n', b'    mem_limit: 512m\n    memswap_limit: 512m\n    memswap_limit: 512m\n')):
            with self.subTest(original=original[-150:]), self.assertRaises(RuntimeError):
                MODULE.patch_content(original, RUNTIME)
        for key in RUNTIME:
            with self.subTest(runtime=key), self.assertRaises(RuntimeError):
                MODULE.patch_content(CONFIG, dict(RUNTIME, **{key: 0}))

    def test_observed_namespaced_image_and_official_short_alias_are_supported(self):
        for original in (CONFIG, CONFIG.replace(b'image: kong/kong:3.9.1', b'image: kong:3.9.1')):
            changed, _ = MODULE.patch_content(original, RUNTIME)
            self.assertIn(b'KONG_NGINX_WORKER_PROCESSES=1', changed)

    def test_symlink_backup_directory_or_previous_file_is_refused_before_compose_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path, backups, elsewhere = root / 'docker-compose.yml', root / 'backups', root / 'elsewhere'
            path.write_bytes(CONFIG)
            path.chmod(0o600)
            elsewhere.mkdir()
            backups.symlink_to(elsewhere)
            lstat_mock, stat_mock = self.root_path_mocks(path, backups)
            with lstat_mock, stat_mock, patch.object(MODULE.os, 'fchown'), self.assertRaises(RuntimeError):
                MODULE.apply_patch(path, backups, RUNTIME)
            self.assertEqual(path.read_bytes(), CONFIG)
            backups.unlink()
            backups.mkdir()
            target = elsewhere / 'preserved-file'
            target.write_text('preserve')
            target.chmod(0o600)
            (backups / 'previous-docker-compose.yml').symlink_to(target)
            lstat_mock, stat_mock = self.root_path_mocks(path, backups)
            with lstat_mock, stat_mock, patch.object(MODULE.os, 'fchown'), self.assertRaises(RuntimeError):
                MODULE.apply_patch(path, backups, RUNTIME)
            self.assertEqual(path.read_bytes(), CONFIG)
            self.assertEqual(target.read_text(), 'preserve')

    def test_runtime_inspection_requests_only_non_secret_kong_cgroup_fields(self):
        with patch.object(MODULE.subprocess, 'run') as run:
            run.return_value.stdout = json.dumps(RUNTIME)
            self.assertEqual(MODULE.read_runtime_limits(), RUNTIME)
        command = run.call_args.args[0]
        self.assertEqual(command[:3], ['docker', 'inspect', '--format'])
        self.assertEqual(command[-1], MODULE.KONG)
        self.assertNotIn('.Config', command[3])

    def root_path_mocks(self, path, backups):
        real_lstat, real_stat = Path.lstat, Path.stat
        targets = {path, backups, backups / 'previous-docker-compose.yml'}
        def metadata(original):
            def wrapped(target, *args, **kwargs):
                value = original(target, *args, **kwargs)
                if target in targets:
                    fields = list(value)
                    fields[4] = 0
                    return type(value)(fields)
                return value
            return wrapped
        return patch.object(Path, 'lstat', metadata(real_lstat)), patch.object(Path, 'stat', metadata(real_stat))

    def test_apply_is_atomic_private_and_retains_exactly_one_previous_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path, backups = root / 'docker-compose.yml', root / 'backups'
            path.write_bytes(CONFIG)
            path.chmod(0o600)
            lstat_mock, stat_mock = self.root_path_mocks(path, backups)
            with lstat_mock, stat_mock, patch.object(MODULE.os, 'fchown'):
                report = MODULE.apply_patch(path, backups, RUNTIME)
                repeated = MODULE.apply_patch(path, backups, RUNTIME)
                self.assertFalse(repeated['changed'])
                backup = Path(report['backup'])
                self.assertEqual(backup.read_bytes(), CONFIG)
                self.assertEqual(stat.S_IMODE(backup.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(backups.stat().st_mode), 0o700)
                self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
                self.assertEqual(len(list(backups.iterdir())), 1)
                # Re-patching a changed configuration replaces the one private
                # previous file, rather than accumulating dated secret copies.
                edited = path.read_bytes().replace(b'KONG_NGINX_WORKER_PROCESSES=1', b'KONG_NGINX_WORKER_PROCESSES=4')
                path.write_bytes(edited)
                MODULE.apply_patch(path, backups, RUNTIME)
                self.assertEqual(backup.read_bytes(), edited)
                self.assertEqual(len(list(backups.iterdir())), 1)

    def test_symlink_compose_ancestor_or_backup_is_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path = root / 'docker-compose.yml'
            path.write_bytes(CONFIG)
            path.chmod(0o600)
            alias = root / 'alias'
            alias.symlink_to(root)
            with self.assertRaises(RuntimeError):
                MODULE.regular_private_path(alias / path.name, require_root=False)
            with self.assertRaises(RuntimeError):
                MODULE.regular_private_path(alias, require_root=False)

    def test_public_configuration_and_non_root_owner_are_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory).resolve() / 'docker-compose.yml'
            path.write_bytes(CONFIG)
            path.chmod(0o644)
            with self.assertRaises(RuntimeError):
                MODULE.regular_private_path(path, require_root=False)
            path.chmod(0o600)
            if path.stat().st_uid != 0:
                with self.assertRaises(RuntimeError):
                    MODULE.regular_private_path(path)

    def test_a_same_named_volume_is_preserved_and_not_treated_as_a_service(self):
        original = CONFIG + b'  supabase-kong: {}\n'
        changed, _ = MODULE.patch_content(original, RUNTIME)
        self.assertTrue(changed.endswith(b'  supabase-kong: {}\n'))

    def test_concurrent_compose_edit_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path, backups = root / 'docker-compose.yml', root / 'backups'
            path.write_bytes(CONFIG)
            path.chmod(0o600)
            lstat_mock, stat_mock = self.root_path_mocks(path, backups)
            original_atomic = MODULE.atomic_write
            def racing_write(target, *args, **kwargs):
                original_atomic(target, *args, **kwargs)
                if target.parent == backups:
                    path.write_bytes(b'concurrent edit')
            with lstat_mock, stat_mock, patch.object(MODULE.os, 'fchown'), patch.object(MODULE, 'atomic_write', side_effect=racing_write), self.assertRaises(RuntimeError):
                MODULE.apply_patch(path, backups, RUNTIME)
            self.assertEqual(path.read_bytes(), b'concurrent edit')

    def test_default_command_is_a_dry_run_and_does_not_restart_containers(self):
        captured = io.StringIO()
        with patch.object(MODULE, 'regular_private_path'), patch.object(MODULE, 'read_runtime_limits', return_value=RUNTIME), patch.object(Path, 'read_bytes', return_value=CONFIG), patch.object(MODULE, 'apply_patch') as apply, contextlib.redirect_stdout(captured):
            self.assertEqual(MODULE.main([]), 0)
        self.assertFalse(apply.called)
        report = json.loads(captured.getvalue())
        self.assertFalse(report['applied'])
        self.assertFalse(report['activation_performed'])

    def test_failure_output_does_not_expose_compose_or_subprocess_secrets(self):
        captured = io.StringIO()
        with patch.object(MODULE, 'regular_private_path', side_effect=RuntimeError('SECRET=private-value')), contextlib.redirect_stderr(captured):
            self.assertEqual(MODULE.main([]), 1)
        self.assertNotIn('private-value', captured.getvalue())

    def test_baseline_pins_workers_and_swap_without_changing_other_kong_values(self):
        baseline = (SCRIPT.parent / 'configure-local-services.py').read_text()
        beginning = baseline.index("kong=services['supabase-kong']")
        ending = baseline.index("for service in ('supabase-analytics'", beginning)
        snippet = compile(ast.parse(baseline[beginning:ending]), 'sitov-kong-baseline', 'exec')
        for environment in ({'SECRET': False}, ['SECRET=false', 'KONG_NGINX_WORKER_PROCESSES=4']):
            service = {'environment': environment, 'mem_limit': '512m', 'cpus': 1}
            exec(snippet, {'services': {'supabase-kong': service}})
            self.assertEqual(service['memswap_limit'], '512m')
            self.assertEqual(service['mem_limit'], '512m')
            self.assertEqual(service['cpus'], 1)
            if isinstance(environment, dict):
                self.assertIs(service['environment']['SECRET'], False)
                self.assertEqual(service['environment']['KONG_NGINX_WORKER_PROCESSES'], '1')
            else:
                self.assertEqual(service['environment'], ['SECRET=false', 'KONG_NGINX_WORKER_PROCESSES=1'])


if __name__ == '__main__':
    unittest.main()
