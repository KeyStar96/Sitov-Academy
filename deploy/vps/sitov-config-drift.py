#!/usr/bin/env python3
"""Passively check Sitov Academy's canonical deployment invariants.

Print only fixed invariant names and OK/DRIFT, never configuration values,
container environments, subprocess output or exception text. Exit 1 on drift
or an unavailable source. Nothing is repaired, restarted or written.
"""
import ipaddress
import json
from pathlib import Path
import re
import subprocess

import yaml

PROJECT = 'eknmzxvqilojjicinatnllbt'
COMPOSE = Path('/data/coolify/services') / PROJECT / 'docker-compose.yml'
APP_ENV = Path('/etc/sitov-academy/app.env')
NGINX_SITE = '/etc/nginx/sites-enabled/test-app'
TRUSTED_PROXY = '/etc/nginx/snippets/sitov-trusted-proxy.conf'
ORIGIN = 'https://www.sitov-academy.com'
AUTH_ENV = {
    'API_EXTERNAL_URL': ORIGIN + '/supabase',
    'GOTRUE_SITE_URL': ORIGIN,
    'GOTRUE_URI_ALLOW_LIST': ORIGIN + '/**,https://217.154.228.254/**',
    'GOTRUE_MAILER_AUTOCONFIRM': 'false',
    'GOTRUE_SMTP_HOST': 'host.docker.internal',
    'GOTRUE_SMTP_PORT': '2525',
    'GOTRUE_SMTP_USER': '',
    'GOTRUE_SMTP_PASS': '',
    'GOTRUE_SMTP_ADMIN_EMAIL': 'info@sitov-academy.com',
    'GOTRUE_SMTP_SENDER_NAME': 'Sitov Academy',
    'GOTRUE_PASSWORD_HIBP_ENABLED': 'true',
    'GOTRUE_PASSWORD_HIBP_FAIL_CLOSED': 'false',
    'GOTRUE_PASSWORD_MIN_LENGTH': '8',
}
for kind in ('CONFIRMATION', 'RECOVERY', 'INVITE', 'MAGIC_LINK', 'EMAIL_CHANGE'):
    AUTH_ENV['GOTRUE_MAILER_TEMPLATES_' + kind] = 'http://host.docker.internal:8088/mail-templates/' + kind.lower() + '.html'
CONTRACTS = {
    'supabase-auth': {'env': AUTH_ENV, 'image': 'supabase/gotrue:v2.186.0', 'memory': 256 * 1024 ** 2, 'cpu': 0.5},
    'supabase-storage': {'env': {'UPLOAD_FILE_SIZE_LIMIT': '536870912', 'UPLOAD_FILE_SIZE_LIMIT_STANDARD': '536870912',
                                 'STORAGE_BACKEND': 's3'}, 'image': 'supabase/storage-api:v1.44.2',
                         'memory': 384 * 1024 ** 2, 'cpu': 1},
    'supabase-kong': {'env': {'KONG_NGINX_WORKER_PROCESSES': '1'}, 'image': 'kong/kong:3.9.1',
                      'memory': 512 * 1024 ** 2, 'cpu': 1},
}
APP_VALUES = {'NODE_ENV': 'production', 'NEXT_PUBLIC_SITE_URL': ORIGIN, 'SITE_URL': ORIGIN,
              'NEXT_PUBLIC_SUPABASE_URL': ORIGIN + '/supabase', 'CANONICAL_SITE_URL': ORIGIN,
              'TRUSTED_PROXY_HOPS': '1'}
APP_PROPERTIES = ('ActiveState', 'User', 'WorkingDirectory', 'MemoryMax', 'NoNewPrivileges', 'PrivateTmp',
                  'ProtectSystem', 'IPAddressAllow', 'IPAddressDeny', 'ExecStart')


class UniqueSafeLoader(yaml.SafeLoader):
    pass


def unique_mapping(loader, node, deep=False):
    loader.flatten_mapping(node)
    values = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in values:
            raise ValueError('Duplicate configuration key')
        values[key] = loader.construct_object(value_node, deep=deep)
    return values


UniqueSafeLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


class Report:
    def __init__(self):
        self.checks = {}

    def check(self, name, passed):
        # No names may come from configuration files or command output.
        if not re.fullmatch(r'sitov\.[A-Za-z0-9_.-]+', name):
            raise ValueError('Invalid invariant name')
        self.checks[name] = bool(passed)

    def emit(self):
        for name, passed in sorted(self.checks.items()):
            print(('OK ' if passed else 'DRIFT ') + name)
        return 0 if self.checks and all(self.checks.values()) else 1


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=15)
    if result.returncode:
        raise RuntimeError('Source unavailable')
    return result.stdout


