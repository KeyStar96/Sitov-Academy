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
from pathlib import Path
import subprocess


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def verify(source):
    if not (source / 'COMPLETE').is_file():
        raise ValueError('Incomplete backup')
    hashes = json.loads((source / 'sha256.json').read_text())
    core = {'postgres.dump', 'roles.sql', 'storage-manifest.json', 'buckets.json'}
    if not isinstance(hashes, dict) or not hashes or not (
        core.issubset(hashes) or 'cluster/backup_manifest' in hashes or 'configuration-manifest.json' in hashes
    ):
        raise ValueError('Missing backup inventory/core members')
    for name, expected in hashes.items():
        original = source / name
        path = original.resolve()
        if original.is_symlink() or not path.is_relative_to(source.resolve()) or not path.is_file():
            raise ValueError('Invalid backup member')
        if not isinstance(expected, str) or not re.fullmatch(r'[0-9a-f]{64}', expected) or digest(path) != expected:
            raise ValueError('Backup digest mismatch')
    return len(hashes)


def export(source, recipient, output, age_binary='age'):
    members = verify(source)
    output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    if output.exists():
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
        except BaseException:
            archive.kill()
            archive.wait()
            temporary.unlink(missing_ok=True)
            raise
        finally:
            archive.stdout.close()
            archive.stderr.close()
    temporary.chmod(0o600)
    temporary.rename(output)
    checksum = digest(output)
    output.with_suffix(output.suffix + '.sha256').write_text(checksum + '  ' + output.name + '\n')
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
