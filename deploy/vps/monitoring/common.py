"""Pure monitoring policy; percentages use host capacity, never container free(1)."""
import json
import os
import time
from pathlib import Path


def atomic_json(path, value):
    path = Path(path)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')))
    os.chmod(temporary, 0o644)
    temporary.replace(path)


def evaluate(sample, previous=None):
    previous = previous or {}
    failures = 0 if sample.get('health') is True else previous.get('health_failures', 0) + 1
    alarms = []
    for field, threshold in [('disk_percent', 80), ('ram_percent', 90), ('cpu_percent', 90)]:
        value = sample.get(field)
        if value is None:
            alarms.append(field + '_unknown')
        elif value > threshold:
            alarms.append(field + '_high')
    if failures > 3:
        alarms.append('health_failed')
    if sample.get('containers') is None or not sample.get('containers'):
        alarms.append('containers_unknown')
    else:
        for name, state in sample['containers'].items():
            if state not in ('healthy', 'running'):
                alarms.append('container:' + name)
    for name, state in (sample.get('services') or {}).items():
        if state != 'active':
            alarms.append('service:' + name)
    if not sample.get('services'):
        alarms.append('services_unknown')
    outbox = sample.get('outbox')
    if outbox is None:
        alarms.append('outbox_unknown')
    elif outbox['failed'] > 0 or outbox['due'] > 100 or outbox['oldest_due_seconds'] > 300:
        alarms.append('outbox_backlog')
    return dict(sample, health_failures=failures, alarms=sorted(alarms))


def read_status(path, now=None):
    try:
        result = json.loads(Path(path).read_text())
        age = (time.time() if now is None else now) - result['timestamp']
        if age > 150 or age < -5:
            result = dict(result, alarms=sorted(set(result.get('alarms', []) + ['collector_stale'])))
        return result
    except (OSError, ValueError, KeyError, TypeError):
        return {'alarms': ['collector_unavailable'], 'timestamp': 0}
