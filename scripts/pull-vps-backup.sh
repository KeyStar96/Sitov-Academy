#!/usr/bin/env bash
# Kopiert das neueste vollständige Tages-Backup vom VPS auf diesen Rechner
# (Kopie außerhalb des Servers) und prüft alle SHA256-Summen.
# Enthält personenbezogene Daten: nur auf verschlüsseltem Laufwerk (FileVault) ablegen.
# Aufruf: scripts/pull-vps-backup.sh [Zielordner]   (Standard: ~/Sitov-Backups)
set -euo pipefail
TARGET="${1:-$HOME/Sitov-Backups}"
LATEST="$(ssh sitov-academy 'for d in /root/backups/daily/sitov-daily-*; do [ -f "$d/COMPLETE" ] && echo "$d"; done | tail -1')"
[[ -n "$LATEST" ]] || { echo 'Kein vollständiges Backup auf dem VPS gefunden.' >&2; exit 1; }
install -d -m 700 "$TARGET"
rsync -a --partial "sitov-academy:$LATEST" "$TARGET/"
python3 - "$TARGET/$(basename "$LATEST")" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
expected = json.loads((root / 'sha256.json').read_text())
for name, digest in expected.items():
    actual = hashlib.sha256((root / name).read_bytes()).hexdigest()
    if actual != digest:
        sys.exit(f'Prüfsumme falsch: {name}')
print(f'{root}: {len(expected)} Dateien, alle Prüfsummen korrekt.')
PY
