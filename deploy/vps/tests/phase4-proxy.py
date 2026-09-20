#!/usr/bin/env python3
"""Run from outside the VPS. Exercise real public login actions without a user.
No emails, accounts or bookings are created. Prints only boolean assertions.
"""
import hashlib,json,subprocess,urllib.request,urllib.parse,uuid
from html.parser import HTMLParser
ORIGIN='https://217.154.228.254'
class Form(HTMLParser):
    def __init__(self):super().__init__();self.action=None
    def handle_starttag(self,tag,attrs):
        value=dict(attrs).get('name','')
        if tag=='input' and value.startswith('$ACTION_ID_'):self.action=value
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args):return None
def buckets():
    query="SELECT COALESCE(json_object_agg(key_hash,count),'{}') FROM platform_private.rate_limits"
    return json.loads(subprocess.check_output(['ssh','sitov-academy','docker exec supabase-db-eknmzxvqilojjicinatnllbt psql -X -U supabase_admin -d postgres -At -c '+"'"+query.replace("'","'\\''")+"'"],text=True))
form=Form();form.feed(urllib.request.urlopen(ORIGIN+'/de/login').read().decode());assert form.action
boundary='phase4-'+uuid.uuid4().hex
fields={form.action:'', 'lang':'de','email':'phase4-invalid-login@example.test','password':'not-a-real-user-password'}
payload=(''.join(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n' for name,value in fields.items())+f'--{boundary}--\r\n').encode()
def attempt(extra):
    request=urllib.request.Request(ORIGIN+'/de/login',data=payload,headers={'Origin':ORIGIN,'Content-Type':'multipart/form-data; boundary='+boundary,**extra})
    try:response=urllib.request.build_opener(NoRedirect()).open(request)
    except urllib.error.HTTPError as error:response=error
    assert response.status==303,(response.status,'login_action_failed')
    assert 'status=login_failed' in response.headers.get('Location',''),'unexpected_auth_result'
before=buckets();attempt({});first=buckets()
changed=[key for key,value in first.items() if before.get(key)!=value]
assert len(changed)==1,'concurrent_request_or_missing_limiter'
key=changed[0]
attempt({'X-Forwarded-For':'1.2.3.4','X-Real-IP':'5.6.7.8','X-Nf-Client-Connection-Ip':'9.8.7.6'})
second=buckets();assert second.get(key)==first[key]+1,'spoof_changed_bucket'
assert {k:v for k,v in second.items() if k!=key}=={k:v for k,v in first.items() if k!=key},'unexpected_second_bucket'
for invalid in ['unknown','unbekannt','1.2.3.4','5.6.7.8','9.8.7.6','10.0.1.2','10.0.2.5','127.0.0.1']:
    assert key!=hashlib.sha256(f'auth:login:{invalid}:10:300000'.encode()).hexdigest(),'fallback_or_proxy_bucket'
print('PASS: public HTTPS login uses one real-client bucket; forged XFF/Real-IP/Netlify headers do not alter it.')
