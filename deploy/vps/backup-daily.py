#!/usr/bin/env python3
"""Daily Sitov backup: PostgreSQL dump, roles and every Storage object, with SHA256.

Reuses the migration runner's backup (deploy/vps/migrate-local.py): online
`pg_dump -Fc`, `pg_dumpall --roles-only` and Storage files via the Storage API,
checked against the object inventory. Services keep running.
Target: /root/backups/daily/sitov-daily-<stamp> (root-only, contains personal data).
Keeps the newest KEEP complete backups; removes older ones and incomplete leftovers.
Run by sitov-backup.timer. Restore: see docs/go-live-runbook.md.
"""
import importlib.util
from pathlib import Path
import shutil
import sys
import time

ROOT = Path('/root/backups/daily')
PREFIX = 'sitov-daily-'
KEEP = 14
RUNNER = Path(__file__).resolve().with_name('migrate-local.py')


def load_runner():
    spec = importlib.util.spec_from_file_location('sitov_migrate_local', RUNNER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def expired(directories, keep=KEEP):
    """Backups to delete: all but the newest `keep` complete ones, plus every incomplete one."""
    ours = sorted(path for path in directories if path.name.startswith(PREFIX))
    complete = [path for path in ours if (path / 'COMPLETE').is_file()]
    incomplete = [path for path in ours if path not in complete]
    return complete[:-keep] + incomplete if keep else complete + incomplete


def main():
    ROOT.mkdir(parents=True, mode=0o700, exist_ok=True)
    runner = load_runner()
    for attempt in (1, 2):
        try:
            target = runner.backup(root=ROOT, prefix=PREFIX)
            break
        except RuntimeError as error:
            # An upload during the backup changes the Storage inventory; retry once.
            print(f'Backup attempt {attempt} failed: {error}', file=sys.stderr, flush=True)
            if attempt == 2:
                return 1
            time.sleep(300)
    for path in expired([path for path in ROOT.iterdir() if path.is_dir() and path != target]):
        shutil.rmtree(path)
        print(f'Removed {path}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
