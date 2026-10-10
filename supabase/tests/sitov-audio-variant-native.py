"""Opt-in bounded native115 rollback proof on the single assigned existing clone."""
import hashlib,importlib.util,json,os,re,subprocess,sys,unicodedata
from pathlib import Path
os.umask(0o077)
if os.environ.get('SITOV_AUDIO_VARIANT_NATIVE')!='1':raise SystemExit('Active M clone lease and SITOV_AUDIO_VARIANT_NATIVE=1 required')
root=Path(__file__).resolve().parents[2]
private=Path(os.environ['SITOV_AUDIO_VARIANT_EVIDENCE_DIR']);private.mkdir(parents=True,exist_ok=True)
def literal(s):return "'"+s.replace("'","''")+"'"
def sha(s):return hashlib.sha256(s.encode()).hexdigest()
def normalize(s):return re.sub(r'[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+',' ',unicodedata.normalize('NFC',s)).strip(' ')
profile=json.loads((root/'lib/audio/models/sitov-qwen-male-de/config.json').read_text());fp=sha(json.dumps(profile,sort_keys=True,separators=(',',':'),ensure_ascii=False))
registry=json.loads((root/'lib/audio/models/sitov-qwen-male-de/approved-variants.json').read_text())
variants={r['text']:r['variant']for r in registry['variants']}
def path(text,variant=True):
 spoken=normalize(text);identity={'text':spoken,'voice':profile['voice'],'rate':'qwen-native-1-lufs-18-aligned-v1','format':'audio-24khz-48kbitrate-mono-mp3','leadIn':.35,'profile':fp}
 if variant and spoken in variants:identity['variant']=variants[spoken]
 return 'sitov-qwen-v1/de/'+sha(json.dumps(identity,separators=(',',':'),ensure_ascii=False))+'.mp3'
