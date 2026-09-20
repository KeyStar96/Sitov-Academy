#!/usr/bin/env python3
"""Disposable real-Storage browser fixtures, after an R8 backup.

Run only on the VPS. No email is sent: Auth admin creates confirmed .invalid
accounts. State/credentials stay root-only; cleanup targets only saved UUIDs.
"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
import urllib.error
import urllib.request
import uuid

DB = 'supabase-db-eknmzxvqilojjicinatnllbt'
STORAGE = 'supabase-storage-eknmzxvqilojjicinatnllbt'
BASE = 'http://127.0.0.1:8088/supabase'
STATE = Path('/root/phase5-media-fixture.json')
storage = json.loads(subprocess.check_output(['docker', 'inspect', STORAGE]))[0]
env = dict(value.split('=', 1) for value in storage['Config']['Env'])
service = env['SERVICE_KEY']
anon = env.get('ANON_KEY') or env['SUPABASE_ANON_KEY']

# Storage v1.44.2 removes completed objects + .info through the Storage API.
# Its TUS S3Store.remove() aborts multipart uploads but does not remove .part.
# Abandoned transfers also need not have any storage.objects row. Inventory
# their exact fixture prefixes, validate every returned key before mutation,
# then abort only listed multipart IDs and delete only the saved include-list.
# Existing container SDK credentials remain in the container and are not logged.
TUS_CLEANUP_JS = r'''
const fs = require('node:fs');
const cfg = require('/app/dist/config').getConfig();
const { S3Client, ListObjectsV2Command, ListMultipartUploadsCommand,
  AbortMultipartUploadCommand, DeleteObjectsCommand } = require('/app/node_modules/@aws-sdk/client-s3');
const mode = process.argv[1];
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const uuidPattern = new RegExp(`^${uuid}$`);
const relativePattern = new RegExp(`^(?:videos/${uuid}\\.(?:mp4|webm)|presentations/${uuid}\\.(?:pdf|pptx|key))/${uuid}(?:\\.info|\\.part)?$`);
function prefixFor(folder) {
  if (!folder || !uuidPattern.test(folder.folder_id) || !/^(?:A1|A2|B1)\.[12]$/.test(folder.level))
    throw new Error('Invalid fixture folder');
  return `${cfg.tenantId}/course-assets/${folder.level}/${folder.folder_id}/`;
}
function validateKey(key, prefix, multipart = false) {
  if (typeof key !== 'string' || !key.startsWith(prefix) || !relativePattern.test(key.slice(prefix.length)) ||
      (multipart && /\.(info|part)$/.test(key))) throw new Error('Unexpected fixture S3 key');
}
async function inventory(client, folders) {
  const result = [];
  for (const folder of folders) {
    const prefix = prefixFor(folder), objects = [], multipart = [];
    let continuation, keyMarker, uploadIdMarker;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: cfg.storageS3Bucket, Prefix: prefix, ContinuationToken: continuation }));
      for (const item of page.Contents || []) { validateKey(item.Key, prefix); objects.push({ Key: item.Key }); }
      const next = page.IsTruncated ? page.NextContinuationToken : undefined;
      if (page.IsTruncated && (!next || next === continuation)) throw new Error('Incomplete S3 object inventory');
      continuation = next;
    } while (continuation);
    do {
      const page = await client.send(new ListMultipartUploadsCommand({ Bucket: cfg.storageS3Bucket, Prefix: prefix, KeyMarker: keyMarker, UploadIdMarker: uploadIdMarker }));
      for (const item of page.Uploads || []) {
        validateKey(item.Key, prefix, true);
        if (typeof item.UploadId !== 'string' || !item.UploadId) throw new Error('Missing fixture multipart ID');
        multipart.push({ Key: item.Key, UploadId: item.UploadId });
      }
      const nextKey = page.IsTruncated ? page.NextKeyMarker : undefined;
      const nextUpload = page.IsTruncated ? page.NextUploadIdMarker : undefined;
      if (page.IsTruncated && (!nextKey || (nextKey === keyMarker && nextUpload === uploadIdMarker)))
        throw new Error('Incomplete multipart inventory');
      keyMarker = nextKey; uploadIdMarker = nextUpload;
    } while (keyMarker);
    result.push({ folder_id: folder.folder_id, level: folder.level, prefix, objects, multipart });
  }
  return { bucket: cfg.storageS3Bucket, tenant: cfg.tenantId, folders: result };
}
(async () => {
  if (cfg.storageBackendType !== 's3' || !cfg.storageS3Bucket || !cfg.tenantId || cfg.tusUseFileVersionSeparator)
    throw new Error('Unexpected Storage configuration; review before cleanup');
  const client = new S3Client({ endpoint: cfg.storageS3Endpoint, region: cfg.storageS3Region, forcePathStyle: cfg.storageS3ForcePathStyle });
  try {
    if (mode === 'inventory') { console.log(JSON.stringify(await inventory(client, input))); return; }
    if (mode !== 'cleanup' || input.bucket !== cfg.storageS3Bucket || input.tenant !== cfg.tenantId || !Array.isArray(input.folders))
      throw new Error('Invalid saved fixture cleanup plan');
    // Validate the complete include-list BEFORE the first abort/delete.
    for (const folder of input.folders) {
      const prefix = prefixFor(folder);
      if (folder.prefix !== prefix || !Array.isArray(folder.objects) || !Array.isArray(folder.multipart))
        throw new Error('Invalid saved fixture prefix');
      for (const item of folder.objects) validateKey(item.Key, prefix);
      for (const item of folder.multipart) {
        validateKey(item.Key, prefix, true);
        if (typeof item.UploadId !== 'string' || !item.UploadId) throw new Error('Invalid saved multipart ID');
      }
    }
    let removedObjects = 0, abortedUploads = 0;
    for (const folder of input.folders) {
      for (const upload of folder.multipart) {
        try { await client.send(new AbortMultipartUploadCommand({ Bucket: cfg.storageS3Bucket, Key: upload.Key, UploadId: upload.UploadId })); }
        catch (error) { if (error.name !== 'NoSuchUpload') throw error; }
        abortedUploads++;
      }
      for (let offset = 0; offset < folder.objects.length; offset += 1000) {
        const objects = folder.objects.slice(offset, offset + 1000);
        const deleted = await client.send(new DeleteObjectsCommand({ Bucket: cfg.storageS3Bucket, Delete: { Objects: objects } }));
        if (deleted.Errors?.length) throw new Error('Fixture S3 deletion was incomplete');
        removedObjects += objects.length;
      }
    }
    const after = await inventory(client, input.folders);
    if (after.folders.some(folder => folder.objects.length || folder.multipart.length))
      throw new Error('Fixture uploads still active or cleanup incomplete');
    console.log(JSON.stringify({ removedObjects, abortedUploads, remainingObjects: 0, remainingMultipart: 0 }));
  } finally { client.destroy(); }
})().catch(error => { console.error('Fixture TUS cleanup failed: ' + (error.name || 'Error')); process.exitCode = 1; });
'''


def tus_storage(mode, data):
    return json.loads(subprocess.check_output(
        ['docker', 'exec', '-i', STORAGE, 'node', '-e', TUS_CLEANUP_JS, mode],
        input=json.dumps(data), text=True))


def api(method, path, data=None, token=service):
    request = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(data).encode() if data is not None else None,
        headers={'apikey': anon, 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        raise RuntimeError('Fixture API failed: HTTP ' + str(error.code)) from None


def sql(query):
    return subprocess.check_output(['docker', 'exec', '-i', DB, 'psql', '-X', '-U', 'supabase_admin',
        '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input=query, text=True).strip()


def save(state):
    STATE.write_text(json.dumps(state))
    os.chmod(STATE, 0o600)


def start():
    if STATE.exists():
        raise RuntimeError('Existing fixture state; run cleanup first.')
    # The live API exercise mutates only new fixture accounts; backup first.
    module = importlib.util.spec_from_file_location('migrate', Path(__file__).parents[1] / 'migrate-local.py')
    runner = importlib.util.module_from_spec(module)
    module.loader.exec_module(runner)
    backup = runner.backup()
    state = {'token': str(uuid.uuid4()), 'courseId': str(uuid.uuid4()), 'users': [], 'people': [],
        'sessions': {}, 'baseURL': 'https://217.154.228.254', 'backup': str(backup)}
    save(state)
    for role in ('teacher', 'student', 'locked'):
        password = secrets.token_urlsafe(24) + 'aA1!'
        user = api('POST', '/auth/v1/admin/users', {'email': f'phase5-{role}-{state["token"]}@example.invalid',
            'password': password, 'email_confirm': True,
            'user_metadata': {'display_name': 'Phase5 ' + state['token'], 'ui_language': 'ru', 'native_language': 'ru'}})
        uid = str(uuid.UUID(user['id']))
        state['users'].append(uid)
        save(state)
        sql(f"UPDATE public.profiles SET role='{'teacher' if role == 'teacher' else 'student'}',ui_language='ru',native_language='ru' WHERE id='{uid}';")
        people = json.loads(sql(f"SELECT coalesce(json_agg(id),'[]') FROM public.people WHERE auth_user_id='{uid}'"))
        state['people'].extend(people)
        save(state)
        if role == 'student':
            sql(f"INSERT INTO public.student_level_access(auth_user_id,level) VALUES('{uid}','A1.1');")
        state['sessions'][role] = api('POST', '/auth/v1/token?grant_type=password', {'email': user['email'], 'password': password}, anon)
        save(state)
    cid, token = state['courseId'], state['token']
    sql(f"INSERT INTO public.courses(id,slug,title,type,category,level,unit_price) VALUES('{cid}','phase5-{token}','Phase5 {token}','online','german','A1.1',2.5);")
    print('Disposable media fixtures ready; credentials remain in ' + str(STATE))


def cleanup():
    if not STATE.exists():
        return
    state = json.loads(STATE.read_text())
    token = str(uuid.UUID(state['token']))
    cid = str(uuid.UUID(state['courseId']))
    # Browser-created folders are restricted to the unique fixture title/course.
    found = json.loads(sql(f"SELECT coalesce(json_agg(json_build_object('folder_id',folder_id,'level',level)),'[]') FROM public.lms_media_folder WHERE course_id='{cid}' OR title LIKE 'Phase5 {token}%'"))
    # Save before deleting DB folders so a partial cleanup remains retryable.
    folders = {str(uuid.UUID(item['folder_id'])): item for item in state.get('cleanupFolders', [])}
    for item in found:
        fid = str(uuid.UUID(item['folder_id']))
        if fid in folders and folders[fid]['level'] != item['level']:
            raise RuntimeError('Fixture folder level changed; review before cleanup.')
        folders[fid] = {'folder_id': fid, 'level': item['level']}
    state['cleanupFolders'] = list(folders.values())
    save(state)
    # First let Storage delete every registered object and its .info sidecar.
    for folder in folders:
        paths = json.loads(sql(f"SELECT coalesce(json_agg(name),'[]') FROM storage.objects WHERE bucket_id='course-assets' AND split_part(name,'/',2)='{folder}'"))
        if paths:
            api('DELETE', '/storage/v1/object/course-assets', {'prefixes': paths})
        if sql(f"SELECT count(*) FROM storage.objects WHERE bucket_id='course-assets' AND split_part(name,'/',2)='{folder}'") != '0':
            raise RuntimeError('Registered fixture objects remain; aborting TUS cleanup.')
    if folders:
        plan = tus_storage('inventory', list(folders.values()))
        state['tusCleanupPlan'] = plan
        save(state)  # Exact include-list is root-only and available for review.
        print('Fixture TUS inventory:', sum(len(f['objects']) for f in plan['folders']),
            'objects,', sum(len(f['multipart']) for f in plan['folders']), 'multipart uploads.')
        print('Fixture TUS cleanup:', tus_storage('cleanup', plan))
    # Only remove database identities after Storage and multipart are empty.
    for folder in folders:
        units = json.loads(sql(f"SELECT coalesce(json_agg(unit_id),'[]') FROM public.learning_videos WHERE folder_id='{folder}'"))
        sql(f"DELETE FROM public.learning_videos WHERE folder_id='{folder}'; DELETE FROM public.lms_media_folder WHERE folder_id='{folder}';")
        for unit in units:
            sql(f"DELETE FROM public.learning_units WHERE id='{uuid.UUID(unit)}';")
    sql(f"DELETE FROM public.courses WHERE id='{cid}';")
    for uid in state['users']:
        api('DELETE', '/auth/v1/admin/users/' + str(uuid.UUID(uid)))
    for pid in state['people']:
        sql(f"DELETE FROM public.people WHERE id='{uuid.UUID(pid)}';")
    STATE.unlink()
    print('Disposable media accounts, course, folders and Storage objects removed.')


if __name__ == '__main__':
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'cleanup'])
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run only as root on the approved VPS.')
    start() if args.action == 'start' else cleanup()
