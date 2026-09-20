#!/usr/bin/env python3
"""Exercise the 20-GiB quota in two real PostgreSQL sessions on the clone only.

No binary uploads: creates 39 synthetic 512-MiB metadata records in a private
random fixture folder, then races two final records. Removes only its own IDs.
The script refuses any database other than sitov_phase2_verify and requires an
otherwise empty A2.2 storage level, so browser/e2e fixtures are never removed.
"""
import argparse
import json
import selectors
import subprocess
import time
import uuid

DATABASE = 'sitov_phase2_verify'
CONTAINER = 'supabase-db-eknmzxvqilojjicinatnllbt'
LEVEL = 'A2.2'
SIZE = 512 * 1024 * 1024
LIMIT = 20 * 1024 * 1024 * 1024


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def psql_command(container):
    # Database is deliberately not configurable. Never inherit PGDATABASE.
    return ['docker', 'exec', '-i', container, 'psql', '-X', '-q', '-A', '-t',
            '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
            '-U', 'postgres', '-d', DATABASE]


def query(command, sql):
    result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=20)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def send(process, sql):
    process.stdin.write(sql + '\n')
    process.stdin.flush()


def wait_line(process, marker, timeout=10):
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    deadline = time.monotonic() + timeout
    try:
        while time.monotonic() < deadline:
            if selector.select(max(0, deadline-time.monotonic())):
                line = process.stdout.readline()
                if marker in line:
                    return
                if not line:
                    raise RuntimeError('First session exited before acquiring the quota lock: ' + process.stderr.read())
        raise RuntimeError('First session did not reach its transaction barrier')
    finally:
        selector.close()


def finish(process):
    if process.stdin:
        process.stdin.close()
        process.stdin = None
    stdout, stderr = process.communicate(timeout=15)
    return process.returncode, stdout, stderr


def run(container):
    command = psql_command(container)
    if query(command, 'SELECT current_database();') != DATABASE:
        raise RuntimeError('Clone database assertion failed; refusing test')
    if query(command, f'SELECT count(*) FROM public.learning_levels WHERE code={quote(LEVEL)};') != '1':
        raise RuntimeError('The existing A2.2 level is required; test does not create or alter levels')
    occupied = query(command, f"SELECT count(*) FROM storage.objects WHERE bucket_id='course-assets' AND split_part(name,'/',1)={quote(LEVEL)};")
    if occupied != '0':
        raise RuntimeError('A2.2 already has storage objects. Refusing to affect another test fixture.')
    if query(command, "SELECT count(*) FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND tgname='course_assets_quota' AND tgenabled<>'D';") != '1':
        raise RuntimeError('Active quota trigger is required')
    folder = str(uuid.uuid4())
    marker = 'phase2-quota-' + uuid.uuid4().hex
    prefix = f'{LEVEL}/{folder}/videos/'
    names = [prefix + str(uuid.uuid4()) + '.mp4' for _ in range(41)]
    processes = []
    seeded = False
    result = None
    try:
        query(command, f"INSERT INTO public.lms_media_folder(folder_id,level,title) VALUES({quote(folder)},{quote(LEVEL)},{quote(marker)});")
        seeded = True
        values = ','.join(f"('course-assets',{quote(name)},jsonb_build_object('size',{SIZE},'mimetype','video/mp4'))" for name in names[:39])
        query(command, 'INSERT INTO storage.objects(bucket_id,name,metadata) VALUES' + values + ';')
        assert query(command, f"SELECT sum((metadata->>'size')::bigint) FROM storage.objects WHERE bucket_id='course-assets' AND name LIKE {quote(prefix+'%')};") == str(39*SIZE)
        # Session A owns the per-level advisory lock and keeps its new row uncommitted.
        first = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        processes.append(first)
        send(first, f"SET application_name={quote(marker+'-a')}; BEGIN; SET LOCAL statement_timeout='15s'; INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('course-assets',{quote(names[39])},jsonb_build_object('size',{SIZE})); SELECT 'first_ready';")
        wait_line(first, 'first_ready')
        # Session B starts while A is still uncommitted: a real race, not sequential calls.
        second = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
        processes.append(second)
        send(second, f"SET application_name={quote(marker+'-b')}; BEGIN; SET LOCAL statement_timeout='15s'; INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('course-assets',{quote(names[40])},jsonb_build_object('size',{SIZE})); COMMIT;")
        deadline = time.monotonic()+10
        waiting = False
        while time.monotonic()<deadline:
            waiting = query(command, f"SELECT count(*) FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname={quote(DATABASE)} AND a.application_name={quote(marker+'-b')} AND l.locktype='advisory' AND NOT l.granted;") == '1'
            if waiting:
                break
            if second.poll() is not None:
                break
            time.sleep(0.1)
        if not waiting:
            raise RuntimeError('Second writer did not wait on the quota advisory lock')
        send(first, 'COMMIT;')
        first_status, _, first_error = finish(first)
        second_status, _, second_error = finish(second)
        if first_status != 0:
            raise RuntimeError('The first writer failed: ' + first_error)
        if second_status == 0 or 'PT413' not in second_error or 'level_quota_exceeded' not in second_error:
            raise RuntimeError('Expected PT413 for the second writer: ' + second_error)
        final = json.loads(query(command, f"SELECT json_build_object('rows',count(*),'bytes',coalesce(sum((metadata->>'size')::bigint),0)) FROM storage.objects WHERE bucket_id='course-assets' AND name LIKE {quote(prefix+'%')};"))
        if final != {'rows':40,'bytes':LIMIT}:
            raise RuntimeError('Concurrent writes exceeded or incorrectly applied the quota: ' + json.dumps(final))
        result = dict(database=DATABASE, level=LEVEL, initial_objects=39, competing_writers=2,
                      successes=1, rejected_sqlstate='PT413', advisory_wait_observed=True,
                      final_objects=final['rows'], final_bytes=final['bytes'])
    finally:
        # Close/terminate only this run's sessions before removing its own metadata.
        for process in processes:
            if process.poll() is None:
                if process.stdin:
                    process.stdin.close()
                    process.stdin = None
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    query(command, f"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname={quote(DATABASE)} AND application_name IN ({quote(marker+'-a')},{quote(marker+'-b')}) AND pid<>pg_backend_pid();")
                    process.wait(timeout=5)
        if seeded:
            # These are synthetic metadata rows in the fixed clone, with no blobs.
            # Permit their scoped cleanup only inside this transaction; the real
            # Storage guard and all production sessions retain their defaults.
            query(command, f"BEGIN; SET LOCAL storage.allow_delete_query='true'; DELETE FROM storage.objects WHERE bucket_id='course-assets' AND name LIKE {quote(prefix+'%')}; DELETE FROM public.lms_media_folder WHERE folder_id={quote(folder)}; COMMIT;")
            remaining = query(command, f"SELECT count(*) FROM storage.objects WHERE bucket_id='course-assets' AND name LIKE {quote(prefix+'%')};")
            if remaining != '0':
                raise RuntimeError('Own fixture cleanup failed')
    if result:
        result['cleanup'] = 'own objects and folder removed'
        print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='Run against the fixed isolated clone database')
    parser.add_argument('--container', default=CONTAINER)
    args = parser.parse_args()
    if not args.run:
        parser.error('--run is required; no database has been touched')
    run(args.container)