inputs=list(variants)+[' \u00a0'+t+'\n 'for t in variants]+['Cafe\u0301','\ufeffdas\u202fHaus\u3000','Sind','sind.','Guten Morgen.']
rows=[{'label':t if i<6 else 'normalized:'+str(i),'input':t,'spoken':normalize(t),'expected':path(t),'legacy':path(t,False)}for i,t in enumerate(inputs)]
# Execute the actual frozen TS and Python identity independently, without a model.
env=os.environ.copy();env['TS_NODE_COMPILER_OPTIONS']=json.dumps({'module':'commonjs','moduleResolution':'node'})
node="const fs=require('fs');const {neuralAudioPath}=require('./lib/audio/neural-identity');const rows=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(rows.map(r=>({...r,path:neuralAudioPath(r.text,r.language)}))))"
cases=[{'text':t,'language':'de'}for t in inputs]+[{'text':t,'language':lang}for lang in ['en','ru','uk','tr']for t in variants]
r=subprocess.run(['node','-r','ts-node/register/transpile-only','-e',node],cwd=root,env=env,input=json.dumps(cases),text=True,capture_output=True,timeout=8);assert r.returncode==0,r.stderr;ts=json.loads(r.stdout)
spec=importlib.util.spec_from_file_location('sitov_audio_import',root/'deploy/vps/import-sitov-qwen-audio.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
for row in ts:
 if row['language']=='de':assert row['path']==module.expected_path(row['text'],profile,fp)==path(row['text'])
voices={'en':'en_US-ljspeech-high','ru':'ru_RU-denis-medium','uk':'uk_UA-ukrainian_tts-medium-speaker2','tr':'espeak-ng-tr'}
for row in ts:
 if row['language']!='de':
  identity={'text':normalize(row['text']),'voice':voices[row['language']],'rate':'piper-length-1-espeak-145-word-timings','format':'audio-24khz-48kbitrate-mono-mp3'}
  assert row['path']=='piper-local-v2/'+row['language']+'/'+sha(json.dumps(identity,separators=(',',':'),ensure_ascii=False))+'.mp3'
(private/'epoch67-identity-record.json').write_text(json.dumps({'profileFingerprint':fp,'goldens':rows,'actualTS':ts,'pythonGermanParity':True,'foreignUnchanged':True},ensure_ascii=False,indent=2)+'\n')
args=['ssh','-o','BatchMode=yes','-o','ConnectTimeout=3','sitov-academy','docker','exec','-i','sitov-night-20261008-qa-db','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','sitov_night_migration_rehearsal_20261009']
affected=sorted({v for row in rows for v in[row['expected'],row['legacy']]})
storage_query="BEGIN READ ONLY;SET LOCAL application_name='sitov_S3_epoch67_storage';SET LOCAL statement_timeout='4s';SELECT row_to_json(o)::text FROM storage.objects o WHERE bucket_id='audio_cache' AND name IN("+','.join(map(literal,affected))+") ORDER BY id;COMMIT;"
def storage(label):
 r=subprocess.run(args,input=storage_query,text=True,capture_output=True,timeout=10);(private/('epoch67-storage-'+label+'.stderr')).write_text(r.stderr);assert r.returncode==0,r.stderr;(private/('epoch67-storage-'+label+'.jsonl')).write_text(r.stdout);return r.stdout
before=storage('before')
sql115=(root/'supabase/vps/115_sitov_prepared_audio_variants.sql').read_text();old=re.search(r'previous constant text:=\$old\$(.*?)\$old\$',sql115,re.S).group(1);new=re.search(r'current_identity constant text:=\$new\$(.*?)\$new\$',sql115,re.S).group(1)
fixture=Path(__file__).with_suffix('.sql').read_text().replace('-- SITOV67_APPLY115',sql115).replace('-- SITOV67_REPLAY115',sql115).replace(':SITOV67_OLD',literal(old)).replace(':SITOV67_NEW',literal(new))
goldens='CREATE TEMP TABLE sitov67_goldens(label text,input text,spoken text,expected text,legacy text);\nINSERT INTO sitov67_goldens VALUES '+','.join('('+','.join(literal(row[k])for k in['label','input','spoken','expected','legacy'])+')'for row in rows)+';'
fixture=fixture.replace('-- SITOV67_GOLDENS',goldens)
negative=[];target=rows[0]['expected']
mutations={'wrong_voice':"user_metadata=jsonb_set(user_metadata,'{voice}','\"wrong\"')",'wrong_profile':"user_metadata=jsonb_set(user_metadata,'{profileFingerprint}','\"wrong\"')",'wrong_text':"user_metadata=jsonb_set(user_metadata,'{textSha256}','\"wrong\"')",'wrong_audio_hash':"user_metadata=jsonb_set(user_metadata,'{audioSha256}','\"wrong\"')",'wrong_mime':"metadata=jsonb_set(metadata,'{mimetype}','\"audio/wav\"')",'zero_size':"metadata=jsonb_set(metadata,'{size}','0')",'empty_timings':"user_metadata=jsonb_set(user_metadata,'{wordTimings}','[]')",'reversed_timings':"user_metadata=jsonb_set(user_metadata,'{wordTimings}','[{\"start\":1,\"end\":0.5}]')"}
for label,mutation in mutations.items():
 query=("UPDATE storage.objects SET "+mutation+" WHERE bucket_id='audio_cache' AND name="+literal(target)+";" if mutation else "UPDATE storage.objects SET name='sitov-qa67-missing/'||id::text||'.mp3' WHERE bucket_id='audio_cache' AND name="+literal(target)+";")+"SELECT vocabulary_private.sitov_prepared_german_audio_url('sind');"
 negative.append("SELECT pg_temp.sitov67_error("+literal(label)+","+literal(query)+",'22023','prepared_audio_required');")
fixture=fixture.replace('-- SITOV67_NEGATIVE_METADATA','\n'.join(negative))
unknown="DO $bad$ BEGIN EXECUTE replace(pg_get_functiondef('vocabulary_private.sitov_prepared_german_audio_url(text)'::regprocedure),"+literal(new)+","+literal(" cache_path := 'invalid';")+");END $bad$;\n"+sql115
fixture=fixture.replace('-- SITOV67_UNKNOWN_BASELINE',"SELECT pg_temp.sitov67_error('unknown_baseline',"+literal(unknown)+",'P0001','sitov_audio_variant_identity_contract_changed');")
sql="BEGIN;SET LOCAL application_name='sitov_S3_epoch67_native';SET LOCAL statement_timeout='5s';SET LOCAL lock_timeout='1500ms';\n"+(root/'supabase/vps/113_sitov_staff_legacy_verb_scope.sql').read_text()+(root/'supabase/vps/114_sitov_path_content_revisions.sql').read_text()+fixture
(private/'epoch67-native-private.sql').write_text(sql)
r=subprocess.run(args,input=sql,text=True,capture_output=True,timeout=25);(private/'epoch67-native.stdout').write_text(r.stdout);(private/'epoch67-native.stderr').write_text(r.stderr)
after=storage('after');result={'nativeExitCode':r.returncode,'storageRows':len(before.splitlines()),'storageBeforeSha256':sha(before),'storageAfterSha256':sha(after),'storageFullRowsExact':before==after,'fixtureAssetsAreSyntheticMetadataOnly':True,'originalAffectedPaths':len(affected),'sqlSourceSha256':sha(sql115),'sourceHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'sql114Sha256':sha((root/'supabase/vps/114_sitov_path_content_revisions.sql').read_text()),'driverSha256':sha(Path(__file__).read_text()),'full185ProtectedStreamRun':False}
(private/'epoch67-driver-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result));print(r.stdout[-1200:]);print(r.stderr[-2200:]);assert r.returncode==0,r.stderr[-2000:];assert before==after
