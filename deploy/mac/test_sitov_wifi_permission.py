"""Real Swift policy and locally signed app packaging checks; no OS grants."""
import importlib.util
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('sitov_wifi_installer_test', HERE / 'install-sitov-wifi-permission.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

HARNESS = r'''
import Foundation
@main struct SitovPolicyTests {
    static func main() {
        let args = Array(CommandLine.arguments.dropFirst())
        if args[0] == "path" {
            let bits = args.dropFirst().map { $0 == "1" }
            let reason = SitovPathPolicy.rejection(satisfied: bits[0], expensive: bits[1], constrained: bits[2],
                wifi: bits[3], cellular: bits[4], ethernet: bits[5], loopback: bits[6])
            print(SitovNetworkSnapshot(eligible: reason == nil, reason: reason ?? "allowed_wifi").json())
        } else if args[0] == "ssid" {
            let values: [String?] = args.dropFirst().map { $0 == "<nil>" ? nil : $0 }
            print(SitovPathPolicy.inspectSSIDs(values, allowed: ["Allowed Test WLAN"]).json())
        } else {
            switch sitovReadAllowedWiFi(URL(fileURLWithPath: args[1])) {
            case .failure(let failure): print(SitovNetworkSnapshot.denied(failure.reason).json())
            case .success: print(SitovNetworkSnapshot(eligible: true, reason: "allowed_wifi").json())
            }
        }
    }
}
'''


@unittest.skipUnless(sys.platform == 'darwin' and shutil.which('xcrun'), 'Requires the native macOS SDK')
class SitovWiFiNativePolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory(prefix='sitov-wifi-policy-')
        cls.root = Path(cls.temporary.name)
        source = cls.root / 'policy.swift'
        source.write_text(HARNESS)
        cls.binary = cls.root / 'policy'
        subprocess.run(['xcrun', 'swiftc', '-parse-as-library', str(HERE / 'sitov-wifi-shared.swift'),
                        str(HERE / 'sitov-network-state.swift'), str(source), '-o', str(cls.binary)],
                       check=True, capture_output=True, text=True)

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def policy(self, *args):
        result = subprocess.run([str(self.binary), *args], check=True, capture_output=True, text=True)
        self.assertNotIn('Allowed Test WLAN', result.stdout)
        self.assertEqual(result.stderr, '')
        return json.loads(result.stdout)

    def test_only_default_ordinary_wifi_path_is_eligible(self):
        self.assertEqual(self.policy('path', '1', '0', '0', '1', '0', '0', '0'),
                         {'eligible': True, 'reason': 'allowed_wifi'})

    def test_hotspot_and_constrained_paths_are_rejected(self):
        self.assertEqual(self.policy('path', '1', '1', '0', '1', '0', '0', '0')['reason'], 'expensive_network')
        self.assertEqual(self.policy('path', '1', '0', '1', '1', '0', '0', '0')['reason'], 'constrained_network')

    def test_missing_network_cellular_ethernet_and_loopback_are_rejected(self):
        self.assertEqual(self.policy('path', '0', '0', '0', '1', '0', '0', '0')['reason'], 'network_unavailable')
        for bits in [('1', '0', '0', '0', '0', '0', '0'), ('1', '0', '0', '1', '1', '0', '0'),
                     ('1', '0', '0', '1', '0', '1', '0'), ('1', '0', '0', '1', '0', '0', '1')]:
            self.assertEqual(self.policy('path', *bits), {'eligible': False, 'reason': 'wifi_required'})

    def test_exact_allowed_ssid_only(self):
        self.assertTrue(self.policy('ssid', 'Allowed Test WLAN')['eligible'])
        for name in ['Unknown WLAN', 'allowed test wlan', 'Allowed Test WLAN ']:
            self.assertEqual(self.policy('ssid', name), {'eligible': False, 'reason': 'wifi_not_allowed'})

    def test_missing_or_ambiguous_wifi_is_rejected(self):
        for args in [(), ('<nil>',), ('',)]:
            self.assertEqual(self.policy('ssid', *args)['reason'], 'ssid_unavailable')
        self.assertEqual(self.policy('ssid', 'Allowed Test WLAN', 'Allowed Test WLAN')['reason'], 'wifi_interface_ambiguous')

    def test_private_allowlist_validation_rejects_malformed_empty_and_oversized_names(self):
        config = self.root / 'allowed.json'
        config.touch(mode=0o600)
        for content, reason in [('[]', 'wifi_allowlist_missing'), ('broken', 'wifi_config_invalid'),
                                ('{}', 'wifi_config_invalid'), ('[""]', 'wifi_config_invalid'),
                                (json.dumps(['x' * 33]), 'wifi_config_invalid')]:
            config.write_text(content)
            self.assertEqual(self.policy('config', str(config))['reason'], reason)
        config.write_text('["Allowed Test WLAN"]')
        self.assertTrue(self.policy('config', str(config))['eligible'])
        config.chmod(0o644)
        self.assertEqual(self.policy('config', str(config))['reason'], 'wifi_config_invalid')
        config.chmod(0o600)
        link = self.root / 'allowed-link.json'
        link.symlink_to(config)
        self.assertEqual(self.policy('config', str(link))['reason'], 'wifi_config_invalid')


class SitovWiFiPackagingTests(unittest.TestCase):
    def test_registration_runs_inside_app_and_accepts_only_known_service_states(self):
        app = Path('/private/test/Sitov Academy Backup-WLAN.app')
        for state in (1, 2):
            with patch.object(installer.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, json.dumps({'agentStatus': state}), '')) as run:
                self.assertEqual(installer.refresh_wifi_agent(app), state)
                self.assertEqual(run.call_args.args[0], [str(app / 'Contents/MacOS/sitov-wifi-permission'), '--refresh-agent'])
        for response in ['{"agentRegistrationFailed":true}', '{"agentStatus":true}', '{"agentStatus":0}', 'invalid']:
            with patch.object(installer.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, response, '')):
                with self.assertRaises(RuntimeError):
                    installer.refresh_wifi_agent(app)

    def test_app_explains_location_only_for_wifi_and_has_native_permission_keys(self):
        metadata = installer.app_metadata()
        self.assertEqual(metadata['CFBundleIdentifier'], 'com.sitov.backup-wifi')
        self.assertIn('keine Standortkoordinaten', metadata['NSLocationUsageDescription'])
        self.assertIn('Handy-Hotspot', metadata['NSLocationWhenInUseUsageDescription'])

    def test_embedded_agent_uses_smappservice_relative_executable_and_local_mach_service(self):
        metadata = installer.agent_metadata()
        self.assertEqual(metadata['BundleProgram'], 'Contents/MacOS/sitov-wifi-permission')
        self.assertEqual(metadata['ProgramArguments'], ['sitov-wifi-permission', '--agent'])
        self.assertEqual(metadata['MachServices'], {'com.sitov.backup-wifi.network-agent': True})
        self.assertEqual(metadata['AssociatedBundleIdentifiers'], ['com.sitov.backup-wifi'])
        self.assertNotIn('UserName', metadata)
        self.assertNotIn('Sockets', metadata)

    @unittest.skipUnless(sys.platform == 'darwin' and shutil.which('xcrun'), 'Requires the native macOS SDK')
    def test_real_signed_bundle_and_guard_fail_closed_without_privacy_changes(self):
        with tempfile.TemporaryDirectory(prefix='sitov-wifi-package-') as temporary:
            tools = Path(temporary) / 'Tools'
            app = installer.install_wifi_support(tools)
            metadata = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
            self.assertEqual(metadata['CFBundleIdentifier'], installer.APP_ID)
            subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True, capture_output=True)
            guard = tools / 'sitov-network-guard'
            for args, reason in [([], 'wifi_allowlist_missing'), (['--unexpected'], 'invalid_arguments'),
                                 (['--allowed-wifi-config', str(tools / 'missing')], 'wifi_config_invalid')]:
                result = subprocess.run([str(guard), *args], check=True, capture_output=True, text=True)
                self.assertEqual(json.loads(result.stdout), {'eligible': False, 'reason': reason})
                self.assertEqual(result.stderr, '')
            config = tools / 'test-only-wifi.json'
            config.touch(mode=0o600)
            config.write_text('["Allowed Test WLAN"]')
            result = subprocess.run([str(guard), '--allowed-wifi-config', str(config)], check=True, capture_output=True, text=True)
            self.assertEqual(json.loads(result.stdout), {'eligible': False, 'reason': 'wifi_config_invalid'})
            self.assertNotIn('Allowed Test WLAN', result.stdout)


if __name__ == '__main__':
    unittest.main()
