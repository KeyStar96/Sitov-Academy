import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createSitovIntegrated96NativeDatabase} from './helpers/sitov-night-integrated96-native-db.mjs'
import {SitovNativeDatabase} from './helpers/sitov-night-current-native-db.mjs'
import {sitovId,sitovUsers,sitovHistorySnapshot} from './helpers/sitov-night-current-db.mjs'
import {sitovReadAuthoringSources} from '../../scripts/sitov-pronunciation-pretests-authoring.mjs'
const sql=await readFile(new URL('../migrations/20261009004000_sitov_pretest_staff_drafts.sql',import.meta.url),'utf8'),sql97=await readFile(new URL('../migrations/20261009001000_sitov_storage_proof_compatibility.sql',import.meta.url),'utf8')
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`,hash=t=>createHash('sha256').update(t).digest('hex'),fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const drafts=JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-pretests-2026-10-08.json',import.meta.url),'utf8')).drafts,sources=await sitovReadAuthoringSources()
const sql99=await readFile(new URL('../migrations/20261009003000_sitov_readonly_audio_proofs.sql',import.meta.url),'utf8')
const sql98=await readFile(new URL('../migrations/20261009002000_sitov_pretest_option_presentation.sql',import.meta.url),'utf8')
test('100 saves source-bound immutable staff drafts with real staff/CAS/receipt protections',async t=>{
 const name=`sitov_night_drafts100_${process.pid}_${Date.now()}`,admin=new SitovNativeDatabase();admin.raw(`CREATE DATABASE ${name}`);let db
 try{
  db=await createSitovIntegrated96NativeDatabase({database:name});await db.actor(null,'postgres');await db.exec(sql97);await db.exec(sql98);await db.exec(sql99)
  const history=await sitovHistorySnapshot(db),draft=drafts[0],definition=draft.definition,body=sources.rows.find(s=>s.id===draft.textId).text,textId=sitovId(98302)
  const rpc=async(name,args)=>(await db.query(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value
  let serial=98400;const request=()=>sitovId(serial++)
  const seedAsset=async text=>{const spoken=(await db.query('SELECT vocabulary_private.sitov_normalize_audio_text($1) value',[text])).rows[0].value,path='sitov-qwen-v1/de/'+hash(JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:.35,profile:fingerprint}))+'.mp3',metadata={engine:'qwen3-tts',voice:'sitov-qwen-male-de-v1',revision:'sitov-qwen-base-bf16-v1',profileFingerprint:fingerprint,textSha256:hash(spoken),audioSha256:'a'.repeat(64),wordTimings:spoken.split(' ').map((_,i)=>({start:i,end:i+.5}))};await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('audio_cache','${path}','{"mimetype":"audio/mpeg","size":1000}',${literal(metadata)}) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata`);return{spoken,path}}
  await db.exec(`INSERT INTO learning_units(id,level,trainer,label,sort_order) VALUES('${sitovId(233)}','A1.1','pronunciation','Sitov QA pronunciation 3',3);INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES('${textId}','${sitovId(232)}','${body.replaceAll("'","''")}'),('${sitovId(98303)}','${sitovId(233)}','${body.replaceAll("'","''")}');INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition) VALUES('${textId}','${draft.textVersion}',repeat('a',64),${literal(definition)})`)
  const d=(await db.query('SELECT id,text_version,test_version,definition FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=$1',[textId])).rows[0],ref=await seedAsset(body)
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_approvals(definition_id,text_version,test_version,author_identity,reviewer_identity,review_status,reviewed_at,review_document_ref,review_document_sha256,reference_kind,reference_bucket,reference_path,reference_audio_sha256) VALUES('${d.id}','${d.text_version}','${d.test_version}','sitov.qa.author','sitov.qa.editor','independent_approved',now(),'sitov.editorial.review.synthetic98',repeat('b',64),'prepared_qwen','audio_cache','${ref.path}',repeat('a',64))`)
  const assets=[];for(const row of (await db.query('SELECT sitov_pronunciation_private.public_audio_texts($1) spoken',[definition])).rows)assets.push(await seedAsset(row.spoken))
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_question_audio_proofs(definition_id,test_version,text_sha256,path,audio_sha256,word_timings_sha256) VALUES ${assets.map(a=>`('${d.id}','${d.test_version}','${hash(a.spoken)}','${a.path}',repeat('a',64),(SELECT sitov_pronunciation_private.pretest_hash((user_metadata->'wordTimings')::text) FROM storage.objects WHERE name='${a.path}'))`).join(',')};UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`)
  const start=req=>rpc('sitov_start_pronunciation_pretest',[textId,req??request()]),get=id=>rpc('sitov_get_pronunciation_pretest_attempt',[id]),save=(a,answers,req=request(),revision=a.revision)=>rpc('sitov_save_pronunciation_pretest_answers',[a.id,revision,answers,req]),submit=(a,answers,req=request(),revision=a.revision)=>rpc('sitov_submit_pronunciation_pretest',[a.id,revision,answers,req])
  const canonicalAnswers=data=>Object.fromEntries(data.attempt.questionIds.map(id=>[id,definition.tasks.find(q=>q.id===id).correctOptionId]))
  const presentedAnswers=data=>Object.fromEntries(data.tasks.map(q=>{const canonical=definition.tasks.find(c=>c.id===q.id),correctText=canonical.options.find(o=>o.id===canonical.correctOptionId).textDe;return[q.id,q.options.find(o=>o.textDe===correctText).id]}))
  await db.actor(sitovUsers.german);const begun=(await start()).data,answers=presentedAnswers(begun),done=await submit(begun.attempt,answers);assert.equal(done.data.result.passed,true)
  await db.actor(null,'postgres');const before=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_definitions WHERE id=$1',[d.id])).rows[0],oldAttempts=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts ORDER BY id')).rows,oldPasses=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_passes ORDER BY id')).rows
  const revise=label=>{const copy=structuredClone(definition);copy.tasks[0].rationaleDe+=' '+label;return copy},call=(base,def,req=request(),version=d.text_version,target=textId)=>rpc('sitov_save_pronunciation_pretest_draft',[target,version,base,def,req])
  let first
  await t.test('mirrors/replays;student/anonymous/service deny and private DML inaccessible',async()=>{
   assert.equal(sql,await readFile(new URL('../vps/100_sitov_pretest_staff_drafts.sql',import.meta.url),'utf8'));await db.exec(sql);await db.exec(sql)
   await db.actor(sitovUsers.german);assert.equal((await call(d.id,revise('Student darf das nicht.'))).error,'not_found');await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.draft_receipts'),/permission denied/);await assert.rejects(db.exec('INSERT INTO sitov_pronunciation_private.pretest_definitions DEFAULT VALUES'),/permission denied/)
   for(const role of ['anon','service_role']){await db.actor(null,role);await assert.rejects(call(d.id,definition),/permission denied/)}
  })
  await t.test('teacher password-only source validation;malformed/span/key/stale/base/foreign rejected',async()=>{
   await db.actor(sitovUsers.teacher)
   assert.equal((await call(null,revise('Falsche Basis.'))).error,'version_conflict');assert.equal((await call(d.id,revise('Alte Quelle.'),request(),'0'.repeat(64))).error,'version_conflict');assert.equal((await call(d.id,definition,request(),d.text_version,sitovId(999999))).error,'not_found')
   for(const mutate of [x=>{x.tasks[0].sourceSpans[0].start++},x=>{x.tasks[0].correctOptionId='sitov.foreign'},x=>{x.active=true},x=>{x.tasks[0].approval=true},x=>{x.reviewForms[1].questionIds[0]=x.reviewForms[0].questionIds[0]}]){const bad=revise('Malformed private draft.');mutate(bad);assert.equal((await call(d.id,bad)).error,'invalid_input')}
   const fresh=await call(null,definition,request(),d.text_version,sitovId(98303));assert.equal(fresh.ok,true);assert.equal(fresh.data.active,false)
   const def=revise('Lehrkraft hat die Erklärung überprüft.'),req=request();first=await call(d.id,def,req);assert.equal(first.ok,true);assert.equal(first.data.active,false);assert.notEqual(first.data.id,d.id);assert.deepEqual(first.data.definition,def);assert.deepEqual(await call(d.id,def,req),first);assert.equal((await call(d.id,revise('Andere Anfrage.'),req)).error,'request_conflict')
   assert.equal((await call(d.id,revise('Veraltete parallele Basis.'))).error,'version_conflict')
  })
  await t.test('admin requires verified TOTP+AAL2;teacher remains unchanged',async()=>{
   const adminId=sitovUsers.explicitAll;await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET role='admin',sitov_mfa_required=true WHERE id='${adminId}';INSERT INTO auth.mfa_factors(id,user_id,factor_type,status) VALUES('${sitovId(100106)}','${adminId}','totp','verified')`)
   await db.actor(adminId,'authenticated',{aal:'aal1'});assert.equal((await call(first.data.id,revise('Admin AAL1.'))).error,'not_found');await db.actor(adminId,'authenticated',{aal:'aal2'});const next=await call(first.data.id,revise('Admin bestätigt die Erklärung.'));assert.equal(next.ok,true);first=next
   await db.actor(null,'postgres');await db.exec(`DELETE FROM auth.mfa_factors WHERE id='${sitovId(100106)}';UPDATE profiles SET role='student',sitov_mfa_required=false WHERE id='${adminId}'`)
  })
  await t.test('actual concurrent different saves CAS one winner;same request identical receipt',async()=>{
   const parallel=async(def,req)=>{const query=`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${sitovUsers.teacher}',false);SELECT sitov_save_pronunciation_pretest_draft('${textId}','${d.text_version}','${first.data.id}',${literal(def)},'${req}');`;const {stdout}=await promisify(execFile)('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',name,'-v','ON_ERROR_STOP=1','-c',query],{env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))});return JSON.parse(stdout.trim().split('\n').at(-1))}
   const results=await Promise.all([parallel(revise('Parallel A.'),request()),parallel(revise('Parallel B.'),request())]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).error,'version_conflict');first=results.find(r=>r.ok)
   const replayBase=first.data.id,def=revise('Identische Wiederholung.'),req=request(),same=await Promise.all([parallel(def,req),parallel(def,req)]);assert.equal(same[0].ok,true);assert.deepEqual(same[0],same[1]);first=same[0]
   await db.actor(null,'postgres');await db.exec(`UPDATE learning_reading_texts SET sentence_de=sentence_de||' Geändert.' WHERE id='${textId}'`);await db.actor(sitovUsers.teacher);assert.deepEqual(await call(replayBase,def,req),first);assert.equal((await parallel(revise('Nach Quellenänderung.'),request())).error,'version_conflict');await db.actor(null,'postgres');await db.exec(`UPDATE learning_reading_texts SET sentence_de='${body.replaceAll("'","''")}' WHERE id='${textId}'`)
  })
  await t.test('active version/attempt/pass/history unchanged;new draft immutable,no approval/audio waiver',async()=>{
   await db.actor(null,'postgres');assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_definitions WHERE id=$1',[d.id])).rows[0],before);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts ORDER BY id')).rows,oldAttempts);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_passes ORDER BY id')).rows,oldPasses);assert.deepEqual(await sitovHistorySnapshot(db),history)
   await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET definition=definition||'{"bad":true}' WHERE id='${first.data.id}'`),/immutable_pretest_definition/);await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${first.data.id}'`),/pretest_publication_proof_required/)
   await db.actor(sitovUsers.german);assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[textId])).rows[0].value,true)
  })
 }finally{await db?.close();admin.raw(`DROP DATABASE ${name} WITH(FORCE)`)}
})
