"""Future M-frozen bundle only. Real vendor schemas stay intact. No QA stubs."""
import json,sys,hashlib,re,subprocess,time,urllib.request
from pathlib import Path
root=Path(sys.argv[1]).resolve()
m=json.loads((root/'manifest.json').read_text())
assert m['target']=='integrated96' and re.fullmatch(r'[0-9a-f]{40}',m['integrated_sha']),'M integrated96 freeze missing'
assert m['baseline_source_sha']=='e22c73883356e61700ed57f3cfeb601f9bf55b32'
assert [x['role'] for x in m['files']]==['baseline_schema','baseline_lookups','migration93','migration94','migration95','migration96']
sources=[]
for entry in m['files']:
 assert re.fullmatch(r'[a-zA-Z0-9_-]+\.sql',entry['path']),'relative SQL basenames only'
 assert re.fullmatch(r'[0-9a-f]{40}',entry['source_sha']),'exact source SHA required'
 data=(root/entry['path']).read_bytes()
 assert hashlib.sha256(data).hexdigest()==entry['sha256'],'bundle checksum mismatch'
 sql=data.decode()
 assert not re.search(r'CREATE\s+(?:OR\s+REPLACE\s+)?(?:SCHEMA\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:auth|storage)\b|FUNCTION\s+(?:auth|storage)\.)',sql,re.I),'vendor schema/function substitute forbidden'
 sources.append(sql)
assert m['files'][0]['sha256']=='c6b90f3bb5527ae6d36d0336c84afd7c5549a5e16d9f79af245d21c0fb8b5cfe'
assert m['files'][1]['sha256']=='9e19b140bc5ae9b0585cadb3e97a0691a4c04717dce62959682c689e985e1803'
keys=json.loads(Path('test-keys.json').read_text())
deadline=time.monotonic()+60
while True:
 try:
  urllib.request.urlopen(keys['url']+'/auth/v1/health',timeout=3).read(4096)
  break
 except Exception:
  if time.monotonic()>deadline:raise RuntimeError('real Auth health unverified')
  time.sleep(1)
for name in ['pronunciation_audio','audio_submissions','audio_cache','lms-media']:
 req=urllib.request.Request(keys['url']+'/storage/v1/bucket',data=json.dumps({'id':name,'name':name,'public':False}).encode(),
  headers={'Authorization':'Bearer '+keys['service'],'apikey':keys['service'],'Content-Type':'application/json'},method='POST')
 urllib.request.urlopen(req,timeout=10).read(4096)
def sql(statement):
 p=subprocess.run(['docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True)
 if p.returncode:raise RuntimeError('isolated SQL failed; inspect private diagnostics locally, never dump keys/data')
sql("DO $$ BEGIN IF to_regclass('storage.objects') IS NULL OR to_regclass('auth.users') IS NULL OR EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') THEN RAISE EXCEPTION 'vendor_not_ready_or_public_not_empty'; END IF; END $$;")
baseline=sources[0]
assert baseline.count('CREATE SCHEMA public;')==1
assert baseline.count('-- PostgreSQL database dump complete')==1
baseline=baseline.replace('CREATE SCHEMA public;','CREATE SCHEMA IF NOT EXISTS public;')
baseline=baseline.replace('-- PostgreSQL database dump complete','-- PostgreSQL database dump complete\n'+sources[1])
sql('BEGIN; SET LOCAL ROLE postgres;\n'+baseline+'\nCOMMIT;')
for index,statement in enumerate(sources[2:],93):
 sql('BEGIN; SET LOCAL ROLE supabase_admin;\n'+statement+'\nCOMMIT;')
 print('Applied exact frozen QA migration',index)
sql("CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION business_private.provision_profile(); NOTIFY pgrst,'reload schema';")
Path('applied-bundle-metadata.json').write_text(json.dumps({'integrated_sha':m['integrated_sha'],'files':m['files'],'vendor_preserved':True},indent=2))
print('Isolated bundle installed; actual .invalid learner sign-in/JWT/RLS/Storage/browser proofs remain separate')
