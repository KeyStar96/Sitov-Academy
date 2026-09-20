#!/usr/bin/env python3
"""Allow only the inspected Traefik container to supply the app's XFF chain.
Run after a proxy recreation, before nginx reload. Never trusts arbitrary CIDRs.
"""
import ipaddress, json, subprocess
from pathlib import Path
configuration=json.loads(subprocess.check_output(['docker','inspect','coolify-proxy'],text=True))[0]
addresses=[]
for network in configuration['NetworkSettings']['Networks'].values():
    for field in ('IPAddress','GlobalIPv6Address'):
        if network.get(field): addresses.append(str(ipaddress.ip_address(network[field])))
if not addresses: raise RuntimeError('No Traefik addresses; refusing to broaden ingress')
target=Path('/etc/nginx/snippets/sitov-trusted-proxy.conf')
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text('# Generated from coolify-proxy; regenerate after recreation.\n'+''.join('allow '+ip+';\n' for ip in sorted(set(addresses)))+'deny all;\n')
target.chmod(0o644)
print('Restricted app ingress to '+str(len(set(addresses)))+' inspected proxy addresses.')
