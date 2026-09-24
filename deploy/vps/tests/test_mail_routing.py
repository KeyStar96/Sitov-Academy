#!/usr/bin/env python3
"""Mail-routing patch tests; pure functions only, no production access or subprocesses."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'patch-mail-routing.py'
SPEC = importlib.util.spec_from_file_location('sitov_mail_routing', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

LIVE_MYDESTINATION = '$myhostname, sitov-academy.com, ubuntu, localhost.localdomain, localhost'
LIVE_TRUSTED = '127.0.0.1\nlocalhost\n::1\n'
LIVE_LISTENER = '''10.0.0.1:2525 inet n - y - - smtpd
  -o syslog_name=postfix/sitov-auth
  -o mynetworks=127.0.0.0/8,10.0.2.0/24
'''


class MailRoutingTest(unittest.TestCase):
    def test_domain_is_no_longer_a_local_destination(self):
        self.assertEqual(MODULE.without_domain(LIVE_MYDESTINATION),
                         '$myhostname, ubuntu, localhost.localdomain, localhost')

    def test_domain_removal_is_idempotent_and_case_insensitive(self):
        once = MODULE.without_domain(LIVE_MYDESTINATION.replace('sitov-academy.com', 'Sitov-Academy.COM'))
        self.assertEqual(MODULE.without_domain(once), once)

    def test_subdomains_and_hostname_stay_local(self):
        self.assertEqual(MODULE.without_domain('$myhostname mail.sitov-academy.com localhost'),
                         '$myhostname, mail.sitov-academy.com, localhost')

    def test_unexpected_mydestination_aborts(self):
        for value in ('sitov-academy.com', '', 'localhost'):
            with self.assertRaises(RuntimeError):
                MODULE.without_domain(value)

    def test_auth_network_is_added_once(self):
        patched = MODULE.with_auth_network(LIVE_TRUSTED)
        self.assertEqual(patched, '127.0.0.1\nlocalhost\n::1\n10.0.2.0/24\n')
        self.assertEqual(MODULE.with_auth_network(patched), patched)

    def test_listener_guard(self):
        self.assertTrue(MODULE.auth_listener_matches(LIVE_LISTENER))
        self.assertFalse(MODULE.auth_listener_matches(LIVE_LISTENER.replace('10.0.2.0/24', '10.0.3.0/24')))


if __name__ == '__main__':
    unittest.main()
