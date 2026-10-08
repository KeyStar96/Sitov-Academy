#!/usr/bin/env python3
"""Daily Sitov backup: database, Storage and private recovery settings, encrypted.

The VPS retains one complete encrypted daily recovery point and its SHA256.
Plaintext is temporary staging only. Older daily files are removed only after
the replacement's source manifest and encrypted checksum have been verified.
Migration, configuration and physical recovery backups are never pruned here.
Run by sitov-backup.timer (03:30 Europe/Berlin); Mac downloads are separate.
"""
import argparse
import fcntl
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

ROOT = Path('/root/backups/daily')
PREFIX = 'sitov-daily-'
STAMP = r'sitov-daily-[0-9]{8}T[0-9]{12}Z'
DIRECTORY_NAME = re.compile(STAMP)
ARCHIVE_NAME = re.compile(STAMP + r'\.age')
MANAGED_FILE_NAME = re.compile(STAMP + r'\.age(?:\.sha256)?(?:\.partial)?')
RECIPIENT = Path('/etc/sitov-academy/backup-age-recipient.txt')
ENCRYPTED = Path('/root/backups/encrypted/daily')
LOCK = Path('/var/lock/sitov-backup.lock')
RUNNER = Path(__file__).resolve().with_name('migrate-local.py')
EXPORTER = Path(__file__).resolve().with_name('export-encrypted-backup.py')
RECOVERY = Path(__file__).resolve().with_name('sitov-recovery-configuration.py')


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_runner():
    return load_module(RUNNER, 'sitov_migrate_local')


def capture_recovery():
    return load_module(RECOVERY, 'sitov_recovery_configuration').capture_configuration()


def daily_directories(root):
    if not root.exists():
        return []
    if root.is_symlink() or not root.is_dir():
        raise ValueError('Daily backup root must be a real directory')
    return sorted(path for path in root.iterdir()
                  if DIRECTORY_NAME.fullmatch(path.name) and path.is_dir() and not path.is_symlink())


def verify_encrypted(path):
    """Verify a fully published ciphertext/checksum pair without a private key."""
    checksum_path = path.with_suffix('.age.sha256')
    if not ARCHIVE_NAME.fullmatch(path.name) or path.is_symlink() or not path.is_file() or path.stat().st_size == 0:
        raise ValueError('Invalid encrypted daily backup')
    if checksum_path.is_symlink() or not checksum_path.is_file() or checksum_path.stat().st_size > 1024:
        raise ValueError('Missing encrypted backup checksum')
    expected = checksum_path.read_text().split()
    if len(expected) != 2 or not re.fullmatch(r'[0-9a-f]{64}', expected[0]) or expected[1] != path.name:
        raise ValueError('Invalid encrypted backup checksum')
    exporter = load_module(EXPORTER, 'sitov_encrypted_export')
    if exporter.digest(path) != expected[0]:
        raise ValueError('Encrypted backup checksum mismatch')
    return expected[0]


def retention_plan(root, encrypted, keep=None):
    """Return an exact deletion inventory only after finding a verified pair."""
    if encrypted.is_symlink() or not encrypted.is_dir():
        raise ValueError('Encrypted daily backup directory unavailable')
    files = sorted(path for path in encrypted.iterdir()
                   if MANAGED_FILE_NAME.fullmatch(path.name) and path.is_file() and not path.is_symlink())
    if keep is None:
        for path in reversed(files):
            if not ARCHIVE_NAME.fullmatch(path.name):
                continue
            try:
                verify_encrypted(path)
                keep = path
                break
            except (OSError, ValueError):
                continue
    if keep is None or keep.parent != encrypted:
        raise ValueError('No verified encrypted daily backup; preserving every existing backup')
    verify_encrypted(keep)
    retained = {keep, keep.with_suffix('.age.sha256')}
    return {'keep': keep, 'remove_files': [path for path in files if path not in retained],
            'remove_directories': daily_directories(root)}


def remove_staging(path, root):
    if path.parent != root or not DIRECTORY_NAME.fullmatch(path.name) or path.is_symlink() or not path.is_dir():
        raise ValueError('Refusing to delete an unexpected staging path')
    shutil.rmtree(path)
    print(f'Removed temporary daily snapshot {path}', flush=True)