def environment(value):
    if isinstance(value, list):
        pairs = [item.split('=', 1) for item in value if isinstance(item, str) and '=' in item]
        if len(pairs) != len(value) or len({key for key, _ in pairs}) != len(pairs):
            raise ValueError('Invalid environment')
        return dict(pairs)
    if isinstance(value, dict):
        return {key: str(item).lower() if isinstance(item, bool) else str(item) for key, item in value.items()}
    raise ValueError('Invalid environment')


def memory_bytes(value):
    if isinstance(value, bool):
        return None
    match = re.fullmatch(r'([0-9]+)([kKmMgG]?)', str(value))
    return int(match[1]) * 1024 ** {'': 0, 'k': 1, 'm': 2, 'g': 3}[match[2].lower()] if match else None


def canonical_ports(value):
    ports = []
    for port in value or []:
        if isinstance(port, str):
            parts = port.removesuffix('/tcp').split(':')
            if len(parts) != 3:
                return None
            ports.append(tuple(parts))
        elif isinstance(port, dict) and port.get('protocol', 'tcp') == 'tcp':
            ports.append((str(port.get('host_ip', '')), str(port.get('published', '')), str(port.get('target', ''))))
        else:
            return None
    return sorted(ports)


def runtime_ports(bindings):
    return sorted((str(binding.get('HostIp', '')), str(binding.get('HostPort', '')), port.removesuffix('/tcp'))
                  for port, values in (bindings or {}).items() for binding in values or [])


def check_service(report, name, configured, runtime):
    contract = CONTRACTS[name]
    prefix = 'sitov.' + name
    report.check(prefix + '.compose.present', isinstance(configured, dict))
    report.check(prefix + '.runtime.present', isinstance(runtime, dict))
    configured = configured if isinstance(configured, dict) else {}
    runtime = runtime if isinstance(runtime, dict) else {}
    config = runtime.get('Config') or {}
    limits = runtime.get('HostConfig') or {}
    state = runtime.get('State') or {}
    for source, raw in (('compose', configured.get('environment')), ('runtime', config.get('Env'))):
        try:
            values = environment(raw)
        except (TypeError, ValueError):
            values = {}
        report.check(prefix + '.' + source + '.environment_valid', bool(values))
        for key, expected in contract['env'].items():
            report.check(prefix + '.' + source + '.' + key, values.get(key) == expected)
        if name == 'supabase-auth':
            # The deployed SMTP/template flow has no custom email hook.
            report.check(prefix + '.' + source + '.email_hook_disabled',
                         values.get('GOTRUE_HOOK_SEND_EMAIL_ENABLED', 'false') == 'false' and
                         not values.get('GOTRUE_HOOK_SEND_EMAIL_URI') and not values.get('GOTRUE_HOOK_SEND_EMAIL_SECRETS'))
    report.check(prefix + '.compose.container_name', configured.get('container_name') == name + '-' + PROJECT)
    report.check(prefix + '.compose.image', configured.get('image') == contract['image'])
    report.check(prefix + '.runtime.image', config.get('Image') == contract['image'])
    report.check(prefix + '.compose.memory', memory_bytes(configured.get('mem_limit')) == contract['memory'])
    report.check(prefix + '.compose.swap', memory_bytes(configured.get('memswap_limit')) == contract['memory'])
    report.check(prefix + '.runtime.memory', limits.get('Memory') == contract['memory'])
    report.check(prefix + '.runtime.swap', limits.get('MemorySwap') == contract['memory'])
    report.check(prefix + '.compose.cpu', str(configured.get('cpus')) in (str(contract['cpu']), str(float(contract['cpu']))))
    report.check(prefix + '.runtime.cpu', limits.get('NanoCpus') == int(contract['cpu'] * 10 ** 9))
    report.check(prefix + '.runtime.running', state.get('Running') is True)
    report.check(prefix + '.runtime.healthy', (state.get('Health') or {}).get('Status') == 'healthy')
    expected_ports = [('127.0.0.1', '9080', '8000')] if name == 'supabase-kong' else []
    report.check(prefix + '.compose.loopback_ports', canonical_ports(configured.get('ports')) == expected_ports)
    report.check(prefix + '.runtime.loopback_ports', runtime_ports(limits.get('PortBindings')) == expected_ports)
    if name == 'supabase-auth':
        configured_hosts = configured.get('extra_hosts')
        report.check(prefix + '.compose.mail_host_gateway', configured_hosts == ['host.docker.internal:host-gateway'] or
                     configured_hosts == {'host.docker.internal': 'host-gateway'})
        report.check(prefix + '.runtime.mail_host_gateway', 'host.docker.internal:host-gateway' in (limits.get('ExtraHosts') or []))


def dotenv(text):
    values = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if not separator or key in values:
            raise ValueError('Invalid app environment')
        values[key] = value.strip().strip('\"\x27')
    return values


