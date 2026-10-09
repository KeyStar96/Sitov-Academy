"""Actual local Next cookie/audio test; own QA actors only; no browser cookie reads."""
import json,uuid,secrets,subprocess,urllib.request,urllib.error,urllib.parse,base64,hashlib,unicodedata,re,sys,os
from pathlib import Path
TARGET='708068f83e75403a4bd2c348122acece24b01d15'
assert sys.argv[1] in ['prepare','api','cleanup']
assert sys.argv[2:]==['--ready-target',TARGET]
private=Path('/Users/denniskostjuk/Documents/SitovAcademy/SmartGerman/.git/sitov-orchestration/SITOV-NIGHT-2026-10-08/S5');ledger=private/'epoch8-private-ledger.json';os.umask(0o077)
def remote(src):
 p=subprocess.run(['ssh','-o','BatchMode=yes','sitov-academy','python3','-'],input=src,text=True,capture_output=True)
 if p.returncode:raise RuntimeError('sanitized scoped remote failure')
 return json.loads(p.stdout)
runtime=Path(__file__).with_name('runtime.py').read_text()
bootstrap='import types,sys\nm=types.ModuleType("runtime")\nexec(compile('+repr(runtime)+',"runtime.py","exec"),m.__dict__)\nsys.modules["runtime"]=m\n'
init=remote(bootstrap+"from runtime import scope,health\nfrom pathlib import Path\nimport json\nr=Path('/tmp/sitov-night-20261008-qa-master');p=json.loads((r/'qa-overlay100-proof.json').read_text());old=json.loads((r/'qa-overlay99-proof.json').read_text());assert p['sourceIntegrationSha']=='"+TARGET+"' and p['through']==100 and p['migrationSha256']=='ebe50eedbeeb3506ddbd0ab7a2105488f3b5362905ddd2c1834490edb217cb7c' and p['productionWrite'] is False;assert old['sourceIntegrationSha']=='8b83a421748dce9c8a2d2e38712cb5526ad5e2bb';scope();health();print(json.dumps({'keys':json.loads((r/'test-keys.json').read_text()),'ready':True}))")
keys=init['keys'];gateway='http://127.0.0.1:19483';checks=[]
def http(url,token=None,body=None,cookie=None,headers=None,method=None):
 h={'apikey':keys['anon'],'Content-Type':'application/json'}
 if token:h['Authorization']='Bearer '+token
 if cookie:h['Cookie']=cookie
 if headers:h.update(headers)
 req=urllib.request.Request(url,data=None if body is None else json.dumps(body).encode(),headers=h,method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=25) as r:return r.status,r.read(),{k.lower():v for k,v in r.headers.items()}
 except urllib.error.HTTPError as e:return e.code,e.read(),{k.lower():v for k,v in e.headers.items()}
def rpc(n,a,b):
 st,data,_=http(gateway+'/rest/v1/rpc/'+n,a['token'],b);assert st==200;return json.loads(data)
def sql(q,owner=None):
 if owner:
  assert owner in actors and owner['email'].startswith('sitov-s5-e8-') and owner['email'].endswith('@example.invalid');u=str(uuid.UUID(owner['id']))
  q="DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='"+u+"' AND email='"+owner['email']+"') THEN RAISE EXCEPTION 'own_fixture_only';END IF;END $$;"+q
 return remote("import subprocess,json\np=subprocess.run(['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1'],input="+repr(q)+",text=True,capture_output=True);assert p.returncode==0;print(p.stdout.strip().split('\\n')[-1])")
def save():ledger.write_text(json.dumps({'target':TARGET,'actors':actors}))
def ok(name,cond,status=None):
 assert cond,'QA assertion failed: '+name
 checks.append({'check':name,'passed':True,'http_status':status})
def cookie(a):return 'sb-sitov-auth-token=base64-'+base64.urlsafe_b64encode(json.dumps(a['session'],separators=(',',':')).encode()).decode().rstrip('=')
if sys.argv[1]=='prepare':
 assert not ledger.exists() or json.loads(ledger.read_text()).get('cleaned') is True
 actors=[]
 for role in ['student','foreign','teacher','browser']:
  email=os.environ['SITOV_QA_BROWSER_EMAIL'] if role=='browser' else 'sitov-s5-e8-'+uuid.uuid4().hex+'@example.invalid'
  password=os.environ['SITOV_QA_BROWSER_PASSWORD'] if role=='browser' else secrets.token_hex(24)
  st,b,_=http(gateway+'/auth/v1/admin/users',keys['service'],{'email':email,'password':password,'email_confirm':True,'user_metadata':{'display_name':'Sitov QA Paul','native_language':'ru','ui_language':'ru'}});assert st==200;u=json.loads(b);a={'id':str(uuid.UUID(u['id'])),'email':email,'role':role};actors.append(a);save()
  st,b,_=http(gateway+'/auth/v1/token?grant_type=password',keys['anon'],{'email':email,'password':password});assert st==200;a['session']=json.loads(b);a['token']=a['session']['access_token'];save()
  if role=='teacher':sql("UPDATE public.profiles SET role='teacher' WHERE id='"+a['id']+"';SELECT '{}'::json;",a)
  else:sql("INSERT INTO public.student_level_access(auth_user_id,level) VALUES('"+a['id']+"','A1.1') ON CONFLICT DO NOTHING;SELECT '{}'::json;",a)
 print(json.dumps({'ready':True,'newActors':4,'target':TARGET,'productionWrite':False}))
