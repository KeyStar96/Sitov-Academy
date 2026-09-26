#!/usr/bin/env python3
"""Verify Phase 3 migrations in an isolated, synthetic local PostgreSQL clone.

No VPS, production database, Docker daemon, network socket, existing cluster or
curriculum seed is used. The production migration runner supplies ordering and
transaction semantics; a test adapter redirects its Docker command and backup
function to this disposable cluster. Every mutation has a verified pg_dump.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[3]
SQL_DIR = REPO / 'supabase/vps'
PHASE3 = ['33_path_exercise_types.sql', '34_path_content_contract.sql', '35_path_learning.sql']
SCHEMAS = ['public', 'business_private', 'grammar_private', 'identity_private',
           'learning_private', 'learning_reset_private', 'platform_private',
           'private', 'pronunciation_private', 'trainer_access_private',
           'vocabulary_private', 'media_private', 'path_private']

BOOTSTRAP = """
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,
 raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,owner uuid,
 public boolean DEFAULT false,file_size_limit bigint,allowed_mime_types text[],
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,owner uuid,
 owner_id text,metadata jsonb,user_metadata jsonb,version text,
 created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
 last_accessed_at timestamptz DEFAULT now(),UNIQUE(bucket_id,name));
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
 SELECT (string_to_array(name,'/'))[1:greatest(array_length(string_to_array(name,'/'),1)-1,0)] $$;
