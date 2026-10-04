#!/usr/bin/env python3
"""Daily Sitov backup: PostgreSQL dump, roles and every Storage object, with SHA256.

Reuses the migration runner's backup (deploy/vps/migrate-local.py): online
`pg_dump -Fc`, `pg_dumpall --roles-only` and Storage files via the Storage API,
checked against the object inventory. Services keep running.
Target: /root/backups/daily/sitov-daily-<stamp> (root-only, contains personal data).
Keeps the newest KEEP complete backups; removes older ones and incomplete leftovers.
Run by sitov-backup.timer (03:30 Europe/Berlin). Restore: see docs/sitov-security-remediation-2026-10-04.md.
"""
import importlib.util
import fcntl
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path('/root/backups/daily')
PREFIX = 'sitov-daily-'
KEEP = 14
MAX_BACKUP_BYTES = 20 * 1024 ** 3
RECIPIENT = Path('/etc/sitov-academy/backup-age-recipient.txt')
ENCRYPTED = Path('/root/backups/encrypted/daily')
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


def bounded_expired(directories, max_bytes=MAX_BACKUP_BYTES):
    """Keep at least the latest complete recovery point, while bounding growth."""
    complete = sorted(path for path in directories if path.name.startswith(PREFIX) and (path / 'COMPLETE').is_file())
    sizes = {path: sum(p.stat().st_size for p in path.rglob('*') if p.is_file()) for path in complete}
    total = sum(sizes.values())
    doomed = []
    for path in complete[:-1]:
        if total <= max_bytes:
            break
        total -= sizes[path]
        doomed.append(path)
    return doomed


def main():
    ROOT.mkdir(parents=True, mode=0o700, exist_ok=True)
    # Manual invocations and the timer must not prune each other's in-progress
    # snapshots. The kernel releases this lock even after a killed process.
    lock = Path('/var/lock/sitov-backup.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print('Another Sitov backup is running', file=sys.stderr)
        return 1
    runner = load_runner()
    # Space for the snapshot, optional encrypted copy and a 20 GiB operating
    # reserve. Fail visibly rather than letting backups fill the database disk.
    database_bytes = int(runner.sql('SELECT pg_database_size(current_database())'))
    estimate = sum(int((item.get('metadata') or {}).get('size') or 0) for item in runner.inventory()) + max(database_bytes, 1024 ** 3)
    required = estimate * (2 if RECIPIENT.is_file() else 1) + 20 * 1024 ** 3
    if shutil.disk_usage(ROOT).free < required:
        print('Insufficient free disk for a complete backup and operating reserve', file=sys.stderr)
        return 1
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
    if RECIPIENT.is_file():
        subprocess.run([sys.executable, str(Path(__file__).with_name('export-encrypted-backup.py')), str(target),
                        '--recipient', RECIPIENT.read_text().strip(), '--output', str(ENCRYPTED / (target.name + '.age'))], check=True)
        archives = sorted(ENCRYPTED.glob(PREFIX + '*.age'))
        total = sum(path.stat().st_size for path in archives)
        for path in archives[:-1]:
            if len(archives) <= KEEP and total <= MAX_BACKUP_BYTES:
                break
            total -= path.stat().st_size
            path.unlink()
            path.with_suffix('.age.sha256').unlink(missing_ok=True)
            archives.remove(path)
    directories = [path for path in ROOT.iterdir() if path.is_dir()]
    doomed = set(expired(directories)) | set(bounded_expired(directories))
    for path in sorted(doomed):
        shutil.rmtree(path)
        print(f'Removed {path}', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
