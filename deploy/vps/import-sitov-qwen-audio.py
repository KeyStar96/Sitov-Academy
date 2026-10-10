#!/usr/bin/env python3
"""Import immutable, locally prepared Qwen assets. No synthesis or model on the VPS."""
import argparse
import base64
import hashlib
import json
import re
import subprocess
import urllib.error
import urllib.request
import unicodedata
import uuid
from pathlib import Path

DB = 'supabase-db-eknmzxvqilojjicinatnllbt'
STORAGE = 'supabase-storage-eknmzxvqilojjicinatnllbt'
API = 'http://127.0.0.1:9080/storage/v1'
PROFILE_PATH = Path(__file__).resolve().parents[2] / 'lib/audio/models/sitov-qwen-male-de/config.json'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def compact(value, ordered=False):
    return json.dumps(value, ensure_ascii=False, sort_keys=not ordered, separators=(',', ':'))


VARIANTS_PATH = PROFILE_PATH.with_name('approved-variants.json')

def normalize_text(text):
    whitespace = r'[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
    return re.sub(whitespace + '+', ' ', unicodedata.normalize('NFC', text)).strip(' ')

def approved_variants():
    registry = json.loads(VARIANTS_PATH.read_text())
    rows = registry.get('variants')
    if registry.get('schemaVersion') != 1 or not isinstance(rows, list) or len(rows) != 7:
        raise ValueError('Invalid Sitov audio variant registry')
    result = {}
    for row in rows:
        text = row.get('text')
        if (text not in {'sind', 'stehe', 'wollte', 'des', 'ihrer', 'meiste', 'esst'} or text in result
                or text != normalize_text(text) or row.get('textSha256') != digest(text.encode())
                or row.get('variant') != 'sitov-audio-repair-20261010-v1'):
            raise ValueError('Invalid Sitov audio variant registry')
        result[text] = row['variant']
    return result


def expected_path(text, profile, fingerprint):
    text = normalize_text(text)
    variants = approved_variants()
    identity = {'text': text, 'voice': profile['voice'], 'rate': 'qwen-native-1-lufs-18-aligned-v1',
                'format': 'audio-24khz-48kbitrate-mono-mp3', 'leadIn': profile['output']['leadInSeconds'], 'profile': fingerprint}
    if text in variants:
        identity['variant'] = variants[text]
    return 'sitov-qwen-v1/de/' + digest(compact(identity, ordered=True).encode()) + '.mp3'


def valid_timings(value, text):
    if not isinstance(value, list) or len(value) != len(text.split()) or not 0 < len(value) <= 1500:
        return False
    previous = 0
    for word in value:
        if not isinstance(word, dict):
            return False
        start, end = word.get('start'), word.get('end')
        if type(start) not in (int, float) or type(end) not in (int, float) or not previous <= start <= end <= 1200:
            return False
        previous = end
    return True


