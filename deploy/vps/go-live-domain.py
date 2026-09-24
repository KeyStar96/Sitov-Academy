#!/usr/bin/env python3
"""Move Sitov from https://217.154.228.254 to https://www.sitov-academy.com.

Run on the VPS as root:
  check      read-only: DNS at the IONOS nameservers, prepared domain build, Traefik route, certificates
  prepare    BEFORE the DNS change; the live site stays untouched. Writes
             /etc/sitov-academy/app.env.domain and builds the domain release into
             /var/www/sitov-releases-domain (NEXT_PUBLIC_* are baked in at build).
  activate   AFTER both DNS names point here. In order: Traefik routes +
             Let's Encrypt certificate, Supabase Auth URLs, app.env, domain
             release (restarts app and mail). Nothing is changed unless DNS and
             the prepared build check out; backups go to
             /root/backups/sitov-domain-cutover/<stamp> (root-only, contain secrets).
  rollback --backup DIR --release REV
             restores app.env and the Auth URLs from DIR and re-activates the
             IP release REV. Pair it with the DNS records back to Netlify.

The Auth allow list keeps the IP for links sent before the move. The domain
Traefik file stays in place on rollback; it only answers for the domain names.
"""
import argparse
import datetime
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time

IP = '217.154.228.254'
IPV6 = '2a01:239:485:b000::1'
APEX = 'sitov-academy.com'
WWW = 'www.sitov-academy.com'
ORIGIN = 'https://' + WWW
APP_VALUES = {'NEXT_PUBLIC_SITE_URL': ORIGIN, 'SITE_URL': ORIGIN, 'NEXT_PUBLIC_SUPABASE_URL': ORIGIN + '/supabase'}
AUTH_VALUES = {'API_EXTERNAL_URL': ORIGIN + '/supabase', 'GOTRUE_SITE_URL': ORIGIN,
               'GOTRUE_URI_ALLOW_LIST': f'{ORIGIN}/**,https://{IP}/**'}
# Authoritative IONOS nameservers (fallback if the NS lookup fails). Asking them directly
# avoids waiting out the 1 h TTL in public caches while visitors already reach the VPS.
RESOLVERS = ('ns1100.ui-dns.de', 'ns1077.ui-dns.org', 'ns1057.ui-dns.com', 'ns1053.ui-dns.biz')

APP_ENV = Path('/etc/sitov-academy/app.env')
DOMAIN_ENV = Path('/etc/sitov-academy/app.env.domain')
COMPOSE_DIR = Path('/data/coolify/services/eknmzxvqilojjicinatnllbt')
COMPOSE = COMPOSE_DIR / 'docker-compose.yml'
AUTH = 'supabase-auth-eknmzxvqilojjicinatnllbt'
TRAEFIK_SOURCE = Path(__file__).resolve().with_name('traefik-domain.yaml')
TRAEFIK_TARGET = Path('/data/coolify/proxy/dynamic/sitov-domain.yaml')
SOURCE = Path('/var/www/sitov-academy')
DEPLOY = SOURCE / 'deploy/vps/deploy-release.sh'
CURRENT = Path('/var/www/sitov-current')
DOMAIN_RELEASES = Path('/var/www/sitov-releases-domain')
BACKUPS = Path('/root/backups/sitov-domain-cutover')


# ── pure helpers (unit-tested) ──────────────────────────────────────────────

def patch_env(text, values):
    """Replace exactly one `KEY=...` line per key; everything else stays byte-identical."""
    for key, value in values.items():
        pattern = re.compile(r'(?m)^' + re.escape(key) + r'=.*$')
        if len(pattern.findall(text)) != 1:
            raise RuntimeError(f'{key} must appear exactly once in the env file')
        text = pattern.sub(lambda _: f'{key}="{value}"', text)
    return text


def auth_block(compose):
    """Byte range of the supabase-auth service in the list-format compose file."""
    start = re.search(r'(?m)^  supabase-auth:[ \t]*$', compose)
    if not start:
        raise RuntimeError('supabase-auth service not found')
    following = re.search(r'(?m)^  [A-Za-z0-9_.-]+:[ \t]*$', compose[start.end():])
    return start.end(), start.end() + following.start() if following else len(compose)


def patch_auth(compose, values):
    start, end = auth_block(compose)
    block = compose[start:end]
    if not re.search(r'(?m)^    memswap_limit:', block):
        # Recreating Auth without a pinned swap cap resets MemorySwap (Phase 2 finding).
        raise RuntimeError('supabase-auth has no memswap_limit; pin it before recreating the container')
    for key, value in values.items():
        pattern = re.compile(r'(?m)^    - ' + re.escape(key) + r'=.*$')
        if len(pattern.findall(block)) != 1 or len(re.findall(r'(?m)^\s*-?\s*' + re.escape(key) + r'\s*[=:]', block)) != 1:
            raise RuntimeError(f'{key} must appear exactly once in supabase-auth')
        block = pattern.sub(lambda _: f'    - {key}={value}', block)
    return compose[:start] + block + compose[end:]


