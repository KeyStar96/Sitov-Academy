#!/usr/bin/env python3
"""One-time approved VPS migration. Never connects to any external database."""
import datetime,hashlib,hmac,json,os,subprocess,sys,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
DOCKER=['docker','-H','unix:///var/run/docker.sock']
DB='supabase-db-eknmzxvqilojjicinatnllbt'
BASE=Path('/var/www/sitov-academy')

def invoke(args,**kw):
 r=subprocess.run(args,capture_output=True,**kw)
 if r.returncode: raise RuntimeError('Command failed: '+str(args[:3])+' (private logs retained)')
 return r.stdout

def inspect(name):return json.loads(invoke(DOCKER+['inspect',name],text=True))[0]
def environment(name):return dict(x.split('=',1) for x in inspect(name)['Config']['Env'])

# Current storage has orphaned cloud metadata, but no actual files. Refuse the
# cleanup if somebody has uploaded anything since the reviewed preflight.
storage=environment('supabase-storage-eknmzxvqilojjicinatnllbt')
minio=inspect('supabase-minio-eknmzxvqilojjicinatnllbt')
ip=minio['NetworkSettings']['Networks']['eknmzxvqilojjicinatnllbt']['IPAddress']
bucket=storage['STORAGE_S3_BUCKET'];region=storage.get('STORAGE_S3_REGION','us-east-1')
access=storage['AWS_ACCESS_KEY_ID'];secret=storage['AWS_SECRET_ACCESS_KEY']
host=ip+':9000';path='/'+bucket;query='list-type=2&max-keys=1'
now=datetime.datetime.now(datetime.timezone.utc);stamp=now.strftime('%Y%m%dT%H%M%SZ');date=stamp[:8]
empty=hashlib.sha256(b'').hexdigest();headers=f'host:{host}\nx-amz-content-sha256:{empty}\nx-amz-date:{stamp}\n';signed='host;x-amz-content-sha256;x-amz-date'
canonical='\n'.join(['GET',path,query,headers,signed,empty]);scope=f'{date}/{region}/s3/aws4_request'
string='\n'.join(['AWS4-HMAC-SHA256',stamp,scope,hashlib.sha256(canonical.encode()).hexdigest()])
def mac(key,msg):return hmac.new(key,msg.encode(),hashlib.sha256).digest()
key=mac(mac(mac(mac(('AWS4'+secret).encode(),date),region),'s3'),'aws4_request')
signature=hmac.new(key,string.encode(),hashlib.sha256).hexdigest()
req=urllib.request.Request(f'http://{host}{path}?{query}',headers={'x-amz-content-sha256':empty,'x-amz-date':stamp,'Authorization':f'AWS4-HMAC-SHA256 Credential={access}/{scope}, SignedHeaders={signed}, Signature={signature}'})
with urllib.request.urlopen(req,timeout=15) as response:root=ET.fromstring(response.read())
if any(el.tag.endswith('Contents') for el in root.iter()):raise RuntimeError('Storage is not empty: abort; use Storage API and a file backup instead.')
print('Verified: local MinIO bucket has no objects.',flush=True)

# Stop the old application before the consistent dump and destructive cleanup.
apps=json.loads(invoke(['pm2','jlist'],text=True))
for app in apps:
 if app.get('pm2_env',{}).get('pm_cwd')==str(BASE):invoke(['pm2','stop',str(app['pm_id'])],text=True)
subprocess.run(['systemctl','stop','sitov-app','sitov-mail'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
backup=Path('/root/backups')/('sitov-migration-'+stamp);backup.mkdir(mode=0o700)
with (backup/'postgres.dump').open('wb') as f:
 r=subprocess.run(DOCKER+['exec',DB,'pg_dump','-U','supabase_admin','-d','postgres','-Fc'],stdout=f,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError('Backup failed; database unchanged.')
os.chmod(backup/'postgres.dump',0o600)
with (backup/'roles.sql').open('wb') as f:
 subprocess.run(DOCKER+['exec',DB,'pg_dumpall','-U','supabase_admin','--roles-only'],stdout=f,stderr=subprocess.PIPE,check=True)
os.chmod(backup/'roles.sql',0o600)
sha=hashlib.sha256((backup/'postgres.dump').read_bytes()).hexdigest();(backup/'sha256.txt').write_text(sha+'  postgres.dump\n')
print('Backup:',backup,'SHA256:',sha,flush=True)
if '--backup-only' in sys.argv:sys.exit(0)

# All schema/data changes commit together. A failure leaves the old DB intact.
parts=[]
for name in ['prepare','mail','business','learning','platform']:
 source=(Path(os.environ.get('SITOV_MIGRATION_SQL_DIR',str(BASE/'supabase/vps')))/f'{name}.sql').read_text()
 parts.append('\n'.join(line for line in source.splitlines() if line.strip().upper() not in ['BEGIN;','COMMIT;']))
sql='BEGIN;\n'+ '\n\n'.join(parts)+'\nALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_id_fkey;\nCOMMIT;\n'
r=subprocess.run(DOCKER+['exec','-i',DB,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],input=sql,text=True,capture_output=True)
(backup/'migration.log').write_text(r.stdout+'\n'+r.stderr);os.chmod(backup/'migration.log',0o600)
if r.returncode:raise RuntimeError('Migration rolled back. See protected migration.log.')
print('Local migration committed.',flush=True)

# The normalized schema supersedes older incremental migrations. Record missing
# historical versions as baseline entries so a future CLI push cannot replay
# old Cloud webhook definitions. This records a baseline, not their execution.
import base64
entries=[]
for path in sorted((BASE/'supabase/migrations').glob('*.sql')):
    version,_,name=path.stem.partition('_')
    if not version.isdigit() or version>'20260913131152':continue
    statement=path.read_bytes() if version=='20260913131152' else b'-- Baseline: superseded by the verified VPS normalization 20260913131152; not executed separately.'
    encoded=base64.b64encode(statement).decode()
    entries.append("INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('"+version+"','"+name.replace("'","''")+"',ARRAY[convert_from(decode('"+encoded+"','base64'),'UTF8')]) ON CONFLICT(version) DO NOTHING;")
invoke(DOCKER+['exec','-i',DB,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1'],input='\n'.join(entries),text=True)
print('Migration baseline recorded; retired migrations will not be replayed.')
