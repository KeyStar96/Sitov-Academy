import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1] / 'monitoring'
sys.path.insert(0, str(ROOT))
from common import evaluate, read_status, atomic_json
import collect


def sample():
    return dict(timestamp=1000, health=True, disk_percent=80, ram_percent=90, cpu_percent=90,
                containers={'db': 'healthy'}, services={'mail': 'active'}, outbox={'due': 0, 'failed': 0, 'oldest_due_seconds': 0})


class MonitoringTests(unittest.TestCase):
    def test_strict_thresholds_and_four_consecutive_failures(self):
        self.assertEqual(evaluate(sample())['alarms'], [])
        previous = None
        for i in range(1, 5):
            previous = evaluate(dict(sample(), health=False), previous)
            self.assertEqual('health_failed' in previous['alarms'], i > 3)
        self.assertEqual(evaluate(sample(), previous)['health_failures'], 0)
        for field in ('disk_percent', 'ram_percent', 'cpu_percent'):
            changed = sample(); changed[field] += .01
            self.assertIn(field + '_high', evaluate(changed)['alarms'])

    def test_missing_sources_are_never_healthy(self):
        for field, alarm in [('containers', 'containers_unknown'), ('outbox', 'outbox_unknown'), ('services', 'services_unknown'), ('ram_percent', 'ram_percent_unknown')]:
            self.assertIn(alarm, evaluate(dict(sample(), **{field: None}))['alarms'])
        self.assertIn('container:db', evaluate(dict(sample(), containers={'db': 'unhealthy'}))['alarms'])
        self.assertIn('service:mail', evaluate(dict(sample(), services={'mail': 'inactive'}))['alarms'])

    def test_outbox_delay_failed_jobs_and_count(self):
        for value in [{'due': 101, 'failed': 0, 'oldest_due_seconds': 0}, {'due': 1, 'failed': 0, 'oldest_due_seconds': 301}, {'due': 0, 'failed': 1, 'oldest_due_seconds': 0}]:
            self.assertIn('outbox_backlog', evaluate(dict(sample(), outbox=value))['alarms'])

    def test_stale_collector_and_atomic_json(self):
        with tempfile.TemporaryDirectory() as temporary:
            file = Path(temporary) / 'status.json'
            self.assertEqual(read_status(file)['alarms'], ['collector_unavailable'])
            atomic_json(file, evaluate(sample()))
            self.assertEqual(read_status(file, 1150)['alarms'], [])
            self.assertIn('collector_stale', read_status(file, 1151)['alarms'])
            file.write_text('invalid')
            self.assertEqual(read_status(file)['alarms'], ['collector_unavailable'])

    def test_alerts_retry_and_recovery_without_real_mail(self):
        with tempfile.TemporaryDirectory() as temporary:
            data = Path(temporary) / 'data'; state = Path(temporary) / 'state'
            with patch.object(collect, 'DATA', data), patch.object(collect, 'STATE', state), patch.object(collect, 'run', return_value='active'), patch.object(collect, 'health', return_value=True), patch.object(collect, 'containers', return_value={'db':'healthy'}), patch.object(collect, 'outbox', return_value=sample()['outbox']), patch.object(collect, 'host_memory', return_value=91) as memory, patch.object(collect, 'cpu_sample', side_effect=lambda: {'total': int(collect.time.time()*10000), 'idle': int(collect.time.time()*9500)}), patch.object(collect, 'notify', side_effect=OSError('offline')) as notify:
                collect.main()
                self.assertIn('alert_delivery_failed', json.loads((data/'status.json').read_text())['alarms'])
                notify.side_effect = None
                collect.main(); collect.main()
                self.assertEqual(notify.call_count, 2)
                previous = json.loads((state/'state.json').read_text()); previous['last_send'] = 0; atomic_json(state/'state.json', previous)
                memory.return_value = 40
                collect.main()
                self.assertEqual(notify.call_args.args, ([],))
                self.assertEqual(len(json.loads((data/'history.json').read_text())), 4)


if __name__ == '__main__':
    unittest.main()
