"""Actual frozen97 RPC/Storage protocol, guarded own .invalid fixtures only."""
import json,sys,uuid,secrets,urllib.request,urllib.error,subprocess,hashlib,os
from pathlib import Path
from runtime import scope,health
TARGET='51d989a112a9c89c7f0aaa478dc082994b6a2919'
assert sys.argv[1:]==['--ready-target',TARGET]
root=Path('/tmp/sitov-night-20261008-qa-master');assert root.stat().st_mode&0o077==0
keys=json.loads((root/'test-keys.json').read_text());url,_=scope();checks=[];actors=[];uploads=[];submissions=[]
os.umask(0o077)
ledger=root/'s5-epoch6-ledger.json'
def write_ledger():ledger.write_text(json.dumps({'target':TARGET,'actors':[{'id':x['id'],'email':x['email']} for x in actors],'uploads':uploads,'submissions':submissions},indent=2))
def http(path,token,body=None,method=None,binary=False):
 req=urllib.request.Request(url+path,data=body if isinstance(body,bytes) else None if body is None else json.dumps(body).encode(),
  headers={'Authorization':'Bearer '+token,'apikey':keys['anon'],'Content-Type':'audio/mpeg' if isinstance(body,bytes) else 'application/json'},method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=15) as r:
   data=r.read();return r.status,data if binary else json.loads(data or 'null')
 except urllib.error.HTTPError as e:
  try:data=json.loads(e.read())
  except Exception:data={}
  return e.code,data
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
 email='sitov-s5-e6-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_hex(24)
 status,user=http('/auth/v1/admin/users',keys['service'],{'email':email,'password':password,'email_confirm':True,'user_metadata':{'display_name':'Sitov QA Paul','native_language':'ru','ui_language':'ru'}})
 assert status==200 and user['email']==email
 actor={'id':str(uuid.UUID(user['id'])),'email':email};actors.append(actor);write_ledger()
 status,session=http('/auth/v1/token?grant_type=password',keys['anon'],{'email':email,'password':password});assert status==200
 actor['token']=session['access_token']
 if role=='teacher':sql("UPDATE public.profiles SET role='teacher' WHERE id='"+actor['id']+"'; SELECT '{}'::json;",actor)
 else:sql("INSERT INTO public.student_level_access(auth_user_id,level) VALUES('"+actor['id']+"','A1.1') ON CONFLICT DO NOTHING; SELECT '{}'::json;",actor)
 return actor
