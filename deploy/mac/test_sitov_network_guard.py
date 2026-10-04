import importlib.util
import io
import json
from pathlib import Path
import signal
import subprocess
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('sitov_pull_network', Path(__file__).with_name('sitov-pull-backups.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class SitovNetworkGuardTests(unittest.TestCase):
    def test_cli_without_allowlist_prints_safe_snapshot_and_never_contacts_vps(self):
        output = io.StringIO()
        argv = ['sitov-pull-backups.py', '--destination', '/unused', '--identity', '/unused', '--age', '/unused']
        with patch('sys.argv', argv), patch.object(module, 'pull') as pull, patch.object(module.subprocess, 'run') as run, redirect_stdout(output):
            module.main()
            pull.assert_not_called()
            run.assert_not_called()
        self.assertEqual(json.loads(output.getvalue()), {'eligible': False, 'reason': 'wifi_allowlist_missing'})

    def test_missing_allowlist_skips_without_running_any_process(self):
        with patch.object(module.subprocess, 'run') as run, patch.object(module.subprocess, 'Popen') as popen:
            self.assertEqual(module.network_status(Path('/guard'), None), {'eligible': False, 'reason': 'wifi_allowlist_missing'})
            with self.assertRaises(module.SitovNetworkIneligible):
                module.network_run(['ssh', 'host'], Path('/guard'), None)
            run.assert_not_called()
            popen.assert_not_called()

    def test_guard_failure_or_malformed_result_fails_closed_without_disclosing_contents(self):
        with tempfile.TemporaryDirectory() as temporary:
            config = Path(temporary) / 'wifi.json'
            config.write_text('["Private SSID"]')
            failures = [subprocess.TimeoutExpired('guard', 5), OSError('denied')]
            for failure in failures:
                with patch.object(module.subprocess, 'run', side_effect=failure):
                    self.assertEqual(module.network_status(Path('/guard'), config), {'eligible': False, 'reason': 'network_guard_failed'})
            responses = [
                'not-json', '{"eligible":"yes","reason":"allowed_wifi"}',
                '{"eligible":true,"reason":"Private SSID"}',
                '{"eligible":true,"reason":"expensive_network"}',
                '{"eligible":false,"reason":["Private SSID"]}',
            ]
            for response in responses:
                with patch.object(module.subprocess, 'run', return_value=Mock(stdout=response)):
                    self.assertEqual(module.network_status(Path('/guard'), config), {'eligible': False, 'reason': 'network_guard_failed'})

    def test_snapshot_exposes_only_boolean_and_known_reason(self):
        with tempfile.TemporaryDirectory() as temporary:
            config = Path(temporary) / 'wifi.json'
            config.write_text('["Private SSID"]')
            output = json.dumps({'eligible': True, 'reason': 'allowed_wifi', 'ssid': 'Private SSID'})
            with patch.object(module.subprocess, 'run', return_value=Mock(stdout=output)) as run:
                self.assertEqual(module.network_status(Path('/guard'), config), {'eligible': True, 'reason': 'allowed_wifi'})
                self.assertEqual(run.call_args.args[0], ['/guard', '--allowed-wifi-config', str(config)])

    def test_ineligible_preflight_never_starts_ssh_or_scp(self):
        for reason in ['wifi_required', 'expensive_network', 'constrained_network', 'ssid_unavailable', 'wifi_not_allowed']:
            with patch.object(module, 'network_status', return_value={'eligible': False, 'reason': reason}), patch.object(module.subprocess, 'Popen') as popen:
                with self.assertRaises(module.SitovNetworkIneligible) as error:
                    module.network_run(['scp', 'remote', 'local'], Path('/guard'), Path('/config'))
                self.assertEqual(error.exception.reason, reason)
                popen.assert_not_called()

    def test_handoff_terminates_scp_and_its_ssh_process_group(self):
        process = Mock(pid=12345, returncode=None)
        process.poll.return_value = None
        process.communicate.side_effect = [subprocess.TimeoutExpired('scp', 5), ('', '')]
        statuses = [{'eligible': True, 'reason': 'allowed_wifi'}, {'eligible': False, 'reason': 'expensive_network'}]
        with patch.object(module, 'network_status', side_effect=statuses) as status, patch.object(module.subprocess, 'Popen', return_value=process) as popen, patch.object(module.os, 'killpg') as kill:
            with self.assertRaises(module.SitovNetworkIneligible):
                module.network_run(['scp', 'remote', 'local'], Path('/guard'), Path('/config'))
            self.assertEqual(status.call_count, 2)
            self.assertEqual(process.communicate.call_args_list[0].kwargs['timeout'], 5)
            self.assertTrue(popen.call_args.kwargs['start_new_session'])
            kill.assert_called_once_with(12345, signal.SIGTERM)

    def test_unresponsive_transfer_group_is_killed(self):
        process = Mock(pid=12345)
        process.communicate.side_effect = [subprocess.TimeoutExpired('scp', 2), ('', '')]
        with patch.object(module.os, 'killpg') as kill:
            module.stop_network_process(process)
            self.assertEqual([call.args for call in kill.call_args_list], [(12345, signal.SIGTERM), (12345, signal.SIGKILL)])

    def test_handoff_removes_partial_backup_and_preserves_verified_copies(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            destination = root / 'backups'
            destination.mkdir()
            previous = destination / 'sitov-daily-20261003T010000000000Z.age'
            previous.write_bytes(b'existing independent backup')
            identity = root / 'identity'
            identity.write_text('test-only')
            name = 'sitov-daily-20261004T010000000000Z.age'
            inventory = json.dumps({'name': name, 'sha256': 'a' * 64, 'bytes': 10})

            def run(command, *_args, **kwargs):
                if kwargs.get('capture'):
                    return inventory
                Path(command[-1]).write_bytes(b'incomplete')
                raise module.SitovNetworkIneligible('expensive_network')

            with patch.object(module, 'network_run', side_effect=run), patch.object(module.shutil, 'disk_usage', return_value=Mock(free=100 * 1024 ** 3)), patch.object(module, 'verify_archive') as verify:
                with self.assertRaises(module.SitovNetworkIneligible):
                    module.pull('host', destination, identity, '/age', Path('/guard'), Path('/config'))
                verify.assert_not_called()
            self.assertFalse((destination / (name + '.partial')).exists())
            self.assertFalse((destination / name).exists())
            self.assertEqual(previous.read_bytes(), b'existing independent backup')


if __name__ == '__main__':
    unittest.main()
