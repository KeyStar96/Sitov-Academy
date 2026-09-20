#!/usr/bin/env python3
"""Real nginx/Storage/TUS/RLS smoke test. Run on the backed-up VPS after deploy.
Creates two disposable .invalid Auth users (admin API, no email), own folder/files,
then removes only those IDs via Storage/Auth APIs. Never uses customer accounts.
"""
import base64,hashlib,http.client,json,os,secrets,subprocess,time,urllib.error,urllib.parse,urllib.request,uuid
DB='supabase-db-eknmzxvqilojjicinatnllbt'
BASE='http://127.0.0.1:8088/supabase'
c=json.loads(subprocess.check_output(['docker','inspect','supabase-storage-eknmzxvqilojjicinatnllbt']))[0]
env=dict(v.split('=',1) for v in c['Config']['Env'])
service=env['SERVICE_KEY'];anon=env.get('ANON_KEY') or env['SUPABASE_ANON_KEY']

def api(method,path,token=service,data=None,headers=None,raw=False):
    body=data if raw else (json.dumps(data).encode() if data is not None else None)
    h={'apikey':anon,'Authorization':'Bearer '+token,**({'Content-Type':'application/json'} if not raw else {}),**(headers or {})}
    req=urllib.request.Request(BASE+path,method=method,data=body,headers=h)
    try:
        with urllib.request.urlopen(req,timeout=120) as response:
            value=response.read();return response.status,response.headers,value
    except urllib.error.HTTPError as error:return error.code,error.headers,error.read()

