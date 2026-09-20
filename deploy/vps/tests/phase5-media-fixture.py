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
BASE = 'http://127.0.0.1:8088/supabase'
STATE = Path('/root/phase5-media-fixture.json')
storage = json.loads(subprocess.check_output(['docker', 'inspect', 'supabase-storage-eknmzxvqilojjicinatnllbt']))[0]
env = dict(value.split('=', 1) for value in storage['Config']['Env'])
service = env['SERVICE_KEY']
anon = env.get('ANON_KEY') or env['SUPABASE_ANON_KEY']


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
    folders = json.loads(sql(f"SELECT coalesce(json_agg(folder_id),'[]') FROM public.lms_media_folder WHERE course_id='{cid}' OR title LIKE 'Phase5 {token}%'"))
    for raw in folders:
        folder = str(uuid.UUID(raw))
        paths = json.loads(sql(f"SELECT coalesce(json_agg(name),'[]') FROM storage.objects WHERE bucket_id='course-assets' AND split_part(name,'/',2)='{folder}'"))
        if paths:
            api('DELETE', '/storage/v1/object/course-assets', {'prefixes': paths})
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
