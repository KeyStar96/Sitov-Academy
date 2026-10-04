import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('sitov_export', Path(__file__).resolve().parents[1] / 'export-encrypted-backup.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BackupEncryptionTest(unittest.TestCase):
    def source(self, root):
        source = root / 'sitov-backup-test'
        source.mkdir()
        hashes = {}
        for name in ['postgres.dump', 'roles.sql', 'storage-manifest.json', 'buckets.json']:
            (source / name).write_bytes(b'sitov test fixture')
            hashes[name] = module.digest(source / name)
        (source / 'sha256.json').write_text(json.dumps(hashes))
        (source / 'COMPLETE').touch()
        return source

    def test_incomplete_empty_tampered_and_symlink_inventories_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.source(Path(directory))
            self.assertEqual(module.verify(source), 4)
            data = json.loads((source / 'sha256.json').read_text())
            (source / 'sha256.json').write_text('{}')
            with self.assertRaises(ValueError): module.verify(source)
            (source / 'sha256.json').write_text(json.dumps(data))
            (source / 'roles.sql').write_text('tampered')
            with self.assertRaises(ValueError): module.verify(source)
            (source / 'roles.sql').unlink()
            (source / 'roles.sql').symlink_to(source / 'postgres.dump')
            with self.assertRaises(ValueError): module.verify(source)

    def test_real_streaming_encryption_decryption_and_tamper_detection(self):
        age = os.environ.get('SITOV_TEST_AGE_BIN') or shutil.which('age')
        if not age:
            self.skipTest('Set SITOV_TEST_AGE_BIN or install age for encryption integration')
        keygen = str(Path(age).with_name('age-keygen'))
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            identity = root / 'identity.txt'
            subprocess.run([keygen, '-o', str(identity)], check=True, capture_output=True)
            recipient = subprocess.check_output([keygen, '-y', str(identity)], text=True).strip()
            encrypted = root / 'backup.age'
            module.export(self.source(root), recipient, encrypted, age)
            plaintext = root / 'backup.tar'
            subprocess.run([age, '-d', '-i', str(identity), '-o', str(plaintext), str(encrypted)], check=True, capture_output=True)
            self.assertGreater(plaintext.stat().st_size, 0)
            damaged = bytearray(encrypted.read_bytes()); damaged[-1] ^= 1
            encrypted.write_bytes(damaged)
            failed = subprocess.run([age, '-d', '-i', str(identity), str(encrypted)], capture_output=True)
            self.assertNotEqual(failed.returncode, 0)


if __name__ == '__main__': unittest.main()
