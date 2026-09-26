#!/usr/bin/env python3
"""Phase 5: real local PostgreSQL + PostgREST and synthetic carryover learners.

Requires PostgreSQL binaries and a separately installed PostgREST binary.
Every setup/migration has a verified backup through migrate-local.py's
adapter. --serve keeps this disposable environment alive for browser tests;
Ctrl-C stops all processes. Auth alone is synthetic; REST/RPC/RLS/grading are real.
"""
import argparse
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
import urllib.error
import urllib.request

REPO = Path(__file__).resolve().parents[3]
MIGRATION = '37_vocabulary_carryover.sql'
LEARNER = '00000000-0000-4000-8000-000000000081'
TEACHER = '00000000-0000-4000-8000-000000000082'
FIXTURE = REPO / 'deploy/vps/tests/phase5-vocabulary-fixture.sql'


def module_at(name, location):
    spec = importlib.util.spec_from_file_location(name, location)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--pg-bin', type=Path, default=Path('/opt/homebrew/opt/postgresql@17/bin'))
    parser.add_argument('--postgrest', type=Path, required=True)
    parser.add_argument('--schema', type=Path, required=True,
                        help='Frozen Phase-4 schema snapshot; schema-only exports omit rollback backup data')
    parser.add_argument('--serve', action='store_true')
    args = parser.parse_args()
    os.umask(0o077)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    runner = module_at('phase5_runner', REPO / 'deploy/vps/migrate-local.py')
    phase3 = module_at('phase5_bootstrap', REPO / 'deploy/vps/tests/phase3-local-clone.py')
    original_run = subprocess.run
    records = []
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    secret = os.urandom(48)

    def token(role, sub=None):
        encode = lambda value: base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=')
        claims = {'role': role, 'aud': 'authenticated', 'exp': int(time.time()) + 14400}
        if sub:
            claims['sub'] = sub
        data = encode({'alg': 'HS256', 'typ': 'JWT'}) + b'.' + encode(claims)
        return (data + b'.' + base64.urlsafe_b64encode(hmac.digest(secret, data, 'sha256')).rstrip(b'=')).decode()

    keys = {role: token(role) for role in ('anon', 'service_role')}
    learner_token = token('authenticated', LEARNER)
    teacher_token = token('authenticated', TEACHER)
    user = {'id': LEARNER, 'aud': 'authenticated', 'role': 'authenticated',
            'email': 'phase5@example.invalid', 'email_confirmed_at': '2026-01-01T00:00:00Z',
            'app_metadata': {'provider': 'email'}, 'user_metadata': {}}
    session = {'access_token': learner_token, 'refresh_token': 'synthetic-local-session',
               'token_type': 'bearer', 'expires_in': 14400, 'expires_at': int(time.time()) + 14400, 'user': user}
    (output / 'session.json').write_text(json.dumps(session))
    environment_file = {'NEXT_PUBLIC_SUPABASE_URL': 'http://127.0.0.1:54341',
                        'SUPABASE_INTERNAL_URL': 'http://127.0.0.1:54341',
                        'NEXT_PUBLIC_SUPABASE_ANON_KEY': keys['anon'],
                        'SUPABASE_SERVICE_ROLE_KEY': keys['service_role'],
                        'NEXT_PUBLIC_SITE_URL': 'http://127.0.0.1:3105', 'SITE_URL': 'http://127.0.0.1:3105',
                        'NEXT_TELEMETRY_DISABLED': '1'}
    (output / 'environment.json').write_text(json.dumps(environment_file))

    with tempfile.TemporaryDirectory(prefix='sitov-p5-') as temp:
        root = Path(temp)
        socket = root / 'socket'
        socket.mkdir()
        env = {**os.environ, 'PGHOST': str(socket), 'PGPORT': '5445', 'PGUSER': 'postgres'}

        def command(binary, *argv, **kwargs):
            return original_run([str(args.pg_bin / binary), *map(str, argv)], env=env,
                                check=True, capture_output=True, **kwargs)

        def sql(source):
            try:
                return command('psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-d', 'phase5',
                               input=source, text=True).stdout.strip()
            except subprocess.CalledProcessError as error:
                (output / 'sql-error.log').write_text(error.stderr)
                raise RuntimeError(f'Local SQL failed; see {output / "sql-error.log"}') from error

        def backup(label):
            target = output / 'backups' / f'{root.name}-{len(records):03d}-{label}'
            target.mkdir(parents=True)
            dump = command('pg_dump', '-Fc', '-d', 'phase5').stdout
            (target / 'postgres.dump').write_bytes(dump)
            command('pg_restore', '--list', target / 'postgres.dump')
            digest = hashlib.sha256(dump).hexdigest()
            (target / 'sha256.json').write_text(json.dumps({'postgres.dump': digest}))
            (target / 'COMPLETE').write_text('synthetic local PostgreSQL; no Storage objects\n')
            records.append({'label': label, 'path': str(target), 'sha256': digest})
            (output / 'backup-records.json').write_text(json.dumps(records, indent=2) + '\n')
            return target

        def apply(label, rollback=False):
            def adapter(argv, **kwargs):
                expected = ['docker', 'exec', '-i', runner.DB, 'psql']
                if argv[:len(expected)] != expected:
                    raise RuntimeError('Unexpected command in migration adapter')
                forwarded = argv[len(expected):]
                forwarded[forwarded.index('-U') + 1] = 'postgres'
                return original_run([str(args.pg_bin / 'psql'), *forwarded], env=env, **kwargs)
            sql_dir = REPO / 'supabase/vps'
            if rollback:
                sql_dir /= 'rollback'
            with patch.object(sys, 'argv', ['migrate-local.py', '--database', 'phase5',
                                           '--sql-dir', str(sql_dir), '--apply', MIGRATION]), \
                    patch.object(runner, 'backup', side_effect=lambda: backup(label)), \
                    patch.object(runner.subprocess, 'run', side_effect=adapter):
                runner.main()

        def dump_schema():
            argv = ['--schema-only', '--no-owner', '-d', 'phase5']
            for schema in phase3.SCHEMAS:
                argv += ['--schema', schema]
            raw = command('pg_dump', *argv, text=True).stdout
            return '\n'.join(line.rstrip() for line in raw.splitlines()
                             if not line.startswith(('\\restrict', '\\unrestrict'))
                             and line != 'SET transaction_timeout = 0;').rstrip() + '\n'

        class Gateway(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_GET(self):
                self.handle_request()

            def do_POST(self):
                self.handle_request()

            def handle_request(self):
                if self.path == '/__phase5/health':
                    payload = b'{"database":"PostgreSQL","rest":"PostgREST","auth":"synthetic"}'
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(payload)
                    return
                if self.path == '/__phase5/reset' and self.command == 'POST':
                    backup('browser-reset')
                    sql("DELETE FROM vocabulary_private.answer_receipts; DELETE FROM vocabulary_direction_progress; DELETE FROM vocabulary_learning_state; DELETE FROM vocabulary_carryover_preferences; DELETE FROM vocabulary_onboarding; DELETE FROM vocabulary_lesson_pauses;")
                    sql(FIXTURE.read_text())
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(b'{"success":true}')
                    return
                if self.path.startswith('/auth/v1/user'):
                    authorized = self.headers.get('Authorization') == 'Bearer ' + learner_token
                    self.send_response(200 if authorized else 401)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(user if authorized else {'error': 'invalid_token'}).encode())
                    return
                if not self.path.startswith('/rest/v1/'):
                    self.send_error(404)
                    return
                body = self.rfile.read(int(self.headers.get('Content-Length', '0'))) or None
                headers = {name: value for name, value in self.headers.items()
                           if name.lower() not in ('host', 'connection', 'content-length', 'accept-encoding')}
                request = urllib.request.Request('http://127.0.0.1:54340/' + self.path[len('/rest/v1/'):],
                                                 data=body, headers=headers, method=self.command)
                try:
                    response = urllib.request.urlopen(request, timeout=180)
                except urllib.error.HTTPError as error:
                    response = error
                with response:
                    self.send_response(response.status)
                    for name, value in response.headers.items():
                        if name.lower() not in ('transfer-encoding', 'connection', 'server', 'date'):
                            self.send_header(name, value)
                    self.end_headers()
                    self.wfile.write(response.read())

        started = False
        postgrest = gateway = None
        try:
            command('initdb', '-D', root / 'data', '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--no-locale')
            command('pg_ctl', '-D', root / 'data', '-l', root / 'postgres.log', '-o',
                    f"-k {socket} -p 5445 -c listen_addresses='' -c shared_buffers=32MB -c max_connections=12", '-w', 'start')
            started = True
            command('createdb', 'phase5')
            backup('bootstrap')
            sql(phase3.BOOTSTRAP)
            sql(args.schema.read_text())
            sql("""CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
              SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
                nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
              CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
              SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),
                nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;
              CREATE ROLE authenticator LOGIN NOINHERIT;
              GRANT anon, authenticated, service_role TO authenticator;
            """)
            backup('fixture')
            sql(FIXTURE.read_text())
            old_progress = sql('SELECT to_jsonb(p) FROM public.vocabulary_direction_progress p ORDER BY id')
            apply('migration-first')
            first_schema = dump_schema()
            apply('migration-second')
            if first_schema != dump_schema():
                raise RuntimeError('Migration is not schema-idempotent')
            pg_env = {**env, 'PGRST_DB_URI': f'postgresql://authenticator@/phase5?host={socket}&port=5445',
                      'PGRST_DB_SCHEMAS': 'public', 'PGRST_DB_ANON_ROLE': 'anon',
                      'PGRST_JWT_SECRET': base64.b64encode(secret).decode(), 'PGRST_JWT_SECRET_IS_BASE64': 'true',
                      'PGRST_SERVER_HOST': '127.0.0.1', 'PGRST_SERVER_PORT': '54340', 'PGRST_DB_POOL': '3'}
            postgrest = subprocess.Popen([str(args.postgrest.resolve())], env=pg_env,
                                        stdout=(output / 'postgrest.log').open('w'), stderr=subprocess.STDOUT)
            for _ in range(100):
                try:
                    urllib.request.urlopen('http://127.0.0.1:54340/', timeout=1).close()
                    break
                except (urllib.error.URLError, TimeoutError):
                    if postgrest.poll() is not None:
                        raise RuntimeError('PostgREST stopped; see local log')
                    time.sleep(.1)
            else:
                raise RuntimeError('PostgREST did not start')
            gateway = ThreadingHTTPServer(('127.0.0.1', 54341), Gateway)
            threading.Thread(target=gateway.serve_forever, daemon=True).start()

            backup('preference-fixture')
            sql(f"SET request.jwt.claim.sub='{LEARNER}'; SET ROLE authenticated; SELECT set_vocabulary_carryover('A1.2',true); RESET ROLE;")
            apply('rollback', rollback=True)
            if old_progress != sql('SELECT to_jsonb(p) FROM public.vocabulary_direction_progress p ORDER BY id'):
                raise RuntimeError('Rollback changed source learning progress')
            apply('reapply')
            if first_schema != dump_schema():
                raise RuntimeError('Rollback/reapply changed schema')
            if old_progress != sql('SELECT to_jsonb(p) FROM public.vocabulary_direction_progress p ORDER BY id'):
                raise RuntimeError('Migration changed source learning progress')
            backup('browser-fixture')
            sql("DELETE FROM public.vocabulary_carryover_preferences")
            counts = json.loads(sql("SELECT jsonb_build_object('cards',(SELECT count(*) FROM learning_vocabulary_cards),'directions',(SELECT count(*) FROM vocabulary_direction_progress))"))
            schema = dump_schema()
            (output / 'schema.sql').write_text('-- Canonical VPS application schema. Auth/Storage bootstrap is managed separately.\n' + schema)
            catalog = sql("""SELECT jsonb_build_object(
              'columns',(SELECT jsonb_agg(to_jsonb(c)) FROM information_schema.columns c WHERE table_schema='public'),
              'enums',(SELECT jsonb_agg(jsonb_build_object('name',t.typname,'label',e.enumlabel,'sort',e.enumsortorder)) FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typnamespace='public'::regnamespace),
              'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid))) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
              'constraints',(SELECT jsonb_agg(jsonb_build_object('name',c.conname,'table',c.conrelid::regclass::text,'type',c.contype,'definition',pg_get_constraintdef(c.oid))) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE t.relnamespace='public'::regnamespace),
              'views',(SELECT jsonb_agg(to_jsonb(v)) FROM information_schema.views v WHERE table_schema='public'))""")
            (output / 'public-catalog.json').write_text(catalog + '\n')
            evidence = {'postgres': command('postgres', '--version', text=True).stdout.strip(),
                        'postgrest': original_run([str(args.postgrest), '--version'], capture_output=True, text=True, check=True).stdout.strip(),
                        'counts': counts, 'source_progress_preserved': True, 'migration_idempotent': True, 'rollback_reapply': True,
                        'schema_sha256': hashlib.sha256(schema.encode()).hexdigest(),
                        'migration_sha256': hashlib.sha256((REPO / 'supabase/vps' / MIGRATION).read_bytes()).hexdigest(),
                        'backups': records}
            (output / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
            print(json.dumps({k: v for k, v in evidence.items() if k != 'backups'}), flush=True)
            if args.serve:
                backup('browser-session')
                (output / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
                (output / 'connection.json').write_text(json.dumps({'socket': str(socket), 'port': 5445, 'database': 'phase5'}))
                print('Ready for local browser tests on http://127.0.0.1:54341; Ctrl-C to stop.', flush=True)
                while not stop.wait(1):
                    if postgrest.poll() is not None:
                        raise RuntimeError('PostgREST stopped during browser tests')
        finally:
            if gateway:
                gateway.shutdown()
                gateway.server_close()
            if postgrest:
                postgrest.terminate()
                postgrest.wait(timeout=15)
            if started:
                command('pg_ctl', '-D', root / 'data', '-m', 'fast', '-w', 'stop')


if __name__ == '__main__':
    main()
