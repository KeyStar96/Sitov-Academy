#!/usr/bin/env python3
"""Allow only the inspected Traefik container to supply the app's XFF chain.
Run after a proxy recreation, before nginx reload. Never trusts arbitrary CIDRs.

Docker hands coolify-proxy new addresses after a reboot or recreation; the old
allow list then answers every request with 403 (24.09.2026: ~7 min outage after
the kernel reboot). sitov-proxy-trust.timer therefore runs this every minute
with --reload: the file is only rewritten when the addresses changed, and nginx
is reloaded only after `nginx -t` passed.
"""
import argparse, ipaddress, json, subprocess
from pathlib import Path

TARGET = Path('/etc/nginx/snippets/sitov-trusted-proxy.conf')


def proxy_addresses(configuration):
    addresses = []
    for network in configuration['NetworkSettings']['Networks'].values():
        for field in ('IPAddress', 'GlobalIPv6Address'):
            if network.get(field): addresses.append(str(ipaddress.ip_address(network[field])))
    if not addresses: raise RuntimeError('No Traefik addresses; refusing to broaden ingress')
    return sorted(set(addresses))


def render(addresses):
    return '# Generated from coolify-proxy; regenerate after recreation.\n' + ''.join('allow ' + ip + ';\n' for ip in addresses) + 'deny all;\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--reload', action='store_true', help='reload nginx (after nginx -t) when the list changed')
    args = parser.parse_args()
    configuration = json.loads(subprocess.check_output(['docker', 'inspect', 'coolify-proxy'], text=True))[0]
    addresses = proxy_addresses(configuration)
    content = render(addresses)
    if TARGET.exists() and TARGET.read_text() == content:
        print('Proxy addresses unchanged.')
        return
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(content)
    TARGET.chmod(0o644)
    print('Restricted app ingress to ' + str(len(addresses)) + ' inspected proxy addresses.')
    if args.reload:
        subprocess.run(['nginx', '-t'], check=True)
        subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
        print('nginx reloaded.')


if __name__ == '__main__':
    main()
