"""Actual frozen105 Special protocol, guarded own .invalid fixtures only."""
import json,sys,uuid,secrets,urllib.request,urllib.error,subprocess,hashlib,os,re
from pathlib import Path
from runtime import scope,health
TARGET='5e1b656ad8befd6af52b593be372519bf1c50704'
assert sys.argv[1:]==['--ready-target',TARGET]
root=Path('/tmp/sitov-night-20261008-qa-master');assert root.stat().st_mode&0o077==0
ready=json.loads((root/'qa-overlay105-proof.json').read_text())
assert ready['through']==105 and ready['productionWrite'] is False
assert ready['migrationSha256']['104_sitov_special_staff_publication.sql']=='91e8946ffc03bdb407cd4fc899ccbd2673513af9b3f97cd4627b01a9e2af614f'
keys=json.loads((root/'test-keys.json').read_text());url,_=scope();checks=[];actors=[];uploads=[];submissions=[];last_http={};http_trace=[]
os.umask(0o077)
ledger=root/'s5-epoch9-ledger.json'
assert not ledger.exists() or json.loads(ledger.read_text()).get('cleaned') is True
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
 email=qa_browser['email'] if role=='student' else 'sitov-s5-e9-'+uuid.uuid4().hex+'@example.invalid';password=qa_browser['password'] if role=='student' else secrets.token_hex(24)
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
snapshot_q="SELECT jsonb_build_object('pretestDefinitions',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions),'pretestActive',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions WHERE active),'pretestPasses',(SELECT count(*) FROM sitov_pronunciation_private.pretest_passes),'pretestAttempts',(SELECT count(*) FROM sitov_pronunciation_private.pretest_attempts),'specialActive',(SELECT count(*) FROM sitov_special_private.activation),'authUsers',(SELECT count(*) FROM auth.users),'assets',(SELECT count(*) FROM storage.objects));"
def main_state(a):
 return sql("SELECT jsonb_build_object('progress',coalesce((SELECT md5(jsonb_agg(to_jsonb(p) ORDER BY p.node_id)::text) FROM public.path_node_progress p WHERE p.auth_user_id='"+a['id']+"'),''),'streak',(SELECT jsonb_build_array(daily_quest_streak,daily_quest_longest_streak,daily_quest_last_completed_date) FROM public.profiles WHERE id='"+a['id']+"'),'activity',coalesce((SELECT md5(jsonb_agg(to_jsonb(d) ORDER BY d.day)::text) FROM public.learning_activity_days d WHERE d.auth_user_id='"+a['id']+"'),''),'pathPractice',(SELECT count(*) FROM public.path_practice_runs WHERE auth_user_id='"+a['id']+"'),'pathTests',(SELECT count(*) FROM public.path_test_attempts WHERE auth_user_id='"+a['id']+"'));",a)
