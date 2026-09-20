#!/usr/bin/env python3
"""Inspect Sitov Storage limits; --apply sets 512 MiB and preserves live swap caps.

Run on the VPS as root. Configuration backups contain secrets and stay root-only.
Only the two upload values and an absent Storage memswap_limit are changed. The
latter preserves the existing live 384 MiB memory-plus-swap limit, without raising
RAM, CPU or swap allowances. Refuse unexpected live or configured resource caps.
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
import subprocess
import tempfile

COMPOSE = Path('/data/coolify/services/eknmzxvqilojjicinatnllbt/docker-compose.yml')
BACKUPS = Path('/root/backups/sitov-storage-upload-limit')
LIMIT = b'536870912'
STORAGE = 'supabase-storage-eknmzxvqilojjicinatnllbt'
STORAGE_MEMORY = 402653184
KEYS = (b'UPLOAD_FILE_SIZE_LIMIT', b'UPLOAD_FILE_SIZE_LIMIT_STANDARD')
CAPS = re.compile(rb'(?m)^[ \t]*(?:mem_limit|mem_reservation|memswap_limit|mem_swappiness|cpus|cpu_count|cpu_percent|cpu_shares|cpu_period|cpu_quota|cpuset|memory):[^\r\n]*(?:\r?\n|$)')


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def read_runtime_limits():
    # Request only these three non-secret fields, never the full container config.
    template = '{"Memory":{{.HostConfig.Memory}},"MemorySwap":{{.HostConfig.MemorySwap}},"NanoCpus":{{.HostConfig.NanoCpus}}}'
    result = subprocess.run(['docker', 'inspect', '--format', template, STORAGE],
                            check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def ram_cpu_caps(content):
    return [line for line in CAPS.findall(content) if not re.match(rb'^\s*memswap_limit:', line)]


def memory_setting(service, key, optional=False):
    occurrences = re.findall(rb'(?m)^    ' + key + rb'[ \t]*:', service)
    if optional and not occurrences:
        return None
    expression = rb'(?m)^    ' + key + rb':[ \t]*([\x22\x27]?)(384[mM]|402653184)\1[ \t]*(?:#[^\r\n]*)?\r?$'
    if len(occurrences) != 1 or not re.search(expression, service):
        raise RuntimeError('Unexpected Storage memory setting: ' + key.decode())
    return STORAGE_MEMORY


def block(content, name, indent):
    matches = list(re.finditer(rb'(?m)^' + b' ' * indent + re.escape(name) + rb':[ \t]*\r?$', content))
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one configuration block: ' + name.decode())
    start = matches[0].end()
    following = re.search(rb'(?m)^ {0,' + str(indent).encode() + rb'}[A-Za-z0-9_.-]+:', content[start:])
    return start, start + following.start() if following else len(content)


def patch_content(original, runtime):
    if runtime.get('Memory') != STORAGE_MEMORY or runtime.get('MemorySwap') != STORAGE_MEMORY:
        raise RuntimeError('Expected live Storage Memory and MemorySwap of 402653184 bytes; refusing resource changes')
    service_start, service_end = block(original, b'supabase-storage', 2)
    service = original[service_start:service_end]
    memory_setting(service, b'mem_limit')
    existing_swap = memory_setting(service, b'memswap_limit', optional=True)
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
    if existing_swap is None:
        memory_line = re.search(rb'(?m)^    mem_limit:[^\r\n]*(\r?\n|$)', changed_service)
        ending = memory_line[1] or b'\n'
        added = b'    memswap_limit: ' + str(runtime['MemorySwap']).encode() + ending
        changed_service = changed_service[:memory_line.end()] + added + changed_service[memory_line.end():]
    changed = original[:service_start] + changed_service + original[service_end:]
    if ram_cpu_caps(original) != ram_cpu_caps(changed):
        raise RuntimeError('CPU or memory limits changed; refusing patch')
    # Only the two numeric spans and (when absent) the live swap-cap line change.
    # Retain all other bytes, including every service's existing RAM/CPU limits.
    return changed, {'before': values, 'after': {key.decode(): int(LIMIT) for key in KEYS},
                     'resource_limits_original_sha256': sha256(b''.join(CAPS.findall(original))),
                     'resource_limits_final_sha256': sha256(b''.join(CAPS.findall(changed))),
                     'ram_cpu_limits_original_sha256': sha256(b''.join(ram_cpu_caps(original))),
                     'ram_cpu_limits_final_sha256': sha256(b''.join(ram_cpu_caps(changed))),
                     'runtime': {key: runtime.get(key) for key in ('Memory', 'MemorySwap', 'NanoCpus')},
                     'storage_memswap': {'before_bytes': existing_swap, 'after_bytes': runtime['MemorySwap'], 'added': existing_swap is None},
                     'changed': changed != original}


def apply_patch(path, backup_root, runtime):
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or metadata.st_uid != 0:
        raise RuntimeError('Expected a regular root-owned Compose configuration')
    original = path.read_bytes()
    changed, report = patch_content(original, runtime)
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
    runtime = read_runtime_limits()
    if args.apply:
        if os.geteuid() != 0:
            parser.error('--apply requires root')
        report = apply_patch(COMPOSE, BACKUPS, runtime)
    else:
        _, report = patch_content(COMPOSE.read_bytes(), runtime)
    report['applied'] = args.apply
    print(json.dumps(report, sort_keys=True))


if __name__ == '__main__':
    main()
