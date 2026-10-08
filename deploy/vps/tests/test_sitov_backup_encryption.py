import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

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

    def test_unlisted_files_and_directory_symlinks_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            source = self.source(Path(directory))
            extra = source / 'unlisted.txt'
            extra.write_text('not covered by manifest')
            with self.assertRaisesRegex(ValueError, 'Unlisted'):
                module.verify(source)
            extra.unlink()
            (source / 'linked-directory').symlink_to(Path(directory))
            with self.assertRaisesRegex(ValueError, 'member type'):
                module.verify(source)

    def test_checksum_is_published_before_ciphertext_and_existing_output_is_preserved(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.source(root)
            output = root / 'backup.age'
            checksum = output.with_suffix('.age.sha256')
            real_link = os.link
            publication = []
            def copy_test_stream(command, stdin, stdout, **kwargs):
                shutil.copyfileobj(stdin, stdout)
                return SimpleNamespace(returncode=0, stderr=b'')
            def link(first, second):
                if second == output:
                    self.assertTrue(checksum.is_file())
                    self.assertFalse(output.exists())
                publication.append(second)
                return real_link(first, second)
            with patch.object(module.subprocess, 'run', side_effect=copy_test_stream), patch.object(module.os, 'link', side_effect=link):
                module.export(source, 'public recipient fixture', output)
            self.assertEqual(publication, [checksum, output])
            self.assertEqual(checksum.read_text().split(), [module.digest(output), output.name])
            self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            self.assertFalse(list(root.glob('*.partial')))
            original = output.read_bytes()
            with self.assertRaisesRegex(ValueError, 'overwrite'):
                module.export(source, 'public recipient fixture', output)
            self.assertEqual(output.read_bytes(), original)

    def test_failed_ciphertext_publication_removes_own_sidecar_and_partials(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = self.source(root)
            output = root / 'backup.age'
            real_link = os.link
            def copy_test_stream(command, stdin, stdout, **kwargs):
                shutil.copyfileobj(stdin, stdout)
                return SimpleNamespace(returncode=0, stderr=b'')
            def fail_final(first, second):
                if second == output:
                    raise OSError('simulated failed atomic publication')
                return real_link(first, second)
            with patch.object(module.subprocess, 'run', side_effect=copy_test_stream), patch.object(module.os, 'link', side_effect=fail_final):
                with self.assertRaisesRegex(OSError, 'publication'):
                    module.export(source, 'public recipient fixture', output)
            self.assertFalse(output.exists())
            self.assertFalse(output.with_suffix('.age.sha256').exists())
            self.assertFalse(list(root.glob('*.partial')))

    def test_existing_checksum_partial_is_never_deleted_by_failed_export(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'backup.age'
            partial = root / 'backup.age.sha256.partial'
            partial.write_text('another run owns this')
            def copy_test_stream(command, stdin, stdout, **kwargs):
                shutil.copyfileobj(stdin, stdout)
                return SimpleNamespace(returncode=0, stderr=b'')
            with patch.object(module.subprocess, 'run', side_effect=copy_test_stream):
                with self.assertRaises(FileExistsError):
                    module.export(self.source(root), 'public recipient fixture', output)
            self.assertEqual(partial.read_text(), 'another run owns this')
            self.assertFalse(output.exists())

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
