"""Actual QA107 failed-topic/retake HTTP protocol; exact own disposable actors only."""
import time
import json,sys,uuid,secrets,urllib.request,urllib.error,subprocess,hashlib,os,re
from pathlib import Path
from runtime import scope,health
TARGET='f690574575b0f92233a939dd7ebe42b268fb40b6'
assert sys.argv[1:]==['--ready-target',TARGET]
root=Path('/tmp/sitov-night-20261008-qa-master');assert root.stat().st_mode&0o077==0
# The actual SSH stdin driver injects private Mac proof/binding inputs.
assert isinstance(globals().get('qa_ready'), dict), 'driver must inject verified qa_ready proof'
assert isinstance(globals().get('qa_bindings'), dict), 'driver must inject reviewed qa_bindings'
assert qa_ready['through']==107 and qa_ready['sourceIntegrationSha']==TARGET and not qa_ready['productionWrite']
assert qa_ready['migrationSha256']=='a89c4fbc09349bc20b75f101254d697dac00cd4503f418eaf6e3d691b2d7ffa5'
keys=json.loads((root/'test-keys.json').read_text());url,_=scope();checks=[];actors=[];uploads=[];submissions=[];last_http={};http_trace=[]
os.umask(0o077)
ledger=root/'s5-epoch16-ledger.json'
assert not ledger.exists() or json.loads(ledger.read_text()).get('cleaned') is True
def write_ledger():ledger.write_text(json.dumps({'target':TARGET,'actors':[{'id':x['id'],'email':x['email']} for x in actors],'uploads':uploads,'submissions':submissions},indent=2))
work_deadline=time.monotonic()+100
cleanup_phase=False
def http(path,token,body=None,method=None,binary=False):
 if not cleanup_phase:assert time.monotonic()<work_deadline,'bounded work time reached'
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
 email='sitov-s5-e16-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_hex(24)
 status,user=http('/auth/v1/admin/users',keys['service'],{'email':email,'password':password,'email_confirm':True,'user_metadata':{'display_name':'Sitov QA Paul','native_language':'ru','ui_language':'ru'}})
 assert status==200 and user['email']==email
 actor={'id':str(uuid.UUID(user['id'])),'email':email};actors.append(actor);write_ledger()
 status,session=http('/auth/v1/token?grant_type=password',keys['anon'],{'email':email,'password':password});assert status==200
 actor['token']=session['access_token']
 if role=='teacher':sql("UPDATE public.profiles SET role='teacher' WHERE id='"+actor['id']+"'; SELECT '{}'::json;",actor)
 else:sql("INSERT INTO public.student_level_access(auth_user_id,level) VALUES('"+actor['id']+"','A1.1') ON CONFLICT DO NOTHING; SELECT '{}'::json;",actor)
 return actor