try:
 health_before=health();own=create('student');foreign=create('student');teacher=create('teacher')
 defs=sql("SELECT coalesce(jsonb_agg(jsonb_build_object('text_id',text_id,'id',id) ORDER BY text_id),'[]') FROM sitov_pronunciation_private.pretest_definitions WHERE active;")
 assert len(defs)==3;text=defs[0]['text_id'];other=defs[1]['text_id']
 evidence=sql("SELECT jsonb_build_object('vocab',(SELECT count(*) FROM public.vocabulary_direction_progress WHERE auth_user_id='"+own['id']+"'),'verb',(SELECT count(*) FROM public.sitov_verb_progress WHERE auth_user_id='"+own['id']+"'),'path',(SELECT count(*) FROM public.path_node_progress WHERE auth_user_id='"+own['id']+"'));",own)
 ok('zero old vocabulary/verb/path evidence',evidence=={'vocab':0,'verb':0,'path':0})
 status,rows=http('/rest/v1/learning_reading_texts?select=id,audio_url&id=eq.'+text,own['token'])
 ok('reference target hidden before individual pass',status==200 and rows==[])
 status,res=rpc('sitov_create_pronunciation_upload_ticket',own,{'p_text_id':text,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'})
 ok('new recording ticket denied before pass',status==200 and res.get('error')=='test_required')
 start_body={'p_text_id':text,'p_request_id':str(uuid.uuid4())};status,start=rpc('sitov_start_pronunciation_pretest',own,start_body)
 ok('zeroevidence learner starts actual current test',status==200 and start.get('ok') is True)
 attempt=start['data']['attempt'];aid=str(uuid.UUID(attempt['id']));revision=attempt['revision']
 ok('explicit private keys absent from public DTO','correctOptionId' not in json.dumps(start) and 'rationaleDe' not in json.dumps(start))
 status,repeat=rpc('sitov_start_pronunciation_pretest',own,start_body);ok('start retry exact attempt',repeat==start)
 status,res=rpc('sitov_get_pronunciation_pretest_attempt',foreign,{'p_attempt_id':aid});ok('foreign attempt denied',res.get('error')=='not_found')
 answers=sql("SELECT jsonb_object_agg(q->>'id',q->>'correctOptionId') FROM sitov_pronunciation_private.pretest_attempts a CROSS JOIN LATERAL jsonb_array_elements(a.tasks) q WHERE a.id='"+aid+"' AND a.student_id='"+own['id']+"';",own)
 ok('grader uses only guarded private own-attempt answer keys',len(answers)==attempt['totalCount'])
 status,res=rpc('sitov_save_pronunciation_pretest_answers',own,{'p_attempt_id':aid,'p_revision':revision+99,'p_answers':answers,'p_request_id':str(uuid.uuid4())});ok('stale revision denied',res.get('error')=='attempt_conflict')
 save_body={'p_attempt_id':aid,'p_revision':revision,'p_answers':answers,'p_request_id':str(uuid.uuid4())}
 status,saved=rpc('sitov_save_pronunciation_pretest_answers',own,save_body);ok('answers saved persistently',saved.get('ok') is True)
 status,repeat=rpc('sitov_save_pronunciation_pretest_answers',own,save_body);ok('save exact retry',repeat==saved)
 submit_body={'p_attempt_id':aid,'p_revision':saved['data']['revision'],'p_answers':answers,'p_request_id':str(uuid.uuid4())}
 status,graded=rpc('sitov_submit_pronunciation_pretest',own,submit_body);ok('actual persisted individual pass',status==200 and graded.get('ok') is True and graded['data']['result']['passed'] is True)
 status,repeat=rpc('sitov_submit_pronunciation_pretest',own,submit_body);ok('double submit returns exact receipt',repeat==graded)
 status,rows=http('/rest/v1/learning_reading_texts?select=id,audio_url',own['token'])
 target_diagnostics={'http_status':status,'response_type':type(rows).__name__,'visible_row_count':len(rows) if isinstance(rows,list) else None,
  'passed_target_visible':isinstance(rows,list) and any(x.get('id')==text for x in rows),
  'first3_visible_count':len([x for x in rows if x.get('id') in [d['text_id'] for d in defs]]) if isinstance(rows,list) else None}
 target_diagnostics['private_gate_probe']=sql("SELECT set_config('request.jwt.claims','"+json.dumps({'sub':own['id'],'role':'authenticated'})+"',false); SELECT jsonb_build_object('current_pass',sitov_pronunciation_private.current_pass('"+text+"'),'item_allowed',sitov_access_private.item_allowed('"+own['id']+"','reading_text','"+text+"'),'unit_allowed',(SELECT learning_private.unit_allowed(unit_id) FROM public.learning_reading_texts WHERE id='"+text+"'));",own)
 ok('exactly passed first3 text reference unlocks',status==200 and [x['id'] for x in rows if x['id'] in [d['text_id'] for d in defs]]==[text])
 reference=next(x['audio_url'] for x in rows if x['id']==text);assert reference.startswith('storage://audio_cache/')
 path=reference[len('storage://audio_cache/'):]
 status,mp3=http('/storage/v1/object/authenticated/audio_cache/'+path,keys['service'],binary=True)
 meta=sql("SELECT jsonb_build_object('sha',user_metadata->>'audioSha256') FROM storage.objects WHERE bucket_id='audio_cache' AND name='"+path+"';")
 ok('real QA MP3 bytes match stored hash; synthetic recording copy',status==200 and len(mp3)>1000 and hashlib.sha256(mp3).hexdigest()==meta['sha'])
 for role,token in [('anonymous',keys['anon']),('learner',own['token']),('foreign',foreign['token'])]:
  status,_=http('/storage/v1/object/authenticated/audio_cache/'+path,token,binary=True);ok(role+' direct private reference object denied',status in [400,401,403,404])
 status,res=rpc('sitov_create_pronunciation_upload_ticket',own,{'p_text_id':other,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'});ok('another text still test_required',res.get('error')=='test_required')
 ticket_body={'p_text_id':text,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'};status,ticket=rpc('sitov_create_pronunciation_upload_ticket',own,ticket_body);ok('ticket issued after exact pass',ticket.get('ok') is True)
 status,repeat=rpc('sitov_create_pronunciation_upload_ticket',own,ticket_body);ok('ticket retry stable',repeat==ticket)
 upload=ticket['data']['path'];assert upload.startswith(own['id']+'/')
 status,_=http('/storage/v1/object/pronunciation_audio/'+upload,foreign['token'],mp3);ok('foreign cannot upload owned ticket path',status in [400,401,403,404])
 badpath=own['id']+'/'+str(uuid.uuid4())+'.mp3';status,_=http('/storage/v1/object/pronunciation_audio/'+badpath,own['token'],mp3);ok('unticketed own path denied',status in [400,401,403,404])
 status,_=http('/storage/v1/object/pronunciation_audio/'+upload,own['token'],mp3);ok('actual ticket-authorized MP3 upload',status in [200,201]);uploads.append(upload);write_ledger()
 status,_=http('/storage/v1/object/pronunciation_audio/'+upload,own['token'],mp3+b'collision');ok('same-path byte collision denied',status in [400,403,409])
 status,back=http('/storage/v1/object/authenticated/pronunciation_audio/'+upload,keys['service'],binary=True);ok('uploaded bytes preserved',status==200 and hashlib.sha256(back).digest()==hashlib.sha256(mp3).digest())
 status,res=rpc('create_pronunciation_submission',own,{'p_prompt_id':other,'p_audio_path':'storage://pronunciation_audio/'+upload});ok('wrong text submission denied',not isinstance(res,str))
 submission_body={'p_prompt_id':text,'p_audio_path':'storage://pronunciation_audio/'+upload};status,sid=rpc('create_pronunciation_submission',own,submission_body);ok('actual recorded-copy submission persists',status==200 and isinstance(sid,str));sid=str(uuid.UUID(sid));submissions.append(sid);write_ledger()
 status,repeat=rpc('create_pronunciation_submission',own,submission_body);ok('submission retry identical historical receipt',repeat==sid)
 status,_=http('/storage/v1/object/authenticated/pronunciation_audio/'+upload,foreign['token'],binary=True);ok('foreign cannot read private submission audio',status in [400,401,403,404])
 status,reply=rpc('sitov_create_pronunciation_reply_upload_ticket',own,{'p_submission_id':sid,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'});ok('historical reply ticket available',reply.get('ok') is True)
 reply_path=reply['data']['path'];status,res=rpc('create_pronunciation_submission',own,{'p_prompt_id':text,'p_audio_path':'storage://pronunciation_audio/'+reply_path});ok('reply purpose cannot submit new target',not isinstance(res,str))
 status,revoked=rpc('set_student_trainer_access',teacher,{'p_user_id':own['id'],'p_level':'A1.1','p_trainer':'pronunciation','p_enabled':False,'p_unit_ids':None,'p_replace_units':False});ok('own QA teacher commercially revokes pronunciation',status==200 and revoked.get('success') is True)
 status,rows=http('/rest/v1/learning_reading_texts?select=id&id=eq.'+text,own['token']);ok('revocation closes passed target reference',status==200 and rows==[])
 status,res=rpc('sitov_create_pronunciation_upload_ticket',own,{'p_text_id':text,'p_request_id':str(uuid.uuid4()),'p_extension':'mp3'});ok('revocation denies new target ticket',res.get('ok') is False)
 status,rows=http('/rest/v1/submissions?select=id,text_content&id=eq.'+sid,own['token']);ok('historical submission snapshot preserved after revoke',status==200 and len(rows)==1 and bool(rows[0]['text_content']))
 status,repeat=rpc('create_pronunciation_submission',own,submission_body);ok('historical consumed receipt retry preserved after revoke',repeat==sid)
 result={'passed':True,'target':TARGET,'checks':checks,'syntheticRecording':True,'realMP3ShaChecked':True,'beforeHealth':health_before,'nextBrowserTested':False}
except Exception as error:
 result={'passed':False,'target':TARGET,'checks':checks,'error_type':type(error).__name__,'failure':str(error) if str(error).startswith('QA assertion failed:') else 'sanitized protocol failure','target_diagnostics':globals().get('target_diagnostics'),'nextBrowserTested':False}
finally:
 cleanup=[]
 for path in uploads:
  status,_=http('/storage/v1/object/pronunciation_audio',keys['service'],{'prefixes':[path]},method='DELETE');cleanup.append(status in [200,204])
 if actors:
  own=actors[0]
  sql("DELETE FROM public.pronunciation_messages WHERE submission_id IN(SELECT id FROM public.submissions WHERE auth_user_id='"+own['id']+"'); DELETE FROM public.submissions WHERE auth_user_id='"+own['id']+"'; SELECT '{}'::json;",own)
 for actor in reversed(actors):
  status,_=http('/auth/v1/admin/users/'+actor['id'],keys['service'],method='DELETE');cleanup.append(status in [200,204])
 result['onlyOwnFixtureCleanupPassed']=all(cleanup)
 result['newSyntheticAccounts']=len(actors)
 ledger.write_text(json.dumps({'target':TARGET,'cleaned':all(cleanup),'newSyntheticAccounts':len(actors),'uploads':len(uploads),'submissions':len(submissions)}))
 print(json.dumps(result,indent=2))
 if not result['passed'] or not result['onlyOwnFixtureCleanupPassed']:sys.exit(1)
