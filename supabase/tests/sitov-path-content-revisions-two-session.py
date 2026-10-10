"""Explicit opt-in, bounded rollback probe on the one assigned existing clone."""
import json,os,re,subprocess,sys
from pathlib import Path
if os.environ.get('SITOV_PATH_REVISION_NATIVE')!='1':
    raise SystemExit('Set SITOV_PATH_REVISION_NATIVE=1 only with an active M clone lease.')
fixture=Path(__file__).with_name('sitov-path-content-revisions-native.sql').read_text().replace('sitov_S3_epoch64','sitov_S3_epoch65')
match=re.search(r"SELECT path_private.import_path_catalog\('(.*?)'::jsonb,NULL\);",fixture,re.S)
assert match
seed=json.loads(match.group(1).replace("''","'"))
seed_sql="'"+json.dumps([seed],ensure_ascii=False).replace("'","''")+"'::jsonb"
remote=r'''
import subprocess,threading,time,json,sys,signal
cmd=['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','sitov_night_migration_rehearsal_20261009']
processes=[];logs={};errors={};readers=[];connection_readers={}
def alarm(signum,frame):raise TimeoutError("remote_probe_budget_20s")
signal.signal(signal.SIGALRM,alarm);signal.alarm(20)
def connection(name):
 p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 processes.append(p);logs[name]=[];errors[name]=[];connection_readers[name]=[]
 def drain(stream,target):
  for line in stream:target.append(line.rstrip('\n'))
 for stream,target in [(p.stdout,logs[name]),(p.stderr,errors[name])]:
  thread=threading.Thread(target=drain,args=(stream,target),daemon=True);thread.start();readers.append(thread);connection_readers[name].append(thread)
 return p
def finish(name,p):
 p.stdin.close();p.wait(timeout=5)
 for thread in connection_readers[name]:thread.join(timeout=.25)
def write(p,q):p.stdin.write(q+'\n');p.stdin.flush()
def marker(name,prefix,timeout=7):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  for line in logs[name]:
   if line.startswith(prefix):return line[len(prefix):].strip()
  time.sleep(.01)
 raise RuntimeError('marker_timeout:'+name+':'+prefix+':'+str(errors[name][-2:]))
result={'lockObservations':[]}
def observe_wait(name,pid,owner):
 deadline=time.monotonic()+.75
 for attempt in range(20):
  prefix=name+'_'+str(attempt)+':'
  # PostgreSQL caches activity in a transaction. A saw B_import already;
  # refresh before looking for the subsequently created B_row backend.
  write(a,"SELECT pg_stat_clear_snapshot();SELECT '"+prefix+"'||COALESCE((SELECT jsonb_build_object('event',wait_event,'type',wait_event_type,'blockedByA',"+str(owner)+"=ANY(pg_blocking_pids(pid))) FROM pg_stat_activity WHERE pid="+str(pid)+"),'null'::jsonb)::text;")
  observed=json.loads(marker('A',prefix,timeout=1))
  result['lockObservations'].append({'phase':name,'pid':pid,'observed':observed})
  if observed and observed['type']=='Lock' and observed['blockedByA']:return observed
  if time.monotonic()>=deadline:break
  time.sleep(.025)
 raise AssertionError('lock_not_observed:'+name+':'+str(result['lockObservations'][-1]))
try:
 a=connection('A')
 prefix=FIXTURE.rsplit("SELECT jsonb_build_object('checks'",1)[0]
 write(a,prefix+"SELECT 'A_READY:'||pg_backend_pid();")
 apid=int(marker('A','A_READY:'))
 write(a,"SELECT 'A_ROLE:'||jsonb_build_object('role',current_user,'session',session_user)::text;")
 result['aRole']=json.loads(marker('A','A_ROLE:'));assert result['aRole']['role']=='supabase_admin'
 b=connection('B_import')
 write(b,"BEGIN;SET LOCAL application_name='sitov_S3_epoch65_import';SET LOCAL statement_timeout='4s';SET LOCAL lock_timeout='1500ms';SELECT 'B_READY:'||pg_backend_pid();SET LOCAL ROLE service_role;SELECT 'B_ROLE:'||jsonb_build_object('role',current_user,'session',session_user)::text;SELECT public.import_learning_path_seed("+SEED_SQL+");ROLLBACK;")
 bpid=int(marker('B_import','B_READY:'))
 result['importerRole']=json.loads(marker('B_import','B_ROLE:'));assert result['importerRole']['role']=='service_role'
 observed=observe_wait('CATALOG_WAIT',bpid,apid);assert observed['event']=='advisory',observed
 result['actualInstalledServiceImporterBlocked']=dict(observed,sqlstate=None)
 finish('B_import',b)
 payload=next(json.loads(x) for x in logs['B_import'] if x.startswith('{'))
 assert payload.get('sqlstate')=='55P03',payload
 result['actualInstalledServiceImporterBlocked']=dict(observed,sqlstate=payload['sqlstate'])
 # Finish the 114 transaction before the row probe: its trigger DDL holds
 # relation locks, which would otherwise hide the actual row contention.
 write(a,"SELECT 'NATIVE_RESULT:'||jsonb_build_object('nativeAssertions',(SELECT count(*) FROM sitov61_checks),'allPassed',(SELECT bool_and(passed) FROM sitov61_checks))::text;ROLLBACK;SELECT 'ROLLBACK_RESULT:'||jsonb_build_object('archiveAbsent',to_regclass('path_private.sitov_content_revisions') IS NULL,'fixtureRows',(SELECT count(*) FROM public.learning_exercises WHERE id::text LIKE '00000000-0061-%'))::text;")
 result['nativeResult']=json.loads(marker('A','NATIVE_RESULT:'));assert result['nativeResult']=={'nativeAssertions':54,'allPassed':True}
 result['rollbackResult']=json.loads(marker('A','ROLLBACK_RESULT:'));assert result['rollbackResult']=={'archiveAbsent':True,'fixtureRows':0}
 write(a,"BEGIN;SET LOCAL application_name='sitov_S3_epoch65_row_owner';SET LOCAL statement_timeout='4s';SET LOCAL lock_timeout='1500ms';")
 # Lock exactly one existing visible catalog exercise without modifying it.
 write(a,"SELECT 'REAL_ROW:'||id::text FROM public.learning_exercises WHERE id::text NOT LIKE '00000000-006%' ORDER BY id LIMIT 1 FOR UPDATE;")
 row=marker('A','REAL_ROW:');assert re.match(r'^[a-f0-9-]{36}$',row)
 c=connection('B_row')
 write(c,"BEGIN;SET LOCAL application_name='sitov_S3_epoch65_row';SET LOCAL statement_timeout='4s';SET LOCAL lock_timeout='1500ms';SELECT 'ROW_READY:'||pg_backend_pid();SELECT 'ROW_ROLE:'||jsonb_build_object('role',current_user,'session',session_user)::text;SELECT id FROM public.learning_exercises WHERE id='"+row+"' FOR UPDATE;ROLLBACK;")
 cpid=int(marker('B_row','ROW_READY:'))
 result['rowRole']=json.loads(marker('B_row','ROW_ROLE:'));assert result['rowRole']['role']=='supabase_admin'
 observed=observe_wait('ROW_WAIT',cpid,apid);assert observed['event']=='transactionid',observed
 result['actualExistingExerciseRowLockBlocked']=dict(observed,timeoutConfirmed=False)
 finish('B_row',c);assert c.returncode!=0 and any('lock timeout' in x for x in errors['B_row'])
 result['actualExistingExerciseRowLockBlocked']['timeoutConfirmed']=True
 write(a,"ROLLBACK;SELECT 'ROW_ROLLBACK_DONE';")
 marker('A','ROW_ROLLBACK_DONE');finish('A',a);assert a.returncode==0,errors['A'][-3:]
 result['rowTransactionRolledBack']=True
 result['passed']=True;result['DDLCommitted']=False;result['crossSession114CASOrReplayProven']=False
except Exception as exc:
 result.update(passed=False,error=str(exc),DDLCommitted=False,crossSession114CASOrReplayProven=False)
finally:
 signal.alarm(0)
 for p in processes:
  if p.poll() is None:
   try:p.stdin.close()
   except Exception:pass
   try:p.wait(timeout=1)
   except subprocess.TimeoutExpired:p.terminate();p.wait(timeout=1)
 for thread in readers:thread.join(timeout=.25)
 result['openChildProcesses']=sum(p.poll() is None for p in processes)
print(json.dumps({'result':result,'logs':logs,'errors':errors},ensure_ascii=False))
'''
remote='import re\nFIXTURE='+repr(fixture)+'\nSEED_SQL='+repr(seed_sql)+'\n'+remote
try:
 r=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=3','sitov-academy','python3','-'],input=remote,text=True,capture_output=True,timeout=25)
except subprocess.TimeoutExpired as exc:
 def decoded(value):return value.decode(errors='replace') if isinstance(value,bytes) else value or ''
 r=subprocess.CompletedProcess(exc.cmd,124,decoded(exc.stdout),decoded(exc.stderr)+'\nouter_probe_timeout_25s')
private=os.environ.get('SITOV_PATH_REVISION_EVIDENCE_DIR')
if private:
 p=Path(private);p.mkdir(parents=True,exist_ok=True)
 (p/'epoch65-two-session.stdout').write_text(r.stdout);(p/'epoch65-two-session.stderr').write_text(r.stderr)
assert r.returncode==0,r.stderr[-1500:]
result=json.loads(r.stdout)['result'];print(json.dumps(result,indent=2));assert result['passed']
