#!/usr/bin/env python3
"""VPS-only installer. Prints summaries, never credentials or full Docker inspect."""
import datetime
import json
import os
import secrets
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
TARGET = Path('/opt/sitov-monitor')
NGINX = Path('/etc/nginx/sites-enabled/test-app').resolve()
TTS = Path('/etc/systemd/system/sitov-tts.service')
MIB = 1024 * 1024


def run(command, **kwargs):
    return subprocess.check_output(command, text=True, **kwargs).strip()


def inventory():
    ids = run(['docker', 'ps', '-aq']).split()
    containers = json.loads(run(['docker', 'inspect', *ids]))
    result = {'containers': [{'name': c['Name'].lstrip('/'), 'running': c['State']['Running'],
        'memory_mib': c['HostConfig']['Memory'] // MIB or None,
        'cpu': (c['HostConfig']['NanoCpus'] / 1e9 or (c['HostConfig']['CpuQuota'] / c['HostConfig']['CpuPeriod'] if c['HostConfig']['CpuQuota'] > 0 and c['HostConfig']['CpuPeriod'] else None))}
        for c in containers], 'services': {}}
    for name in ['sitov-app', 'sitov-mail', 'sitov-tts', 'sitov-monitor-collect']:
        raw = run(['systemctl', 'show', name, '-p', 'LoadState', '-p', 'MemoryMax', '-p', 'CPUQuotaPerSecUSec'])
        fields = dict(line.split('=', 1) for line in raw.splitlines())
        if fields.get('LoadState') != 'not-found':
            memory = fields.get('MemoryMax', 'infinity')
            result['services'][name] = {'memory_mib': int(memory) // MIB if memory.isdigit() else None, 'cpu_quota': fields.get('CPUQuotaPerSecUSec')}
    result['known_memory_mib'] = sum(c['memory_mib'] or 0 for c in result['containers'] if c['running']) + sum(s['memory_mib'] or 0 for s in result['services'].values())
    return result


def main():
    if os.geteuid() != 0 or not NGINX.is_file() or not TTS.is_file():
        raise RuntimeError('Run only on the verified VPS as root')
    before = inventory()
    tts = TTS.read_text()
    if 'MemoryMax=2G' not in tts and 'MemoryMax=1792M' not in tts:
        raise RuntimeError('Unexpected TTS config; inspect before changing')
    if before['services']['sitov-tts']['memory_mib'] not in (2048, 1792):
        raise RuntimeError('Unexpected live TTS limit')
    if int(run(['systemctl', 'show', 'sitov-tts', '-p', 'MemoryCurrent', '--value'])) > 1400 * MIB:
        raise RuntimeError('TTS memory too high for safe reduction')
    nginx = NGINX.read_text()
    marker = '    location /mail-templates/ {'
    include = '    include /etc/nginx/snippets/sitov-status.conf;'
    if marker not in nginx:
        raise RuntimeError('Unexpected nginx config')
    if include not in nginx:
        nginx = nginx.replace(marker, include + '\n\n' + marker, 1)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = Path('/root/backups') / ('phase6-monitor-' + stamp)
    backup.mkdir(mode=0o700)
    for path in [NGINX, TTS, Path('/etc/nginx/snippets/sitov-status.conf')]:
        if path.exists():
            shutil.copy2(path, backup / path.name)
    (backup / 'before.json').write_text(json.dumps(before, indent=2))
    print(json.dumps({'backup': str(backup), 'before': before}), flush=True)
    # Reclaim first; adding 128+64 afterwards leaves at least 64 MiB less than
    # original known limits. No unrelated Supabase services are restarted.
    TTS.write_text(tts.replace('MemoryMax=2G', 'MemoryMax=1792M'))
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    subprocess.run(['systemctl', 'set-property', '--runtime', 'sitov-tts', 'MemoryMax=1792M'], check=True)
    TARGET.mkdir(mode=0o755, exist_ok=True)
    for name in ['common.py', 'collect.py', 'server.py', 'compose.yml']:
        shutil.copy2(HERE / name, TARGET / name)
    for name in ['sitov-monitor-collect.service', 'sitov-monitor-collect.timer']:
        shutil.copy2(HERE / name, Path('/etc/systemd/system') / name)
    Path('/var/lib/sitov-monitor').mkdir(mode=0o755, exist_ok=True)
    Path('/var/lib/sitov-monitor-private').mkdir(mode=0o700, exist_ok=True)
    auth = Path('/etc/nginx/sitov-status.htpasswd')
    if not auth.exists():
        password = secrets.token_urlsafe(24)
        hashed = run(['openssl', 'passwd', '-6', '-stdin'], input=password + '\n')
        auth.write_text('monitor:' + hashed + '\n')
        shutil.chown(auth, user='root', group='www-data')
        auth.chmod(0o640)
        access = Path('/root/sitov-status-access.txt')
        with os.fdopen(os.open(access, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as output:
            output.write('https://217.154.228.254/status/\nBenutzer: monitor\nPasswort: ' + password + '\n')
    shutil.copy2(HERE / 'nginx-status.conf', '/etc/nginx/snippets/sitov-status.conf')
    NGINX.write_text(nginx)
    try:
        subprocess.run(['nginx', '-t'], check=True)
    except subprocess.CalledProcessError:
        shutil.copy2(backup / NGINX.name, NGINX)
        raise
    subprocess.run(['systemctl', 'daemon-reload'], check=True)
    subprocess.run(['systemctl', 'start', 'sitov-monitor-collect.service'], check=True)
    subprocess.run(['docker', 'compose', '-f', str(TARGET / 'compose.yml'), 'up', '-d'], check=True)
    subprocess.run(['systemctl', 'enable', '--now', 'sitov-monitor-collect.timer'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    after = inventory()
    if after['known_memory_mib'] > before['known_memory_mib']:
        raise RuntimeError('Unexpected aggregate memory increase; inspect before continuing')
    (backup / 'after.json').write_text(json.dumps(after, indent=2))
    print(json.dumps({'after': after, 'credentials': '/root/sitov-status-access.txt'}))


if __name__ == '__main__':
    main()
