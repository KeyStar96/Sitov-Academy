#!/usr/bin/env python3
"""Install the Sitov Mac backup job with a deny-by-default Wi-Fi allowlist."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--identity', type=Path, required=True)
    parser.add_argument('--age', type=Path, required=True)
    args = parser.parse_args()
    for path in [args.identity, args.age]:
        if not path.is_file():
            parser.error('Required private identity or age executable is unavailable')
    base = Path.home() / 'Library/Application Support/Sitov Academy'
    tools = base / 'Tools'
    config = base / 'Backups'
    for path in (tools, config, args.destination):
        path.mkdir(mode=0o700, parents=True, exist_ok=True)
        path.chmod(0o700)
    allowed = config / 'allowed-wifi.json'
    if not allowed.exists():
        allowed.write_text(json.dumps([]) + '\n')
    allowed.chmod(0o600)
    script = tools / 'sitov-pull-backups.py'
    shutil.copy2(Path(__file__).with_name(script.name), script)
    script.chmod(0o700)
    guard = tools / 'sitov-network-guard'
    subprocess.run(['xcrun', 'swiftc', '-parse-as-library', '-O', str(Path(__file__).with_name('sitov-network-guard.swift')), '-o', str(guard)], check=True)
    guard.chmod(0o700)
    log = config / 'sitov-backup-pull.log'
    job = {
        'Label': 'com.sitov.backup-pull',
        'ProgramArguments': [sys.executable, str(script), '--destination', str(args.destination.resolve()),
                             '--identity', str(args.identity.resolve()), '--age', str(args.age.resolve()),
                             '--network-guard', str(guard), '--allowed-wifi-config', str(allowed)],
        'RunAtLoad': True,
        'StartCalendarInterval': [{'Hour': hour, 'Minute': 30} for hour in (4, 10, 16, 22)],
        'ProcessType': 'Background',
        'LowPriorityIO': True,
        'Nice': 10,
        'StandardOutPath': str(log),
        'StandardErrorPath': str(log),
        'EnvironmentVariables': {'PYTHONUNBUFFERED': '1'},
    }
    agents = Path.home() / 'Library/LaunchAgents'
    agents.mkdir(exist_ok=True)
    plist = agents / 'com.sitov.backup-pull.plist'
    if plist.exists():
        previous = plist.with_suffix('.plist.previous')
        shutil.copy2(plist, previous)
        previous.chmod(0o600)
    plist.write_bytes(plistlib.dumps(job))
    plist.chmod(0o600)
    domain = 'gui/' + str(os.getuid())
    subprocess.run(['launchctl', 'bootout', domain + '/com.sitov.backup-pull'], capture_output=True)
    subprocess.run(['launchctl', 'bootstrap', domain, str(plist)], check=True)
    print('Installed com.sitov.backup-pull; downloads require an explicitly allowed Wi-Fi network')


if __name__ == '__main__':
    main()