def dns_problems(answers):
    """answers: {(name, resolver, 'A'|'AAAA'): [addresses]} → list of human-readable problems."""
    problems = []
    for (name, resolver, kind), addresses in sorted(answers.items()):
        if kind == 'A' and addresses != [IP]:
            problems.append(f'{name} A @{resolver} = {addresses or "—"} (erwartet {IP})')
        if kind == 'AAAA' and addresses and addresses != [IPV6]:
            # Let's Encrypt prefers IPv6; a foreign AAAA record makes the challenge fail.
            problems.append(f'{name} AAAA @{resolver} = {addresses} (bitte löschen)')
    return problems


# ── system access ───────────────────────────────────────────────────────────

def run(*command, env=None, check=True):
    print('$ ' + ' '.join(str(part) for part in command), flush=True)
    return subprocess.run([str(part) for part in command], check=check, env={**os.environ, **(env or {})})


def output(*command):
    return subprocess.run([str(part) for part in command], check=True, capture_output=True, text=True).stdout.strip()


def nameservers():
    lines = output('dig', '+short', '+time=3', '+tries=2', 'NS', APEX, '@1.1.1.1').splitlines()
    return tuple(sorted(line.rstrip('.') for line in lines if line.strip())) or RESOLVERS


def resolve():
    answers = {}
    servers = nameservers()
    for name in (APEX, WWW):
        for resolver in servers:
            for kind in ('A', 'AAAA'):
                lines = output('dig', '+short', '+norecurse', '+time=3', '+tries=2', kind, name, '@' + resolver).splitlines()
                answers[(name, resolver, kind)] = sorted(line for line in lines if re.fullmatch(r'[0-9a-f.:]+', line))
    return answers


def https_ok(host, path='/', expect=None):
    """Certificate and hostname verified by curl; connects to this VPS regardless of local DNS caches."""
    result = subprocess.run(['curl', '--silent', '--show-error', '--max-time', '10', '--resolve', f'{host}:443:{IP}',
                             '--output', '/dev/null', '--write-out', '%{http_code} %{redirect_url}', f'https://{host}{path}'],
                            capture_output=True, text=True)
    return result.returncode == 0 and (expect is None or result.stdout.startswith(expect)), (result.stdout or result.stderr).strip()


def write_like(path, content, template):
    """Atomic write that keeps owner and mode of `template`."""
    info = template.stat()
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.' + path.name + '.')
    with os.fdopen(fd, 'w') as handle:
        handle.write(content)
    os.chown(temporary, info.st_uid, info.st_gid)
    os.chmod(temporary, info.st_mode & 0o7777)
    os.replace(temporary, path)


def head_revision():
    return output('git', '-C', SOURCE, 'rev-parse', 'HEAD')[:12]


def prepared(release):
    return (DOMAIN_RELEASES / release / '.sitov-prepared').is_file()


def auth_limits():
    return output('docker', 'inspect', '--format', '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}} {{.HostConfig.NanoCpus}}', AUTH)


def recreate_auth():
    before = auth_limits()
    print('$ docker compose up -d --no-deps supabase-auth', flush=True)
    subprocess.run(['docker', 'compose', 'up', '-d', '--no-deps', 'supabase-auth'], cwd=COMPOSE_DIR, check=True)
    for _ in range(60):
        if output('docker', 'inspect', '--format', '{{.State.Health.Status}}', AUTH) == 'healthy':
            break
        time.sleep(2)
    else:
        raise RuntimeError('supabase-auth did not become healthy')
    if auth_limits() != before:
        raise RuntimeError(f'Auth limits changed: {before} -> {auth_limits()}')


# ── commands ────────────────────────────────────────────────────────────────

def check(_args):
    problems = dns_problems(resolve())
    print('DNS: ' + ('zeigt auf den VPS' if not problems else 'noch nicht umgestellt'))
    for problem in problems:
        print('  - ' + problem)
    release = head_revision()
    print(f'Domain-Build für {release}: ' + ('bereit' if prepared(release) else 'fehlt → prepare'))
    print('app.env.domain: ' + ('vorhanden' if DOMAIN_ENV.exists() else 'fehlt → prepare'))
    print('Traefik-Domainroute: ' + ('aktiv' if TRAEFIK_TARGET.exists() else 'noch nicht installiert'))
    print('Live NEXT_PUBLIC_SITE_URL: ' + next((line for line in APP_ENV.read_text().splitlines()
                                              if line.startswith('NEXT_PUBLIC_SITE_URL=')), '?'))
    for host in (WWW, APEX):
        ok, detail = https_ok(host)
        print(f'HTTPS {host}: ' + ('gültig' if ok else 'noch kein gültiges Zertifikat') + f' ({detail})')
    return 0 if not problems else 1


