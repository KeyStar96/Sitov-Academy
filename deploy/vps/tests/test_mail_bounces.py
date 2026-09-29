#!/usr/bin/env python3
"""Bounce patch tests; pure functions only, no production access or subprocesses."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'patch-mail-bounces.py'
SPEC = importlib.util.spec_from_file_location('sitov_mail_bounces', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

LIVE_MASTER = '''# comment
smtp      unix  -       -       y       -       -       smtp
discard   unix  -       -       y       -       -       discard
10.0.0.1:2525 inet n - y - - smtpd
'''


class MailBouncesTest(unittest.TestCase):
    def test_unset_parameter_gets_the_null_sender_discard_map(self):
        self.assertEqual(MODULE.target_value('', '<>'), 'inline:{ <>=discard: }')

    def test_reapplying_is_a_no_op(self):
        self.assertEqual(MODULE.target_value(MODULE.TARGET, '<>'), MODULE.TARGET)

    def test_foreign_maps_and_unusual_lookup_keys_abort(self):
        with self.assertRaises(RuntimeError):
            MODULE.target_value('hash:/etc/postfix/sender_transport', '<>')
        with self.assertRaises(RuntimeError):
            MODULE.target_value('', 'null')

    def test_discard_transport_guard(self):
        self.assertTrue(MODULE.discard_transport_exists(LIVE_MASTER))
        self.assertFalse(MODULE.discard_transport_exists(LIVE_MASTER.replace('discard   unix', '#discard   unix')))
        self.assertFalse(MODULE.discard_transport_exists('smtp unix - - y - - smtp\n'))


if __name__ == '__main__':
    unittest.main()
