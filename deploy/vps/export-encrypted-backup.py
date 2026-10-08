#!/usr/bin/env python3
"""Export a verified Sitov backup with authenticated streaming age encryption.

Only a public age recipient is required on the VPS. Keep the private identity
outside the VPS and Git. Copy the .age file to independent storage.
Decrypt: age --decrypt --identity KEY.txt --output backup.tar FILE.age
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path, PurePosixPath
import subprocess


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def verify(source):
    if source.is_symlink() or not source.is_dir() or not (source / 'COMPLETE').is_file():
        raise ValueError('Incomplete backup')
    hashes = json.loads((source / 'sha256.json').read_text())
    core = {'postgres.dump', 'roles.sql', 'storage-manifest.json', 'buckets.json'}
    if not isinstance(hashes, dict) or not hashes or not (
        core.issubset(hashes) or 'cluster/backup_manifest' in hashes or 'configuration-manifest.json' in hashes
    ):
        raise ValueError('Missing backup inventory/core members')
    for name, expected in hashes.items():
        if not isinstance(name, str) or not name or PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts:
            raise ValueError('Invalid backup member name')
        original = source / name
        path = original.resolve()
        if original.is_symlink() or not path.is_relative_to(source.resolve()) or not path.is_file():
            raise ValueError('Invalid backup member')
        if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected) or digest(path) != expected:
            raise ValueError('Backup digest mismatch')
    actual = set()
    for path in source.rglob('*'):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError('Invalid backup member type')
        if path.is_file():
            actual.add(path.relative_to(source).as_posix())
    if actual != set(hashes) | {'COMPLETE', 'sha256.json'}:
        raise ValueError('Unlisted backup files')
    return len(hashes)


def sync_directory(path):
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def export(source, recipient, output, age_binary='age'):
    members = verify(source)
    output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    checksum_path = output.with_suffix(output.suffix + '.sha256')
    if output.parent.is_symlink() or output.exists() or output.is_symlink() or checksum_path.exists() or checksum_path.is_symlink():
        raise ValueError('Refusing to overwrite encrypted backup')
    temporary = output.with_name(output.name + '.partial')
    with temporary.open('xb') as encrypted:
        archive = subprocess.Popen(['tar', '-C', str(source.parent), '-cf', '-', '--', source.name], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            result = subprocess.run([age_binary, '--encrypt', '--recipient', recipient], stdin=archive.stdout, stdout=encrypted, stderr=subprocess.PIPE)
            archive.stdout.close()
            error = archive.stderr.read()
            tar_status = archive.wait()
            if result.returncode or tar_status:
                raise RuntimeError('Encrypted export failed: ' + (result.stderr + error).decode(errors='replace'))
            encrypted.flush()
            os.fsync(encrypted.fileno())
        except BaseException:
            archive.kill()
            archive.wait()
            temporary.unlink(missing_ok=True)
            raise
        finally:
            archive.stdout.close()
            archive.stderr.close()
    temporary.chmod(0o600)
    checksum_temporary = checksum_path.with_name(checksum_path.name + '.partial')
    checksum_published = False
    checksum_temporary_created = False
    try:
        checksum = digest(temporary)
        if temporary.stat().st_size == 0:
            raise ValueError('Empty encrypted backup')
        with checksum_temporary.open('x') as sidecar:
            checksum_temporary_created = True
            sidecar.write(checksum + '  ' + output.name + '\n')
            sidecar.flush()
            os.fsync(sidecar.fileno())
        checksum_temporary.chmod(0o600)
        # Publish the sidecar first, then expose the complete ciphertext as one
        # atomic no-overwrite operation. The Mac never sees an .age without its
        # checksum, and a failed export never displaces an existing archive.
        os.link(checksum_temporary, checksum_path)
        checksum_published = True
        os.link(temporary, output)
        sync_directory(output.parent)
    except BaseException:
        if checksum_published and not output.exists():
            checksum_path.unlink(missing_ok=True)
        raise
    finally:
        temporary.unlink(missing_ok=True)
        if checksum_temporary_created:
            checksum_temporary.unlink(missing_ok=True)
    print(json.dumps({'encrypted_backup': str(output), 'sha256': checksum, 'verified_files': members, 'bytes': output.stat().st_size}))


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--recipient', required=True)
    parser.add_argument('--age-binary', default='age')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    export(args.source, args.recipient, args.output, args.age_binary)


if __name__ == '__main__':
    main()
