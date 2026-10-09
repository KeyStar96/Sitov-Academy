"""Actual frozen105 Special protocol, guarded own .invalid fixtures only."""
import json,sys,uuid,secrets,urllib.request,urllib.error,subprocess,hashlib,os,re
from pathlib import Path
from runtime import scope,health
TARGET='f4b0629ed68da1ba08f8023dad3915d02a555985'
assert sys.argv[1:]==['--ready-target',TARGET]
root=Path('/tmp/sitov-night-20261008-qa-master');assert root.stat().st_mode&0o077==0
ready=json.loads((root/'qa-overlay105-proof.json').read_text())
assert ready['through']==105 and ready['productionWrite'] is False
assert ready['migrationSha256']['104_sitov_special_staff_publication.sql']=='91e8946ffc03bdb407cd4fc899ccbd2673513af9b3f97cd4627b01a9e2af614f'
keys=json.loads((root/'test-keys.json').read_text());url,_=scope();checks=[];actors=[];uploads=[];submissions=[];last_http={};http_trace=[]
os.umask(0o077)
ledger=root/'s5-epoch10-ledger.json'
assert qa_mode in ['prepare','finish','cleanup']
if qa_mode=='prepare':assert not ledger.exists() or json.loads(ledger.read_text()).get('cleaned') is True
def write_ledger():ledger.write_text(json.dumps({'target':TARGET,'actors':[{'id':x['id'],'email':x['email']} for x in actors],'uploads':uploads,'submissions':submissions},indent=2))
def http(path,token,body=None,method=None,binary=False):
 operation=path.split('?')[0].split('/')
 operation='/'.join(operation[:5] if '/rpc/' in path else operation[:4])
 request_method=method or ('POST' if body is not None else 'GET')
 req=urllib.request.Request(url+path,data=body if isinstance(body,bytes) else None if body is None else json.dumps(body).encode(),
  headers={'Authorization':'Bearer '+token,'apikey':keys['anon'],'Content-Type':'audio/mpeg' if isinstance(body,bytes) else 'application/json'},method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=15) as r:
   data=r.read();parsed=data if binary else json.loads(data or 'null');last_http.clear();last_http.update({'status':r.status,'binary':binary});http_trace.append({'operation':operation,'method':request_method,'status':r.status,'error':parsed.get('error') if isinstance(parsed,dict) else None});return r.status,parsed
 except urllib.error.HTTPError as e:
  try:data=json.loads(e.read())
  except Exception:data={}
  last_http.clear();last_http.update({'status':e.code,'error':data.get('error') if isinstance(data,dict) else None});http_trace.append({'operation':operation,'method':request_method,'status':e.code,'error':data.get('error') if isinstance(data,dict) else None});return e.code,data
def rpc(name,actor,data):return http('/rest/v1/rpc/'+name,actor['token'],data)
def ok(name,condition):
 assert condition,'QA assertion failed: '+name
 checks.append({'check':name,'passed':True})