else:
 state=json.loads(ledger.read_text());assert state['target']==TARGET;actors=state['actors'];own,foreign,teacher,browser=actors
 if sys.argv[1]=='cleanup':
  for a in actors:
   sql("DELETE FROM sitov_pronunciation_private.upload_tickets WHERE student_id='"+a['id']+"';DELETE FROM public.submissions WHERE auth_user_id='"+a['id']+"';SELECT '{}'::json;",a)
   st,_,_=http(gateway+'/auth/v1/admin/users/'+a['id'],keys['service'],method='DELETE');assert st==200
  ledger.write_text(json.dumps({'target':TARGET,'cleaned':True,'newAccounts':4,'uploads':0}));print(json.dumps({'onlyOwnCleanupPassed':True,'newAccounts':4,'uploads':0}))
 else:
  try:
   source=sql("SELECT jsonb_build_object('id',r.id,'text',r.sentence_de,'sha',o.user_metadata->>'audioSha256','timings',jsonb_array_length(o.user_metadata->'wordTimings')) FROM public.learning_reading_texts r JOIN sitov_pronunciation_private.pretest_definitions d ON d.text_id=r.id JOIN storage.objects o ON o.bucket_id='audio_cache' AND 'storage://audio_cache/'||o.name=r.audio_url WHERE d.active AND NOT EXISTS(SELECT 1 FROM sitov_pronunciation_private.pretest_passes p WHERE p.student_id='"+own['id']+"' AND p.definition_id=d.id) ORDER BY r.id LIMIT 1;",own)
   text=source['id'];sha=hashlib.sha256(re.sub(r'\s+',' ',unicodedata.normalize('NFC',source['text']).strip()).encode()).hexdigest()
   url='http://127.0.0.1:3143/api/sitov-audio?'+urllib.parse.urlencode({'reference':json.dumps({'kind':'reading_text','id':text,'part':'reference'},separators=(',',':')),'language':'de','textSha256':sha})
   st,b,h=http(url,cookie=cookie(own));ok('actual Next cookie reference denied before pass',st==404,st)
   start=rpc('sitov_start_pronunciation_pretest',own,{'p_text_id':text,'p_request_id':str(uuid.uuid4())});a=start['data']['attempt'];answers=sql("SELECT jsonb_object_agg(q->>'id',q->>'correctOptionId') FROM sitov_pronunciation_private.pretest_attempts a CROSS JOIN LATERAL jsonb_array_elements(a.tasks) q WHERE a.id='"+str(uuid.UUID(a['id']))+"' AND a.student_id='"+own['id']+"';",own)
   passed=rpc('sitov_submit_pronunciation_pretest',own,{'p_attempt_id':a['id'],'p_revision':a['revision'],'p_answers':answers,'p_request_id':str(uuid.uuid4())});ok('actual current individual pass',passed['data']['result']['passed'] is True,200)
   st,b,h=http(url,cookie=cookie(own));ok('actual Next cookie MP3 matches prepared hash',st==200 and len(b)>1000 and hashlib.sha256(b).hexdigest()==source['sha'],st)
   ok('source prepared word timings present',isinstance(source['timings'],int) and source['timings']>0)
   ok('audio private no-store and Cookie vary',h.get('cache-control')=='private, no-store, max-age=0' and 'Cookie' in h.get('vary','') and h.get('content-type')=='audio/mpeg',st)
   st,part,h=http(url,cookie=cookie(own),headers={'Range':'bytes=0-127'});ok('authenticated Range bytes reauthorized',st==206 and part==b[:128],st)
   st,_,_=http(url);ok('anonymous Next reference denied',st==401,st)
   st,_,_=http(url,cookie=cookie(foreign));ok('foreign Next reference denied',st==404,st)
   rpc('set_student_trainer_access',teacher,{'p_user_id':own['id'],'p_level':'A1.1','p_trainer':'pronunciation','p_enabled':False,'p_unit_ids':None,'p_replace_units':False})
   st,_,_=http(url,cookie=cookie(own));ok('revoked Next reference denied',st==404,st)
   st,_,_=http(url,cookie=cookie(own),headers={'Range':'bytes=0-127'});ok('revoked Range cannot reuse previous access',st==404,st)
   result={'passed':True,'target':TARGET,'checks':checks,'browserCookiesRead':False,'browserCookieInjected':False,'actualHTTPClientSessionCookie':True}
  except Exception as e:result={'passed':False,'target':TARGET,'checks':checks,'failure':str(e) if str(e).startswith('QA assertion failed:') else 'sanitized Next protocol failure','error_type':type(e).__name__}
  print(json.dumps(result,indent=2));sys.exit(0 if result['passed'] else 1)
