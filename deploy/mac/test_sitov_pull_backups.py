import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('sitov_pull_backups', Path(__file__).with_name('sitov-pull-backups.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MacBackupTest(unittest.TestCase):
    def test_retention_never_removes_latest_or_unrelated_archives(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = []
            for day in ('01', '02', '03'):
                path = root / ('sitov-daily-202610' + day + 'T033000000000Z.age')
                path.write_bytes(b'0123456789')
                paths.append(path)
            unrelated = root / 'sitov-cluster-security-20261004.age'
            unrelated.write_bytes(b'0' * 100)
            self.assertEqual(module.expired(paths + [unrelated], keep=14, max_bytes=15), paths[:2])
            self.assertEqual(module.expired(paths, keep=1), paths[:2])

    def test_real_stream_verification_and_manipulation_rejection(self):
        age = os.environ.get('SITOV_TEST_AGE_BIN')
        if not age:
            self.skipTest('Set SITOV_TEST_AGE_BIN for real age verification')
        keygen = str(Path(age).with_name('age-keygen'))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'sitov-daily-20261004T033000000000Z'
            source.mkdir()
            hashes = {}
            for name in ('postgres.dump', 'roles.sql', 'storage-manifest.json', 'buckets.json'):
                (source / name).write_bytes(b'sitov test fixture')
                hashes[name] = hashlib.sha256((source / name).read_bytes()).hexdigest()
            (source / 'sha256.json').write_text(json.dumps(hashes))
            (source / 'COMPLETE').touch()
            identity = root / 'identity.txt'
            subprocess.run([keygen, '-o', str(identity)], check=True, capture_output=True)
            recipient = subprocess.check_output([keygen, '-y', str(identity)], text=True).strip()
            tar = subprocess.check_output(['tar', '-C', str(root), '-cf', '-', source.name], env={**os.environ, 'COPYFILE_DISABLE': '1'})
            encrypted = root / 'backup.age'
            result = subprocess.run([age, '-r', recipient], input=tar, capture_output=True, check=True)
            encrypted.write_bytes(result.stdout)
            self.assertEqual(module.verify_archive(encrypted, identity, age), 4)
            # Even authenticated ciphertext must match the interior backup inventory.
            hashes['roles.sql'] = '0' * 64
            (source / 'sha256.json').write_text(json.dumps(hashes))
            bad_tar = subprocess.check_output(['tar', '-C', str(root), '-cf', '-', source.name], env={**os.environ, 'COPYFILE_DISABLE': '1'})
            encrypted.write_bytes(subprocess.run([age, '-r', recipient], input=bad_tar, capture_output=True, check=True).stdout)
            with self.assertRaisesRegex(ValueError, 'digest mismatch'):
                module.verify_archive(encrypted, identity, age)
            damaged = bytearray(result.stdout)
            damaged[-1] ^= 1
            encrypted.write_bytes(damaged)
            with self.assertRaises((ValueError, tarfile.ReadError)):
                module.verify_archive(encrypted, identity, age)


if __name__ == '__main__':
    unittest.main()
