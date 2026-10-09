import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createSitovIntegrated96NativeDatabase} from './helpers/sitov-night-integrated96-native-db.mjs'
import {SitovNativeDatabase} from './helpers/sitov-night-current-native-db.mjs'
import {sitovId,sitovUsers,sitovHistorySnapshot} from './helpers/sitov-night-current-db.mjs'
const sql=await readFile(new URL('../migrations/20261009001000_sitov_storage_proof_compatibility.sql',import.meta.url),'utf8')
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`
const hash=t=>createHash('sha256').update(t).digest('hex')
const fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const signatures=['vocabulary_private.sitov_prepared_german_audio_url(text)','sitov_pronunciation_private.reference_valid(text,text,sitov_pronunciation_private.pretest_approvals)','sitov_pronunciation_private.public_audio_ready(uuid,text,jsonb)','sitov_special_private.definition_ready(sitov_special_private.definitions)']
test('97 supports concrete vendor and extended Storage rows without weakening four asset guards',async t=>{
 const name=`sitov_night_storage97_${process.pid}_${Date.now()}`,admin=new SitovNativeDatabase();admin.raw(`CREATE DATABASE ${name}`)
 let db
 try{
  db=await createSitovIntegrated96NativeDatabase({database:name});await db.actor(null,'postgres')
  // Only this disposable DB gets the remaining real vendor column. Frozen fixture stays byte-identical.
  await db.exec('ALTER TABLE storage.objects ADD COLUMN path_tokens text[] GENERATED ALWAYS AS(string_to_array(name,\'/\')) STORED')
  const originalHistory=await sitovHistorySnapshot(db)
  const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='storage' AND table_name='objects' ORDER BY column_name")).rows.map(r=>r.column_name)
  assert.deepEqual(columns,['bucket_id','created_at','id','last_accessed_at','metadata','name','owner','owner_id','path_tokens','updated_at','user_metadata','version'])
  const attrs=()=>db.query(`SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid IN(${signatures.map(s=>`'${s}'::regprocedure`).join(',')}) ORDER BY oid`)
  const before=(await attrs()).rows
  const asset=async text=>{const spoken=(await db.query('SELECT vocabulary_private.sitov_normalize_audio_text($1) spoken',[text])).rows[0].spoken,path='sitov-qwen-v1/de/'+hash(JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:0.35,profile:fingerprint}))+'.mp3',metadata={engine:'qwen3-tts',voice:'sitov-qwen-male-de-v1',revision:'sitov-qwen-base-bf16-v1',profileFingerprint:fingerprint,textSha256:hash(spoken),audioSha256:'a'.repeat(64),wordTimings:spoken.split(' ').map((_,i)=>({start:i,end:i+.5}))};await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('audio_cache','${path}','{"mimetype":"audio/mpeg","size":1000}',${literal(metadata)}) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata`);return{spoken,path,metadata}}
  const body='Paul geht nach Hause.',reference=await asset(body)
  await t.test('actual missing-column error reproduced;97 replays preserving OIDs/ACLs/flags and private96 path',async()=>{
   await assert.rejects(db.query('SELECT vocabulary_private.sitov_prepared_german_audio_url($1)',[body]),/archived_at/)
   assert.equal(sql,await readFile(new URL('../../supabase/vps/97_sitov_storage_proof_compatibility.sql',import.meta.url),'utf8'))
   await db.exec(sql);await db.exec(sql);assert.deepEqual((await attrs()).rows,before)
   assert.equal((await db.query('SELECT vocabulary_private.sitov_prepared_german_audio_url($1) value',[body])).rows[0].value,'storage://audio_cache/'+reference.path)
  })
  const definition=structuredClone(JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-pretests-2026-10-08.json',import.meta.url),'utf8')).drafts[0].definition);definition.tasks[0].fragmentDe='Paul spricht Deutsch.'
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition) VALUES('${sitovId(302)}','${hash(body)}',repeat('a',64),${literal(definition)})`)
  const d=(await db.query('SELECT id,test_version FROM sitov_pronunciation_private.pretest_definitions')).rows[0]
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_approvals(definition_id,text_version,test_version,author_identity,reviewer_identity,review_status,reviewed_at,review_document_ref,review_document_sha256,reference_kind,reference_bucket,reference_path,reference_audio_sha256) VALUES('${d.id}','${hash(body)}','${d.test_version}','sitov.qa.author','sitov.qa.editor','independent_approved',now(),'sitov.editorial.review.synthetic97',repeat('b',64),'prepared_qwen','audio_cache','${reference.path}',repeat('a',64))`)
  const publicTexts=(await db.query('SELECT sitov_pronunciation_private.public_audio_texts($1) spoken',[definition])).rows.map(r=>r.spoken),assets=[]
  for(const text of publicTexts)assets.push(await asset(text))
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_question_audio_proofs(definition_id,test_version,text_sha256,path,audio_sha256,word_timings_sha256) VALUES ${assets.map(a=>`('${d.id}','${d.test_version}','${hash(a.spoken)}','${a.path}',repeat('a',64),(SELECT sitov_pronunciation_private.pretest_hash((user_metadata->'wordTimings')::text) FROM storage.objects WHERE bucket_id='audio_cache' AND name='${a.path}'))`).join(',')}`)
  const refReady=async()=> (await db.query('SELECT sitov_pronunciation_private.reference_valid($1,NULL,a) value FROM sitov_pronunciation_private.pretest_approvals a WHERE definition_id=$2',[body,d.id])).rows[0].value
  const questionsReady=async()=> (await db.query('SELECT sitov_pronunciation_private.public_audio_ready($1,$2,$3) value',[d.id,d.test_version,definition])).rows[0].value
  // Actual Special snapshot/source/reviewer proof, in a disposable synthetic DB only.
  const anchor=sitovId(9701),node=sitovId(9702),exercise=sitovId(9703)
  await db.exec(`INSERT INTO public.learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES('${sitovId(9705)}','A1.1','exercises','Sitov QA Nominativ',97,true,'sitov.qa.storage97','sitov-qa-storage97','Sitov QA Nominativ');
   INSERT INTO public.path_objectives(unit_id,id,area,description) VALUES('${sitovId(9705)}','sitov.qa.core','grammar','Das Subjekt erkennen.');
   INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,merkkarte) VALUES('${anchor}','${sitovId(9705)}','sitov.qa.storage97.anchor','practice',1,'Sitov QA Nominativ','Nominativ',ARRAY['sitov.qa.core'],'{"rule":"Das Subjekt nennt die Person.","examples":["Paul geht."]}');
   INSERT INTO public.path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,goals,anchor_node_id) VALUES('${node}','${sitovId(9705)}','sitov.qa.storage97.special','special',2,'Sitov QA Special','Nominativ',ARRAY['sitov.qa.core'],'${anchor}');
   INSERT INTO public.learning_exercises(id,unit_id,node_id,goal_id,topic,type,content) VALUES('${exercise}','${sitovId(9705)}','${node}','sitov.qa.core','Nominativ','multiple_choice','{"question":"Wer geht?","options":["Paul","Leon","Jan"],"correct_answer":"Paul","accepted_answers":["Paul"],"target_form":["Paul"]}');
   INSERT INTO sitov_special_private.sources VALUES('sitov.qa.storage97',repeat('c',64),'A1.1','catalog:sitov.qa.storage97',true)`)
  const snapshot=(await db.query('SELECT path_private.snapshot($1) value',[exercise])).rows[0].value,pool=[{id:exercise,stratum:'sitov.qa.core',snapshot}],blueprint={'sitov.qa.core':1},version=(await db.query('SELECT sitov_special_private.definition_fingerprint($1,$2,$3,$4) value',[node,'sitov.qa.storage97',blueprint,pool])).rows[0].value
  await db.actor(sitovUsers.teacher,'postgres');await db.exec(`INSERT INTO sitov_special_private.approvals(node_id,version,source_ref,source_sha256,reviewed_by) VALUES('${node}','${version}','sitov.qa.storage97',repeat('c',64),'${sitovUsers.teacher}')`);await db.actor(null,'postgres')
  const reviewId=(await db.query('SELECT id FROM sitov_special_private.approvals WHERE node_id=$1',[node])).rows[0].id,specialAssets=[]
  for(const row of (await db.query('SELECT spoken FROM sitov_special_private.audible_texts($1)',[pool])).rows)specialAssets.push(await asset(row.spoken))
  const special={id:sitovId(9704),node_id:node,source_ref:'sitov.qa.storage97',version,blueprint,pool,published:true,editorial_proof:{reviewId,definitionVersion:version,sourceSha256:'c'.repeat(64)},audio_import_proof:{definitionVersion:version,assets:specialAssets.map(a=>({textSha256:hash(a.spoken),path:'storage://audio_cache/'+a.path,audioSha256:a.metadata.audioSha256}))}}
  const specialReady=async value=>(await db.query('SELECT sitov_special_private.definition_ready(jsonb_populate_record(NULL::sitov_special_private.definitions,$1)) value',[value??special])).rows[0].value
  await t.test('minimal vendor rows pass actual reference/public prompt-fragment-options/Special proof paths',async()=>{
   assert.equal(await refReady(),true);assert.equal(await questionsReady(),true);assert.equal(await specialReady(),true)
   await db.exec(sql);assert.equal(await specialReady(),true);assert.deepEqual(await sitovHistorySnapshot(db),originalHistory)
  })
  await t.test('minimal schema keeps profile/hash/timing/object identity/private proof strict',async()=>{
   const q=assets.find(a=>a.spoken===definition.tasks[0].promptDe)
   for(const delta of [{voice:'wrong-profile'},{textSha256:'0'.repeat(64)},{audioSha256:'d'.repeat(64)},{wordTimings:[]}]){await db.exec(`UPDATE storage.objects SET user_metadata=${literal({...q.metadata,...delta})} WHERE name='${q.path}'`);assert.equal(await questionsReady(),false);await db.exec(`UPDATE storage.objects SET user_metadata=${literal(q.metadata)} WHERE name='${q.path}'`)}
   await assert.rejects(db.exec(`UPDATE storage.objects SET name='sitov.qa.missing.mp3' WHERE name='${q.path}'`),/sitov_storage_path_is_immutable/);await db.exec(`DELETE FROM storage.objects WHERE name='${q.path}'`);assert.equal(await questionsReady(),false);await asset(q.spoken)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.public_audio_ready($1,$2,$3) value',[d.id,'0'.repeat(64),definition])).rows[0].value,false)
   const wrong=structuredClone(special);wrong.audio_import_proof.assets[0].path='storage://audio_cache/sitov-qwen-v1/de/'+('0'.repeat(64))+'.mp3';assert.equal(await specialReady(wrong),false)
   assert.equal(await questionsReady(),true);assert.equal(await specialReady(),true)
  })
  await t.test('optional extended archive/delete flags independently deny reference/prompt/fragment/option/Special',async()=>{
   await db.exec('ALTER TABLE storage.objects ADD COLUMN archived_at timestamptz;ALTER TABLE storage.objects ADD COLUMN is_delete_marker boolean')
   assert.equal(await refReady(),true);assert.equal(await questionsReady(),true);assert.equal(await specialReady(),true)
   const checked=[{a:reference,ready:refReady},...['prompt','fragment','option'].map(kind=>({a:assets.find(a=>a.spoken===(kind==='prompt'?definition.tasks[0].promptDe:kind==='fragment'?definition.tasks[0].fragmentDe:definition.tasks[0].options[1].textDe)),ready:questionsReady})),{a:specialAssets[0],ready:specialReady}]
   for(const {a,ready} of checked)for(const marker of ['archived_at=now()','is_delete_marker=true']){await db.exec(`UPDATE storage.objects SET ${marker} WHERE name='${a.path}'`);assert.equal(await ready(),false);await db.exec(`UPDATE storage.objects SET archived_at=NULL,is_delete_marker=false WHERE name='${a.path}'`);assert.equal(await ready(),true)}
   await db.exec('ALTER TABLE storage.objects DROP COLUMN archived_at;ALTER TABLE storage.objects DROP COLUMN is_delete_marker');await db.exec(sql);assert.equal(await refReady(),true);assert.equal(await questionsReady(),true);assert.equal(await specialReady(),true)
  })
  await t.test('private predicate cannot be invoked by application roles; malformed optional flags fail closed',async()=>{
   for(const value of [null,[],{archived_at:''},{is_delete_marker:'false'},{is_delete_marker:0},{is_delete_marker:true}])assert.equal((await db.query('SELECT sitov_storage_private.sitov_object_is_current($1) value',[value])).rows[0].value,false)
   for(const value of [{},{archived_at:null,is_delete_marker:null},{is_delete_marker:false}])assert.equal((await db.query('SELECT sitov_storage_private.sitov_object_is_current($1) value',[value])).rows[0].value,true)
   for(const role of ['anon','authenticated','service_role']){await db.actor(null,role);await assert.rejects(db.query('SELECT sitov_storage_private.sitov_object_is_current($1)',[{}]),/permission denied/)}await db.actor(null,'postgres')
   assert.deepEqual((await attrs()).rows,before);assert.deepEqual(await sitovHistorySnapshot(db),originalHistory)
  })
 }finally{await db?.close();admin.raw(`DROP DATABASE ${name} WITH(FORCE)`)}
})