CREATE FUNCTION storage.filename(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT (string_to_array(name,'/'))[array_length(string_to_array(name,'/'),1)] $$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth,storage TO anon,authenticated,service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth,storage TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;
INSERT INTO storage.buckets(id,name,public) VALUES('pronunciation_audio','pronunciation_audio',false);
DROP SCHEMA public;
"""


def load_runner():
    location = REPO / 'deploy/vps/migrate-local.py'
    spec = importlib.util.spec_from_file_location('phase3_isolated_migration_runner', location)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--pg-bin', type=Path, default=Path('/opt/homebrew/opt/postgresql@17/bin'))
    args = parser.parse_args()
    for binary in ('initdb', 'pg_ctl', 'psql', 'pg_dump', 'pg_restore', 'createdb'):
        if not (args.pg_bin / binary).is_file():
            parser.error(f'Missing PostgreSQL binary: {args.pg_bin / binary}')
    args.output.mkdir(parents=True, exist_ok=True)
    output = args.output.resolve()
    runner = load_runner()
    original_run = subprocess.run
    records = []
    migration_hashes = {name: hashlib.sha256((SQL_DIR / name).read_bytes()).hexdigest() for name in PHASE3}

    with tempfile.TemporaryDirectory(prefix='sitov-phase3-pg-') as temporary:
        root = Path(temporary)
        data, socket = root / 'data', root / 'socket'
        socket.mkdir(mode=0o700)
        environment = {**os.environ, 'PGHOST': str(socket), 'PGPORT': '5443', 'PGUSER': 'postgres'}

        def command(binary, *arguments, **kwargs):
            return original_run([str(args.pg_bin / binary), *map(str, arguments)],
                                env=environment, check=True, capture_output=True, **kwargs)

        def sql(source, database='path_baseline'):
            return command('psql', '-X', '-v', 'ON_ERROR_STOP=1', '-d', database,
                           '-At', input=source, text=True).stdout.strip()

        def backup(database, label):
            target = output / 'backups' / f'{root.name}-{len(records):03d}-{label}'
            target.mkdir(parents=True, mode=0o700)
            dump = command('pg_dump', '-Fc', '-d', database).stdout
            path = target / 'postgres.dump'
            path.write_bytes(dump)
            command('pg_restore', '--list', path)
            digest = hashlib.sha256(dump).hexdigest()
            (target / 'sha256.json').write_text(json.dumps({'postgres.dump': digest}) + '\n')
            (target / 'COMPLETE').write_text('isolated synthetic test database\n')
            records.append({'database': database, 'label': label,
                            'path': str(target.relative_to(output)), 'sha256': digest})
            return target

        def apply(database, files, sql_dir=SQL_DIR, label='migrate'):
            def docker_adapter(argv, **kwargs):
                expected = ['docker', 'exec', '-i', runner.DB, 'psql']
                if argv[:len(expected)] != expected:
                    raise RuntimeError('Unexpected external command: ' + repr(argv))
                forwarded = argv[len(expected):]
                forwarded[forwarded.index('-U') + 1] = 'postgres'
                return original_run([str(args.pg_bin / 'psql'), *forwarded], env=environment, **kwargs)

            invocation = [str(REPO / 'deploy/vps/migrate-local.py'), '--database', database,
                          '--sql-dir', str(sql_dir), '--apply', *files]
            with patch.object(sys, 'argv', invocation), \
                    patch.object(runner, 'backup', side_effect=lambda: backup(database, label)), \
                    patch.object(runner.subprocess, 'run', side_effect=docker_adapter):
                runner.main()

        def dump_schema(database):
            argv = ['--schema-only', '--no-owner', '-d', database]
            for schema in SCHEMAS:
                argv.extend(['--schema', schema])
            content = command('pg_dump', *argv, text=True).stdout
            # PostgreSQL 17.6+ emits per-dump random psql restriction tokens.
            # Keep the reference artifact compatible with the PostgreSQL-15 target.
            # transaction_timeout is a pg_dump17 session setting, not app DDL.
            lines = [line.rstrip() for line in content.splitlines()
                     if not line.startswith(('\\restrict', '\\unrestrict'))
                     and line != 'SET transaction_timeout = 0;']
            return '\n'.join(lines).rstrip() + '\n'

        def concurrency_checks():
            """Two real PostgreSQL sessions race; no in-process DB simulation."""
            learner = '00000000-0000-4000-8000-000000000071'
            unit = '00000000-0000-4000-8000-000000000072'
            node = '00000000-0000-4000-8000-000000000073'
            exercise = '00000000-0000-4000-8000-000000000074'
            request = '00000000-0000-4000-8000-000000000075'
            backup('path_clone', 'concurrency-fixture')
            sql(f"""
              INSERT INTO locales(code) VALUES('de'),('en'),('ru'),('uk'),('tr');
              INSERT INTO cefr_levels(code) VALUES('A1');
              INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.1','A1',1);
              INSERT INTO learning_trainers(code) VALUES('exercises');
              INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('{learner}','fixture@example.test',now());
              INSERT INTO profiles(id,role,native_language,ui_language) VALUES('{learner}','student','en','en');
              INSERT INTO student_level_access(auth_user_id,level) VALUES('{learner}','A1.1');
              INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title)
               VALUES('{unit}','A1.1','exercises','Prüfpfad',1,true,'concurrency','concurrency','Prüfpfad');
              INSERT INTO path_objectives(unit_id,id,area,description) VALUES('{unit}','concurrency','grammar','Prüfziel');
              INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals)
               VALUES('{node}','{unit}','concurrency','practice',1,'Prüfknoten','Prüfung',
                '{{"rule":"Wähle das erste Wort.","examples":["Ja."],"highlight":null}}',ARRAY['concurrency']);
              INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content)
               VALUES('{exercise}','{unit}','{node}','concurrency','concurrency',1,'Prüfung','multiple_choice',
                '{{"target_form":["Gruß"],"question":"Wähle Ja.","options":["Ja","Nein"],"correct_answer":"Ja","accepted_answers":["Ja"]}}');
            """, 'path_clone')

            def invoke(expression):
                output = sql(f"""BEGIN; SET LOCAL ROLE authenticated;
                  SELECT set_config('request.jwt.claim.sub','{learner}',true),
                         set_config('request.jwt.claim.role','authenticated',true);
                  SELECT {expression}; SELECT pg_sleep(0.1); COMMIT;""", 'path_clone')
                responses = [json.loads(line) for line in output.splitlines() if line.startswith('{')]
                if len(responses) != 1 or 'error' in responses[0]:
                    raise RuntimeError('Concurrent RPC failed: ' + output)
                return responses[0]

            backup('path_clone', 'concurrent-start')
            with ThreadPoolExecutor(max_workers=2) as workers:
                starts = list(workers.map(invoke, [f"start_path_node('{node}','en',false)"] * 2))
            if starts[0]['run_id'] != starts[1]['run_id']:
                raise RuntimeError('Concurrent starts created two practice runs')
            run_id = starts[0]['run_id']
            backup('path_clone', 'concurrent-answer')
            expression = f"submit_path_answer('{run_id}','{exercise}','{{\"index\":0}}','{request}','en')"
            with ThreadPoolExecutor(max_workers=2) as workers:
                answers = list(workers.map(invoke, [expression] * 2))
            if answers[0] != answers[1] or answers[0].get('completed') is not True:
                raise RuntimeError('Concurrent duplicate submissions were not idempotent')
            counts = json.loads(sql(f"""SELECT jsonb_build_object(
              'runs',(SELECT count(*) FROM path_practice_runs WHERE auth_user_id='{learner}'),
              'attempts',(SELECT attempts FROM path_private.practice_items WHERE run_id='{run_id}'),
              'receipts',(SELECT count(*) FROM path_private.answer_receipts WHERE run_id='{run_id}'),
              'stars',(SELECT best_stars FROM path_node_progress WHERE auth_user_id='{learner}' AND node_id='{node}'))""", 'path_clone'))
            if counts != {'runs': 1, 'attempts': 1, 'receipts': 1, 'stars': 3}:
                raise RuntimeError('Concurrent submissions counted twice: ' + repr(counts))
            return {'sessions': 2, 'same_run': True, 'same_receipt': True, **counts}

        started = False
        try:
            command('initdb', '-D', data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--no-locale')
            command('pg_ctl', '-D', data, '-l', root / 'postgres.log', '-o',
                    f"-k {socket} -p 5443 -c listen_addresses='' -c shared_buffers=32MB -c max_connections=10 -c fsync=off", '-w', 'start')
            started = True
            command('createdb', 'path_baseline')
            backup('path_baseline', 'empty-baseline')
            sql(BOOTSTRAP)
            sql((REPO / 'supabase/tests/fixtures/phase2-baseline.sql').read_text())
            sql("SET search_path=public; SET row_security=on; SET check_function_bodies=on;")
            earlier = [name for name in runner.ORDER if name not in PHASE3]
            apply('path_baseline', earlier, label='baseline-migrations')
            baseline = backup('path_baseline', 'clone-source') / 'postgres.dump'
            command('createdb', 'path_clone')
            backup('path_clone', 'empty-clone')
            command('pg_restore', '--no-owner', '--exit-on-error', '-d', 'path_clone', baseline)

            apply('path_clone', PHASE3, label='phase3-first')
            first = dump_schema('path_clone')
            apply('path_clone', PHASE3, label='phase3-second')
            second = dump_schema('path_clone')
            if first != second:
                (output / 'first.sql').write_text(first)
                (output / 'second.sql').write_text(second)
                raise RuntimeError('Second migration changed the schema')

            concurrency = concurrency_checks()

            # Reverse application order without weakening the runner ORDER gate:
            # one backed-up file per invocation is the existing rollback contract.
            for filename in reversed(PHASE3):
                apply('path_clone', [filename], SQL_DIR / 'rollback', 'rollback-' + filename[:2])
            apply('path_clone', PHASE3, label='phase3-reapply')
            restored = dump_schema('path_clone')
            if restored != first:
                (output / 'restored.sql').write_text(restored)
                (output / 'first.sql').write_text(first)
                raise RuntimeError('Reapplication after rollback changed the schema')
            (output / 'schema.sql').write_text('-- Canonical VPS application schema. Auth/Storage bootstrap is managed separately.\n' + restored)
            catalog = sql("""SELECT jsonb_build_object(
              'columns',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public'),
              'enums',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'label',e.enumlabel,'sort',e.enumsortorder)) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace),
              'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
              'constraints',(SELECT jsonb_agg(jsonb_build_object('name',c.conname,'table',c.conrelid::regclass::text,'type',c.contype,'definition',pg_get_constraintdef(c.oid))) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relnamespace='public'::regnamespace),
              'views',(SELECT jsonb_agg(to_jsonb(v)) FROM information_schema.views v WHERE table_schema='public')
            )""", 'path_clone')
            (output / 'public-catalog.json').write_text(catalog + '\n')
            if migration_hashes != {name: hashlib.sha256((SQL_DIR / name).read_bytes()).hexdigest() for name in PHASE3}:
                raise RuntimeError('Migration source changed during verification; rerun against stable files')
            evidence = {'postgres': command('postgres', '--version', text=True).stdout.strip(),
                        'database': 'synthetic isolated clone', 'migration_runs': 2,
                        'rollback_reapply': True, 'schema_sha256': hashlib.sha256(restored.encode()).hexdigest(),
                        'migration_sha256': migration_hashes, 'concurrency': concurrency, 'backups': records}
            (output / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
            print(json.dumps({key: value for key, value in evidence.items() if key != 'backups'}))
        finally:
            if started:
                command('pg_ctl', '-D', data, '-m', 'fast', '-w', 'stop')


if __name__ == '__main__':
    main()
