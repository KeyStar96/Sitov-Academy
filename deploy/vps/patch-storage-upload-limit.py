#!/usr/bin/env python3
"""Inspect the Sitov Storage 512 MiB limits; --apply patches only these two values.

Run on the VPS as root. Configuration backups contain secrets and stay root-only.
This does not restart containers; coordinate the Storage deployment separately.
Rollback: atomically restore the reported backup, then recreate only Storage.
"""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import tempfile

COMPOSE = Path('/data/coolify/services/eknmzxvqilojjicinatnllbt/docker-compose.yml')
BACKUPS = Path('/root/backups/sitov-storage-upload-limit')
LIMIT = b'536870912'
KEYS = (b'UPLOAD_FILE_SIZE_LIMIT', b'UPLOAD_FILE_SIZE_LIMIT_STANDARD')
CAPS = re.compile(rb'(?m)^[ \t]*(?:mem_limit|mem_reservation|memswap_limit|mem_swappiness|cpus|cpu_count|cpu_percent|cpu_shares|cpu_period|cpu_quota|cpuset|memory):[^\r\n]*(?:\r?\n|$)')


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def block(content, name, indent):
    matches = list(re.finditer(rb'(?m)^' + b' ' * indent + re.escape(name) + rb':[ \t]*\r?$', content))
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one configuration block: ' + name.decode())
    start = matches[0].end()
    following = re.search(rb'(?m)^ {0,' + str(indent).encode() + rb'}[A-Za-z0-9_.-]+:', content[start:])
    return start, start + following.start() if following else len(content)


def patch_content(original):
    service_start, service_end = block(original, b'supabase-storage', 2)
    service = original[service_start:service_end]
    env_start, env_end = block(service, b'environment', 4)
    environment = service[env_start:env_end]
    values = {}
    patched = environment
    for key in KEYS:
        # Deliberately accept only the observed mapping format, never YAML
        # interpolation, duplicate keys, inherited values or an unknown limit.
        expression = re.compile(rb'(?m)^( {6}' + key + rb':[ \t]*)([\x22\x27]?)([0-9]+)(\2)([ \t]*(?:#[^\r\n]*)?\r?)$')
        matches = list(expression.finditer(environment))
        occurrences = re.findall(rb'(?m)^[ \t]*' + key + rb'[ \t]*:', environment)
        if len(matches) != 1 or len(occurrences) != 1 or matches[0][3] not in (b'524288000', LIMIT):
            raise RuntimeError('Unexpected Storage upload limit: ' + key.decode())
        values[key.decode()] = int(matches[0][3])
        patched = expression.sub(lambda match: match[1] + match[2] + LIMIT + match[4] + match[5], patched)
    changed_service = service[:env_start] + patched + service[env_end:]
    changed = original[:service_start] + changed_service + original[service_end:]
    if CAPS.findall(original) != CAPS.findall(changed):
        raise RuntimeError('CPU or memory limits changed; refusing patch')
    # The only transformation above replaces these two numeric spans; retain
    # every other byte, including secrets, comments, ordering and resource caps.
    return changed, {'before': values, 'after': {key.decode(): int(LIMIT) for key in KEYS},
                     'resource_limits_sha256': sha256(b''.join(CAPS.findall(original))),
                     'changed': changed != original}


def apply_patch(path, backup_root):
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0:
        raise RuntimeError('Expected a regular root-owned Compose configuration')
    original = path.read_bytes()
    changed, report = patch_content(original)
    if changed == original:
        return report
    backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if backup_root.is_symlink() or backup_root.stat().st_uid != 0:
        raise RuntimeError('Expected a root-owned backup directory')
    backup_root.chmod(0o700)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    backup = backup_root / (stamp + '-docker-compose.yml')
    with backup.open('xb') as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(original)
        output.flush()
        os.fsync(output.fileno())
    if backup.read_bytes() != original:
        raise RuntimeError('Configuration backup verification failed')
    descriptor, temporary = tempfile.mkstemp(prefix='.sitov-storage-upload-limit-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            os.fchmod(output.fileno(), stat.S_IMODE(metadata.st_mode))
            os.fchown(output.fileno(), metadata.st_uid, metadata.st_gid)
            output.write(changed)
            output.flush()
            os.fsync(output.fileno())
        if path.read_bytes() != original or path.lstat().st_ino != metadata.st_ino:
            raise RuntimeError('Compose changed concurrently; refusing replacement')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    report.update(backup=str(backup), backup_sha256=sha256(original), compose_sha256=sha256(changed))
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.apply:
        if os.geteuid() != 0:
            parser.error('--apply requires root')
        report = apply_patch(COMPOSE, BACKUPS)
    else:
        _, report = patch_content(COMPOSE.read_bytes())
    report['applied'] = args.apply
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    main()