try:
 health_before=health();baseline=sql(snapshot_q);own=create('student');foreign=create('foreign');teacher=create('teacher')
 info=qa_special;node=str(uuid.UUID(info['nodeId']));anchor=str(uuid.UUID(info['anchorNodeId']));definition=str(uuid.UUID(info['definitionId']))
 req=str(uuid.uuid4());res=call('start',own,node=node,mode='learning',request=req);ok('commercially unauthorized learner denied',res.get('error')=='not_found')
 sql("INSERT INTO public.student_level_access(auth_user_id,level) VALUES('"+own['id']+"','A1.1');SELECT '{}'::json;",own)
 res=call('start',own,node=node,mode='learning',request=str(uuid.uuid4()));ok('commercial access without anchor completion denied',res.get('error')=='not_found')
 sql("INSERT INTO public.path_node_progress(auth_user_id,node_id,status,best_stars,first_attempt_accuracy) VALUES('"+own['id']+"','"+anchor+"','completed',2,75);SELECT '{}'::json;",own)
 before=main_state(own);body={'p_operation':'start','p_node_id':node,'p_mode':'learning','p_request_id':str(uuid.uuid4()),'p_locale':'ru'}
 st,start=rpc('sitov_special_operation',own,body);ok('actual Special learning starts with20cards',st==200 and start.get('ok') and len(start['data']['queue'])==20)
 st,repeat=rpc('sitov_special_operation',own,body);ok('start exact retry stable',repeat==start)
 conflict=dict(body,p_mode='test');st,res=rpc('sitov_special_operation',own,conflict);ok('same request different operation payload denied',res.get('error')=='request_conflict')
 r=start['data'];ok('learning DTO hides private answer before reveal',r['learningSolution'] is None and 'correct_answer' not in json.dumps(r['tasks']))
 res=call('get',foreign,run=r['runId']);ok('foreign run retrieval denied',res.get('error')=='not_found')
 res=call('right',own,run=r['runId'],rev=r['revision'],request=str(uuid.uuid4()));ok('self-rating before reveal denied',res.get('error')=='reveal_required')
 old=r;rid=str(uuid.uuid4());flip=call('reveal',own,run=r['runId'],rev=r['revision'],request=rid);ok('actual reveal provides current private solution',flip.get('ok') and flip['data']['learningSolution'] is not None)
 ok('reveal exact retry stable',call('reveal',own,run=r['runId'],rev=r['revision'],request=rid)==flip)
 res=call('wrong',own,run=r['runId'],rev=r['revision'],request=str(uuid.uuid4()));ok('stale CAS revision denied',res.get('error')=='revision_conflict')
 r=flip['data'];first=r['queue'][0];r=call('wrong',own,run=r['runId'],rev=r['revision'],request=str(uuid.uuid4()))['data'];ok('wrong rotates card to queue end',len(r['queue'])==20 and r['queue'][-1]==first and not r['revealed'])
 ok('get resumes persisted queue',call('get',own,run=r['runId'])['data']==r)
 r=call('reveal',own,run=r['runId'],rev=r['revision'],request=str(uuid.uuid4()))['data'];r=call('right',own,run=r['runId'],rev=r['revision'],request=str(uuid.uuid4()))['data'];ok('right removes current card',len(r['queue'])==19)
 previous=[]
 for expected in [7,8]:
  start=call('start',own,node=node,mode='test',request=str(uuid.uuid4()));ok('test balanced10 start '+str(expected),start.get('ok') and len(start['data']['selected'])==10);t=start['data']
  oracle=sql("SELECT jsonb_build_object('blueprint',d.blueprint,'items',(SELECT jsonb_agg(jsonb_build_object('id',q->>'id','stratum',q->>'stratum','type',q->'snapshot'->>'type','content',q->'snapshot'->'content')) FROM jsonb_array_elements(d.pool) q WHERE (q->>'id')::uuid=ANY(a.selected))) FROM sitov_special_private.runs a JOIN sitov_special_private.definitions d ON d.id=a.definition_id WHERE a.id='"+str(uuid.UUID(t['runId']))+"' AND a.student_id='"+own['id']+"';",own)
  counts={k:sum(i['stratum']==k for i in oracle['items']) for k in oracle['blueprint']};ok('actual selected strata match authored quotas '+str(expected),counts==oracle['blueprint'])
  if previous:ok('retake selected10 disjoint from previous10',set(t['selected']).isdisjoint(previous))
  ok('test DTO has no private solution before grading '+str(expected),t['result'] is None and t['learningSolution'] is None and 'correct_answer' not in json.dumps(t['tasks']))
  byid={i['id']:i for i in oracle['items']};answers={}
  for n,i in enumerate(t['selected']):
   item=byid[i];c=item['content']
   if item['type']=='multiple_choice':idx=c['options'].index(c['correct_answer']);answers[i]={'index':idx if n<expected else (idx+1)%len(c['options'])}
   else:assert item['type']=='fill_in_blank';answers[i]={'text':c['correct_answer'] if n<expected else 'sitov-qa-wrong'}
  res=call('submit',own,run=t['runId'],rev=t['revision'],answers={},request=str(uuid.uuid4()));ok('incomplete submit denied '+str(expected),res.get('error')=='incomplete_attempt')
  req=str(uuid.uuid4());one={t['selected'][0]:answers[t['selected'][0]]};saved=call('save',own,run=t['runId'],rev=t['revision'],answers=one,request=req);ok('save single answer and exact retry '+str(expected),saved.get('ok') and call('save',own,run=t['runId'],rev=t['revision'],answers=one,request=req)==saved)
  ok('get resumes persisted test answer '+str(expected),call('get',own,run=t['runId'])['data']['answers']==one)
  req=str(uuid.uuid4());done=call('submit',own,run=t['runId'],rev=saved['data']['revision'],answers=answers,request=req);ok('server grades '+str(expected)+'of10 '+('PASS' if expected==8 else 'FAIL'),done.get('ok') and done['data']['result']['correct']==expected and done['data']['result']['passed']==(expected>=8))
  ok('graded submit exact retry '+str(expected),call('submit',own,run=t['runId'],rev=saved['data']['revision'],answers=answers,request=req)==done)
  previous=t['selected']
 st,res=http('/rest/v1/definitions',own['token'],method='GET');ok('private definition absent in public REST',st in [404,406])
 # Direct private REST exposure is tested independently from SQL permissions.
 import urllib.request,urllib.error
 request=urllib.request.Request(url+'/rest/v1/runs',headers={'Authorization':'Bearer '+own['token'],'apikey':keys['anon'],'Accept-Profile':'sitov_special_private'})
 try:
  with urllib.request.urlopen(request,timeout=15) as response:private_status=response.status
 except urllib.error.HTTPError as error:private_status=error.code
 ok('private schema REST not exposed',private_status==406)
 sqlprobe="SET ROLE authenticated;SELECT * FROM sitov_special_private.runs;"
 p=subprocess.run(['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input=sqlprobe,text=True,capture_output=True);ok('authenticated SQL direct private runs permission denied',p.returncode!=0 and 'permission denied' in p.stderr)
 st,res=rpc('set_student_trainer_access',teacher,{'p_user_id':own['id'],'p_level':'A1.1','p_trainer':'exercises','p_enabled':False,'p_unit_ids':None,'p_replace_units':False});ok('own teacher revokes commercial Special trainer',st==200 and res is None)
 res=call('get',own,run=r['runId']);ok('current rights revocation closes existing run',res.get('error')=='not_found')
 st,res=rpc('set_student_trainer_access',teacher,{'p_user_id':own['id'],'p_level':'A1.1','p_trainer':'exercises','p_enabled':True,'p_unit_ids':None,'p_replace_units':False});ok('own fixture trainer restored for bounded UI smoke',st==200 and res is None)
 ok('main path progress stars activity and streak unchanged',main_state(own)==before)
 result={'passed':True,'target':TARGET,'checks':checks,'syntheticCommercialAndAnchorFixture':True,'actualMainPathLearning':False,'timeoutTimestampSimulation':False,'privateOracleAnswersEmitted':False,'health':health_before,'baseline':baseline,'browserUntested':True}
except Exception as error:result={'passed':False,'target':TARGET,'checks':checks,'failure':str(error) if str(error).startswith('QA assertion failed:') else 'sanitized Special protocol failure','error_type':type(error).__name__}
finally:
 write_ledger();d=json.loads(ledger.read_text());d['protocol_result']=result;ledger.write_text(json.dumps(d));print(json.dumps(result,indent=2));sys.exit(0 if result['passed'] else 1)