def prepare(_args):
    write_like(DOMAIN_ENV, patch_env(APP_ENV.read_text(), APP_VALUES), APP_ENV)
    DOMAIN_RELEASES.mkdir(mode=0o755, exist_ok=True)
    run('git', '-C', SOURCE, 'pull', '--ff-only')
    release = head_revision()
    if prepared(release):
        print(f'Domain-Build {release} ist bereits vorbereitet.')
        return 0
    run(DEPLOY, '--prepare-only', env={'SITOV_ENV_FILE': str(DOMAIN_ENV), 'SITOV_RELEASES_DIR': str(DOMAIN_RELEASES)})
    print(f'Domain-Build vorbereitet: {release}. Live-Seite unverändert.')
    return 0


def activate(args):
    release = args.release or head_revision()
    problems = dns_problems(resolve())
    if problems:
        print('DNS zeigt noch nicht (überall) auf den VPS – nichts geändert:')
        for problem in problems:
            print('  - ' + problem)
        return 1
    if not prepared(release):
        print(f'Kein Domain-Build für {release} – zuerst prepare ausführen. Nichts geändert.')
        return 1
    if not DOMAIN_ENV.exists() or DOMAIN_ENV.read_text() != patch_env(APP_ENV.read_text(), APP_VALUES):
        print('app.env hat sich seit prepare geändert – prepare erneut ausführen. Nichts geändert.')
        return 1
    compose_patched = patch_auth(COMPOSE.read_text(), AUTH_VALUES)

    backup = BACKUPS / datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup.mkdir(parents=True, mode=0o700)
    shutil.copy2(APP_ENV, backup / 'app.env')
    shutil.copy2(COMPOSE, backup / 'docker-compose.yml')
    (backup / 'previous-release').write_text(os.path.basename(os.readlink(CURRENT)) + '\n')
    print(f'Backup: {backup}')

    # 1. Traefik route; the certificate arrives via HTTP-01 within seconds.
    shutil.copyfile(TRAEFIK_SOURCE, TRAEFIK_TARGET)
    os.chmod(TRAEFIK_TARGET, 0o644)
    for _ in range(60):
        if https_ok(WWW)[0] and https_ok(APEX)[0]:
            break
        time.sleep(5)
    else:
        # Removing the route makes the next `activate` a configuration change, so Traefik retries ACME.
        TRAEFIK_TARGET.unlink()
        print('Kein gültiges Zertifikat nach 5 Minuten; Domainroute wieder entfernt. Auth und App unverändert.\n'
              'Diagnose: docker logs coolify-proxy 2>&1 | grep -i -E "acme|certificate" | tail\n'
              'Erneut versuchen: activate (frühestens nach einigen Minuten).')
        return 1
    print('Zertifikat für www und Apex gültig.')

    # 2. Supabase Auth URLs.
    write_like(COMPOSE, compose_patched, COMPOSE)
    recreate_auth()
    print('Supabase Auth läuft mit Domain-URLs.')

    # 3. app.env + domain release (restarts app and mail, health-checked).
    write_like(APP_ENV, DOMAIN_ENV.read_text(), APP_ENV)
    result = run(DEPLOY, '--activate', release, env={'SITOV_RELEASES_DIR': str(DOMAIN_RELEASES)}, check=False)
    if result.returncode != 0:
        write_like(APP_ENV, (backup / 'app.env').read_text(), APP_ENV)
        run('systemctl', 'restart', 'sitov-app', 'sitov-mail', check=False)
        print(f'Aktivierung fehlgeschlagen; vorheriges Release und app.env zurück. Rollback komplett:\n'
              f'  {__file__} rollback --backup {backup} --release {(backup / "previous-release").read_text().strip()}')
        return 1

    checks = [(WWW, '/api/health', '200'), (APEX, '/de', '301 https://www.sitov-academy.com/de')]
    for host, path, expect in checks:
        ok, detail = https_ok(host, path, expect)
        print(f'{"OK " if ok else "!! "} https://{host}{path} → {detail}')
    print(f'Live unter {ORIGIN}. Rollback bei Bedarf:\n'
          f'  {__file__} rollback --backup {backup} --release {(backup / "previous-release").read_text().strip()}')
    return 0


def rollback(args):
    backup = Path(args.backup)
    write_like(COMPOSE, (backup / 'docker-compose.yml').read_text(), COMPOSE)
    recreate_auth()
    write_like(APP_ENV, (backup / 'app.env').read_text(), APP_ENV)
    result = run(DEPLOY, '--activate', args.release, check=False)
    return result.returncode


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('check').set_defaults(handler=check)
    commands.add_parser('prepare').set_defaults(handler=prepare)
    activate_parser = commands.add_parser('activate')
    activate_parser.add_argument('--release', help='prepared domain release (default: current Git HEAD)')
    activate_parser.set_defaults(handler=activate)
    rollback_parser = commands.add_parser('rollback')
    rollback_parser.add_argument('--backup', required=True)
    rollback_parser.add_argument('--release', required=True)
    rollback_parser.set_defaults(handler=rollback)
    args = parser.parse_args()
    if os.geteuid() != 0:
        sys.exit('Als root ausführen.')
    sys.exit(args.handler(args))


if __name__ == '__main__':
    main()