def check_app(report, app_values, properties):
    for key, expected in APP_VALUES.items():
        report.check('sitov.app.env.' + key, app_values.get(key) == expected)
    expected = {'ActiveState': 'active', 'User': 'sitov', 'WorkingDirectory': '/var/www/sitov-current',
                'MemoryMax': '2147483648', 'NoNewPrivileges': 'yes', 'PrivateTmp': 'yes', 'ProtectSystem': 'strict'}
    for key, value in expected.items():
        report.check('sitov.app.systemd.' + key, properties.get(key) == value)
    report.check('sitov.app.systemd.IPAddressAllow', set(properties.get('IPAddressAllow', '').split()) == {'127.0.0.0/8', '::1/128'})
    report.check('sitov.app.systemd.IPAddressDeny', set(properties.get('IPAddressDeny', '').split()) == {'0.0.0.0/0', '::/0'})
    report.check('sitov.app.systemd.loopback_listener',
                 bool(re.search(r'next start -H 127\.0\.0\.1 -p 3000(?:\s|;|$)', properties.get('ExecStart', ''))))


def nginx_file(dump, name):
    marker = '# configuration file ' + name + ':\n'
    if dump.count(marker) != 1:
        raise ValueError('nginx source missing or repeated')
    return dump.split(marker, 1)[1].split('\n# configuration file ', 1)[0]


def location(text, name):
    match = re.search(r'\blocation\s+' + re.escape(name) + r'\s*\{', text)
    if not match:
        return ''
    start, depth = match.end(), 1
    for index in range(start, len(text)):
        depth += (text[index] == '{') - (text[index] == '}')
        if depth == 0:
            return text[start:index]
    return ''


def nginx_map(text, source, target):
    match = re.search(r'\bmap\s+' + re.escape(source) + r'\s+' + re.escape(target) + r'\s*\{([^}]+)\}', text)
    return ' '.join(match[1].split()) if match else ''


def directive(text, key, expected):
    values = re.findall(r'(?:^|[;{}])\s*' + re.escape(key) + r'\s+([^;{}]+);', text)
    return len(values) == 1 and ' '.join(values[0].split()) == expected


