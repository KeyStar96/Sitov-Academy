#!/usr/bin/env python3
"""Recovery settings tests use private temporary fixtures, never live secrets."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('sitov_recovery_test', HERE / 'sitov-recovery-configuration.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
EXPORT_SPEC = importlib.util.spec_from_file_location('sitov_recovery_export_test', HERE / 'export-encrypted-backup.py')
EXPORT = importlib.util.module_from_spec(EXPORT_SPEC)
EXPORT_SPEC.loader.exec_module(EXPORT)


class RecoveryConfigurationTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='sitov-recovery-settings-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.state = {'container_id': 'test-db', 'image': 'test-image', 'environment': ['TEST_KEY=private-fixture'],
                      'postgres_custom': '/var/lib/docker/volumes/sitov-test-db-config/_data'}
        _, required = MODULE.scoped_sources(self.root, self.state)
        for path in required:
            self.put(path.relative_to(self.root).as_posix(), 'required-private-fixture')
        self.put('etc/sitov-academy/tts.env', 'TEST_TTS_KEY=private-fixture')
        self.put('etc/nginx/sites-available/sitov', 'server { test; }')
        link = self.root / 'etc/nginx/sites-enabled/sitov'
        link.parent.mkdir(parents=True)
        link.symlink_to('../sites-available/sitov')
        self.put('etc/systemd/system/sitov-backup.service.d/private.conf', '[Service]\nTest=true')
        # These large data/source locations must never be copied into settings.
        self.put(MODULE.SERVICE.lstrip('/') + '/volumes/storage/private-object', 'not configuration')
        self.put(MODULE.SERVICE.lstrip('/') + '/volumes/functions/index.ts', 'not configuration')
        self.put('var/www/sitov-current/app/page.tsx', 'not configuration')

    def put(self, name, contents):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(contents)
        return path

    def capture(self):
        return MODULE.capture_configuration(self.root, lambda: dict(self.state))

    def logical_backup(self):
        target = self.root / 'backup'
        target.mkdir()
        hashes = {}
        for filename in ('postgres.dump', 'roles.sql', 'storage-manifest.json', 'buckets.json'):
            file = target / filename
            file.write_text('logical fixture')
            hashes[filename] = EXPORT.digest(file)
        (target / 'sha256.json').write_text(json.dumps(hashes))
        (target / 'COMPLETE').write_text('complete')
        return target

    def test_archive_has_live_key_env_compose_links_and_units_but_no_source_or_storage(self):
        snapshot = self.capture()
        target = self.logical_backup()
        archive = snapshot.write(target)
        self.assertEqual(EXPORT.verify(target), 5)
        self.assertEqual(archive.stat().st_mode & 0o777, 0o600)
        with tarfile.open(archive) as tar:
            names = tar.getnames()
            self.assertIn(self.state['postgres_custom'].lstrip('/') + '/pgsodium_root.key', names)
            self.assertIn('etc/sitov-academy/app.env', names)
            self.assertIn('etc/sitov-academy/tts.env', names)
            self.assertIn(MODULE.SERVICE.lstrip('/') + '/.env', names)
            self.assertIn('etc/systemd/system/sitov-backup.service.d/private.conf', names)
            self.assertTrue(tar.getmember('etc/nginx/sites-enabled/sitov').issym())
            self.assertFalse(any('/storage/' in n or '/functions/' in n or n.endswith('page.tsx') for n in names))
            metadata = json.load(tar.extractfile('sitov-recovery-configuration.json'))
            self.assertEqual(metadata['database']['environment'], self.state['environment'])
            self.assertEqual(set(metadata['files']), set(names) - {'sitov-recovery-configuration.json'})

    def test_real_age_and_mac_streaming_verifier_cover_regular_configuration_archive(self):
        age = os.environ.get('SITOV_TEST_AGE_BIN') or shutil.which('age')
        if not age:
            self.skipTest('Set SITOV_TEST_AGE_BIN for encrypted settings integration')
        spec = importlib.util.spec_from_file_location('sitov_recovery_mac_verify', HERE.parent / 'mac/sitov-pull-backups.py')
        mac = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mac)
        target = self.logical_backup()
        self.capture().write(target)
        identity = self.root / 'test-only-identity.txt'
        keygen = str(Path(age).with_name('age-keygen'))
        subprocess.run([keygen, '-o', str(identity)], check=True, capture_output=True)
        recipient = subprocess.check_output([keygen, '-y', str(identity)], text=True).strip()
        output = self.root / 'test-only.age'
        # Production uses GNU tar on Linux. macOS BSD tar otherwise appends
        # AppleDouble metadata that is deliberately outside our manifest.
        with patch.dict(os.environ, {'COPYFILE_DISABLE': '1'}):
            EXPORT.export(target, recipient, output, age)
        self.assertEqual(mac.verify_archive(output, identity, age), 5)
        with (target / MODULE.ARCHIVE).open('ab') as stream:
            stream.write(b'changed private settings')
        with self.assertRaisesRegex(ValueError, 'digest mismatch'):
            EXPORT.verify(target)

    def test_postfix_private_maps_dkim_tls_and_operational_helpers_are_covered(self):
        self.put('etc/postfix/main.cf', 'alias_maps = hash:/etc/aliases\nsmtp_sasl_password_maps = hash:/etc/postfix/private-relay\nsmtpd_tls_cert_file = /etc/ssl/certs/sitov.pem\nsmtpd_tls_key_file = /etc/ssl/private/sitov.key\n')
        for name in ('etc/postfix/master.cf', 'etc/aliases', 'etc/aliases.db',
                     'etc/postfix/private-relay', 'etc/postfix/private-relay.db',
                     'etc/ssl/certs/sitov.pem', 'etc/ssl/private/sitov.key',
                     'etc/systemd/system/postfix@-.service.d/10-sitov-docker.conf',
                     'etc/opendkim/keys/sitov/mail.private', 'etc/default/opendkim',
                     'opt/sitov-ops/sitov-backup.py', 'opt/sitov-ops/sitov-deploy.sh'):
            self.put(name, 'private test fixture')
        self.put('etc/opendkim.conf', 'KeyFile /etc/opendkim/keys/sitov/mail.private\n')
        self.put('opt/sitov-ops/__pycache__/old.pyc', 'must not capture')
        self.put('opt/sitov-ops/old.py.previous', 'must not capture')
        self.put('etc/postfix/package-binary', 'not recovery configuration')
        entries = self.capture().entries
        for name in ('etc/postfix/private-relay.db', 'etc/aliases.db', 'etc/ssl/private/sitov.key',
                     'etc/opendkim/keys/sitov/mail.private',
                     'etc/systemd/system/postfix@-.service.d/10-sitov-docker.conf',
                     'opt/sitov-ops/sitov-backup.py', 'opt/sitov-ops/sitov-deploy.sh'):
            self.assertIn(name, entries)
        self.assertNotIn('etc/postfix/package-binary', entries)
        self.assertFalse(any('__pycache__' in name or name.endswith('.previous') for name in entries))
        (self.root / 'etc/postfix/private-relay').unlink()
        with self.assertRaisesRegex(ValueError, 'required'):
            self.capture()

    def test_missing_empty_or_linked_key_blocks_backup(self):
        key = self.root / self.state['postgres_custom'].lstrip('/') / 'pgsodium_root.key'
        key.unlink()
        with self.assertRaisesRegex(ValueError, 'required'):
            self.capture()
        key.write_text('')
        with self.assertRaisesRegex(ValueError, 'required'):
            self.capture()
        key.unlink()
        key.symlink_to(self.root / 'etc/sitov-academy/app.env')
        with self.assertRaisesRegex(ValueError, 'required'):
            self.capture()

    def test_config_key_rotation_additions_deletions_and_database_upgrade_are_detected(self):
        snapshot = self.capture()
        snapshot.assert_unchanged()
        env = self.root / 'etc/sitov-academy/tts.env'
        original = env.read_text()
        env.write_text('rotated-private-fixture')
        with self.assertRaisesRegex(RuntimeError, 'changed during backup'):
            snapshot.assert_unchanged()
        env.write_text(original)
        self.state['image'] = 'new-image'
        with self.assertRaisesRegex(RuntimeError, 'changed during backup'):
            snapshot.assert_unchanged()
        self.state['image'] = 'test-image'
        added = self.put('etc/sitov-academy/new.env', 'new configuration')
        with self.assertRaises(RuntimeError):
            snapshot.assert_unchanged()
        added.unlink()
        env.unlink()
        with self.assertRaises(RuntimeError):
            snapshot.assert_unchanged()

    def test_current_release_retargeting_is_detected_without_backing_up_code(self):
        pointer = self.root / 'var/www/sitov-current'
        shutil.rmtree(pointer)
        for release in ('release-one', 'release-two'):
            self.put('var/www/' + release + '/.sitov-runtime.env', 'same runtime values')
        pointer.symlink_to('release-one')
        snapshot = self.capture()
        self.assertIn('var/www/sitov-current/.sitov-runtime.env', snapshot.entries)
        pointer.unlink()
        pointer.symlink_to('release-two')
        with self.assertRaises(RuntimeError):
            snapshot.assert_unchanged()

    def test_links_outside_scope_special_files_and_oversized_settings_are_rejected(self):
        link = self.root / 'etc/nginx/foreign'
        link.symlink_to(self.put('outside/private', 'do not copy'))
        with self.assertRaisesRegex(ValueError, 'declared scope'):
            self.capture()
        link.unlink()
        fifo = self.root / 'etc/nginx/fifo'
        os.mkfifo(fifo)
        with self.assertRaisesRegex(ValueError, 'special file'):
            self.capture()
        fifo.unlink()
        with patch.object(MODULE, 'MAX_BYTES', 8):
            with self.assertRaisesRegex(ValueError, 'size limit'):
                self.capture()
        with patch.object(MODULE, 'MAX_FILES', 1):
            with self.assertRaisesRegex(ValueError, 'Too many'):
                self.capture()


if __name__ == '__main__':
    unittest.main()
