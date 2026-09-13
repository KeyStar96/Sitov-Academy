#!/usr/bin/env python3
"""One-time coordinated schema/release cutover on the approved local VPS.

prepare builds against the isolated restored database while production runs.
activate backs up again, applies the tested transaction and switches the release.
Credentials and full SQL logs remain in root-only files on the VPS.
"""
import argparse
import base64
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

D = ['docker', '-H', 'unix:///var/run/docker.sock']
DB = 'supabase-db-eknmzxvqilojjicinatnllbt'
ROOT = Path('/var/www/sitov-academy')
CURRENT = Path('/var/www/sitov-current')
STATE = Path('/root/canonical-release.json')
MIGRATION = '20260913154030_canonical_schema_and_private_units.sql'

def command(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def capture(args):
    return subprocess.check_output(args, text=True).strip()

def db_sql(sql):
    return subprocess.run(D + ['exec', '-i', DB, 'psql', '-X', '-At', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], input=sql, text=True, capture_output=True)

def migration_state():
    result = db_sql("SELECT CASE WHEN EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260913154030') THEN 'applied' ELSE 'absent' END;")
    if result.returncode:
        return 'unknown'
    return result.stdout.strip() if result.stdout.strip() in ('applied', 'absent') else 'unknown'

def healthy():
    for _ in range(30):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=3) as response:
                if response.status == 200:
                    return True
        except (OSError, TimeoutError):
            pass
        time.sleep(1)
    return False

parser = argparse.ArgumentParser()
parser.add_argument('phase', choices=['prepare', 'activate'])
args = parser.parse_args()
if os.geteuid() != 0 or not ROOT.is_dir():
    raise SystemExit('Run only as root on the approved Sitov VPS')

if args.phase == 'prepare':
    tracked = subprocess.run(['git', '-C', str(ROOT), 'ls-files', '--error-unmatch', 'tsconfig.tsbuildinfo'], capture_output=True)
    if tracked.returncode == 0:
        command(['git', '-C', str(ROOT), 'restore', '--', 'tsconfig.tsbuildinfo'])
    command(['git', '-C', str(ROOT), 'pull', '--ff-only'])
    revision = capture(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'])
    release = Path('/var/www/sitov-releases') / revision[:12]
    release.mkdir(mode=0o755)
    archive = subprocess.Popen(['git', '-C', str(ROOT), 'archive', revision], stdout=subprocess.PIPE)
    command(['tar', '-x', '-C', str(release)], stdin=archive.stdout)
    archive.stdout.close()
    if archive.wait() != 0:
        raise SystemExit('Release archive failed')
    command(['install', '-m', '640', '-o', 'root', '-g', 'sitov', '/etc/sitov-academy/app.env', str(release / '.env.local')])
    command(['npm', 'ci', '--no-audit', '--no-fund'], cwd=release)
    environment = dict(os.environ, SUPABASE_INTERNAL_URL='http://127.0.0.1:19080', NODE_OPTIONS='--max-old-space-size=3072')
    command(['npm', 'run', 'build'], cwd=release, env=environment)
    command(['chown', '-R', 'sitov:sitov', str(release / '.next')])
    state = {'revision': revision, 'release': str(release), 'previous': str(CURRENT.resolve()),
             'migration_sha256': hashlib.sha256((release / 'supabase/migrations' / MIGRATION).read_bytes()).hexdigest()}
    STATE.write_text(json.dumps(state))
    STATE.chmod(0o600)
    print('Prepared release', revision[:12], flush=True)
else:
    state = json.loads(STATE.read_text())
    release = Path(state['release'])
    if str(CURRENT.resolve()) != state['previous']:
        raise SystemExit('Active release changed since preparation; review before cutover')
    source = (release / 'supabase/migrations' / MIGRATION).read_bytes()
    if hashlib.sha256(source).hexdigest() != state['migration_sha256']:
        raise SystemExit('Prepared migration checksum changed')
    if migration_state() != 'absent':
        raise SystemExit('Migration already applied or preflight unavailable')
    backup = Path('/root/backups') / ('sitov-canonical-cutover-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    backup.mkdir(mode=0o700)
    committed = False
    attempted = False
    try:
        # Pause the public ingress, application writes and email dispatch only
        # after the replacement release has been built and tested.
        command(['systemctl', 'stop', 'nginx', 'sitov-app', 'sitov-mail'])
        for filename, pg_args in [('postgres.dump', ['pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc']),
                                 ('roles.sql', ['pg_dumpall', '-U', 'supabase_admin', '--roles-only'])]:
            with (backup / filename).open('wb') as output:
                command(D + ['exec', DB] + pg_args, stdout=output, stderr=subprocess.PIPE)
            (backup / filename).chmod(0o600)
        shutil.copy2('/etc/sitov-academy/app.env', backup / 'app.env')
        (backup / 'app.env').chmod(0o600)
        checksum = hashlib.sha256((backup / 'postgres.dump').read_bytes()).hexdigest()
        (backup / 'sha256.txt').write_text(checksum + '  postgres.dump\n')
        sql = source.decode()
        insert = "INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20260913154030','canonical_schema_and_private_units',ARRAY[convert_from(decode('" + base64.b64encode(source).decode() + "','base64'),'UTF8')]);\n"
        final_commit = sql.rindex('COMMIT;')
        attempted = True
        result = db_sql(sql[:final_commit] + insert + sql[final_commit:])
        log = backup / 'migration.log'
        log.write_text(result.stdout + '\n' + result.stderr)
        log.chmod(0o600)
        if result.returncode:
            raise RuntimeError('Migration failed or outcome unconfirmed; protected migration.log has details')
        committed = True
        temporary = Path(str(CURRENT) + '.next')
        temporary.symlink_to(release)
        temporary.replace(CURRENT)
        command(['systemctl', 'start', 'sitov-app'])
        if not healthy():
            command(['systemctl', 'stop', 'sitov-app'])
            raise RuntimeError('New release failed readiness. Database committed: inspect before any coordinated restore; do not restart incompatible old code.')
        command(['systemctl', 'start', 'nginx', 'sitov-mail'])
        state.update(backup=str(backup), activated=True)
        STATE.write_text(json.dumps(state))
        print('Activated release', state['revision'][:12], 'backup', backup, flush=True)
    except Exception:
        # A connection failure after COMMIT is ambiguous. The marker commits
        # atomically with DDL; never restart old code on an unknown/new schema.
        if not committed and (not attempted or migration_state() == 'absent'):
            command(['systemctl', 'start', 'sitov-app', 'nginx', 'sitov-mail'])
        raise
