"""Explicit opt-in, bounded rollback probe on the one assigned existing clone."""
import json,os,re,subprocess,sys
from pathlib import Path
if os.environ.get('SITOV_PATH_REVISION_NATIVE')!='1':
    raise SystemExit('Set SITOV_PATH_REVISION_NATIVE=1 only with an active M clone lease.')
fixture=Path(__file__).with_name('sitov-path-content-revisions-native.sql').read_text()
match=re.search(r"SELECT path_private.import_path_catalog\('(.*?)'::jsonb,NULL\);",fixture,re.S)
assert match
seed=json.loads(match.group(1).replace("''","'"))
seed_sql="'"+json.dumps([seed],ensure_ascii=False).replace("'","''")+"'::jsonb"
remote=r'''
import subprocess,threading,time,json,sys
cmd=['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','sitov_night_migration_rehearsal_20261009']
processes=[];logs={};errors={}
def connection(name):
 p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 processes.append(p);logs[name]=[];errors[name]=[]
 def drain(stream,target):
  for line in stream:target.append(line.rstrip('\n'))
 threading.Thread(target=drain,args=(p.stdout,logs[name]),daemon=True).start()
 threading.Thread(target=drain,args=(p.stderr,errors[name]),daemon=True).start()
 return p
def write(p,q):p.stdin.write(q+'\n');p.stdin.flush()
def marker(name,prefix,timeout=7):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  for line in logs[name]:
   if line.startswith(prefix):return line[len(prefix):].strip()
  time.sleep(.01)
 raise RuntimeError('marker_timeout:'+name+':'+prefix+':'+str(errors[name][-2:]))
result={}
try:
 a=connection('A')
 prefix=FIXTURE.rsplit("SELECT jsonb_build_object('checks'",1)[0]
 write(a,prefix+"SELECT 'A_READY:'||pg_backend_pid();")
 apid=int(marker('A','A_READY:'))
 b=connection('B_import')
 write(b,"BEGIN;SET LOCAL application_name='sitov_S3_epoch64_import';SET LOCAL statement_timeout='4s';SET LOCAL lock_timeout='1500ms';SELECT 'B_READY:'||pg_backend_pid();SET LOCAL ROLE service_role;SELECT public.import_learning_path_seed("+SEED_SQL+");ROLLBACK;")
 bpid=int(marker('B_import','B_READY:'))
 time.sleep(.10)
 write(a,"SELECT 'CATALOG_WAIT:'||jsonb_build_object('event',wait_event,'type',wait_event_type,'blockedByA',"+str(apid)+"=ANY(pg_blocking_pids(pid)))::text FROM pg_stat_activity WHERE pid="+str(bpid)+";")
 observed=json.loads(marker('A','CATALOG_WAIT:'));assert observed['type']=='Lock' and observed['blockedByA'],observed
 b.stdin.close();b.wait(timeout=5)
 payload=next(json.loads(x) for x in logs['B_import'] if x.startswith('{'))
 assert payload.get('sqlstate')=='55P03',payload
 result['actualInstalledServiceImporterBlocked']=dict(observed,sqlstate=payload['sqlstate'])
 # Lock one existing catalog exercise without modifying it. The second SELECT
 # FOR UPDATE proves row-lock contention; no uncommitted synthetic ID is used.
 write(a,"SELECT 'REAL_ROW:'||id::text FROM public.learning_exercises WHERE id::text NOT LIKE '00000000-006%' ORDER BY id LIMIT 1 FOR UPDATE;")
 row=marker('A','REAL_ROW:');assert re.match(r'^[a-f0-9-]{36}$',row)
 c=connection('B_row')
 write(c,"BEGIN;SET LOCAL application_name='sitov_S3_epoch64_row';SET LOCAL statement_timeout='4s';SET LOCAL lock_timeout='1500ms';SELECT 'ROW_READY:'||pg_backend_pid();SELECT id FROM public.learning_exercises WHERE id='"+row+"' FOR UPDATE;ROLLBACK;")
 cpid=int(marker('B_row','ROW_READY:'));time.sleep(.10)
 write(a,"SELECT 'ROW_WAIT:'||jsonb_build_object('event',wait_event,'type',wait_event_type,'blockedByA',"+str(apid)+"=ANY(pg_blocking_pids(pid)))::text FROM pg_stat_activity WHERE pid="+str(cpid)+";")
 observed=json.loads(marker('A','ROW_WAIT:'));assert observed['type']=='Lock' and observed['blockedByA'],observed
 c.stdin.close();c.wait(timeout=5);assert c.returncode!=0 and any('lock timeout' in x for x in errors['B_row'])
 result['actualExistingExerciseRowLockBlocked']=observed
 write(a,"SELECT jsonb_build_object('nativeAssertions',(SELECT count(*) FROM sitov61_checks),'allPassed',(SELECT bool_and(passed) FROM sitov61_checks));ROLLBACK;SELECT jsonb_build_object('archiveAbsent',to_regclass('path_private.sitov_content_revisions') IS NULL,'fixtureRows',(SELECT count(*) FROM public.learning_exercises WHERE id::text LIKE '00000000-0061-%'));")
 a.stdin.close();a.wait(timeout=5);assert a.returncode==0,errors['A'][-3:]
 result['finalResults']=[json.loads(x)for x in logs['A']if x.startswith('{')and('nativeAssertions'in x or 'archiveAbsent'in x)]
 result['passed']=True;result['DDLCommitted']=False;result['crossSession114CASOrReplayProven']=False
except Exception as exc:
 result.update(passed=False,error=str(exc),DDLCommitted=False,crossSession114CASOrReplayProven=False)
finally:
 for p in processes:
  if p.poll() is None:
   try:p.stdin.close()
   except Exception:pass
   try:p.wait(timeout=2)
   except subprocess.TimeoutExpired:p.terminate();p.wait(timeout=2)
print(json.dumps({'result':result,'logs':logs,'errors':errors},ensure_ascii=False))
'''
remote='import re\nFIXTURE='+repr(fixture)+'\nSEED_SQL='+repr(seed_sql)+'\n'+remote
r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=3','sitov-academy','python3','-'],input=remote,text=True,capture_output=True,timeout=25)
private=os.environ.get('SITOV_PATH_REVISION_EVIDENCE_DIR')
if private:
 p=Path(private);p.mkdir(parents=True,exist_ok=True)
 (p/'epoch64-two-session.stdout').write_text(r.stdout);(p/'epoch64-two-session.stderr').write_text(r.stderr)
assert r.returncode==0,r.stderr[-1500:]
result=json.loads(r.stdout)['result'];print(json.dumps(result,indent=2));assert result['passed']