def query(text):
    return subprocess.check_output(['docker','exec','-i',DB,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-At'],input=text,text=True).strip()

def expect(status,allowed,step):
    if status not in allowed:raise RuntimeError(step+' HTTP '+str(status))

users=[];paths=[];folder=str(uuid.uuid4());unit=str(uuid.uuid4());asset=str(uuid.uuid4());video=str(uuid.uuid4())
try:
    sessions=[]
    for role in ['teacher','student']:
        password=secrets.token_urlsafe(24)+'aA1!'
        email='phase2-storage-'+str(uuid.uuid4())+'@example.invalid'
        status,_,body=api('POST','/auth/v1/admin/users',data={'email':email,'password':password,'email_confirm':True,'user_metadata':{'display_name':'Phase2 Storage Test','ui_language':'ru','native_language':'ru'}})
        expect(status,[200,201],'test user');user=json.loads(body);users.append(user['id'])
        query("UPDATE public.profiles SET role='"+role+"' WHERE id='"+user['id']+"';")
        status,_,body=api('POST','/auth/v1/token?grant_type=password',token=anon,data={'email':email,'password':password})
        expect(status,[200],'test login');sessions.append(json.loads(body))
    staff,student=[s['access_token'] for s in sessions]
    status,_,_=api('POST','/rest/v1/lms_media_folder',token=staff,data={'folder_id':folder,'level':'A1.1','title':'Phase2 HTTP '+folder})
    expect(status,[201],'folder')
    status,_,_=api('POST','/rest/v1/learning_units',token=staff,data={'id':unit,'level':'A1.1','trainer':'videos','label':'Phase2 HTTP '+unit,'is_active':True})
    expect(status,[201],'unit')
    # A single request above the old32MiB nginx limit, with final DB quota enforcement.
    path='A1.1/'+folder+'/videos/'+video+'.mp4';paths.append(path)
    payload=b'\0'*(34*1024*1024)
    status,_,_=api('POST','/storage/v1/object/course-assets/'+path,token=staff,data=payload,headers={'Content-Type':'video/mp4'},raw=True)
    expect(status,[200,201],'34MiB upload')
    status,_,_=api('POST','/rest/v1/learning_videos',token=staff,data={'id':video,'unit_id':unit,'folder_id':folder,'title':'Phase2 upload','storage_path':path,'file_size':len(payload)})
    expect(status,[201],'video metadata')
    # Signed-link route turns inaccessible/nonexistent Storage files into HTTP403.
    # Matches lib/supabase-env.ts and @supabase/ssr's cookie chunking contract.
    session=sessions[1]
    encoded='base64-'+base64.urlsafe_b64encode(json.dumps(session,separators=(',',':')).encode()).decode().rstrip('=')
    cookie_name='sb-sitov-auth-token'
    chunks=[encoded[i:i+3180] for i in range(0,len(encoded),3180)]
    cookie='; '.join((cookie_name if len(chunks)==1 else cookie_name+'.'+str(i))+'='+part for i,part in enumerate(chunks))
    req=urllib.request.Request('http://127.0.0.1:3000/api/course-assets',method='POST',data=json.dumps({'path':path}).encode(),headers={'Content-Type':'application/json','Cookie':cookie})
    try:
        with urllib.request.urlopen(req,timeout=30) as response:denied=response.status
    except urllib.error.HTTPError as error:denied=error.code
    expect(denied,[403],'locked student signed URL')
    status,_,body=api('GET','/rest/v1/lms_media_folder?folder_id=eq.'+folder,token=student)
    expect(status,[200],'locked folder listing')
    if json.loads(body)!=[]:raise RuntimeError('Locked student saw folder metadata')
    # TUS upload interrupted after a6MiB chunk and resumed using HEAD offset.
    path2='A1.1/'+folder+'/presentations/'+asset+'.pdf';paths.append(path2)
    metadata=','.join(k+' '+base64.b64encode(v.encode()).decode() for k,v in {'bucketName':'course-assets','objectName':path2,'contentType':'application/pdf','cacheControl':'3600'}.items())
    status,h,_=api('POST','/storage/v1/upload/resumable',token=staff,data=b'',headers={'Tus-Resumable':'1.0.0','Upload-Length':str(len(payload)),'Upload-Metadata':metadata},raw=True)
    expect(status,[201],'TUS create')
    location=urllib.parse.urlsplit(h['Location']).path
    # API paths passed here are relative to the /supabase prefix.
    if location.startswith('/supabase/'):location=location[len('/supabase'):]
    offset=0
    while offset<len(payload):
        chunk=payload[offset:offset+6*1024*1024]
        status,h,_=api('PATCH',location,token=staff,data=chunk,headers={'Tus-Resumable':'1.0.0','Upload-Offset':str(offset),'Content-Type':'application/offset+octet-stream'},raw=True)
        expect(status,[204],'TUS chunk');offset=int(h['Upload-Offset'])
        status,h,_=api('HEAD',location,token=staff,headers={'Tus-Resumable':'1.0.0'})
        expect(status,[200,204],'TUS resume HEAD')
        if int(h['Upload-Offset'])!=offset:raise RuntimeError('TUS offset mismatch')
    status,_,_=api('POST','/rest/v1/lms_presentation_asset',token=staff,data={'asset_id':asset,'folder_id':folder,'file_name':'verification.pdf','storage_path':path2,'mime_type':'application/pdf','file_size':len(payload)})
    expect(status,[201],'presentation metadata')
    query("INSERT INTO public.student_level_access(auth_user_id,level) VALUES('"+users[1]+"','A1.1');")
    req=urllib.request.Request('http://127.0.0.1:3000/api/course-assets',method='POST',data=json.dumps({'path':path2}).encode(),headers={'Content-Type':'application/json','Cookie':cookie})
    with urllib.request.urlopen(req,timeout=30) as response:signed=json.loads(response.read())['url']
    signed_parts=urllib.parse.urlsplit(signed)
    if signed_parts.scheme!='https' or signed_parts.hostname in ['localhost','127.0.0.1']:
        raise RuntimeError('Signed URL is not browser-accessible')
    download=signed_parts.path.removeprefix('/supabase')+'?'+signed_parts.query
    status,_,downloaded=api('GET',download,token=student,headers={'Range':'bytes=0-1023'})
    expect(status,[206],'signed file range download')
    if downloaded!=payload[:1024]:raise RuntimeError('Signed download bytes differ')
    print(json.dumps({'standard_upload_bytes':len(payload),'tus_upload_bytes':offset,'tus_resume_verified':True,'locked_student_http_status':denied,'locked_folder_names':0,'unlocked_presentation_access':True,'signed_range_bytes':len(downloaded),'browser_url_verified':True}))
finally:
    if paths:
        status,_,_=api('DELETE','/storage/v1/object/course-assets',data={'prefixes':paths})
        expect(status,[200],'Storage cleanup')
    query("DELETE FROM public.learning_videos WHERE id='"+video+"'; DELETE FROM public.lms_media_folder WHERE folder_id='"+folder+"'; DELETE FROM public.learning_units WHERE id='"+unit+"';")
    for user in users:
        query("DELETE FROM public.people WHERE auth_user_id='"+user+"';")
        status,_,_=api('DELETE','/auth/v1/admin/users/'+user)
        expect(status,[200,204],'Auth cleanup')
    print('Disposable Storage/Auth fixtures removed.')