def sql(statement,owner=None):
 guard=''
 if owner:
  uid=str(uuid.UUID(owner['id']));assert owner in actors and owner['email'].endswith('@example.invalid')
  guard="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='"+uid+"' AND email='"+owner['email']+"') THEN RAISE EXCEPTION 'own_fixture_only'; END IF; END $$;"
 p=subprocess.run(['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=guard+statement,text=True,capture_output=True)
 if p.returncode:raise RuntimeError('sanitized own-fixture SQL failure')
 return json.loads(p.stdout.strip().split('\n')[-1]) if p.stdout.strip().split('\n')[-1].startswith(('{','[')) else None
def create(role):
 email=qa_browser['email'] if role=='student' else 'sitov-s5-e10-'+uuid.uuid4().hex+'@example.invalid';password=qa_browser['password'] if role=='student' else secrets.token_hex(24)
 status,user=http('/auth/v1/admin/users',keys['service'],{'email':email,'password':password,'email_confirm':True,'user_metadata':{'display_name':'Sitov QA Paul','native_language':'ru','ui_language':'ru'}})
 assert status==200 and user['email']==email
 actor={'id':str(uuid.UUID(user['id'])),'email':email};actors.append(actor);write_ledger()
 status,session=http('/auth/v1/token?grant_type=password',keys['anon'],{'email':email,'password':password});assert status==200
 actor['token']=session['access_token']
 if role=='teacher':sql("UPDATE public.profiles SET role='teacher' WHERE id='"+actor['id']+"'; SELECT '{}'::json;",actor)

 return actor

def call(op,a,node=None,run=None,rev=None,answers=None,mode=None,request=None):
 st,data=rpc('sitov_special_operation',a,{'p_operation':op,'p_node_id':node,'p_run_id':run,'p_mode':mode,'p_revision':rev,'p_request_id':request,'p_answers':answers,'p_locale':'ru'})
 assert st==200
 return data
snapshot_q="SELECT jsonb_build_object('pretestDefinitions',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions),'pretestActive',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions WHERE active),'pretestPasses',(SELECT count(*) FROM sitov_pronunciation_private.pretest_passes),'pretestAttempts',(SELECT count(*) FROM sitov_pronunciation_private.pretest_attempts),'pretestProofs',(SELECT count(*) FROM sitov_pronunciation_private.pretest_question_audio_proofs),'specialActive',(SELECT count(*) FROM sitov_special_private.activation),'authUsers',(SELECT count(*) FROM auth.users),'assets',(SELECT count(*) FROM storage.objects));"
def main_state(a):
 return sql("SELECT jsonb_build_object('progress',coalesce((SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY p.node_id)::text) FROM public.path_node_progress p WHERE p.auth_user_id='"+a['id']+"'),''),'streak',(SELECT jsonb_build_array(daily_quest_streak,daily_quest_longest_streak,daily_quest_last_completed_date) FROM public.profiles WHERE id='"+a['id']+"'),'activity',coalesce((SELECT md5(jsonb_agg(to_jsonb(d) ORDER BY d.day)::text) FROM public.learning_activity_days d WHERE d.auth_user_id='"+a['id']+"'),''),'pathPractice',(SELECT count(*) FROM public.path_practice_runs WHERE auth_user_id='"+a['id']+"'),'pathTests',(SELECT count(*) FROM public.path_test_attempts WHERE auth_user_id='"+a['id']+"'));",a)
if qa_mode=='prepare':
 health_before=health();baseline=sql(snapshot_q);own=create('student');node=str(uuid.UUID(qa_special['nodeId']));anchor=str(uuid.UUID(qa_special['anchorNodeId']))
 sql("INSERT INTO public.student_level_access(auth_user_id,level) VALUES('"+own['id']+"','A1.1');INSERT INTO public.path_node_progress(auth_user_id,node_id,status,best_stars,first_attempt_accuracy) VALUES('"+own['id']+"','"+anchor+"','completed',2,75);SELECT '{}'::json;",own)
 state=json.loads(ledger.read_text());state.update({'baseline':baseline,'main_before':main_state(own),'node':node,'health':health_before});ledger.write_text(json.dumps(state));print(json.dumps({'target':TARGET,'prepared':True,'newAccounts':1,'syntheticAnchor':True,'actualMainPathLearning':False,'baseline':baseline}))
else:
 state=json.loads(ledger.read_text());assert state['target']==TARGET;actors=state['actors'];assert len(actors)==1;own=actors[0];node=state['node']
 # Recover the actor's actual private session for HTTP, never browser cookies.
 # Token is not persisted by the generic ledger; get a new GoTrue session using own credential.
 st,session=http('/auth/v1/token?grant_type=password',keys['anon'],qa_browser);assert st==200;own['token']=session['access_token']
 if qa_mode=='finish':
  try:
   start=call('start',own,node=node,mode='learning',request=str(uuid.uuid4()));assert start['ok'];r=start['data'];initial=len(r['queue']);assert initial>0
   removed=0
   while r['queue']:
    if not r['revealed']:r=call('reveal',own,run=r['runId'],rev=r['revision'],request=str(uuid.uuid4()))['data']
    length=len(r['queue']);r=call('right',own,run=r['runId'],rev=r['revision'],request=str(uuid.uuid4()))['data'];assert len(r['queue'])==length-1;removed+=1
   ok('actual learning stack completed after20 distinct cards',r['status']=='completed' and len(r['selected'])==20 and r['result'] is None and r['learningSolution'] is None)
   ok('completed exact run get persisted',call('get',own,run=r['runId'])['data']==r)
   ok('main progress stars activity and streak unchanged after full stack',main_state(own)==state['main_before'])
   result={'target':TARGET,'passed':True,'checks':checks,'initialRemaining':initial,'cardsRemovedByRPC':removed,'selectedCards':20,'actualHTTPRPCCompletion':True,'browserCompletion':False,'syntheticAnchor':True,'actualMainPathLearning':False}
  except Exception as e:result={'target':TARGET,'passed':False,'checks':checks,'failure':str(e) if str(e).startswith('QA assertion failed:') else 'sanitized stack finish failure','error_type':type(e).__name__}
  state['finish_result']=result;ledger.write_text(json.dumps(state));print(json.dumps(result,indent=2));sys.exit(0 if result['passed'] else 1)
 else:
  sql("DELETE FROM sitov_special_private.receipts WHERE student_id='"+own['id']+"';DELETE FROM sitov_special_private.runs WHERE student_id='"+own['id']+"';DELETE FROM public.path_node_progress WHERE auth_user_id='"+own['id']+"';SELECT '{}'::json;",own)
  st,_=http('/auth/v1/admin/users/'+own['id'],keys['service'],method='DELETE');assert st==200;after=sql(snapshot_q);assert after==state['baseline']
  result={'target':TARGET,'cleaned':True,'ownAccountsDeleted':1,'uploads':0,'before':state['baseline'],'after':after,'globalCountsPreserved':True};ledger.write_text(json.dumps(result));print(json.dumps(result,indent=2))
