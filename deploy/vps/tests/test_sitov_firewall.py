import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('sitov_firewall', Path(__file__).resolve().parents[1] / 'sitov-firewall.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FirewallTest(unittest.TestCase):
    def test_docker_uses_original_public_ports(self):
        rules = module.rules('ens6')[module.FORWARD]
        self.assertEqual(rules[-1], ['-j', 'DROP'])
        allowed = [rule[rule.index('--ctorigdstport') + 1] for rule in rules if '--ctorigdstport' in rule]
        self.assertEqual(allowed, ['80', '443', '443'])
        for rule in rules:
            self.assertNotIn('--dport', rule)  # After DNAT, 8000 could mean public 9080 or admin 8000.

    def test_ssh_mail_and_neighbor_discovery_remain_available(self):
        ipv4 = module.rules('ens6')[module.INPUT]
        ipv6 = module.rules('ens6', True)[module.INPUT]
        self.assertTrue(any('22,25,80,443' in rule for rule in ipv4))
        self.assertTrue(any('ipv6-icmp' in rule for rule in ipv6))
        self.assertTrue(any('RELATED,ESTABLISHED' in rule for rule in ipv6))
        self.assertEqual(ipv6[-1], ['-j', 'DROP'])

    def test_rejects_command_injection_interface(self):
        with self.assertRaises(ValueError):
            module.rules('ens6; reboot')


if __name__ == '__main__':
    unittest.main()