def validate_bundle(root, profile):
    if (profile.get('schemaVersion') != 1 or profile.get('engine') != 'qwen3-tts'
            or profile.get('language') != 'German' or profile.get('profile') != 'male'
            or profile.get('voice') != 'sitov-qwen-male-de-v1'
            or profile.get('revision') != 'sitov-qwen-base-bf16-v1'
            or profile.get('tts', {}).get('sourceModel') != 'Qwen/Qwen3-TTS-12Hz-1.7B-Base'
            or profile.get('tts', {}).get('mlxModel') != 'mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16'
            or profile.get('tts', {}).get('mlxRevision') != 'a6eb4f68e4b056f1215157bb696209bc82a6db48'
            or profile.get('tts', {}).get('precision') != 'bfloat16'
            or profile.get('reference', {}).get('license') != 'CC0-1.0'
            or profile.get('reference', {}).get('audioSha256') != '685523fce41587b65dca813bace5782b3c0bd359d37615675decdb06bea569a1'):
        raise ValueError('Unapproved German voice profile')
    fingerprint = digest(compact(profile).encode())
    manifest = json.loads((root / 'sitov-audio-bundle.json').read_text())
    if manifest.get('profileFingerprint') != fingerprint or manifest.get('engine') != profile['engine']:
        raise ValueError('Wrong Qwen profile; nothing imported')
    if 'variant' in manifest:
        raise ValueError('Caller-selected audio variant forbidden')
    rows = manifest.get('rows')
    if not isinstance(rows, list) or not rows:
        raise ValueError('Empty audio bundle')
    planned, seen = [], set()
    for row in rows:
        if 'variant' in row:
            raise ValueError('Caller-selected audio variant forbidden')
        path, text = row.get('cachePath'), row.get('text')
        if not isinstance(text, str) or not text or len(text) > 3000 or not isinstance(path, str) or not re.fullmatch(r'sitov-qwen-v1/de/[0-9a-f]{64}\.mp3', path):
            raise ValueError('Invalid bundle entry')
        whitespace = r'[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
        normalized = re.sub(whitespace + '+', ' ', unicodedata.normalize('NFC', text)).strip(' ')
        if text != normalized or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', text):
            raise ValueError('Noncanonical authoring text')
        if path != expected_path(text, profile, fingerprint) or path in seen:
            raise ValueError('Content address mismatch or duplicate')
        seen.add(path)
        audio_path = root / path
        metadata_path = root / (path + '.json')
        if audio_path.is_symlink() or metadata_path.is_symlink() or root not in audio_path.resolve().parents or root not in metadata_path.resolve().parents:
            raise ValueError('Unsafe bundle path')
        audio = audio_path.read_bytes()
        metadata = json.loads(metadata_path.read_text())
        if 'variant' in metadata:
            raise ValueError('Caller-selected audio variant forbidden')
        if not 100 <= len(audio) <= 2 * 1024 * 1024 or not (audio.startswith(b'ID3') or audio[0] == 255 and audio[1] & 224 == 224):
            raise ValueError('Invalid MP3')
        if row.get('audioSha256') != digest(audio) or metadata.get('audioSha256') != digest(audio) or metadata.get('textSha256') != digest(text.encode()):
            raise ValueError('Audio/text checksum mismatch')
        if metadata.get('engine') != profile['engine'] or metadata.get('voice') != profile['voice'] or metadata.get('revision') != profile['revision'] or metadata.get('profileFingerprint') != fingerprint or not valid_timings(metadata.get('wordTimings'), text):
            raise ValueError('Invalid provider/alignment metadata')
        planned.append((row, audio, metadata))
    return planned


class LocalStorage:
    def __init__(self):
        # The service key stays in this process on the VPS; it never crosses SSH or enters logs.
        inspected = subprocess.run(['docker', 'inspect', STORAGE], check=True, capture_output=True, text=True)
        environment = dict(entry.split('=', 1) for entry in json.loads(inspected.stdout)[0]['Config']['Env'])
        key = environment['SERVICE_KEY']
        self.headers = {'Authorization': 'Bearer ' + key, 'apikey': key}

    def request(self, path, method='GET', data=None, headers=None):
        request = urllib.request.Request(API + path, data=data, method=method, headers={**self.headers, **(headers or {})})
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code in (400, 404) and method == 'GET':
                return None
            raise RuntimeError('Local audio storage request failed') from None

    def info(self, path):
        data = self.request('/object/info/audio_cache/' + path)
        return json.loads(data) if data else None


def info_metadata(info):
    # Storage versions expose author metadata either directly or as user_metadata.
    return (info or {}).get('metadata') or (info or {}).get('user_metadata') or (info or {}).get('userMetadata') or {}


def storage_upload(audio, metadata):
    # Match storage-js's FormData contract. Long passages can have more timing
    # metadata than an HTTP proxy permits in a single x-metadata header.
    boundary = 'sitov-audio-' + uuid.uuid4().hex
    parts = []
    for name, value in [('cacheControl', b'31536000'), ('metadata', compact(metadata).encode())]:
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n'.encode() + value + b'\r\n')
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name=""; filename="sitov-audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n'.encode() + audio + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return b''.join(parts), {'Content-Type': 'multipart/form-data; boundary=' + boundary, 'x-upsert': 'false'}


def verified_remote(storage, row, metadata, verify_bytes=False):
    info = storage.info(row['cachePath'])
    remote = info_metadata(info)
    matched = all(remote.get(key) == metadata[key] for key in ['engine', 'voice', 'revision', 'profileFingerprint', 'textSha256', 'audioSha256', 'wordTimings'])
    if matched and verify_bytes:
        audio = storage.request('/object/authenticated/audio_cache/' + row['cachePath'])
        matched = bool(audio) and digest(audio) == row['audioSha256']
    return matched


