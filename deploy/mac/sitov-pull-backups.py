#!/usr/bin/env python3
"""Pull the newest encrypted daily Sitov backup to the Mac and verify it.

SSH and the private age identity remain outside Git. Decryption is streamed into
manifest checks; no plaintext archive is written. Run while the Mac is awake.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import shutil
import subprocess
import tarfile

NAME = re.compile(r'sitov-daily-[0-9]{8}T[0-9]{12}Z\.age')
MAX_BYTES = 20 * 1024 ** 3
KEEP = 14
NETWORK_POLL_SECONDS = 5
DEFAULT_NETWORK_GUARD = Path.home() / 'Library/Application Support/Sitov Academy/Tools/sitov-network-guard'
NETWORK_REASONS = {
    'allowed_wifi', 'wifi_allowlist_missing', 'wifi_config_invalid', 'wifi_config_unavailable',
    'invalid_arguments', 'network_guard_failed', 'network_unavailable', 'expensive_network',
    'constrained_network', 'wifi_required', 'wifi_interface_ambiguous', 'ssid_unavailable',
    'wifi_not_allowed', 'network_check_timeout',
}
REMOTE = """python3 - <<'PY'
from pathlib import Path
import json,re
root=Path('/root/backups/encrypted/daily')
paths=sorted(p for p in root.glob('sitov-daily-*.age') if re.fullmatch(r'sitov-daily-[0-9]{8}T[0-9]{12}Z\\.age',p.name))
if not paths: raise SystemExit('No complete encrypted daily backup available')
p=paths[-1]
sha=p.with_suffix('.age.sha256').read_text().split()[0]
print(json.dumps({'name':p.name,'bytes':p.stat().st_size,'sha256':sha}))
PY"""


class SitovNetworkIneligible(Exception):
    def __init__(self, reason):
        self.reason = reason
        super().__init__('Backup deferred: ' + reason)


def network_status(guard, allowed_wifi_config):
    if allowed_wifi_config is None:
        return {'eligible': False, 'reason': 'wifi_allowlist_missing'}
    if not allowed_wifi_config.is_file() or allowed_wifi_config.is_symlink():
        return {'eligible': False, 'reason': 'wifi_config_unavailable'}
    try:
        result = subprocess.run([str(guard), '--allowed-wifi-config', str(allowed_wifi_config)],
                                capture_output=True, text=True, timeout=5, check=True)
        if len(result.stdout) > 1024:
            raise ValueError('Invalid network guard response')
        snapshot = json.loads(result.stdout)
        if not isinstance(snapshot, dict) or type(snapshot.get('eligible')) is not bool or snapshot.get('reason') not in NETWORK_REASONS:
            raise ValueError('Invalid network guard response')
        if snapshot['eligible'] and snapshot['reason'] != 'allowed_wifi':
            raise ValueError('Invalid eligible network response')
        return {'eligible': snapshot['eligible'], 'reason': snapshot['reason']}
    except (OSError, subprocess.SubprocessError, ValueError, TypeError):
        return {'eligible': False, 'reason': 'network_guard_failed'}


def stop_network_process(process):
    # SCP starts an SSH child. Stop the entire private process group so the
    # transfer cannot continue after its parent has been terminated.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.communicate(timeout=2)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.communicate()


def network_run(command, guard, allowed_wifi_config, capture=False):
    snapshot = network_status(guard, allowed_wifi_config)
    if not snapshot['eligible']:
        raise SitovNetworkIneligible(snapshot['reason'])
    process = subprocess.Popen(command, stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                               stderr=subprocess.PIPE, text=True, start_new_session=True)
    try:
        while True:
            try:
                output, error = process.communicate(timeout=NETWORK_POLL_SECONDS)
                if process.returncode != 0:
                    raise subprocess.CalledProcessError(process.returncode, command, output=output, stderr=error)
                return output
            except subprocess.TimeoutExpired:
                snapshot = network_status(guard, allowed_wifi_config)
                if not snapshot['eligible']:
                    raise SitovNetworkIneligible(snapshot['reason'])
    finally:
        if process.poll() is None:
            stop_network_process(process)


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def verify_archive(path, identity, age):
    process = subprocess.Popen([age, '--decrypt', '--identity', str(identity), str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    hashes, expected, root, complete = {}, None, None, False
    try:
        with tarfile.open(fileobj=process.stdout, mode='r|') as archive:
            for member in archive:
                parts = PurePosixPath(member.name).parts
                if not parts or member.name.startswith('/') or '..' in parts:
                    raise ValueError('Unsafe backup archive path')
                if root is None:
                    root = parts[0]
                if parts[0] != root or member.issym() or member.islnk():
                    raise ValueError('Invalid backup archive member')
                if member.isdir():
                    continue
                if not member.isfile() or len(parts) < 2:
                    raise ValueError('Unexpected backup member type')
                name = '/'.join(parts[1:])
                if name in hashes:
                    raise ValueError('Duplicate backup archive member')
                stream = archive.extractfile(member)
                value = hashlib.sha256()
                if name == 'sha256.json':
                    if member.size > 32 * 1024 ** 2:
                        raise ValueError('Backup manifest too large')
                    data = stream.read()
                    expected = json.loads(data)
                    value.update(data)
                else:
                    for block in iter(lambda: stream.read(1024 * 1024), b''):
                        value.update(block)
                hashes[name] = value.hexdigest()
                complete = complete or name == 'COMPLETE'
        # Drain tar padding so age finishes and verifies every authentication tag.
        while process.stdout.read(1024 * 1024):
            pass
        error = process.stderr.read()
        if process.wait() != 0:
            raise ValueError('Age decryption/authentication failed: ' + error.decode(errors='replace'))
        core = {'postgres.dump', 'roles.sql', 'storage-manifest.json', 'buckets.json'}
        if not complete or not isinstance(expected, dict) or not core.issubset(expected):
            raise ValueError('Incomplete logical backup inventory')
        for name, checksum in expected.items():
            if not isinstance(checksum, str) or not re.fullmatch('[0-9a-f]{64}', checksum) or hashes.get(name) != checksum:
                raise ValueError('Backup manifest digest mismatch')
        if set(hashes) != set(expected) | {'COMPLETE', 'sha256.json'}:
            raise ValueError('Unlisted backup files')
        return len(expected)
    finally:
        if process.poll() is None:
            process.kill()
        process.wait()
        process.stdout.close()
        process.stderr.close()


def expired(paths, keep=KEEP, max_bytes=MAX_BYTES):
    paths = sorted(path for path in paths if NAME.fullmatch(path.name))
    remaining, total, doomed = len(paths), sum(path.stat().st_size for path in paths), []
    for path in paths[:-1]:
        if remaining <= keep and total <= max_bytes:
            break
        remaining -= 1
        total -= path.stat().st_size
        doomed.append(path)
    return doomed


def pull(host, destination, identity, age, network_guard=DEFAULT_NETWORK_GUARD, allowed_wifi_config=None):
    if destination.is_symlink() or not identity.is_file():
        raise ValueError('Private destination/identity unavailable')
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    destination.chmod(0o700)
    with (destination / '.sitov-pull.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        raw = network_run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', host, REMOTE], network_guard, allowed_wifi_config, capture=True)
        info = json.loads(raw)
        name, checksum, size = info['name'], info['sha256'], info['bytes']
        if not NAME.fullmatch(name) or not re.fullmatch('[0-9a-f]{64}', checksum) or not isinstance(size, int) or size <= 0:
            raise ValueError('Invalid remote encrypted backup inventory')
        target = destination / name
        receipt = target.with_suffix('.age.verified.json')
        if target.exists() and receipt.exists() and digest(target) == checksum and json.loads(receipt.read_text()).get('sha256') == checksum:
            print('Newest independent Sitov backup already verified: ' + name)
            return
        if shutil.disk_usage(destination).free < size + 10 * 1024 ** 3:
            raise ValueError('Insufficient Mac disk space; preserving existing backups')
        partial = destination / (name + '.partial')
        partial.unlink(missing_ok=True)
        try:
            network_run(['scp', '-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', host + ':/root/backups/encrypted/daily/' + name, str(partial)], network_guard, allowed_wifi_config)
            partial.chmod(0o600)
            if partial.stat().st_size != size or digest(partial) != checksum:
                raise ValueError('Encrypted transfer checksum mismatch')
            files = verify_archive(partial, identity, age)
            partial.replace(target)
            receipt.write_text(json.dumps({'sha256': checksum, 'verified_files': files, 'bytes': size}) + '\n')
            receipt.chmod(0o600)
        finally:
            partial.unlink(missing_ok=True)
        # Prune only our daily encrypted files, after a newly verified recovery point.
        for path in expired(destination.glob('sitov-daily-*.age')):
            path.unlink()
            path.with_suffix('.age.verified.json').unlink(missing_ok=True)
        print('Independent Sitov backup transferred and decrypted/verified: ' + name + ' (' + str(files) + ' files)')


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', default='sitov-academy')
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--identity', type=Path, required=True)
    parser.add_argument('--age', required=True)
    parser.add_argument('--network-guard', type=Path, default=DEFAULT_NETWORK_GUARD)
    parser.add_argument('--allowed-wifi-config', type=Path, help='Private JSON file containing an explicit array of allowed Wi-Fi SSIDs')
    args = parser.parse_args()
    snapshot = network_status(args.network_guard, args.allowed_wifi_config)
    if not snapshot['eligible']:
        print(json.dumps(snapshot, sort_keys=True))
        return
    try:
        pull(args.host, args.destination, args.identity, args.age, args.network_guard, args.allowed_wifi_config)
    except SitovNetworkIneligible as error:
        print(json.dumps({'eligible': False, 'reason': error.reason}, sort_keys=True))


if __name__ == '__main__':
    main()