def apply_retention(plan, root, encrypted):
    # Recheck the protected pair immediately before any deletion. Never prune
    # based only on COMPLETE, a filename or a stale caller-provided checksum.
    keep = plan['keep']
    if keep.parent != encrypted:
        raise ValueError('Unexpected retained backup location')
    verify_encrypted(keep)
    for path in plan['remove_files']:
        if path.parent != encrypted or not MANAGED_FILE_NAME.fullmatch(path.name) or path.is_symlink():
            raise ValueError('Refusing to delete an unexpected encrypted backup path')
        if path in {keep, keep.with_suffix('.age.sha256')}:
            raise ValueError('Refusing to delete the retained backup')
        path.unlink(missing_ok=True)
        print(f'Removed older daily backup file {path}', flush=True)
    for path in plan['remove_directories']:
        remove_staging(path, root)


def create_backup():
    # Encryption is required: missing configuration must not replace the last
    # usable recovery point with an unencrypted or incomplete snapshot.
    if RECIPIENT.is_symlink() or not RECIPIENT.is_file() or not RECIPIENT.read_text().strip():
        raise ValueError('Configure the public age recipient before daily backups')
    ROOT.mkdir(parents=True, mode=0o700, exist_ok=True)
    previous_staging = set(daily_directories(ROOT))
    recovery = capture_recovery()
    runner = load_runner()
    database_bytes = int(runner.sql('SELECT pg_database_size(current_database())'))
    estimate = sum(int((item.get('metadata') or {}).get('size') or 0) for item in runner.inventory()) + max(database_bytes, 1024 ** 3) + recovery.estimated_bytes
    if shutil.disk_usage(ROOT).free < estimate * 2 + 20 * 1024 ** 3:
        raise ValueError('Insufficient free disk for a complete encrypted backup and operating reserve')
    output = None
    published_verified = False
    try:
        for attempt in (1, 2):
            try:
                target = runner.backup(root=ROOT, prefix=PREFIX)
                break
            except RuntimeError as error:
                # A concurrent upload may change the Storage inventory.
                print(f'Backup attempt {attempt} failed: {error}', file=sys.stderr, flush=True)
                for path in set(daily_directories(ROOT)) - previous_staging:
                    remove_staging(path, ROOT)
                if attempt == 2:
                    raise
                time.sleep(300)
        if target.parent != ROOT or not DIRECTORY_NAME.fullmatch(target.name):
            raise ValueError('Unexpected backup staging path')
        recovery.assert_unchanged()
        recovery.write(target)
        output = ENCRYPTED / (target.name + '.age')
        if any(path.exists() or path.is_symlink() for path in
               (output, output.with_suffix('.age.sha256'), output.with_name(output.name + '.partial'),
                output.with_name(output.name + '.sha256.partial'))):
            # Never claim or remove artifacts from another run with this name.
            output = None
            raise ValueError('Daily encrypted output already exists')
        subprocess.run([sys.executable, str(EXPORTER), str(target), '--recipient', RECIPIENT.read_text().strip(),
                        '--output', str(output)], check=True)
        recovery.assert_unchanged()
        verify_encrypted(output)
        published_verified = True
        apply_retention(retention_plan(ROOT, ENCRYPTED, keep=output), ROOT, ENCRYPTED)
    finally:
        # On failure remove only staging created by this locked daily run.
        # Previously existing daily/migration/recovery backups stay untouched.
        for path in set(daily_directories(ROOT)) - previous_staging:
            remove_staging(path, ROOT)
        if output is not None and not published_verified:
            for path in (output, output.with_suffix('.age.sha256'), output.with_name(output.name + '.partial'),
                         output.with_name(output.name + '.sha256.partial')):
                if path.is_file() and not path.is_symlink():
                    path.unlink()


def main(argv=None):
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--retention-plan', action='store_true', help='Read-only inventory for retaining one verified encrypted daily backup')
    mode.add_argument('--prune-only', action='store_true', help='Apply retention to existing daily backups without creating a new export')
    args = parser.parse_args(argv)
    # Timer, manual runs and maintenance share a lock. The kernel releases it
    # after a killed process; another run cannot prune an in-progress snapshot.
    with LOCK.open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('Another Sitov backup is running', file=sys.stderr)
            return 1
        try:
            if args.retention_plan or args.prune_only:
                plan = retention_plan(ROOT, ENCRYPTED)
                print(json.dumps(plan, default=str), flush=True)
                if args.prune_only:
                    apply_retention(plan, ROOT, ENCRYPTED)
            else:
                create_backup()
        except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
            print(f'Sitov daily backup failed: {error}', file=sys.stderr, flush=True)
            return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
