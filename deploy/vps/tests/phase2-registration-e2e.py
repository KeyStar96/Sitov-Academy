#!/usr/bin/env python3
"""Isolated Phase-2 Auth/REST gateway in the existing container memory cgroups.

start/stop/status run only on the VPS. Never changes production configuration.
Uses the pre-created sitov_phase2_verify database, fresh test JWT keys and a
discard-only SMTP receiver. No test mail is delivered. Generated env is 0600.
The Next.js/browser processes run on the developer machine through an SSH tunnel.
"""
import argparse
import base64
import hashlib
import hmac
import http.client
import http.server
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import socketserver
import subprocess
import sys
import threading
import time
from urllib.parse import urlsplit, urlunsplit

AUTH = 'supabase-auth-eknmzxvqilojjicinatnllbt'
REST = 'supabase-rest-eknmzxvqilojjicinatnllbt'
DB = 'supabase-db-eknmzxvqilojjicinatnllbt'
DATABASE = 'sitov_phase2_verify'
PORT = 19080
STATE = Path('/root/phase2-registration-e2e.json')
ENV = Path('/root/phase2-registration-e2e.env')
LOG = Path('/root/phase2-registration-e2e.log')
MARKER = 'SITOV_PHASE2_E2E=registration'


def command(args):
    return subprocess.check_output(args, text=True).strip()


def inspect(name):
    return json.loads(command(['docker', 'inspect', name]))[0]


def environment(info):
    return dict(item.split('=', 1) for item in info['Config']['Env'])


def clone_url(value):
    parsed = urlsplit(value)
    if parsed.scheme not in ('postgres', 'postgresql') or not parsed.hostname:
        raise RuntimeError('Unexpected database URL; refusing to start')
    return urlunsplit(parsed._replace(path='/' + DATABASE))


def jwt(secret, role):
    encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
    body = encode(b'{"alg":"HS256","typ":"JWT"}') + '.' + encode(json.dumps({
        'role': role, 'iss': 'supabase', 'iat': int(time.time()), 'exp': int(time.time()) + 86400,
    }, separators=(',', ':')).encode())
    return body + '.' + encode(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())


def test_processes():
    found = []
    for container in (AUTH, REST):
        for line in command(['docker', 'top', container, '-eo', 'pid']).splitlines()[1:]:
            pid = int(line.strip())
            try:
                if MARKER.encode() in Path(f'/proc/{pid}/environ').read_bytes().split(b'\0'):
                    found.append(pid)
            except (FileNotFoundError, PermissionError):
                pass
    return found


