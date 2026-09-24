#!/usr/bin/env python3
"""Proxy allow-list tests; pure functions only, no production access or subprocesses."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'configure-proxy-trust.py'
SPEC = importlib.util.spec_from_file_location('sitov_proxy_trust', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

# docker inspect coolify-proxy after the 24.09.2026 reboot (addresses changed from .2/.5).
LIVE = {'NetworkSettings': {'Networks': {
    'coolify': {'IPAddress': '10.0.1.6', 'GlobalIPv6Address': 'fd0b:baf2:5a5b::6'},
    'eknmzxvqilojjicinatnllbt': {'IPAddress': '10.0.2.15', 'GlobalIPv6Address': ''},
}}}


class ProxyTrustTest(unittest.TestCase):
    def test_exact_addresses_only_then_deny(self):
        self.assertEqual(MODULE.render(MODULE.proxy_addresses(LIVE)),
                         '# Generated from coolify-proxy; regenerate after recreation.\n'
                         'allow 10.0.1.6;\nallow 10.0.2.15;\nallow fd0b:baf2:5a5b::6;\ndeny all;\n')

    def test_no_addresses_never_broadens(self):
        with self.assertRaises(RuntimeError):
            MODULE.proxy_addresses({'NetworkSettings': {'Networks': {'coolify': {'IPAddress': ''}}}})

    def test_rendering_is_stable_for_the_change_check(self):
        shuffled = {'NetworkSettings': {'Networks': dict(reversed(list(LIVE['NetworkSettings']['Networks'].items())))}}
        self.assertEqual(MODULE.render(MODULE.proxy_addresses(shuffled)), MODULE.render(MODULE.proxy_addresses(LIVE)))


if __name__ == '__main__':
    unittest.main()
