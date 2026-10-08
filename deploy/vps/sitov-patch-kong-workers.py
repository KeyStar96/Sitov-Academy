#!/usr/bin/env python3
"""Inspect Sitov Academy Kong settings; --apply pins one Nginx worker.

Only KONG_NGINX_WORKER_PROCESSES and a missing memswap_limit change. The
observed 512 MiB RAM/swap cap and one-CPU quota must already match at runtime.
All other Compose bytes, including secrets, YAML types and comments, remain
unchanged. One private previous configuration is retained, without restarting
any container. Recreate only supabase-kong separately after reviewing the patch.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import tempfile
import sys


COMPOSE = Path('/data/coolify/services/eknmzxvqilojjicinatnllbt/docker-compose.yml')
BACKUPS = Path('/root/backups/sitov-kong-workers')
KONG = 'supabase-kong-eknmzxvqilojjicinatnllbt'
KONG_MEMORY = 536870912
KEY = b'KONG_NGINX_WORKER_PROCESSES'
CAPS = re.compile(rb'(?m)^[ \t]*(?:mem_limit|mem_reservation|memswap_limit|mem_swappiness|cpus|cpu_count|cpu_percent|cpu_shares|cpu_period|cpu_quota|cpuset|memory):[^\r\n]*(?:\r?\n|$)')


def sha256(content):
    return hashlib.sha256(content).hexdigest()


def read_runtime_limits():
    # Inspect only non-secret cgroup fields; never request the full environment.
    template = '{"Memory":{{.HostConfig.Memory}},"MemorySwap":{{.HostConfig.MemorySwap}},"NanoCpus":{{.HostConfig.NanoCpus}}}'
    result = subprocess.run(['docker', 'inspect', '--format', template, KONG],
                            check=True, capture_output=True, text=True, timeout=15)
    return json.loads(result.stdout)


def block(content, name, indent):
    expression = rb'(?m)^' + b' ' * indent + re.escape(name) + rb':[ \t]*(?:#[^\r\n]*)?\r?$'
    matches = list(re.finditer(expression, content))
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one configuration block: ' + name.decode())
    start = matches[0].end()
    following = re.search(rb'(?m)^ {0,' + str(indent).encode() + rb'}[A-Za-z0-9_.-]+:', content[start:])
    return start, start + following.start() if following else len(content)


def cap_setting(service, key, numeric, optional=False):
    occurrences = re.findall(rb'(?m)^    ' + key + rb'[ \t]*:', service)
    if optional and not occurrences:
        return None
    literal = rb'(?:512[mM]|536870912)' if numeric == KONG_MEMORY else rb'(?:1|1\.0)'
    expression = rb'(?m)^    ' + key + rb':[ \t]*([\x22\x27]?)(' + literal + rb')\1[ \t]*(?:#[^\r\n]*)?\r?$'
    if len(occurrences) != 1 or not re.search(expression, service):
        raise RuntimeError('Unexpected Kong resource setting: ' + key.decode())
    return numeric


def patch_environment(environment):
    # Handle both Compose environment forms without deserializing other values.
    lines = [(match, match[1]) for match in re.finditer(rb'(?m)^([^\r\n]*)(?:\r?\n|$)', environment)
             if match[1].strip() and not match[1].lstrip().startswith(b'#')]
    if not lines:
        raise RuntimeError('Expected explicit Kong environment entries')
    list_lines = [entry for entry in lines if re.match(rb'^ {4}(?: {2})?- ', entry[1])]
    mapping_lines = [entry for entry in lines if re.match(rb'^ {6}[A-Z][A-Z0-9_]*[ \t]*:', entry[1])]
    if len(list_lines) == len(lines):
        style = 'list'
        indents = {re.match(rb'^( +)- ', line)[1] for _, line in lines}
        if len(indents) != 1:
            raise RuntimeError('Mixed Kong environment indentation')
        indent = next(iter(indents))
        candidates = [entry for entry in lines if re.search(rb'(?:^|[\x22\x27 ])' + KEY + rb'(?:=|[\x22\x27 ]|$)', entry[1])]
        pattern = re.compile(rb'^(' + indent + rb'- )([\x22\x27]?)' + KEY + rb'=([A-Za-z0-9]+)\2([ \t]*(?:#[^\r\n]*)?)$')
    elif len(mapping_lines) == len(lines):
        style = 'mapping'
        indent = b'      '
        candidates = [entry for entry in lines if re.match(rb'^ {6}' + KEY + rb'[ \t]*:', entry[1])]
        pattern = re.compile(rb'^(' + indent + KEY + rb':[ \t]*)([\x22\x27]?)([A-Za-z0-9]+)\2([ \t]*(?:#[^\r\n]*)?)$')
    else:
        raise RuntimeError('Unknown, inherited or mixed Kong environment representation')
    if len(candidates) > 1:
        raise RuntimeError('Duplicate Kong worker setting')
    before = None
    if candidates:
        line, content = candidates[0]
        match = pattern.fullmatch(content)
        if not match or (match[3] != b'auto' and not re.fullmatch(rb'[1-9][0-9]*', match[3])):
            raise RuntimeError('Unexpected Kong worker setting')
        before = match[3].decode()
        quote = match[2] or (b"'" if style == 'mapping' else b'')
        replacement = match[1] + quote + (KEY + b'=1' if style == 'list' else b'1') + quote + match[4]
        changed = environment[:line.start()] + replacement + environment[line.start() + len(content):]
    else:
        line, content = lines[-1]
        ending = line[0][len(content):] or (b'\r\n' if b'\r\n' in environment else b'\n')
        added = indent + (b'- ' + KEY + b'=1' if style == 'list' else KEY + b": '1'") + ending
        changed = environment[:line.end()] + (b'' if line[0].endswith(b'\n') else ending) + added + environment[line.end():]
    return changed, before, style


def patch_content(original, runtime):
    expected = {'Memory': KONG_MEMORY, 'MemorySwap': KONG_MEMORY, 'NanoCpus': 1_000_000_000}
    if any(runtime.get(key) != value for key, value in expected.items()):
        raise RuntimeError('Expected live Kong RAM/swap caps of 512 MiB and a one-CPU quota')
    if b'\t' in original:
        raise RuntimeError('Tabs in Compose are not supported')
    services_start, services_end = block(original, b'services', 0)
    services = original[services_start:services_end]
    start, end = block(services, b'supabase-kong', 2)
    service = services[start:end]
    image = rb'(?m)^    image:[ \t]*([\x22\x27]?)(?:kong|kong/kong):3\.9\.1\1[ \t]*(?:#[^\r\n]*)?\r?$'
    if not re.search(image, service) or len(re.findall(rb'(?m)^    image[ \t]*:', service)) != 1:
        raise RuntimeError('Expected the observed Kong 3.9.1 image')
    cap_setting(service, b'mem_limit', KONG_MEMORY)
    cap_setting(service, b'cpus', 1)
    swap = cap_setting(service, b'memswap_limit', KONG_MEMORY, optional=True)
    env_start, env_end = block(service, b'environment', 4)
    environment, before, style = patch_environment(service[env_start:env_end])
    changed_service = service[:env_start] + environment + service[env_end:]
    if swap is None:
        memory_line = re.search(rb'(?m)^    mem_limit:[^\r\n]*(\r?\n|$)', changed_service)
        ending = memory_line[1] or b'\n'
        changed_service = changed_service[:memory_line.end()] + b'    memswap_limit: 512m' + ending + changed_service[memory_line.end():]
    changed_services = services[:start] + changed_service + services[end:]
    changed = original[:services_start] + changed_services + original[services_end:]
    caps_before = [line for line in CAPS.findall(original) if not re.match(rb'^\s*memswap_limit:', line)]
    caps_after = [line for line in CAPS.findall(changed) if not re.match(rb'^\s*memswap_limit:', line)]
    if caps_before != caps_after:
        raise RuntimeError('RAM or CPU limits changed; refusing patch')
    report = {'service': 'supabase-kong', 'before_workers': before, 'after_workers': '1',
              'environment_format': style, 'swap_added': swap is None, 'swap_after_bytes': KONG_MEMORY,
              'runtime': expected, 'changed': changed != original,
              'ram_cpu_sha256': sha256(b''.join(caps_before))}
    return changed, report


def regular_private_path(path, require_root=True):
    metadata = path.lstat()
    if not stat.S_ISREG(metadata.st_mode) or path.resolve() != path.absolute():
        raise RuntimeError('Expected a regular Compose path without symlinks')
    if require_root and metadata.st_uid != 0:
        raise RuntimeError('Expected a root-owned Compose configuration')
    if stat.S_IMODE(metadata.st_mode) & 0o077:
        raise RuntimeError('Compose contains secrets and must be private (mode 600)')
    return metadata


def atomic_write(path, content, mode, uid, gid, expected=None):
    descriptor, temporary = tempfile.mkstemp(prefix='.sitov-kong-workers-', dir=path.parent)
    try:
        with os.fdopen(descriptor, 'wb') as output:
            os.fchmod(output.fileno(), mode)
            os.fchown(output.fileno(), uid, gid)
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        if expected is not None:
            previous, inode = expected
            if path.read_bytes() != previous or path.lstat().st_ino != inode:
                raise RuntimeError('Compose changed concurrently; refusing replacement')
        os.replace(temporary, path)
        descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def apply_patch(path, backup_root, runtime):
    metadata = regular_private_path(path)
    original = path.read_bytes()
    changed, report = patch_content(original, runtime)
    if changed == original:
        return report
    backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    if backup_root.is_symlink() or backup_root.resolve() != backup_root.absolute() or backup_root.stat().st_uid != 0:
        raise RuntimeError('Expected a real root-owned configuration backup directory')
    backup_root.chmod(0o700)
    backup = backup_root / 'previous-docker-compose.yml'
    if backup.exists() or backup.is_symlink():
        regular_private_path(backup)
    atomic_write(backup, original, 0o600, metadata.st_uid, metadata.st_gid)
    if backup.read_bytes() != original:
        raise RuntimeError('Configuration backup verification failed')
    if path.read_bytes() != original or path.lstat().st_ino != metadata.st_ino:
        raise RuntimeError('Compose changed concurrently; refusing replacement')
    # Last compare immediately before the atomic replacement. The operational
    # lock also prevents two executions of this patch from racing each other.
    atomic_write(path, changed, stat.S_IMODE(metadata.st_mode), metadata.st_uid, metadata.st_gid,
                 expected=(original, metadata.st_ino))
    report.update(backup=str(backup), backup_sha256=sha256(original), compose_sha256=sha256(changed))
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--dry-run', action='store_true', help='inspect only (default)')
    args = parser.parse_args(argv)
    try:
        regular_private_path(COMPOSE)
        runtime = read_runtime_limits()
        if args.apply:
            if os.geteuid() != 0:
                parser.error('--apply requires root')
            lock_path = COMPOSE.parent / '.sitov-kong-workers.lock'
            descriptor = os.open(lock_path, os.O_CREAT | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
            with os.fdopen(descriptor, 'w') as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                report = apply_patch(COMPOSE, BACKUPS, runtime)
        else:
            _, report = patch_content(COMPOSE.read_bytes(), runtime)
        report['applied'] = args.apply
        # Idempotent Compose settings alone cannot prove the running container
        # has loaded them. Never report activation on the strength of a no-op.
        report['activation_performed'] = False
        print(json.dumps(report, sort_keys=True))
        return 0
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError):
        # Do not propagate Compose contents or subprocess stderr containing
        # secrets. Detailed decisions are covered by local contract tests.
        print('Kong worker patch refused: configuration, permissions, runtime or concurrent operation did not match the expected contract.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