def check_nginx(report, dump, proxy):
    site = re.sub(r'(?m)#.*$', '', nginx_file(dump, NGINX_SITE))
    trust = re.sub(r'(?m)#.*$', '', nginx_file(dump, TRUSTED_PROXY))
    app, storage = location(site, '/'), location(site, '/supabase/')
    report.check('sitov.nginx.app_location', bool(app))
    report.check('sitov.nginx.storage_location', bool(storage))
    listeners = re.findall(r'\blisten\s+([^;]+);', site)
    report.check('sitov.nginx.private_listeners', set(listeners) == {'127.0.0.1:8088', '10.0.0.1:8088'})
    for name, block in (('app', app), ('storage', storage)):
        report.check('sitov.nginx.' + name + '.trusted_proxy', directive(block, 'include', TRUSTED_PROXY))
        report.check('sitov.nginx.' + name + '.forwarded_protocol', 'proxy_set_header X-Forwarded-Proto https;' in block)
        report.check('sitov.nginx.' + name + '.forwarded_chain', 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' in block)
    report.check('sitov.nginx.app.destination', directive(app, 'proxy_pass', 'http://sitov_app'))
    report.check('sitov.nginx.app.header_buffer', directive(app, 'proxy_buffer_size', '32k'))
    report.check('sitov.nginx.storage.destination', directive(storage, 'proxy_pass', 'http://127.0.0.1:9080/'))
    report.check('sitov.nginx.storage.upload_limit', directive(storage, 'client_max_body_size', '512m'))
    report.check('sitov.nginx.storage.streaming', directive(storage, 'proxy_request_buffering', 'off'))
    report.check('sitov.nginx.storage.write_pause', bool(re.search(r'if\s*\(\$sitov_storage_reject\)\s*\{\s*return\s+503;', storage)))
    report.check('sitov.nginx.storage.pause_file', bool(re.search(r'if\s*\(-f\s+/run/sitov-storage-write-paused\)\s*\{\s*set\s+\$sitov_storage_paused\s+1;', storage)))
    report.check('sitov.nginx.storage.pause_map', nginx_map(site, '"$sitov_storage_paused:$request_method:$uri"', '$sitov_storage_reject') ==
                 r'default 0; ~^1:POST:/supabase/storage/v1/object/(sign|list|list-v2)(/|$) 0; ~^1:(POST|PUT|PATCH):/supabase/storage/v1/(object|upload|s3)(/|$) 1;')
    report.check('sitov.nginx.storage.writer_map', nginx_map(site, '"$request_method:$uri"', '$sitov_storage_write_key') ==
                 r'default ""; ~^POST:/supabase/storage/v1/object/(sign|list|list-v2)(/|$) ""; ~^(POST|PUT|PATCH):/supabase/storage/v1/(object|upload|s3)(/|$) $sitov_storage_client;')
    report.check('sitov.nginx.storage.client_suffix_map', nginx_map(site, '$http_x_forwarded_for', '$sitov_storage_client') ==
                 r'default $binary_remote_addr; ~(?:^|,\s*)(?<sitov_storage_client_suffix>[0-9a-fA-F:.]+)$ $sitov_storage_client_suffix;')
    report.check('sitov.nginx.storage.writer_zone', directive(site, 'limit_conn_zone', '$sitov_storage_write_key zone=sitov_storage_writers:10m'))
    report.check('sitov.nginx.storage.request_zone', directive(site, 'limit_req_zone', '$sitov_storage_write_key zone=sitov_storage_requests:10m rate=10r/s'))
    report.check('sitov.nginx.storage.concurrent_writers', directive(storage, 'limit_conn', 'sitov_storage_writers 8'))
    report.check('sitov.nginx.storage.request_limit', directive(storage, 'limit_req', 'zone=sitov_storage_requests burst=30 nodelay'))
    log = re.search(r'\blog_format\s+sitov_no_tokens\s+([^;]+);', site)
    report.check('sitov.nginx.no_token_log', bool(log) and '$uri ' in log[1] and '$request_uri' not in log[1] and '$args' not in log[1] and
                 'access_log /var/log/nginx/sitov-access.log sitov_no_tokens;' in site)
    report.check('sitov.nginx.app.loopback_upstream', bool(re.search(r'upstream\s+sitov_app\s*\{[^}]*server\s+127\.0\.0\.1:3000;', site)))
    addresses = set()
    for network in (proxy.get('NetworkSettings', {}).get('Networks') or {}).values():
        for key in ('IPAddress', 'GlobalIPv6Address'):
            if network.get(key):
                addresses.add(str(ipaddress.ip_address(network[key])))
    allowed = re.findall(r'\ballow\s+([^;]+);', trust)
    remaining = re.sub(r'\b(?:allow\s+[^;]+|deny\s+all);', '', trust).strip()
    report.check('sitov.nginx.proxy_exact_allowlist', bool(addresses) and set(allowed) == addresses and len(allowed) == len(addresses) and
                 len(re.findall(r'\bdeny\s+all;', trust)) == 1 and not remaining)


def collect(report):
    services = {}
    try:
        parsed = yaml.load(COMPOSE.read_text(), Loader=UniqueSafeLoader)
        services = parsed['services']
        if not isinstance(services, dict):
            raise ValueError('Invalid Compose')
        report.check('sitov.source.compose', True)
    except Exception:
        report.check('sitov.source.compose', False)
    for name in CONTRACTS:
        try:
            runtime = json.loads(command(['docker', 'inspect', name + '-' + PROJECT]))[0]
        except Exception:
            runtime = {}
        check_service(report, name, services.get(name), runtime)
    database = services.get('supabase-db') or {}
    report.check('sitov.database.compose.loopback_port', canonical_ports(database.get('ports')) == [('127.0.0.1', '5432', '5432')])
    try:
        runtime = json.loads(command(['docker', 'inspect', 'supabase-db-' + PROJECT]))[0]
        report.check('sitov.database.runtime.loopback_port', runtime_ports(runtime.get('HostConfig', {}).get('PortBindings')) == [('127.0.0.1', '5432', '5432')])
        report.check('sitov.database.runtime.image_matches_compose', runtime.get('Config', {}).get('Image') == database.get('image') and bool(database.get('image')))
    except Exception:
        report.check('sitov.database.runtime.available', False)
    try:
        app_values = dotenv(APP_ENV.read_text())
        report.check('sitov.source.app_env', True)
    except Exception:
        app_values = {}
        report.check('sitov.source.app_env', False)
    try:
        properties = dict(line.split('=', 1) for line in command(['systemctl', 'show', 'sitov-app',
                          *('--property=' + key for key in APP_PROPERTIES)]).splitlines() if '=' in line)
        report.check('sitov.source.app_systemd', True)
    except Exception:
        properties = {}
        report.check('sitov.source.app_systemd', False)
    check_app(report, app_values, properties)
    try:
        proxy = json.loads(command(['docker', 'inspect', 'coolify-proxy']))[0]
        check_nginx(report, command(['nginx', '-T']), proxy)
        report.check('sitov.source.nginx', True)
        report.check('sitov.nginx.runtime.active', command(['systemctl', 'is-active', 'nginx']).strip() == 'active')
    except Exception:
        report.check('sitov.source.nginx', False)


def main():
    report = Report()
    try:
        collect(report)
    except Exception:
        # Even parser/shape failures must never echo configuration or secrets.
        report.check('sitov.source.collection', False)
    return report.emit()


if __name__ == '__main__':
    raise SystemExit(main())
