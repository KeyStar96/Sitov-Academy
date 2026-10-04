#!/usr/bin/env python3
"""Restrict public host and Docker ingress without flushing existing rules.

Run --apply on the VPS; --remove reverses only Sitov rules. Keep a second SSH
session open when applying. SSH, web, inbound SMTP and DHCP remain available.
Docker rules inspect the original destination port after Docker's DNAT.
"""
import argparse
import re
import subprocess

INPUT = 'SITOV-INPUT'
FORWARD = 'SITOV-DOCKER'


def rules(interface, ipv6=False):
    if not re.fullmatch(r'[a-zA-Z0-9_.:-]{1,32}', interface):
        raise ValueError('Invalid external interface')
    host = [
        ['-m', 'conntrack', '--ctstate', 'RELATED,ESTABLISHED', '-j', 'ACCEPT'],
        ['-p', 'ipv6-icmp' if ipv6 else 'icmp', '-j', 'ACCEPT'],
        ['-p', 'tcp', '-m', 'multiport', '--dports', '22,25,80,443', '-j', 'ACCEPT'],
        ['-p', 'udp', '--sport', '547' if ipv6 else '67', '--dport', '546' if ipv6 else '68', '-j', 'ACCEPT'],
        ['-p', 'udp', '--dport', '443', '-j', 'ACCEPT'],
        ['-j', 'DROP'],
    ]
    forwarded = [['-m', 'conntrack', '--ctstate', 'RELATED,ESTABLISHED', '-j', 'ACCEPT']]
    for protocol, ports in [('tcp', [80, 443]), ('udp', [443])]:
        for port in ports:
            forwarded.append(['-p', protocol, '-m', 'conntrack', '--ctdir', 'ORIGINAL', '--ctorigdstport', str(port), '-j', 'ACCEPT'])
    forwarded.append(['-j', 'DROP'])
    # Only traffic arriving on the public interface enters these chains. Docker
    # bridges, SSH tunnels, localhost and container-to-host SMTP keep working.
    return {INPUT: host, FORWARD: forwarded}


def call(binary, *args, check=True):
    return subprocess.run([binary, '-w', '10', *args], check=check, capture_output=True, text=True)


def configure(binary, interface, remove=False):
    for chain, parent in [(INPUT, 'INPUT'), (FORWARD, 'DOCKER-USER')]:
        jump = ['-i', interface, '-j', chain]
        if remove:
            while call(binary, '-C', parent, *jump, check=False).returncode == 0:
                call(binary, '-D', parent, *jump)
            if call(binary, '-S', chain, check=False).returncode == 0:
                call(binary, '-F', chain)
                call(binary, '-X', chain)
            continue
        if call(binary, '-S', parent, check=False).returncode != 0:
            raise RuntimeError(f'{binary}: missing {parent}; Docker firewall must be active')
        if call(binary, '-S', chain, check=False).returncode != 0:
            call(binary, '-N', chain)
        # Build and atomically replace only our chains using iptables-restore.
        # --noflush preserves Docker and all provider/other rules.
        lines = ['*filter', f':{chain} - [0:0]', f'-F {chain}']
        for rule in rules(interface, binary == 'ip6tables')[chain]:
            lines.append(' '.join(['-A', chain, *rule]))
        lines.append('COMMIT')
        subprocess.run([binary + '-restore', '--wait', '10', '--noflush'], input='\n'.join(lines)+'\n', text=True, check=True, capture_output=True)
        if call(binary, '-C', parent, *jump, check=False).returncode != 0:
            call(binary, '-I', parent, '1', *jump)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--interface', default='ens6')
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--remove', action='store_true')
    args = parser.parse_args()
    for binary in ['iptables', 'ip6tables']:
        configure(binary, args.interface, args.remove)
    print('Sitov firewall removed' if args.remove else 'Sitov firewall applied (IPv4 + IPv6)')


if __name__ == '__main__':
    main()
