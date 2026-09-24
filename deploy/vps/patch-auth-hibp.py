#!/usr/bin/env python3
"""Inspect Sitov Auth password checks; --apply enables Leaked Password Protection.

Run on the VPS as root. Sets GOTRUE_PASSWORD_HIBP_ENABLED=true and
GOTRUE_PASSWORD_HIBP_FAIL_CLOSED=false for supabase-auth only. GoTrue sends the
first five hex characters of a SHA-1 hash to api.pwnedpasswords.com
(k-anonymity); no password or personal data leaves the host. Fail-open keeps
sign-up and password reset available if HIBP is unreachable.

An absent Auth memswap_limit is pinned to the live value, because recreating
the container would otherwise replace the live 256 MiB memory-plus-swap cap
with Docker's default (see Phase 2 Storage). RAM and CPU caps stay byte-identical.
Configuration backups contain secrets and stay root-only.

This does not restart containers. Afterwards, recreate only Auth:
  cd /data/coolify/services/eknmzxvqilojjicinatnllbt && docker compose up -d --no-deps supabase-auth
Rollback: atomically restore the reported backup, then run the same command.
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
BACKUPS = Path('/root/backups/sitov-auth-hibp')
AUTH = 'supabase-auth-eknmzxvqilojjicinatnllbt'
AUTH_MEMORY = 268435456
SETTINGS = ((b'GOTRUE_PASSWORD_HIBP_ENABLED', b'true'), (b'GOTRUE_PASSWORD_HIBP_FAIL_CLOSED', b'false'))
CAPS = re.compile(rb'(?m)^[ \t]*(?:mem_limit|mem_reservation|memswap_limit|mem_swappiness|cpus|cpu_count|cpu_percent|cpu_shares|cpu_period|cpu_quota|cpuset|memory):[^\r\n]*(?:\r?\n|$)')


def sha256(value):
    return hashlib.sha256(value).hexdigest()


def read_runtime_limits():
    # Request only these three non-secret fields, never the full container config.
    template = '{"Memory":{{.HostConfig.Memory}},"MemorySwap":{{.HostConfig.MemorySwap}},"NanoCpus":{{.HostConfig.NanoCpus}}}'
    result = subprocess.run(['docker', 'inspect', '--format', template, AUTH],
                            check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def ram_cpu_caps(content):
    return [line for line in CAPS.findall(content) if not re.match(rb'^\s*memswap_limit:', line)]


def memory_setting(service, key, optional=False):
    occurrences = re.findall(rb'(?m)^    ' + key + rb'[ \t]*:', service)
    if optional and not occurrences:
        return None
    expression = rb'(?m)^    ' + key + rb':[ \t]*([\x22\x27]?)(256[mM]|268435456)\1[ \t]*(?:#[^\r\n]*)?\r?$'
    if len(occurrences) != 1 or not re.search(expression, service):
        raise RuntimeError('Unexpected Auth memory setting: ' + key.decode())
    return AUTH_MEMORY


def block(content, name, indent):
    matches = list(re.finditer(rb'(?m)^' + b' ' * indent + re.escape(name) + rb':[ \t]*\r?$', content))
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one configuration block: ' + name.decode())
    start = matches[0].end()
    following = re.search(rb'(?m)^ {0,' + str(indent).encode() + rb'}[A-Za-z0-9_.-]+:', content[start:])
    return start, start + following.start() if following else len(content)


def patch_environment(environment):
    """Only the observed list format `    - KEY=VALUE`; never YAML interpolation or duplicates."""
    before, patched = {}, environment
    for key, value in SETTINGS:
        occurrences = re.findall(rb'(?m)^[ \t]*-?[ \t]*' + key + rb'[ \t]*[=:]', patched)
        exact = list(re.finditer(rb'(?m)^    - ' + key + rb'=([^\r\n]*?)(\r?)$', patched))
        if len(occurrences) > 1 or len(occurrences) != len(exact):
            raise RuntimeError('Unexpected Auth setting: ' + key.decode())
        if exact:
            current = exact[0][1]
            if current != value:
                raise RuntimeError('Unexpected Auth setting value: ' + key.decode())
            before[key.decode()] = current.decode()
            continue
        before[key.decode()] = None
        anchors = list(re.finditer(rb'(?m)^    - GOTRUE_[A-Z0-9_]+=[^\r\n]*(\r?\n)', patched))
        if not anchors:
            raise RuntimeError('Expected GoTrue settings in list format')
        anchor = anchors[-1]
        patched = patched[:anchor.end()] + b'    - ' + key + b'=' + value + anchor[1] + patched[anchor.end():]
    return patched, before


def patch_content(original, runtime):
    if runtime.get('Memory') != AUTH_MEMORY or runtime.get('MemorySwap') != AUTH_MEMORY:
        raise RuntimeError('Expected live Auth Memory and MemorySwap of 268435456 bytes; refusing resource changes')
    service_start, service_end = block(original, b'supabase-auth', 2)
    service = original[service_start:service_end]
    if not re.search(rb'(?m)^    image:[ \t]*supabase/gotrue:v2\.[0-9]+\.[0-9]+[ \t]*\r?$', service):
        raise RuntimeError('Expected a supabase/gotrue v2 image with HIBP support')
    memory_setting(service, b'mem_limit')
    existing_swap = memory_setting(service, b'memswap_limit', optional=True)
    env_start, env_end = block(service, b'environment', 4)
    patched_environment, before = patch_environment(service[env_start:env_end])
    changed_service = service[:env_start] + patched_environment + service[env_end:]
    if existing_swap is None:
        memory_line = re.search(rb'(?m)^    mem_limit:[^\r\n]*(\r?\n|$)', changed_service)
        ending = memory_line[1] or b'\n'
        added = b'    memswap_limit: ' + str(runtime['MemorySwap']).encode() + ending
        changed_service = changed_service[:memory_line.end()] + added + changed_service[memory_line.end():]
    changed = original[:service_start] + changed_service + original[service_end:]
    if ram_cpu_caps(original) != ram_cpu_caps(changed):
        raise RuntimeError('CPU or memory limits changed; refusing patch')
    return changed, {'before': before, 'after': {key.decode(): value.decode() for key, value in SETTINGS},
                     'ram_cpu_limits_original_sha256': sha256(b''.join(ram_cpu_caps(original))),
                     'ram_cpu_limits_final_sha256': sha256(b''.join(ram_cpu_caps(changed))),
                     'runtime': {key: runtime.get(key) for key in ('Memory', 'MemorySwap', 'NanoCpus')},
                     'auth_memswap': {'before_bytes': existing_swap, 'after_bytes': runtime['MemorySwap'], 'added': existing_swap is None},
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
    descriptor, temporary = tempfile.mkstemp(prefix='.sitov-auth-hibp-', dir=path.parent)
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
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
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
