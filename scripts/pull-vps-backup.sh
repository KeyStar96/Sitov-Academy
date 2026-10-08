#!/usr/bin/env bash
# Verwendet ausschließlich den installierten verschlüsselten, WLAN-geschützten
# Mac-Abruf. Ein optionaler Zielordner überschreibt dessen Standardziel.
set -euo pipefail
exec python3 - "$@" <<'PY'
from pathlib import Path
import os, plistlib, sys
if len(sys.argv) > 2:
    raise SystemExit('Aufruf: scripts/pull-vps-backup.sh [Zielordner]')
plist = Path.home() / 'Library/LaunchAgents/com.sitov.backup-pull.plist'
if plist.is_symlink() or not plist.is_file():
    raise SystemExit('Zuerst deploy/mac/install-backup-pull.py ausführen.')
with plist.open('rb') as stream:
    arguments = plistlib.load(stream).get('ProgramArguments', [])
if not isinstance(arguments, list) or len(arguments) < 2 or not arguments[1].endswith('/sitov-pull-backups.py'):
    raise SystemExit('Ungültiger installierter Backup-Abruf.')
for required in ['--destination', '--identity', '--age', '--network-guard', '--allowed-wifi-config']:
    if required not in arguments or arguments.index(required) + 1 >= len(arguments):
        raise SystemExit('Unvollständige geschützte Backup-Konfiguration.')
if len(sys.argv) == 2:
    arguments[arguments.index('--destination') + 1] = str(Path(sys.argv[1]).expanduser().absolute())
os.execv(arguments[0], arguments)
PY
