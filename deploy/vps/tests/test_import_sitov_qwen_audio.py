"""Offline boundary tests: no Docker, network, production credentials or writes."""
import base64
import contextlib
import copy
import email.policy
from email.parser import BytesParser
import importlib.util
import io
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'import-sitov-qwen-audio.py'
SPEC = importlib.util.spec_from_file_location('sitov_qwen_audio_import', SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
PROFILE = json.loads(MODULE.PROFILE_PATH.read_text())


def upload_parts(data, headers):
    message = BytesParser(policy=email.policy.default).parsebytes(
        ('Content-Type: ' + headers['Content-Type'] + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + data)
    return {part.get_param('name', header='content-disposition'): part.get_payload(decode=True) for part in message.iter_parts()}


class FakeStorage:
    def __init__(self):
        self.objects = {}
        self.calls = []

    def info(self, path):
        row = self.objects.get(path)
        return {'metadata': row[1]} if row else None

    def request(self, path, method='GET', data=None, headers=None):
        self.calls.append((path, method, data, headers))
        if method == 'POST':
            key = path.removeprefix('/object/audio_cache/')
            if key in self.objects:
                raise AssertionError('Test detected an immutable overwrite')
            parts = upload_parts(data, headers)
            self.objects[key] = (parts[''], json.loads(parts['metadata']))
            return b'{}'
        key = path.removeprefix('/object/authenticated/audio_cache/')
        return self.objects.get(key, (None, None))[0]


class ImportSitovQwenAudioTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='sitov-import-test-')
        self.root = Path(self.temporary.name).resolve()
        self.profile_path = self.root / 'profile.json'
        self.profile_path.write_text(json.dumps(PROFILE))

    def tearDown(self):
        self.temporary.cleanup()

    def bundle(self, texts=('Guten Morgen.', 'Einen Kaffee bitte.'), profile=None):
        profile = profile or PROFILE
        fingerprint = MODULE.digest(MODULE.compact(profile).encode())
        rows = []
        for text in texts:
            path = MODULE.expected_path(text, profile, fingerprint)
            audio = b'ID3' + b'\x01' * 197
            metadata = {
                'engine': profile['engine'], 'voice': profile['voice'], 'revision': profile['revision'],
                'profileFingerprint': fingerprint, 'textSha256': MODULE.digest(text.encode()),
                'audioSha256': MODULE.digest(audio),
                'wordTimings': [{'start': .35 + index, 'end': .8 + index} for index, _ in enumerate(text.split())],
            }
            filename = self.root / path
            filename.parent.mkdir(parents=True, exist_ok=True)
            filename.write_bytes(audio)
            self.metadata_path(path).write_text(json.dumps(metadata))
            rows.append({'id': Path(path).stem, 'text': text, 'cachePath': path, 'audioSha256': MODULE.digest(audio), 'bytes': len(audio), 'sources': ['test:existing-id']})
        manifest = {'schemaVersion': 1, 'brand': 'Sitov Academy', 'engine': profile['engine'],
                    'voice': profile['voice'], 'revision': profile['revision'], 'profileFingerprint': fingerprint, 'rows': rows}
        self.write_manifest(manifest)
        return manifest

    def test_grouped_clock_bundle_and_remote_alignment_are_bound(self):
        manifest = self.bundle(texts=('5:30 Uhr',))
        path = manifest['rows'][0]['cachePath']
        metadata = json.loads(self.metadata_path(path).read_text())
        metadata['spokenAlignment'] = {'version': 1, 'displayText': '5:30 Uhr', 'spokenText': 'fünf Uhr dreißig', 'groups': [{'display': [0, 2], 'spoken': [0, 3]}]}
        metadata['wordTimings'] = [{'start': i, 'end': i + .5} for i in range(3)]
        self.metadata_path(path).write_text(json.dumps(metadata))
        self.assertEqual(MODULE.validate_bundle(self.root, PROFILE), 1)
        storage = FakeStorage()
        storage.objects[path] = ((self.root / path).read_bytes(), metadata)
        self.assertTrue(MODULE.verified_remote(storage, manifest['rows'][0], metadata))
        bad = copy.deepcopy(metadata); bad['spokenAlignment']['spokenText'] = 'fünf Uhr vierzig'
        storage.objects[path] = ((self.root / path).read_bytes(), bad)
        self.assertFalse(MODULE.verified_remote(storage, manifest['rows'][0], metadata))
        self.metadata_path(path).write_text(json.dumps(bad))
        with self.assertRaises(ValueError):
            MODULE.validate_bundle(self.root, PROFILE)

    def metadata_path(self, path):
        return self.root / (path + '.json')

    def write_manifest(self, manifest):
        (self.root / 'sitov-audio-bundle.json').write_text(json.dumps(manifest))

    def main(self, *flags, storage=None):
        with patch.object(sys, 'argv', [str(SCRIPT), str(self.root), '--profile', str(self.profile_path), *flags]), \
                patch.object(MODULE, 'LocalStorage', return_value=storage or FakeStorage()) as constructor, \
                patch.object(MODULE, 'link_recordings', return_value=[]) as link, contextlib.redirect_stdout(io.StringIO()) as output:
            try:
                MODULE.main()
                code = 0
            except SystemExit as error:
                code = error.code
            return code, output.getvalue(), constructor, link

    def test_valid_bundle_is_read_only_without_explicit_remote_flags(self):
        self.bundle()
        code, output, credentials, links = self.main()
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output), {'validated': 2})
        credentials.assert_not_called()
        links.assert_not_called()

    def test_all_local_assets_validate_before_storage_credentials_are_read(self):
        for failure in ('missing', 'corrupt', 'checksum', 'provider', 'voice', 'alignment', 'traversal'):
            with self.subTest(failure=failure):
                manifest = self.bundle()
                row = manifest['rows'][-1]
                path = row['cachePath']
                if failure == 'missing':
                    self.metadata_path(path).unlink()
                elif failure == 'corrupt':
                    (self.root / path).write_bytes(b'ID3' + b'\x02' * 197)
                elif failure == 'traversal':
                    row['cachePath'] = '../outside.mp3'
                    self.write_manifest(manifest)
                else:
                    metadata = json.loads(self.metadata_path(path).read_text())
                    if failure == 'checksum':
                        metadata['textSha256'] = '0' * 64
                    elif failure == 'provider':
                        metadata['engine'] = 'piper-local-v2'
                    elif failure == 'voice':
                        metadata['voice'] = 'female'
                    else:
                        metadata['wordTimings'].pop()
                    self.metadata_path(path).write_text(json.dumps(metadata))
                code, _, credentials, links = self.main('--upload', '--link-recordings')
                self.assertEqual(code, 1)
                credentials.assert_not_called()
                links.assert_not_called()

    def test_directory_symlinks_cannot_escape_the_bundle_root(self):
        manifest = self.bundle(('Guten Morgen.',))
        row = manifest['rows'][0]
        with tempfile.TemporaryDirectory(prefix='sitov-import-outside-') as external:
            original = self.root / 'sitov-qwen-v1/de'
            (Path(external) / Path(row['cachePath']).name).write_bytes((self.root / row['cachePath']).read_bytes())
            (Path(external) / (Path(row['cachePath']).name + '.json')).write_text(self.metadata_path(row['cachePath']).read_text())
            for file in original.iterdir():
                file.unlink()
            original.rmdir()
            original.symlink_to(external, target_is_directory=True)
            code, _, credentials, _ = self.main('--upload')
            self.assertEqual(code, 1)
            credentials.assert_not_called()

    def test_duplicate_and_wrong_content_addresses_are_rejected(self):
        for duplicate in (True, False):
            manifest = self.bundle()
            if duplicate:
                manifest['rows'].append(copy.deepcopy(manifest['rows'][0]))
            else:
                manifest['rows'][0]['cachePath'] = 'sitov-qwen-v1/de/' + '0' * 64 + '.mp3'
            self.write_manifest(manifest)
            code, _, credentials, _ = self.main('--upload')
            self.assertEqual(code, 1)
            credentials.assert_not_called()

    def test_canonical_male_german_model_and_cc0_reference_are_required(self):
        for field, value in (('profile', 'female'), ('voice', 'sitov-female-test'), ('language', 'English'),
                             ('engine', 'piper-local-v2'), ('revision', 'other-revision'),
                             ('reference.audioSha256', '0' * 64), ('reference.license', 'All rights reserved')):
            with self.subTest(field=field):
                profile = copy.deepcopy(PROFILE)
                if '.' in field:
                    parent, key = field.split('.')
                    profile[parent][key] = value
                else:
                    profile[field] = value
                self.profile_path.write_text(json.dumps(profile))
                self.bundle(profile=profile)
                code, _, credentials, _ = self.main('--upload')
                self.assertEqual(code, 1)
                credentials.assert_not_called()

    def test_noncanonical_whitespace_unicode_and_controls_cannot_create_unreachable_objects(self):
        for text in ('  Guten Morgen. ', 'Guten\tMorgen.', 'Das Bro\u0308tchen.', 'Hallo\u0001Welt.'):
            with self.subTest(text=repr(text)):
                self.bundle((text,))
                code, _, credentials, _ = self.main('--upload')
                self.assertEqual(code, 1)
                credentials.assert_not_called()

    def test_invalid_or_overlapping_timings_are_rejected(self):
        for invalid in ([{'start': float('nan'), 'end': 1}], [{'start': True, 'end': 1}],
                        [{'start': .5, 'end': .8}, {'start': .7, 'end': 1}], [{'start': 0, 'end': 1201}]):
            self.assertFalse(MODULE.valid_timings(invalid, ' '.join('Wort' for _ in invalid)))
        self.assertTrue(MODULE.valid_timings([{'start': .35, 'end': .35}], 'in'))

    def test_remote_assets_are_verified_by_direct_metadata_and_audio_bytes(self):
        manifest = self.bundle()
        row = manifest['rows'][0]
        audio = (self.root / row['cachePath']).read_bytes()
        metadata = json.loads(self.metadata_path(row['cachePath']).read_text())
        storage = FakeStorage()
        storage.objects[row['cachePath']] = (audio, metadata)
        self.assertTrue(MODULE.verified_remote(storage, row, metadata, verify_bytes=True))
        storage.objects[row['cachePath']] = (b'different bytes', metadata)
        self.assertFalse(MODULE.verified_remote(storage, row, metadata, verify_bytes=True))
        storage.objects[row['cachePath']] = (audio, {**metadata, 'wordTimings': []})
        self.assertFalse(MODULE.verified_remote(storage, row, metadata, verify_bytes=True))

    def test_matching_immutable_objects_are_reused_and_mismatches_never_overwritten(self):
        manifest = self.bundle()
        storage = FakeStorage()
        for row in manifest['rows']:
            storage.objects[row['cachePath']] = ((self.root / row['cachePath']).read_bytes(), json.loads(self.metadata_path(row['cachePath']).read_text()))
        code, output, _, _ = self.main('--upload', storage=storage)
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output)['reused'], 2)
        self.assertFalse(any(method == 'POST' for _, method, _, _ in storage.calls))
        first = manifest['rows'][0]['cachePath']
        storage.objects[first] = (b'corrupt remote', storage.objects[first][1])
        code, _, _, links = self.main('--upload', '--link-recordings', storage=storage)
        self.assertEqual(code, 1)
        links.assert_not_called()
        self.assertFalse(any(method == 'POST' for _, method, _, _ in storage.calls))

    def test_new_uploads_are_immutable_and_links_wait_for_a_complete_readback(self):
        self.bundle()
        storage = FakeStorage()
        code, output, _, links = self.main('--upload', '--link-recordings', storage=storage)
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output)['uploaded'], 2)
        links.assert_called_once()
        posts = [call for call in storage.calls if call[1] == 'POST']
        self.assertEqual(len(posts), 2)
        self.assertTrue(all(call[3]['x-upsert'] == 'false' for call in posts))
        self.assertTrue(all(json.loads(upload_parts(call[2], call[3])['metadata'])['voice'] == PROFILE['voice'] for call in posts))
        code, _, _, links = self.main('--audit', '--link-recordings', storage=FakeStorage())
        self.assertEqual(code, 1)
        links.assert_not_called()

    def test_late_uploaded_metadata_failure_prevents_all_database_linking(self):
        class BrokenMetadataStorage(FakeStorage):
            def request(self, path, method='GET', data=None, headers=None):
                result = super().request(path, method, data, headers)
                if method == 'POST' and len(self.objects) == 2:
                    key = path.removeprefix('/object/audio_cache/')
                    audio, metadata = self.objects[key]
                    self.objects[key] = (audio, {**metadata, 'wordTimings': []})
                return result
        self.bundle()
        storage = BrokenMetadataStorage()
        code, _, _, links = self.main('--upload', '--link-recordings', storage=storage)
        self.assertEqual(code, 1)
        links.assert_not_called()
        self.assertEqual(len([call for call in storage.calls if call[1] == 'POST']), 2)
        self.assertTrue(all(call[3]['x-upsert'] == 'false' for call in storage.calls if call[1] == 'POST'))

    def test_long_word_timing_metadata_is_carried_in_the_body_with_unchanged_audio_bytes(self):
        metadata = {'voice': PROFILE['voice'], 'wordTimings': [{'start': index, 'end': index + .5} for index in range(600)]}
        self.assertGreater(len(json.dumps(metadata)), 8192)
        audio = b'ID3' + bytes(range(256)) * 20
        data, headers = MODULE.storage_upload(audio, metadata)
        self.assertNotIn('x-metadata', headers)
        self.assertEqual(headers['x-upsert'], 'false')
        parts = upload_parts(data, headers)
        self.assertEqual(parts[''], audio)
        self.assertEqual(json.loads(parts['metadata']), metadata)
        self.assertEqual(parts['cacheControl'], b'31536000')

    def test_database_link_query_only_updates_audio_references_and_retains_progress(self):
        text = "Ich möchte 'einen Kaffee'; -- kein SQL"
        rows = [{'text': text, 'cachePath': 'sitov-qwen-v1/de/' + 'a' * 64 + '.mp3'}]
        with patch.object(MODULE.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='{"vocabularyAudioLinks":1}\n{"readingAudioLinks":1}\n')) as run:
            MODULE.link_recordings(rows)
        query = run.call_args.kwargs['input']
        self.assertIn('BEGIN;', query)
        self.assertIn('COMMIT;', query)
        self.assertEqual(set(re.findall(r'UPDATE public\.([a-z_]+)', query)),
                         {'learning_vocabulary_cards', 'learning_reading_texts', 'sitov_audio_preparation_requests'})
        self.assertIn('learning_vocabulary_cards c SET audio_url=', query)
        self.assertIn('learning_reading_texts r SET audio_url=', query)
        self.assertNotIn(text, query)
        self.assertNotIn('learning_progress', query)
        self.assertNotIn('daily_quest_assignments', query)
        self.assertIn("c.audio_url IS NULL OR c.audio_url LIKE", query)
        self.assertIn("r.audio_url IS NULL OR r.audio_url LIKE", query)
        self.assertIn("SET status='prepared',prepared_at=now()", query)
        self.assertIn("q.cache_path=a.path AND q.status='pending'", query)
        self.assertIn("SET LOCAL statement_timeout='15s'", query)
        self.assertIn("SET LOCAL lock_timeout='2s'", query)
        self.assertIn('ON_ERROR_STOP=1', run.call_args.args[0])

    def test_local_storage_bounds_response_reads_and_never_follows_redirects(self):
        class Response:
            headers = {}
            def __init__(self, body):
                self.body = io.BytesIO(body)
                self.read_bytes = 0
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self, limit):
                chunk = self.body.read(limit)
                self.read_bytes += len(chunk)
                return chunk

        class Opener:
            def __init__(self, response): self.response = response
            def open(self, request, timeout):
                self.request, self.timeout = request, timeout
                return self.response

        response = Response(b'{}')
        opener = Opener(response)
        inspected = subprocess.CompletedProcess([], 0, stdout=json.dumps([{'Config': {'Env': ['SERVICE_KEY=test-only']}}]))
        with patch.object(MODULE.subprocess, 'run', return_value=inspected), \
                patch.object(MODULE.urllib.request, 'build_opener', return_value=opener):
            storage = MODULE.LocalStorage()
            self.assertEqual(storage.request('/object/info/audio_cache/example.mp3'), b'{}')
        self.assertEqual(opener.timeout, 20)
        self.assertLessEqual(response.read_bytes, MODULE.MAX_STORAGE_JSON_BYTES)

        oversized = Response(b'x' * (MODULE.MAX_STORAGE_JSON_BYTES + 100))
        with patch.object(MODULE.subprocess, 'run', return_value=inspected), \
                patch.object(MODULE.urllib.request, 'build_opener', return_value=Opener(oversized)):
            storage = MODULE.LocalStorage()
            with self.assertRaisesRegex(RuntimeError, 'size limit'):
                storage.request('/object/info/audio_cache/example.mp3')
        self.assertEqual(oversized.read_bytes, MODULE.MAX_STORAGE_JSON_BYTES + 1)

        handler = MODULE.NoRedirectHandler()
        request = MODULE.urllib.request.Request('http://127.0.0.1/private', headers={'Authorization': 'Bearer test-only'})
        self.assertIsNone(handler.redirect_request(request, object(), 302, 'Found', {}, 'https://example.invalid/'))

    def test_link_recording_payload_has_explicit_size_caps(self):
        with self.assertRaisesRegex(ValueError, 'row limit'):
            MODULE.link_recordings([{'text': 'x', 'cachePath': 'p'}] * (MODULE.MAX_LINK_ROWS + 1))
        with self.assertRaisesRegex(ValueError, 'byte limit'):
            MODULE.link_recordings([{'text': 'x' * MODULE.MAX_LINK_PAYLOAD_BYTES, 'cachePath': 'p'}])

    def test_upload_keeps_audio_contract_and_does_not_publish_private_authoring_evidence(self):
        metadata = {
            'voice': PROFILE['voice'], 'audioSha256': 'a' * 64,
            'wordTimings': [{'start': 0, 'end': .5}],
            'spokenAlignment': {'version': 1, 'displayText': '5:30', 'spokenText': 'fünf Uhr dreißig'},
            'originalProductionReadbackProvenance': {'path': '/Users/private/source.json'},
            'genuineNativeTimingAdoption': {'receipt': '/tmp/private/receipt.json'},
            'provenance': {'token': 'private-test-token'},
            'humanListening': False, 'publicationApproved': False,
        }
        original = copy.deepcopy(metadata)
        audio = b'ID3' + b'a' * 200
        body, headers = MODULE.storage_upload(audio, metadata)
        parts = upload_parts(body, headers)
        served = json.loads(parts['metadata'])
        self.assertEqual(parts[''], audio)
        self.assertEqual(served['wordTimings'], metadata['wordTimings'])
        self.assertEqual(served['spokenAlignment'], metadata['spokenAlignment'])
        self.assertEqual(served['audioSha256'], metadata['audioSha256'])
        self.assertNotIn('/Users/', body.decode(errors='replace'))
        self.assertNotIn('/tmp/', body.decode(errors='replace'))
        self.assertNotIn('private-test-token', body.decode(errors='replace'))
        self.assertNotIn('publicationApproved', served)
        self.assertEqual(metadata, original)


    def test_streaming_audit_reads_one_audio_and_full_validation_still_rejects_later_errors(self):
        manifest = self.bundle(('Hallo.', 'Guten Morgen.'))
        original = Path.read_bytes
        reads = []
        def read(path):
            if path.suffix == '.mp3':
                reads.append(str(path))
            return original(path)
        with patch.object(Path, 'read_bytes', new=read):
            assets = MODULE.iter_validated_bundle(self.root, PROFILE)
            first = next(assets)
            self.assertEqual(first[0]['text'], 'Hallo.')
            self.assertEqual(len(reads), 1)
            next(assets)
            self.assertEqual(len(reads), 2)
            self.assertRaises(StopIteration, next, assets)
        metadata_path = self.root / (manifest['rows'][1]['cachePath'] + '.json')
        metadata = json.loads(metadata_path.read_text())
        metadata['wordTimings'] = []
        metadata_path.write_text(json.dumps(metadata))
        with self.assertRaisesRegex(ValueError, 'alignment metadata'):
            MODULE.validate_bundle(self.root, PROFILE)


if __name__ == '__main__':
    unittest.main()