def stop():
    # Every target is identified by a dedicated environment marker; PID 1 in
    # either production container never carries that marker and is untouched.
    for pid in test_processes():
        try:
            os.kill(pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    if STATE.exists():
        pid = json.loads(STATE.read_text()).get('gateway_pid')
        try:
            if pid and b'phase2-registration-e2e.py\0serve' in Path(f'/proc/{pid}/cmdline').read_bytes():
                os.kill(pid, signal.SIGTERM)
        except (FileNotFoundError, ProcessLookupError):
            pass
        STATE.unlink(missing_ok=True)
    ENV.unlink(missing_ok=True)


class DiscardSMTP(socketserver.StreamRequestHandler):
    def handle(self):
        self.request.settimeout(30)
        self.wfile.write(b'220 phase2-discard ESMTP\r\n')
        body = False
        while line := self.rfile.readline(65536):
            if body:
                if line == b'.\r\n':
                    body = False
                    self.wfile.write(b'250 Discarded\r\n')
                continue
            verb = line.split(b' ', 1)[0].strip().upper()
            if verb in (b'EHLO', b'HELO'):
                self.wfile.write(b'250 phase2-discard\r\n')
            elif verb == b'DATA':
                body = True
                self.wfile.write(b'354 End with dot\r\n')
            elif verb == b'QUIT':
                self.wfile.write(b'221 Bye\r\n')
                return
            else:
                self.wfile.write(b'250 OK\r\n')


def serve():
    auth = inspect(AUTH)
    rest = inspect(REST)
    auth_network = next(iter(auth['NetworkSettings']['Networks'].values()))
    auth_ip = auth_network['IPAddress']
    rest_ip = next(iter(rest['NetworkSettings']['Networks'].values()))['IPAddress']
    class SMTPServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True
    smtp = SMTPServer((auth_network['Gateway'], 19025), DiscardSMTP)
    threading.Thread(target=smtp.serve_forever, daemon=True).start()

    class Gateway(http.server.BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass  # Requests may contain verification tokens or personal data.

        def do_OPTIONS(self):
            self.send_response(204)
            self.cors()
            self.end_headers()

        def cors(self):
            self.send_header('Access-Control-Allow-Origin', 'http://127.0.0.1:3100')
            self.send_header('Access-Control-Allow-Headers', 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,accept-profile,content-profile')
            self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
            self.send_header('X-Sitov-Test-Database', DATABASE)

        def proxy(self):
            if self.path == '/__phase2/health':
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.cors()
                self.end_headers()
                self.wfile.write(json.dumps({'database': DATABASE, 'mail': 'discard', 'isolated': True}).encode())
                return
            if self.path.startswith('/auth/v1/'):
                host, port, path = auth_ip, 19999, self.path[len('/auth/v1'):]
            elif self.path.startswith('/rest/v1/'):
                host, port, path = rest_ip, 13001, self.path[len('/rest/v1'):]
            else:
                self.send_error(404)
                return
            connection = http.client.HTTPConnection(host, port, timeout=30)
            headers = {key: value for key, value in self.headers.items() if key.lower() not in ('host', 'connection', 'transfer-encoding')}
            headers['Host'] = f'127.0.0.1:{PORT}'
            body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
            try:
                connection.request(self.command, path, body=body, headers=headers)
                response = connection.getresponse()
                payload = response.read()
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() not in ('connection', 'transfer-encoding', 'content-length', 'access-control-allow-origin'):
                        self.send_header(key, value)
                self.send_header('Content-Length', str(len(payload)))
                self.cors()
                self.end_headers()
                self.wfile.write(payload)
            except (OSError, http.client.HTTPException):
                self.send_error(502)
            finally:
                connection.close()
        do_GET = proxy
        do_POST = proxy
        do_PUT = proxy
        do_PATCH = proxy
        do_DELETE = proxy

    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Gateway).serve_forever()


def start():
    if STATE.exists() or test_processes():
        raise SystemExit('An E2E gateway already exists. Stop it explicitly before starting another.')
    exists = command(['docker', 'exec', DB, 'psql', '-X', '-At', '-U', 'supabase_admin', '-d', DATABASE, '-c', 'SELECT current_database()'])
    if exists != DATABASE:
        raise SystemExit('The isolated database is missing.')
    # A --no-owner restore intentionally changes ownership. GoTrue must own its
    # own clone tables to read its migration ledger. This is restricted twice
    # to the disposable database; no shared role settings are modified.
    auth_ownership = """
    DO $$ DECLARE item record; BEGIN
      IF current_database()<>'sitov_phase2_verify' THEN RAISE EXCEPTION 'Test database required'; END IF;
      ALTER SCHEMA auth OWNER TO supabase_auth_admin;
      FOR item IN SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='auth' AND c.relkind IN('r','p','S') LOOP
        EXECUTE format('ALTER %s auth.%I OWNER TO supabase_auth_admin',CASE WHEN item.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END,item.relname);
      END LOOP;
    END $$;
    """
    result = subprocess.run(['docker', 'exec', '-i', DB, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', DATABASE],
                            input=auth_ownership, text=True, capture_output=True)
    if result.returncode:
        raise SystemExit('Could not prepare isolated Auth ownership; production unchanged.')
    auth, rest = inspect(AUTH), inspect(REST)
    auth_env, rest_env = environment(auth), environment(rest)
    network = next(iter(auth['NetworkSettings']['Networks'].values()))
    secret = secrets.token_urlsafe(48)
    auth_overrides = {
        'GOTRUE_DB_DATABASE_URL': clone_url(auth_env['GOTRUE_DB_DATABASE_URL']),
        'GOTRUE_API_PORT': '19999', 'PORT': '19999', 'GOTRUE_API_HOST': '0.0.0.0',
        'GOTRUE_JWT_SECRET': secret, 'GOTRUE_SITE_URL': 'http://127.0.0.1:3100',
        'API_EXTERNAL_URL': f'http://127.0.0.1:{PORT}/auth/v1',
        'GOTRUE_URI_ALLOW_LIST': 'http://127.0.0.1:3100/**',
        'GOTRUE_MAILER_AUTOCONFIRM': 'false', 'GOTRUE_SMTP_HOST': network['Gateway'],
        'GOTRUE_SMTP_PORT': '19025', 'GOTRUE_SMTP_USER': '', 'GOTRUE_SMTP_PASS': '',
        'GOTRUE_SMTP_ADMIN_EMAIL': 'noreply@phase2.invalid', 'GOTRUE_SMTP_MAX_FREQUENCY': '1s',
        'GOTRUE_HOOK_SEND_EMAIL_ENABLED': 'false', 'GOTRUE_RATE_LIMIT_EMAIL_SENT': '100',
    }
    rest_overrides = {
        'PGRST_DB_URI': clone_url(rest_env['PGRST_DB_URI']), 'PGRST_SERVER_PORT': '13001',
        'PGRST_JWT_SECRET': secret, 'PGRST_DB_CHANNEL': 'phase2_registration_e2e',
        'PGRST_ADMIN_SERVER_PORT': '13002', 'PGRST_DB_SCHEMAS': 'public', 'PGRST_DB_CONFIG': 'false',
    }
    try:
        with LOG.open('ab') as log:
            os.chmod(LOG, 0o600)
            gateway = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), 'serve'], stdout=log, stderr=log, start_new_session=True)
        STATE.write_text(json.dumps({'gateway_pid': gateway.pid, 'database': DATABASE}))
        os.chmod(STATE, 0o600)
        for name, binary, overrides in [(AUTH, '/usr/local/bin/auth', auth_overrides), (REST, 'postgrest', rest_overrides)]:
            args = ['docker', 'exec', '-e', MARKER]
            for key, value in overrides.items():
                args += ['-e', f'{key}={value}']
            with LOG.open('ab') as log:
                subprocess.Popen(args + [name, binary], stdout=log, stderr=log, start_new_session=True)
        settings = {
            'NEXT_PUBLIC_SITE_URL': 'http://127.0.0.1:3100', 'SITE_URL': 'http://127.0.0.1:3100',
            'NEXT_PUBLIC_SUPABASE_URL': f'http://127.0.0.1:{PORT}',
            'SUPABASE_INTERNAL_URL': f'http://127.0.0.1:{PORT}',
            'NEXT_PUBLIC_SUPABASE_ANON_KEY': jwt(secret, 'anon'),
            'SUPABASE_SERVICE_ROLE_KEY': jwt(secret, 'service_role'),
            'E2E_SUPABASE_URL': f'http://127.0.0.1:{PORT}',
            'E2E_SUPABASE_ANON_KEY': jwt(secret, 'anon'),
            'E2E_SUPABASE_SERVICE_ROLE_KEY': jwt(secret, 'service_role'),
            'E2E_BASE_URL': 'http://127.0.0.1:3100',
        }
        ENV.write_text(''.join(f'{key}={value}\n' for key, value in settings.items()))
        os.chmod(ENV, 0o600)
        for _ in range(40):
            try:
                for host, port in [(network['IPAddress'], 19999), (next(iter(rest['NetworkSettings']['Networks'].values()))['IPAddress'], 13001), ('127.0.0.1', PORT)]:
                    with socket.create_connection((host, port), timeout=1):
                        pass
                print(f'Ready: clone={DATABASE}; gateway=127.0.0.1:{PORT}; env={ENV}; production limits unchanged.')
                return
            except OSError:
                time.sleep(0.5)
        raise RuntimeError('Test services failed to become ready; inspect the protected log and Docker process state.')
    except BaseException:
        stop()
        raise


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['start', 'stop', 'status', 'serve'])
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise SystemExit('Run as root on the approved VPS.')
    if args.action == 'start':
        start()
    elif args.action == 'stop':
        stop()
        print('Test processes stopped and generated credentials removed.')
    elif args.action == 'serve':
        serve()
    else:
        print(json.dumps({'running': STATE.exists(), 'test_processes': len(test_processes()), 'database': DATABASE}))
