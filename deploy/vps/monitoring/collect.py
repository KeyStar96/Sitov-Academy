#!/usr/bin/env python3
"""Root-only, fixed read commands. No credentials or personal mail data in output."""
import json
import os
import shutil
import smtplib
import subprocess
import time
import urllib.request
from email.message import EmailMessage
from pathlib import Path
from common import atomic_json, evaluate

DATA = Path('/var/lib/sitov-monitor')
STATE = Path('/var/lib/sitov-monitor-private')
DB = 'supabase-db-eknmzxvqilojjicinatnllbt'
SUFFIX = '-eknmzxvqilojjicinatnllbt'
EXPECTED = ['supabase-' + name for name in ('studio', 'supavisor', 'meta', 'vector', 'analytics', 'storage', 'auth', 'db', 'kong', 'edge-functions', 'rest', 'minio')]
EXPECTED += ['realtime-dev', 'imgproxy']
SERVICES = ['sitov-app', 'sitov-mail', 'sitov-tts', 'postfix', 'nginx']


def run(command, timeout=6):
    return subprocess.run(command, capture_output=True, text=True, check=True, timeout=timeout).stdout


def attempt(call):
    try:
        return call()
    except (OSError, ValueError, KeyError, subprocess.SubprocessError):
        return None  # Explicit unknown alarms, not healthy fallbacks.


def host_memory():
    fields = dict((line.split(':')[0], int(line.split()[1])) for line in Path('/proc/meminfo').read_text().splitlines())
    return round((1 - fields['MemAvailable'] / fields['MemTotal']) * 100, 2)


def cpu_sample():
    values = list(map(int, Path('/proc/stat').read_text().splitlines()[0].split()[1:9]))
    return {'total': sum(values), 'idle': values[3] + values[4]}


def containers():
    # Project only status fields. Never serialize inspect Config.Env or labels.
    names = [name + SUFFIX for name in EXPECTED]
    records = run(['docker', 'inspect', '--format', '{{json .State}}', *names])
    rows = [json.loads(line) for line in records.splitlines()]
    if len(rows) != len(names):
        raise ValueError('missing_container')
    return {name: ('oom' if row.get('OOMKilled') else row.get('Health', {}).get('Status', row['Status'])) for name, row in zip(EXPECTED, rows)}


def health():
    with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=5) as response:
        return response.status == 200 and json.load(response).get('status') == 'ready'


def outbox():
    query = """SET statement_timeout='3s'; SELECT json_build_object(
     'due',count(*) FILTER(WHERE status='pending' AND available_at<=now()),
     'failed',count(*) FILTER(WHERE status='failed'),
     'processing',count(*) FILTER(WHERE status='processing'),
     'oldest_due_seconds',coalesce(max(extract(epoch FROM now()-available_at)) FILTER(WHERE status='pending' AND available_at<=now()),0),
     'expired_leases',count(*) FILTER(WHERE status='processing' AND lease_until<now()))
     FROM private.mail_outbox WHERE status IN ('pending','processing','failed');"""
    raw = run(['docker', 'exec', DB, 'psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', query])
    result = json.loads(raw)
    if result['expired_leases']:
        result['failed'] += result['expired_leases']
    return result


def notify(alarms):
    """Independent of app/DB outbox. Local Postfix handles retry after acceptance."""
    message = EmailMessage()
    message['From'] = 'Sitov Monitor <info@sitov-academy.com>'
    message['To'] = os.environ.get('MONITOR_RECIPIENT', 'info@sitov-academy.com')
    message['Subject'] = 'Sitov Monitoring: ' + ('Alarm' if alarms else 'Wiederhergestellt')
    message.set_content('Status: ' + (', '.join(alarms) if alarms else 'Alle Prüfungen wieder erfolgreich.') + '\nStatusseite: https://217.154.228.254/status/\n')
    with smtplib.SMTP('127.0.0.1', 25, timeout=5) as smtp:
        smtp.send_message(message)


def main():
    DATA.mkdir(exist_ok=True)
    STATE.mkdir(mode=0o700, exist_ok=True)
    os.chmod(STATE, 0o700)
    try:
        previous = json.loads((STATE / 'state.json').read_text())
    except FileNotFoundError:
        previous = {}
    current_cpu = cpu_sample()
    old_cpu = previous.get('cpu')
    if not old_cpu:
        old_cpu = current_cpu
        time.sleep(0.15)
        current_cpu = cpu_sample()
    total = current_cpu['total'] - old_cpu['total']
    cpu = round(100 * (1 - (current_cpu['idle'] - old_cpu['idle']) / total), 2) if total > 0 else None
    disk = shutil.disk_usage('/')
    # systemctl returns nonzero for an inactive service; each unknown is visible.
    states = {name: attempt(lambda name=name: run(['systemctl', 'is-active', name], timeout=2).strip()) or 'inactive' for name in SERVICES}
    sample = evaluate({'timestamp': time.time(), 'health': attempt(health) is True,
        'cpu_percent': cpu, 'ram_percent': attempt(host_memory), 'disk_percent': round(disk.used / disk.total * 100, 2),
        'disk_total_bytes': disk.total, 'containers': attempt(containers), 'services': states, 'outbox': attempt(outbox)}, previous)
    delivered = previous.get('delivered_alarms', [])
    desired = sample['alarms']
    last_send = previous.get('last_send', 0)
    # Suppress unchanged alerts; coalesce flapping changes for five minutes.
    if desired != delivered and time.time() - last_send >= 300:
        try:
            notify(desired)
            delivered, last_send = desired[:], time.time()
        except (OSError, subprocess.SubprocessError, smtplib.SMTPException):
            sample['alarms'] = sorted(set(desired + ['alert_delivery_failed']))
            print('monitor_alert_delivery_failed', flush=True)
    try:
        history = json.loads((DATA / 'history.json').read_text())
    except FileNotFoundError:
        history = []
    history = (history + [{key: sample[key] for key in ('timestamp', 'cpu_percent', 'ram_percent', 'disk_percent', 'alarms')}])[-1440:]
    atomic_json(DATA / 'history.json', history)
    atomic_json(DATA / 'status.json', sample)
    atomic_json(STATE / 'state.json', dict(sample, cpu=current_cpu, delivered_alarms=delivered, last_send=last_send))
    print(json.dumps({'alarms': sample['alarms'], 'health_failures': sample['health_failures']}), flush=True)


if __name__ == '__main__':
    main()
