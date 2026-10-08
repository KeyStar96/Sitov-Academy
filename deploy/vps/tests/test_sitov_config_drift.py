"""Passive drift checks: synthetic configuration, no live VPS or credentials."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'sitov-config-drift.py'
SPEC = importlib.util.spec_from_file_location('sitov_config_drift', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def fixture(name):
    contract = MODULE.CONTRACTS[name]
    configured = {'environment': dict(contract['env']), 'image': contract['image'], 'container_name': name + '-' + MODULE.PROJECT,
                  'mem_limit': contract['memory'], 'memswap_limit': contract['memory'], 'cpus': contract['cpu']}
    runtime = {'Config': {'Image': contract['image'], 'Env': [key + '=' + value for key, value in contract['env'].items()]},
               'HostConfig': {'Memory': contract['memory'], 'MemorySwap': contract['memory'],
                              'NanoCpus': int(contract['cpu'] * 10 ** 9), 'PortBindings': {}},
               'State': {'Running': True, 'Health': {'Status': 'healthy'}}}
    if name == 'supabase-auth':
        configured['extra_hosts'] = ['host.docker.internal:host-gateway']
        runtime['HostConfig']['ExtraHosts'] = ['host.docker.internal:host-gateway']
    if name == 'supabase-kong':
        configured['ports'] = ['127.0.0.1:9080:8000']
        runtime['HostConfig']['PortBindings'] = {'8000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '9080'}]}
    return configured, runtime


def nginx_fixture():
    canonical = SCRIPT.with_name('nginx.conf').read_text()
    proxy = {'NetworkSettings': {'Networks': {'test': {'IPAddress': '10.0.0.2', 'GlobalIPv6Address': 'fd00::2'}}}}
    return ('# configuration file ' + MODULE.NGINX_SITE + ':\n' + canonical +
            '\n# configuration file ' + MODULE.TRUSTED_PROXY + ':\nallow 10.0.0.2;\nallow fd00::2;\ndeny all;\n'), proxy


class ConfigDriftTest(unittest.TestCase):
    def service_report(self, name, configured=None, runtime=None):
        expected, running = fixture(name)
        report = MODULE.Report()
        MODULE.check_service(report, name, expected if configured is None else configured, running if runtime is None else runtime)
        return report

    def test_all_canonical_service_contracts_pass_for_actual_environment_formats(self):
        for name in MODULE.CONTRACTS:
            configured, runtime = fixture(name)
            if name == 'supabase-auth':
                configured['environment'] = [key + '=' + value for key, value in configured['environment'].items()]
                configured['mem_limit'] = '256m'
            report = self.service_report(name, configured, runtime)
            self.assertTrue(all(report.checks.values()), report.checks)

    def test_missing_password_rule_and_runtime_disagreement_are_drift(self):
        configured, runtime = fixture('supabase-auth')
        configured['environment'].pop('GOTRUE_PASSWORD_HIBP_ENABLED')
        runtime['Config']['Env'] = [value.replace('GOTRUE_PASSWORD_MIN_LENGTH=8', 'GOTRUE_PASSWORD_MIN_LENGTH=6') for value in runtime['Config']['Env']]
        report = self.service_report('supabase-auth', configured, runtime)
        self.assertFalse(report.checks['sitov.supabase-auth.compose.GOTRUE_PASSWORD_HIBP_ENABLED'])
        self.assertFalse(report.checks['sitov.supabase-auth.runtime.GOTRUE_PASSWORD_MIN_LENGTH'])

    def test_changed_mail_routing_or_custom_hook_is_drift_without_showing_its_secret(self):
        configured, runtime = fixture('supabase-auth')
        canary = 'DO-NOT-PRINT-secret-hook-and-password'
        configured['environment']['GOTRUE_SMTP_PASS'] = canary
        configured['environment']['GOTRUE_HOOK_SEND_EMAIL_ENABLED'] = 'true'
        configured['environment']['GOTRUE_HOOK_SEND_EMAIL_URI'] = 'https://example.invalid/' + canary
        configured['environment']['GOTRUE_HOOK_SEND_EMAIL_SECRETS'] = canary
        report = self.service_report('supabase-auth', configured, runtime)
        self.assertFalse(report.checks['sitov.supabase-auth.compose.GOTRUE_SMTP_PASS'])
        self.assertFalse(report.checks['sitov.supabase-auth.compose.email_hook_disabled'])
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(report.emit(), 1)
        self.assertNotIn(canary, output.getvalue())
        self.assertTrue(all(line.startswith(('OK sitov.', 'DRIFT sitov.')) for line in output.getvalue().splitlines()))

    def test_missing_kong_worker_setting_swap_and_public_port_are_drift(self):
        configured, runtime = fixture('supabase-kong')
        configured['environment'] = {}
        configured.pop('memswap_limit')
        runtime['HostConfig']['PortBindings']['8000/tcp'][0]['HostIp'] = '0.0.0.0'
        report = self.service_report('supabase-kong', configured, runtime)
        for name in ('compose.KONG_NGINX_WORKER_PROCESSES', 'compose.swap', 'runtime.loopback_ports'):
            self.assertFalse(report.checks['sitov.supabase-kong.' + name])

    def test_storage_limit_change_image_change_and_unhealthy_runtime_are_drift(self):
        configured, runtime = fixture('supabase-storage')
        configured['environment']['UPLOAD_FILE_SIZE_LIMIT_STANDARD'] = '524288000'
        runtime['Config']['Image'] = 'supabase/storage-api:latest'
        runtime['HostConfig']['Memory'] = 1536 * 1024 ** 2
        runtime['State']['Health']['Status'] = 'unhealthy'
        report = self.service_report('supabase-storage', configured, runtime)
        for name in ('compose.UPLOAD_FILE_SIZE_LIMIT_STANDARD', 'runtime.image', 'runtime.memory', 'runtime.healthy'):
            self.assertFalse(report.checks['sitov.supabase-storage.' + name])

    def test_duplicate_yaml_or_environment_keys_fail_closed_without_values(self):
        with self.assertRaises(ValueError):
            MODULE.yaml.load('services:\n  auth: first-secret\n  auth: second-secret\n', Loader=MODULE.UniqueSafeLoader)
        with self.assertRaises(ValueError):
            MODULE.environment(['GOTRUE_SITE_URL=first-secret', 'GOTRUE_SITE_URL=second-secret'])
        with self.assertRaises(ValueError):
            MODULE.dotenv('SITE_URL=first-secret\nSITE_URL=second-secret\n')

    def test_memory_and_port_formats_keep_explicit_bounds(self):
        for raw in (268435456, '268435456', '256m', '256M'):
            self.assertEqual(MODULE.memory_bytes(raw), 268435456)
        for raw in (None, 'unlimited', True, -1):
            self.assertIsNone(MODULE.memory_bytes(raw))
        self.assertEqual(MODULE.canonical_ports([{'host_ip': '127.0.0.1', 'published': 9080, 'target': 8000}]), [('127.0.0.1', '9080', '8000')])
        self.assertIsNone(MODULE.canonical_ports(['9080:8000']))

    def test_nginx_canonical_config_and_current_proxy_addresses_pass(self):
        dump, proxy = nginx_fixture()
        report = MODULE.Report()
        MODULE.check_nginx(report, dump, proxy)
        self.assertTrue(all(report.checks.values()), report.checks)

    def test_nginx_missing_gate_token_logging_and_broadened_proxy_are_drift(self):
        dump, proxy = nginx_fixture()
        dump = dump.replace('include /etc/nginx/snippets/sitov-trusted-proxy.conf;', '', 1)
        dump = dump.replace('$request_method $uri $server_protocol', '$request_method $request_uri $server_protocol')
        dump = dump.replace('allow 10.0.0.2;', 'allow 10.0.0.0/8;')
        report = MODULE.Report()
        MODULE.check_nginx(report, dump, proxy)
        self.assertFalse(report.checks['sitov.nginx.storage.trusted_proxy'])
        self.assertFalse(report.checks['sitov.nginx.no_token_log'])
        self.assertFalse(report.checks['sitov.nginx.proxy_exact_allowlist'])

    def test_new_proxy_address_stale_allowlist_is_drift(self):
        dump, proxy = nginx_fixture()
        proxy['NetworkSettings']['Networks']['test']['IPAddress'] = '10.0.0.99'
        report = MODULE.Report()
        MODULE.check_nginx(report, dump, proxy)
        self.assertFalse(report.checks['sitov.nginx.proxy_exact_allowlist'])

    def test_storage_maps_cannot_silently_disable_pause_or_writer_limits(self):
        dump, proxy = nginx_fixture()
        dump = dump.replace('~^1:(POST|PUT|PATCH):/supabase/storage/v1/(object|upload|s3)(/|$) 1;',
                            '~^1:(POST|PUT|PATCH):/supabase/storage/v1/(object|upload|s3)(/|$) 0;')
        dump = dump.replace('~^(POST|PUT|PATCH):/supabase/storage/v1/(object|upload|s3)(/|$) $sitov_storage_client;',
                            '~^(POST|PUT|PATCH):/supabase/storage/v1/(object|upload|s3)(/|$) "";')
        report = MODULE.Report()
        MODULE.check_nginx(report, dump, proxy)
        self.assertFalse(report.checks['sitov.nginx.storage.pause_map'])
        self.assertFalse(report.checks['sitov.nginx.storage.writer_map'])

    def test_app_origin_proxy_hops_and_systemd_network_bounds(self):
        report = MODULE.Report()
        values = dict(MODULE.APP_VALUES)
        properties = {'ActiveState': 'active', 'User': 'sitov', 'WorkingDirectory': '/var/www/sitov-current',
                      'MemoryMax': '2147483648', 'NoNewPrivileges': 'yes', 'PrivateTmp': 'yes', 'ProtectSystem': 'strict',
                      'IPAddressAllow': '127.0.0.0/8 ::1/128', 'IPAddressDeny': '0.0.0.0/0 ::/0',
                      'ExecStart': '{ argv[]=/usr/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000 ; }'}
        MODULE.check_app(report, values, properties)
        self.assertTrue(all(report.checks.values()), report.checks)
        values['TRUSTED_PROXY_HOPS'] = '2'
        properties['IPAddressAllow'] = 'any'
        properties['ExecStart'] = properties['ExecStart'].replace('127.0.0.1', '0.0.0.0')
        MODULE.check_app(report, values, properties)
        self.assertFalse(report.checks['sitov.app.env.TRUSTED_PROXY_HOPS'])
        self.assertFalse(report.checks['sitov.app.systemd.IPAddressAllow'])
        self.assertFalse(report.checks['sitov.app.systemd.loopback_listener'])

    def test_subprocess_failure_and_exception_never_emit_stdout_stderr_or_secrets(self):
        canary = 'DO-NOT-PRINT-subprocess-secret'
        output = io.StringIO()
        with patch.object(MODULE, 'collect', side_effect=RuntimeError(canary)), contextlib.redirect_stdout(output):
            self.assertEqual(MODULE.main(), 1)
        self.assertEqual(output.getvalue(), 'DRIFT sitov.source.collection\n')
        with patch.object(MODULE.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout=canary, stderr=canary)):
            with self.assertRaises(RuntimeError) as failure:
                MODULE.command(['docker', 'inspect', 'safe-test-name'])
        self.assertNotIn(canary, str(failure.exception))

    def test_full_collector_uses_only_passive_commands_and_suppresses_unmonitored_secrets(self):
        canary = 'DO-NOT-PRINT-database-and-jwt-secret'
        services, containers = {}, {}
        for name in MODULE.CONTRACTS:
            configured, runtime = fixture(name)
            configured['environment']['UNMONITORED_PRIVATE_KEY'] = canary
            runtime['Config']['Env'].append('UNMONITORED_PRIVATE_KEY=' + canary)
            services[name] = configured
            containers[name + '-' + MODULE.PROJECT] = [runtime]
        services['supabase-db'] = {'image': 'pinned-database-fixture', 'ports': ['127.0.0.1:5432:5432']}
        containers['supabase-db-' + MODULE.PROJECT] = [{'Config': {'Image': 'pinned-database-fixture', 'Env': ['POSTGRES_PASSWORD=' + canary]},
                                                       'HostConfig': {'PortBindings': {'5432/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '5432'}]}}}]
        nginx, proxy = nginx_fixture()
        containers['coolify-proxy'] = [proxy]
        properties = {'ActiveState': 'active', 'User': 'sitov', 'WorkingDirectory': '/var/www/sitov-current',
                      'MemoryMax': '2147483648', 'NoNewPrivileges': 'yes', 'PrivateTmp': 'yes', 'ProtectSystem': 'strict',
                      'IPAddressAllow': '127.0.0.0/8 ::1/128', 'IPAddressDeny': '0.0.0.0/0 ::/0',
                      'ExecStart': '{ argv[]=/usr/bin/node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000 ; }'}
        def passive(args, **kwargs):
            if args[:2] == ['docker', 'inspect']:
                data = json.dumps(containers[args[2]])
            elif args[:3] == ['systemctl', 'show', 'sitov-app']:
                data = '\n'.join(key + '=' + value for key, value in properties.items())
            elif args == ['systemctl', 'is-active', 'nginx']:
                data = 'active\n'
            elif args == ['nginx', '-T']:
                data = nginx
            else:
                self.fail('Non-passive or unexpected subprocess')
            return SimpleNamespace(returncode=0, stdout=data, stderr=canary)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            compose, app_env = root / 'compose.yml', root / 'app.env'
            compose.write_text(MODULE.yaml.safe_dump({'services': services}))
            app_env.write_text('\n'.join(key + '=' + value for key, value in MODULE.APP_VALUES.items()) + '\nPRIVATE_KEY=' + canary)
            output = io.StringIO()
            with patch.object(MODULE, 'COMPOSE', compose), patch.object(MODULE, 'APP_ENV', app_env), \
                    patch.object(MODULE.subprocess, 'run', side_effect=passive), contextlib.redirect_stdout(output):
                self.assertEqual(MODULE.main(), 0)
            self.assertNotIn(canary, output.getvalue())
            self.assertTrue(all(line.startswith('OK sitov.') for line in output.getvalue().splitlines()))
            compose.write_text('services: first-' + canary + '\nservices: second-' + canary + '\n')
            output = io.StringIO()
            with patch.object(MODULE, 'COMPOSE', compose), patch.object(MODULE, 'APP_ENV', app_env), \
                    patch.object(MODULE.subprocess, 'run', side_effect=passive), contextlib.redirect_stdout(output):
                self.assertEqual(MODULE.main(), 1)
            self.assertIn('DRIFT sitov.source.compose', output.getvalue())
            self.assertNotIn(canary, output.getvalue())


if __name__ == '__main__':
    unittest.main()
