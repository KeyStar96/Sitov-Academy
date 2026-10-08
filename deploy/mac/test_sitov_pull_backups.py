import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location('sitov_pull_backups', Path(__file__).with_name('sitov-pull-backups.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MacBackupTest(unittest.TestCase):
    def test_acknowledgement_removes_only_exact_verified_pair_and_preserves_newer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name = 'sitov-daily-20261004T033000000000Z.age'
            newer = root / 'sitov-daily-20261005T033000000000Z.age'
            archive = root / name
            archive.write_bytes(b'old encrypted fixture')
            checksum = module.digest(archive)
            side = archive.with_suffix('.age.sha256')
            side.write_text(checksum + '  ' + name + '\n')
            newer.write_bytes(b'new encrypted fixture')
            newer.with_suffix('.age.sha256').write_text(module.digest(newer) + '  ' + newer.name + '\n')
            source = module.ACK_SOURCE.replace("Path('/root/backups/encrypted/daily')", repr(root))
            source = source.replace("'/var/lock/sitov-backup.lock'", repr(str(root / 'lock')))
            source = source.replace(repr(root), 'Path(' + repr(str(root)) + ')')
            for status in ('removed', 'already_removed'):
                result = subprocess.run(['python3', '-c', source, name, checksum], capture_output=True, text=True, check=True)
                self.assertEqual(json.loads(result.stdout)['status'], status)
            self.assertFalse(archive.exists())
            self.assertFalse(side.exists())
            self.assertTrue(newer.exists())
            self.assertTrue(newer.with_suffix('.age.sha256').exists())

    def test_acknowledgement_rejects_changed_archive_and_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            name = 'sitov-daily-20261004T033000000000Z.age'
            archive = root / name
            archive.write_bytes(b'original')
            checksum = module.digest(archive)
            archive.with_suffix('.age.sha256').write_text(checksum + '  ' + name + '\n')
            source = module.ACK_SOURCE.replace("Path('/root/backups/encrypted/daily')", 'Path(' + repr(str(root)) + ')')
            source = source.replace("'/var/lock/sitov-backup.lock'", repr(str(root / 'lock')))
            archive.write_bytes(b'changed')
            result = subprocess.run(['python3', '-c', source, name, checksum], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(archive.exists())
            archive.unlink()
            unrelated = root / 'unrelated'
            unrelated.write_bytes(b'original')
            archive.symlink_to(unrelated)
            result = subprocess.run(['python3', '-c', source, name, checksum], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue(unrelated.exists())

    def test_remote_delete_happens_only_after_durable_verified_mac_copy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            identity = root / 'identity'
            identity.touch()
            destination = root / 'backups'
            name = 'sitov-daily-20261004T033000000000Z.age'
            content = b'encrypted fixture'
            checksum = hashlib.sha256(content).hexdigest()
            calls = []
            def run(command, *args, **kwargs):
                calls.append(command[0])
                if command[0] == 'scp':
                    Path(command[-1]).write_bytes(content)
                elif module.ACK_SOURCE in command[-1]:
                    target = destination / name
                    self.assertEqual(target.read_bytes(), content)
                    self.assertEqual(json.loads(target.with_suffix('.age.verified.json').read_text())['verified_files'], 4)
                    return json.dumps({'status': 'removed', 'name': name})
                else:
                    return json.dumps({'name': name, 'sha256': checksum, 'bytes': len(content)})
            with patch.object(module, 'network_run', side_effect=run), patch.object(module, 'verify_archive', return_value=4), patch.object(module.shutil, 'disk_usage', return_value=Mock(free=100*1024**3)):
                module.pull('host', destination, identity, '/age')
            self.assertEqual(calls, ['ssh', 'scp', 'ssh'])

    def test_failed_verification_never_acknowledges_remote(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            identity = root / 'identity'
            identity.touch()
            content = b'encrypted fixture'
            name = 'sitov-daily-20261004T033000000000Z.age'
            def run(command, *args, **kwargs):
                if command[0] == 'scp': Path(command[-1]).write_bytes(content)
                else: return json.dumps({'name': name, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)})
            with patch.object(module, 'network_run', side_effect=run), patch.object(module, 'verify_archive', side_effect=ValueError('bad authentication')), patch.object(module, 'acknowledge_remote') as ack, patch.object(module.shutil, 'disk_usage', return_value=Mock(free=100*1024**3)):
                with self.assertRaisesRegex(ValueError, 'authentication'):
                    module.pull('host', root/'backups', identity, '/age')
                ack.assert_not_called()
            self.assertFalse((root/'backups'/name).exists())

    def test_failed_ack_keeps_mac_copy_and_receipt_for_retry_without_redownload(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            identity = root/'identity'
            identity.touch()
            destination=root/'backups'
            name='sitov-daily-20261004T033000000000Z.age'
            content=b'encrypted fixture'
            checksum=hashlib.sha256(content).hexdigest()
            def run(command,*args,**kwargs):
                if command[0]=='scp':Path(command[-1]).write_bytes(content)
                else:return json.dumps({'name':name,'sha256':checksum,'bytes':len(content)})
            with patch.object(module,'network_run',side_effect=run), patch.object(module,'verify_archive',return_value=4), patch.object(module,'acknowledge_remote',side_effect=module.SitovNetworkIneligible('wifi_not_allowed')), patch.object(module.shutil,'disk_usage',return_value=Mock(free=100*1024**3)):
                with self.assertRaises(module.SitovNetworkIneligible):module.pull('host',destination,identity,'/age')
            self.assertTrue((destination/name).is_file())
            self.assertTrue((destination/name).with_suffix('.age.verified.json').is_file())
            with patch.object(module,'network_run',side_effect=run) as net, patch.object(module,'verify_archive') as verify, patch.object(module,'acknowledge_remote') as ack:
                module.pull('host',destination,identity,'/age')
                self.assertEqual(net.call_count,1)
                verify.assert_not_called()
                ack.assert_called_once()

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
