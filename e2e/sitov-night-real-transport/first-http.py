"""Actual test-only GoTrue password sessions and REST/RPC; never emits keys/IDs."""
import json,sys,secrets,urllib.request,urllib.error,hmac,hashlib,base64,uuid
from pathlib import Path
from runtime import scope,health
TARGET='67bc5dfb711df423423d252c1b119c368616c57a'
assert len(sys.argv)==3 and sys.argv[1]=='--ready-target' and sys.argv[2]==TARGET,'M READY target required'
root=Path('/tmp/sitov-night-20261008-qa-master')
assert root.is_dir() and root.stat().st_mode&0o077==0
keys=json.loads((root/'test-keys.json').read_text())
auth_env=dict(line.split('=',1) for line in (root/'auth.env').read_text().splitlines() if '=' in line)
url,_=scope();checks=[];created=[];cleanup=[]
def request(path,token,body=None,method=None):
 req=urllib.request.Request(url+path,data=None if body is None else json.dumps(body).encode(),
  headers={'Authorization':'Bearer '+token,'apikey':keys['anon'],'Content-Type':'application/json'},
  method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=5) as r:return r.status,json.loads(r.read() or 'null')
 except urllib.error.HTTPError as error:
  try:data=json.loads(error.read())
  except Exception:data={}
  return error.code,data
def passed(name,condition):
 assert condition,'QA check failed: '+name
 checks.append({'check':name,'passed':True})
try:
 before=health()
 for character in ['Paul','Tim']:
  email='sitov-s5-'+uuid.uuid4().hex+'@example.invalid';password=secrets.token_hex(24)
  status,user=request('/auth/v1/admin/users',keys['service'],{'email':email,'password':password,'email_confirm':True,
   'user_metadata':{'display_name':'Sitov QA '+character,'native_language':'ru','ui_language':'ru'}})
  passed('actual GoTrue admin-created .invalid account '+character,status==200 and user.get('email')==email)
  created.append(user['id'])
  status,session=request('/auth/v1/token?grant_type=password',keys['anon'],{'email':email,'password':password})
  passed('actual password sign-in '+character,status==200 and bool(session.get('access_token')))
  token=session['access_token'];a,b,c=token.split('.')
  expected=base64.urlsafe_b64encode(hmac.new(auth_env['GOTRUE_JWT_SECRET'].encode(),(a+'.'+b).encode(),hashlib.sha256).digest()).decode().rstrip('=')
  claims=json.loads(base64.urlsafe_b64decode(b+'='*((4-len(b)%4)%4)))
  passed('real signed learner JWT '+character,hmac.compare_digest(c,expected) and claims['sub']==user['id'] and claims['role']=='authenticated')
  user['token']=token
  if character=='Paul':own=user
  else:foreign=user
 status,profiles=request('/rest/v1/profiles?select=id,role,ui_language',own['token'])
 passed('REST own profile only / real authenticated RLS',status==200 and len(profiles)==1 and profiles[0]['id']==own['id'] and profiles[0]['role']=='student')
 status,profiles=request('/rest/v1/profiles?select=id&id=eq.'+foreign['id'],own['token'])
 passed('REST foreign profile invisible',status==200 and profiles==[])
 status,context=request('/rest/v1/rpc/get_sitov_access_context',own['token'],{})
 passed('own commercial context',status==200 and context.get('vip_enabled') is False and context.get('purchased_levels')==[])
 status,result=request('/rest/v1/rpc/get_sitov_access_context',own['token'],{'p_student':foreign['id']})
 passed('foreign context forbidden',status==200 and result.get('error')=='forbidden')
 status,result=request('/rest/v1/rpc/set_sitov_student_vip',own['token'],{'p_student':own['id'],'p_enabled':True,'p_expected_revision':0})
 passed('learner cannot grant VIP / direct RPC',status==200 and result.get('error')=='forbidden')
 status,result=request('/rest/v1/rpc/get_sitov_access_context',own['token'],{})
 passed('forbidden VIP RPC preserves rights',status==200 and result==context)
 status,result=request('/rest/v1/rpc/get_sitov_access_context',keys['anon'],{})
 passed('anonymous access-context RPC denied',status in [401,403])
 status,result=request('/storage/v1/bucket',own['token'])
 passed('learner cannot enumerate private QA buckets',status==200 and result==[])
 result={'passed':True,'target':TARGET,'checks':checks,'health':before,'transport':'actual private Docker HTTP; no Next/browser or text-pass proof'}
except Exception as error:
 result={'passed':False,'target':TARGET,'checks':checks,'error_type':type(error).__name__,'failure':str(error) if str(error).startswith('QA check failed:') else 'sanitized actual transport failure'}
finally:
 for uid in created:
  status,_=request('/auth/v1/admin/users/'+uid,keys['service'],method='DELETE')
  cleanup.append(status in [200,204])
 result['only_new_accounts_cleaned']=len(cleanup)==len(created) and all(cleanup)
 print(json.dumps(result,indent=2))
 if not result['passed'] or not result['only_new_accounts_cleaned']:sys.exit(1)