import time
started=time.monotonic();observations=[]
def observe():
 h=health();_,cs=scope();mem=int(next(x for x in open('/proc/meminfo') if x.startswith('MemAvailable:')).split()[1])/1024
 assert mem>=1984 and {k:v['HostConfig']['Memory']//1024**2 for k,v in cs.items()}=={'db':320,'auth':128,'storage':256,'rest':64,'gateway':192}
 out=subprocess.check_output(['docker','exec','sitov-night-20261008-qa-gateway','cat','/sys/fs/cgroup/memory.events','/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory.peak'],text=True).splitlines()
 counters={x.split()[0]:int(x.split()[1]) for x in out[:-2]};assert counters.get('oom',0)==counters.get('oom_kill',0)==0
 item={'at':h['at'],'memAvailableMiB':mem,'health':[x['http_status'] for x in h['health']],'gatewayCurrentBytes':int(out[-2]),'gatewayPeakBytes':int(out[-1]),'events':counters,'states':[{'service':k,'startedAt':v['State']['StartedAt'],'restartCount':v['RestartCount'],'oomKilled':v['State']['OOMKilled']} for k,v in cs.items()]};observations.append(item);return item
snapshot_q="SELECT jsonb_build_object('users',(SELECT count(*) FROM auth.users),'defs',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions),'active',(SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions WHERE active),'proofs',(SELECT count(*) FROM sitov_pronunciation_private.pretest_question_audio_proofs),'assets',(SELECT count(*) FROM storage.objects),'attempts',(SELECT count(*) FROM sitov_pronunciation_private.pretest_attempts),'passes',(SELECT count(*) FROM sitov_pronunciation_private.pretest_passes),'submissions',(SELECT count(*) FROM public.submissions),'profileHash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id)::text,'')) FROM public.profiles p),'definitionsHash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id)::text,'')) FROM sitov_pronunciation_private.pretest_definitions d),'assetsHash',(SELECT md5(coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id)::text,'')) FROM storage.objects o));"
def state(a):
 tables=[('sitov_pronunciation_private.pretest_attempts','student_id'),('sitov_pronunciation_private.pretest_receipts','student_id'),('sitov_pronunciation_private.pretest_passes','student_id'),('public.path_node_progress','auth_user_id'),('public.vocabulary_direction_progress','auth_user_id'),('public.sitov_verb_progress','auth_user_id'),('public.learning_activity_days','auth_user_id'),('public.student_level_access','auth_user_id'),('public.learning_trainer_grants','auth_user_id'),('public.learning_unit_grants','auth_user_id')]
 parts=[]
 for t,col in tables:parts.extend(["'"+t+"'","(SELECT md5(coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text)::text,'')) FROM "+t+" x WHERE "+col+"='"+a['id']+"')"])
 return sql('SELECT jsonb_build_object('+','.join(parts)+');',a)
def grant(a,enabled):
 st,r=rpc('set_student_trainer_access',teacher,{'p_user_id':a['id'],'p_level':'A1.1','p_trainer':'pronunciation','p_enabled':enabled,'p_unit_ids':None,'p_replace_units':False});assert st==200 and r is None
try:
 observe();baseline=sql(snapshot_q);own=create('student');foreign=create('student');teacher=create('teacher');grant(own,True)
 defs=sql("SELECT jsonb_agg(jsonb_build_object('id',id,'textId',text_id)) FROM sitov_pronunciation_private.pretest_definitions WHERE active;");ok('current five active definitions verified',len(defs)==5)
 binding=next(d for d in qa_bindings['activeDefinitions'] if any(c['topicIds'] for c in d['topics']));assert any(d['id']==binding['id'] and d['textId']==binding['textId'] for d in defs);text=str(uuid.UUID(binding['textId']));other=next(d['textId'] for d in defs if d['textId']!=text)
 zero=sql("SELECT jsonb_build_object('vocab',(SELECT count(*) FROM public.vocabulary_direction_progress WHERE auth_user_id='"+own['id']+"'),'verb',(SELECT count(*) FROM public.sitov_verb_progress WHERE auth_user_id='"+own['id']+"'),'path',(SELECT count(*) FROM public.path_node_progress WHERE auth_user_id='"+own['id']+"'));",own);ok('fresh learner has zero vocabulary verb mainpath evidence',zero=={'vocab':0,'verb':0,'path':0})
 st,rows=http('/rest/v1/learning_reading_texts?select=id,audio_url&id=eq.'+text,own['token']);ok('text reference denied before individual PASS',st==200 and rows==[])
 st,t=rpc('sitov_create_pronunciation_upload_ticket',own,{'p_text_id':text,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'});ok('recording denied before PASS',st==200 and t.get('error')=='test_required')
 ref=sql("SELECT jsonb_build_object('audio',audio_url) FROM public.learning_reading_texts WHERE id='"+text+"';",own)['audio'];assert ref.startswith('storage://audio_cache/');st,_=http('/storage/v1/object/authenticated/audio_cache/'+ref[len('storage://audio_cache/'):],own['token'],binary=True);ok('private reference source audio denied before PASS',st in [400,401,403,404])
 st,start=rpc('sitov_start_pronunciation_pretest',own,{'p_text_id':text,'p_request_id':str(uuid.uuid4())});ok('zeroevidence actual current test start',st==200 and start.get('ok') is True);attempt=start['data']['attempt'];aid=str(uuid.UUID(attempt['id']))
 correct=sql("SELECT jsonb_object_agg(q->>'id',q->>'correctOptionId') FROM sitov_pronunciation_private.pretest_attempts a CROSS JOIN LATERAL jsonb_array_elements(a.tasks) q WHERE a.id='"+aid+"' AND a.student_id='"+own['id']+"';",own)
 wrong={q['id']:next(o['id'] for o in q['options'] if o['id']!=correct[q['id']]) for q in start['data']['tasks']}
 st,failed=rpc('sitov_submit_pronunciation_pretest',own,{'p_attempt_id':aid,'p_revision':attempt['revision'],'p_answers':wrong,'p_request_id':str(uuid.uuid4())});ok('valid wrong answers persist terminal FAIL',st==200 and failed.get('ok') and failed['data']['result']['passed'] is False);res=failed['data']['result'];failed_ids=res['failedCompetencyIds'];expected=sorted({t for c in binding['topics'] if c['id'] in failed_ids for t in c['topicIds']});assert expected
 before=state(own);st,topics=rpc('sitov_get_pronunciation_pretest_learning_topics',own,{'p_attempt_id':aid});ok('actual107 exact stored failed cores topics versions and attempt',st==200 and topics.get('ok') and topics['data']=={k:res[k] for k in ['attemptId','textId','textVersion','testVersion','failedCompetencyIds']}|{'topicIds':expected});ok('107 DTO only exact metadata no keys source body or links',set(topics['data'])=={'attemptId','textId','textVersion','testVersion','failedCompetencyIds','topicIds'})
 for label,token in [('foreign',foreign['token']),('anonymous',keys['anon'])]:
  st,r=http('/rest/v1/rpc/sitov_get_pronunciation_pretest_learning_topics',token,{'p_attempt_id':aid});ok(label+' learning topics denied',st in [401,403] or st==200 and r.get('error') in ['not_found','authentication_required'])
 ok('readonly107 preserved attempts result receipts proof progress rights hashes',state(own)==before)
 grant(own,False);st,r=rpc('sitov_get_pronunciation_pretest_learning_topics',own,{'p_attempt_id':aid});ok('same JWT current commercial revoke denies107',st==200 and r.get('error')=='not_found');grant(own,True);st,r=rpc('sitov_get_pronunciation_pretest_learning_topics',own,{'p_attempt_id':aid});ok('exact enabled allunit rights restore restores same107 response',st==200 and r==topics)
 st,start=rpc('sitov_start_pronunciation_pretest',own,{'p_text_id':text,'p_request_id':str(uuid.uuid4())});ok('actual retake new accountbound current attempt',st==200 and start.get('ok') and start['data']['attempt']['id']!=aid);at=start['data']['attempt'];rid=str(uuid.UUID(at['id']))
 correct=sql("SELECT jsonb_object_agg(q->>'id',q->>'correctOptionId') FROM sitov_pronunciation_private.pretest_attempts a CROSS JOIN LATERAL jsonb_array_elements(a.tasks) q WHERE a.id='"+rid+"' AND a.student_id='"+own['id']+"';",own)
 body={'p_attempt_id':rid,'p_revision':at['revision'],'p_answers':correct,'p_request_id':str(uuid.uuid4())};st,passed=rpc('sitov_submit_pronunciation_pretest',own,body);ok('servergrades actual retake PASS',st==200 and passed.get('ok') and passed['data']['result']['passed'] is True)
 st,repeat=rpc('sitov_submit_pronunciation_pretest',own,body);ok('PASS submit retry identical receipt',repeat==passed)
 st,r=rpc('sitov_get_pronunciation_pretest_learning_topics',own,{'p_attempt_id':rid});ok('passed attempt rejected by failedtopics RPC',st==200 and r.get('error')=='not_found')
 st,rows=http('/rest/v1/learning_reading_texts?select=id,audio_url&id=eq.'+text,own['token']);ok('exact passed reference visible',st==200 and len(rows)==1 and rows[0]['id']==text);reference=rows[0]['audio_url'];assert reference.startswith('storage://audio_cache/');path=reference[len('storage://audio_cache/'):]
 st,_=http('/storage/v1/object/authenticated/audio_cache/'+path,own['token'],binary=True);ok('direct private reference audio remains protected',st in [400,401,403,404]);st,mp3=http('/storage/v1/object/authenticated/audio_cache/'+path,keys['service'],binary=True);meta=sql("SELECT jsonb_build_object('sha',user_metadata->>'audioSha256') FROM storage.objects WHERE bucket_id='audio_cache' AND name='"+path+"';");ok('real prepared MP3 serverfixture bytes match storedSHA',st==200 and len(mp3)>1000 and hashlib.sha256(mp3).hexdigest()==meta['sha'])
 st,t=rpc('sitov_create_pronunciation_upload_ticket',own,{'p_text_id':other,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'});ok('other current text remains test_required',st==200 and t.get('error')=='test_required')
 st,t=rpc('sitov_create_pronunciation_upload_ticket',own,{'p_text_id':text,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'});ok('exact PASS issues recording ticket',st==200 and t.get('ok'));upload=t['data']['path'];assert upload.startswith(own['id']+'/');uploads.append(upload);write_ledger();st,_=http('/storage/v1/object/pronunciation_audio/'+upload,own['token'],mp3);ok('actual authorized prepared-copy upload',st in [200,201])
 body={'p_prompt_id':text,'p_audio_path':'storage://pronunciation_audio/'+upload};st,sid=rpc('create_pronunciation_submission',own,body);ok('actual syntheticrecording submission persisted',st==200 and isinstance(sid,str));sid=str(uuid.UUID(sid));submissions.append(sid);write_ledger();st,repeat=rpc('create_pronunciation_submission',own,body);ok('submission retry exact same historical receipt',repeat==sid)
 grant(own,False);st,rows=http('/rest/v1/submissions?select=id,text_content&id=eq.'+sid,own['token']);ok('history snapshot retained after current revocation',st==200 and len(rows)==1 and bool(rows[0]['text_content']));st,r=rpc('sitov_get_pronunciation_pretest_attempt',own,{'p_attempt_id':aid});ok('own prior failed result history retained',st==200 and r.get('ok') and r['data']['result']['passed'] is False)
 observe();result={'passed':True,'target':TARGET,'checks':checks,'actual107HTTP':True,'publicRawLearningLinksPopulated':False,'DAL108AndBrowserTested':False,'syntheticRecording':True,'realMP3ShaChecked':True,'topicCount':len(expected),'observationSeconds':round(time.monotonic()-started,3)}
except Exception as error:
 result={'passed':False,'target':TARGET,'checks':checks,'error_type':type(error).__name__,'failure':str(error) if str(error).startswith('QA assertion failed:') else 'sanitized107 protocol failure','actual107HTTP':True,'DAL108AndBrowserTested':False}
finally:
 cleanup_phase=True
 write_ledger();cleanup=[]
 for path in uploads:
  st,_=http('/storage/v1/object/pronunciation_audio',keys['service'],{'prefixes':[path]},method='DELETE');cleanup.append(st in [200,204])
 if actors:
  a=actors[0]
  try:sql("DELETE FROM sitov_pronunciation_private.upload_tickets WHERE student_id='"+a['id']+"';DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE auth_user_id='"+a['id']+"');DELETE FROM public.submissions WHERE auth_user_id='"+a['id']+"';SELECT '{}'::json;",a)
  except Exception:cleanup.append(False)
 for a in reversed(actors):
  st,_=http('/auth/v1/admin/users/'+a['id'],keys['service'],method='DELETE');cleanup.append(st in [200,204])
 result.update({'http_trace':http_trace,'observations':observations,'newOwnAccounts':len(actors),'ownUploads':len(uploads),'ownSubmissions':len(submissions),'onlyOwnCleanup':all(cleanup)})
 try:after=sql(snapshot_q);result['baselineAfterEqual']=after==baseline;result['baseline']=baseline;result['after']=after;observe();result['observations']=observations
 except Exception:result['postflightFailure']=True
 summary={'target':TARGET,'cleaned':all(cleanup),'newOwnAccounts':len(actors),'uploads':len(uploads),'submissions':len(submissions)}
 if not all(cleanup):summary.update({'actors':[{'id':a['id'],'email':a['email']} for a in actors],'uploadPaths':uploads,'submissionIds':submissions})
 ledger.write_text(json.dumps(summary));print(json.dumps(result,indent=2));sys.exit(0 if result['passed'] and result['onlyOwnCleanup'] and result.get('baselineAfterEqual') and not result.get('postflightFailure') else 1)