def link_recordings(rows):
    encoded = base64.b64encode(json.dumps([{'text': row['text'], 'path': row['cachePath']} for row in rows], ensure_ascii=False).encode()).decode()
    # Updates only audio references; all content, IDs and learner progress are retained.
    query = """BEGIN;
CREATE TEMP TABLE sitov_qwen_imported(text text PRIMARY KEY,path text) ON COMMIT DROP;
CREATE FUNCTION pg_temp.sitov_normalize_audio_text(p_text text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $sitov$
 SELECT btrim(regexp_replace(pg_catalog.normalize(coalesce(p_text,''),'NFC'),
 U&'[\\0009-\\000D\\0020\\00A0\\1680\\2000-\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF]+',' ','g'));
$sitov$;
INSERT INTO sitov_qwen_imported SELECT text,path FROM jsonb_to_recordset(convert_from(decode('%s','base64'),'UTF8')::jsonb) AS x(text text,path text);
WITH changed AS (UPDATE public.learning_vocabulary_cards c SET audio_url='/supabase/storage/v1/object/public/audio_cache/'||a.path
 FROM sitov_qwen_imported a WHERE pg_temp.sitov_normalize_audio_text(concat(CASE WHEN c.article IS NULL OR c.article::text='none' THEN '' ELSE c.article::text END,' ',c.word_de))=a.text
 AND (c.audio_url IS NULL OR c.audio_url LIKE '%%/audio_cache/%%')
 AND c.audio_url IS DISTINCT FROM '/supabase/storage/v1/object/public/audio_cache/'||a.path RETURNING c.id)
 SELECT json_build_object('vocabularyAudioLinks',count(*)) FROM changed;
WITH changed AS (UPDATE public.learning_reading_texts r SET audio_url='/supabase/storage/v1/object/public/audio_cache/'||a.path
 FROM sitov_qwen_imported a WHERE pg_temp.sitov_normalize_audio_text(r.sentence_de)=a.text
 AND (r.audio_url IS NULL OR r.audio_url LIKE '%%/audio_cache/%%')
 AND r.audio_url IS DISTINCT FROM '/supabase/storage/v1/object/public/audio_cache/'||a.path RETURNING r.id)
 SELECT json_build_object('readingAudioLinks',count(*)) FROM changed;
DO $$ BEGIN
 IF to_regclass('public.sitov_audio_preparation_requests') IS NOT NULL THEN
   UPDATE public.sitov_audio_preparation_requests q SET status='prepared',prepared_at=now()
   FROM sitov_qwen_imported a WHERE q.cache_path=a.path AND q.status='pending';
 END IF;
END $$;
COMMIT;""" % encoded
    result = subprocess.run(['docker', 'exec', '-i', DB, 'psql', '-X', '-qAt', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=query, text=True, capture_output=True, check=True)
    return [json.loads(line) for line in result.stdout.splitlines() if line.startswith('{')]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--profile', type=Path, default=PROFILE_PATH)
    parser.add_argument('--upload', action='store_true', help='Explicit immutable Storage upload; default validates locally only')
    parser.add_argument('--audit', action='store_true', help='Read back every remote checksum and alignment metadata')
    parser.add_argument('--link-recordings', action='store_true', help='After a complete audit, update generated vocabulary/reading URL references')
    args = parser.parse_args()
    try:
        planned = validate_bundle(args.bundle.resolve(), json.loads(args.profile.read_text()))
        if not (args.upload or args.audit or args.link_recordings):
            print(json.dumps({'validated': len(planned)}))
            return
        storage = LocalStorage()
        uploaded, reused = 0, 0
        for row, audio, metadata in planned:
            existing = storage.info(row['cachePath'])
            if existing:
                if not verified_remote(storage, row, metadata, verify_bytes=True):
                    raise ValueError('Existing immutable audio does not match; refusing overwrite')
                reused += 1
            elif args.upload:
                data, headers = storage_upload(audio, metadata)
                storage.request('/object/audio_cache/' + row['cachePath'], 'POST', data, headers)
                if not verified_remote(storage, row, metadata, verify_bytes=True):
                    raise ValueError('Uploaded audio read-back failed')
                uploaded += 1
            else:
                raise ValueError('Prepared audio missing from Storage')
        links = link_recordings([row for row, _, _ in planned]) if args.link_recordings else []
        print(json.dumps({'verified': len(planned), 'uploaded': uploaded, 'reused': reused, 'links': links}))
    except Exception as error:
        if isinstance(error, ValueError):
            print(str(error))
        else:
            print('Audio import failed; no credentials or internal diagnostics were printed')
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
