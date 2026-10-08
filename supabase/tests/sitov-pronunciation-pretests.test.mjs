import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync, execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promisify } from 'node:util'
import { createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'
import { sitovId, sitovUsers, sitovHistorySnapshot } from './helpers/sitov-night-current-db.mjs'
const psql='/opt/homebrew/opt/postgresql@17/bin/psql', socket='/tmp/sitov-night-2026-10-08-pg', port='55438'
const text=sitovId(302), student=sitovUsers.german
const sql=await readFile(new URL('../vps/94_sitov_pronunciation_pretests.sql',import.meta.url),'utf8')
const authoredDrafts=JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-pretests-2026-10-08.json',import.meta.url),'utf8')).drafts
const rpc=async(db,name,args=[]) => (await db.query(`SELECT ${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result
const pool={policyId:'sitov-pronunciation-language-prerequisites-v1',competencies:['words','syntax','verbs','case'].map(id=>({id:`sitov.${id}`,itemsPerAttempt:3})),tasks:[]}
for(const core of pool.competencies)for(let i=0;i<6;i++)pool.tasks.push({id:`${core.id}.q${i}`,competencyId:core.id,kind:'single_choice',promptDe:`Wähle die passende Form für Aufgabe ${i+1}.`,fragmentDe:null,options:[{id:'sitov.a',textDe:'Paul geht.'},{id:'sitov.b',textDe:'Paul gehen.'},{id:'sitov.c',textDe:'Paul gehst.'}],correctOptionId:'sitov.a',privateEvidence:'DO NOT LEAK'})
test('94 private pretest core on native full92+93 synthetic PostgreSQL',async t=>{
 const database=`sitov_night_s3_${process.pid}_${Date.now()}`
 execFileSync(psql,['-X','-w','-h',socket,'-p',port,'-d','postgres','-v','ON_ERROR_STOP=1','-c',`CREATE DATABASE ${database}`],{stdio:'pipe'})
 const db=await createSitovCurrentNativeDatabase({database})
 // Model real Storage soft-delete metadata before taking preservation snapshots.
 await db.exec('ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS archived_at timestamptz; ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS is_delete_marker boolean DEFAULT false')
 const originalHistory=await sitovHistorySnapshot(db)
 let seq=9000, current
 const nativeCall=async query=>{const {stdout}=await promisify(execFile)(psql,['-X','-w','-qAt','-h',socket,'-p',port,'-d',database,'-v','ON_ERROR_STOP=1','-c',query],{env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))});return JSON.parse(stdout.trim().split('\n').at(-1))}
 const start=()=>rpc(db,'sitov_start_pronunciation_pretest',[text,sitovId(seq++)])
 const submit=(a,answers,request=sitovId(seq++),revision=a.revision)=>rpc(db,'sitov_submit_pronunciation_pretest',[a.id,revision,answers,request])
 const answers=a=>Object.fromEntries(a.questionIds.map(id=>[id,'sitov.a']))
 const seedDefinition=async(target,extra={})=>{
  // Synthetic permission fixtures, not didactic approval or actual audio bytes.
  await db.actor(null,'postgres')
  const body=(await db.query('SELECT sentence_de FROM learning_reading_texts WHERE id=$1',[target])).rows[0].sentence_de
  const definition=structuredClone(pool),span={start:0,end:body.length,quote:body}
  Object.assign(definition,extra)
  const categories={words:'vocabulary',syntax:'syntax',verbs:'verb_forms',case:'nominal_forms'}
  for(const core of definition.competencies)Object.assign(core,{category:categories[core.id.split('.').at(-1)],necessityDe:'Synthetic protocol fixture: not a production didactic claim.',sourceSpans:[span],languageUnits:['synthetic.a','synthetic.b','synthetic.c'],mapping:{topicIds:[],pendingReasonDe:'Synthetic fixture has no learning target.'}})
  for(const [index,q] of definition.tasks.entries())Object.assign(q,{promptDe:authoredDrafts[0].definition.tasks[index].promptDe,sourceSpans:[span],assessmentUnit:q.id,equivalenceKey:q.id,rationaleDe:'Synthetic permission proof tests the private grading protocol, not German teaching quality.'})
  definition.tasks[0].fragmentDe='Paul ist das Subjekt in diesem Satz.'
  definition.omittedCategories=[{category:'modal_verbs',reasonDe:'Synthetic protocol source contains no modal verb.'}]
  definition.reviewForms=[0,1].map(f=>({id:`sitov.fixture.form${f}`,questionIds:definition.competencies.flatMap(c=>definition.tasks.filter(q=>q.competencyId===c.id).slice(f*3,f*3+3).map(q=>q.id))}))
  const literal=JSON.stringify(definition).replaceAll("'","''")
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition,active) VALUES('${target}',sitov_pronunciation_private.pretest_hash('${body.replaceAll("'","''")}'),repeat('a',64),'${literal}'::jsonb,false)`)
  const d=(await db.query('SELECT id,text_version,test_version FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=$1 ORDER BY created_at DESC LIMIT 1',[target])).rows[0]
  await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`),/pretest_publication_proof_required/)
  const spoken=(await db.query('SELECT vocabulary_private.sitov_normalize_audio_text($1) spoken',[body])).rows[0].spoken
  const hash=x=>createHash('sha256').update(x,'utf8').digest('hex'),fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
  const path='sitov-qwen-v1/de/'+hash(JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:0.35,profile:fingerprint}))+'.mp3'
  const metadata={engine:'qwen3-tts',voice:'sitov-qwen-male-de-v1',revision:'sitov-qwen-base-bf16-v1',profileFingerprint:fingerprint,textSha256:hash(spoken),audioSha256:'a'.repeat(64),wordTimings:spoken.split(' ').map((word,i)=>({start:i,end:i+0.5}))}
  await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('audio_cache','${path}','{"mimetype":"audio/mpeg","size":1000}','${JSON.stringify(metadata)}') ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata`)
  await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`),/pretest_publication_proof_required/)
  const approve=(version,doc='b'.repeat(64))=>db.exec(`INSERT INTO sitov_pronunciation_private.pretest_approvals(definition_id,text_version,test_version,author_identity,reviewer_identity,review_status,reviewed_at,review_document_ref,review_document_sha256,reference_kind,reference_bucket,reference_path,reference_audio_sha256) VALUES('${d.id}','${version}','${d.test_version}','sitov.qa.synthetic.author','sitov.qa.synthetic.editor','independent_approved',now(),'sitov.editorial.review.synthetic','${doc}','prepared_qwen','audio_cache','${path}',repeat('a',64))`)
  await assert.rejects(approve(d.text_version,''),/check constraint/)
  await approve('0'.repeat(64));await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`),/pretest_publication_proof_required/)
  await approve(d.text_version)
  assert.equal((await db.query('SELECT sitov_pronunciation_private.valid_authoring($1,$2) value',[body,definition])).rows[0].value,true)
  assert.equal((await db.query('SELECT sitov_pronunciation_private.reference_valid($1,NULL,a) value FROM sitov_pronunciation_private.pretest_approvals a WHERE text_version=$2 AND definition_id=$3',[body,d.text_version,d.id])).rows[0].value,true)
  await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_approvals SET review_status='independent_approved' WHERE definition_id='${d.id}'`),/immutable_pretest_approval/)
  await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`),/pretest_publication_proof_required/)
  const texts=(await db.query('SELECT sitov_pronunciation_private.public_audio_texts($1) spoken',[definition])).rows.map(r=>r.spoken),assets=[]
  for(const spoken of texts){const assetPath='sitov-qwen-v1/de/'+hash(JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:0.35,profile:fingerprint}))+'.mp3',assetMeta={...metadata,textSha256:hash(spoken),wordTimings:spoken.split(' ').map((word,i)=>({start:i,end:i+0.5}))};assets.push({spoken,path:assetPath,metadata:assetMeta})}
  const seedAssets=async list=>{const tuples=list.map(a=>`('audio_cache','${a.path}','{"mimetype":"audio/mpeg","size":1000}','${JSON.stringify(a.metadata).replaceAll("'","''")}')`);if(tuples.length)await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES ${tuples.join(',')} ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata,archived_at=NULL`)}
  const missing=assets.find(a=>a.spoken===definition.tasks[0].promptDe)
  await seedAssets(assets.filter(a=>a!==missing));await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`),/pretest_publication_proof_required/)
  await seedAssets([missing]);await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`),/pretest_publication_proof_required/)
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_question_audio_proofs(definition_id,test_version,text_sha256,path,audio_sha256,word_timings_sha256) VALUES ${assets.map(a=>`('${d.id}','${d.test_version}','${hash(a.spoken)}','${a.path}','${a.metadata.audioSha256}',(SELECT sitov_pronunciation_private.pretest_hash((user_metadata->'wordTimings')::text) FROM storage.objects WHERE bucket_id='audio_cache' AND name='${a.path}'))`).join(',')}`)
  await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_question_audio_proofs SET audio_sha256=repeat('a',64) WHERE definition_id='${d.id}'`),/immutable_pretest_approval/)
  await db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`)
  return {d,path,metadata,definition,assets,seedAssets}

 }

 try{
  await db.exec(await readFile(new URL('../vps/93_sitov_commercial_access.sql',import.meta.url),'utf8'));await db.exec('ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS archived_at timestamptz; ALTER TABLE storage.objects ADD COLUMN IF NOT EXISTS is_delete_marker boolean DEFAULT false');await db.exec(sql);await db.exec(await readFile(new URL('../vps/96_sitov_private_audio_delivery.sql',import.meta.url),'utf8'))
  await t.test('migration mirrors and replays; private keys/DML and anonymous endpoints denied',async()=>{
   assert.equal(sql,await readFile(new URL('../migrations/20261008213100_sitov_pronunciation_pretests.sql',import.meta.url),'utf8'))
   await db.exec(sql);await db.actor(student)
   await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_definitions'),/permission denied/)
   await assert.rejects(db.exec('INSERT INTO sitov_pronunciation_private.pretest_passes DEFAULT VALUES'),/permission denied/)
   await db.actor(null,'anon');await assert.rejects(rpc(db,'sitov_get_pronunciation_pretests',['A1.1']),/permission denied/)
  })
  await t.test('missing definition fails closed; commercial denied IDs omitted; staff MFA required',async()=>{
   await db.actor(sitovUsers.selected);assert.deepEqual((await db.query('SELECT id FROM learning_reading_texts WHERE id=$1',[text])).rows,[]);assert.equal((await db.query('SELECT id FROM submissions WHERE id=$1',[sitovId(304)])).rows[0].id,sitovId(304))
   await db.actor(student);assert.equal((await start()).error,'authoring_not_ready')
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).data[0].status,'locked')
   await db.actor(sitovUsers.outsider);assert.equal((await start()).error,'not_found');assert.deepEqual((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).data,[])
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,null])).error,'not_found')
   await db.actor(student,'postgres')
   const fixture=await seedDefinition(text)
   await db.actor(student);await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_question_audio_proofs'),/permission denied/);await assert.rejects(db.exec('INSERT INTO sitov_pronunciation_private.pretest_question_audio_proofs DEFAULT VALUES'),/permission denied/);await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_approvals'),/permission denied/);await assert.rejects(db.exec('INSERT INTO sitov_pronunciation_private.pretest_approvals DEFAULT VALUES'),/permission denied/);await db.actor(null,'anon');await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_approvals'),/permission denied/);await db.actor(null,'postgres')
   await db.exec(`UPDATE storage.objects SET user_metadata=user_metadata||'{"wordTimings":[]}'::jsonb WHERE name='${fixture.path}'`);assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null)
   await db.exec(`UPDATE storage.objects SET user_metadata='${JSON.stringify(fixture.metadata)}',archived_at=now() WHERE name='${fixture.path}'`);assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null)
   await db.exec(`UPDATE storage.objects SET archived_at=NULL WHERE name='${fixture.path}'`)
   // Every public field is live-rechecked after activation: prompt, fragment and option.
   for(const spoken of [fixture.definition.tasks[0].promptDe,fixture.definition.tasks[0].fragmentDe,fixture.definition.tasks[0].options[1].textDe]){
    const asset=fixture.assets.find(a=>a.spoken===spoken)
    await db.exec(`UPDATE storage.objects SET archived_at=now() WHERE name='${asset.path}'`);assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null);await fixture.seedAssets([asset])
    await db.exec(`UPDATE storage.objects SET user_metadata=user_metadata||'{"audioSha256":"${'c'.repeat(64)}"}'::jsonb WHERE name='${asset.path}'`);assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null);await fixture.seedAssets([asset])
    await db.exec(`UPDATE storage.objects SET user_metadata=user_metadata||'{"voice":"wrong-profile"}'::jsonb WHERE name='${asset.path}'`);assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null);await fixture.seedAssets([asset])
    await db.exec(`UPDATE storage.objects SET user_metadata=jsonb_set(user_metadata,'{wordTimings,0,end}','0.4'::jsonb) WHERE name='${asset.path}'`);assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null);await fixture.seedAssets([asset])
    await db.exec(`UPDATE storage.objects SET user_metadata=user_metadata||'{"wordTimings":[]}'::jsonb WHERE name='${asset.path}'`);assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null);await fixture.seedAssets([asset])
   }
   await db.exec(await readFile(new URL('../vps/96_sitov_private_audio_delivery.sql',import.meta.url),'utf8'));assert.notEqual((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id value',[text])).rows[0].value,null)
  })
  await t.test('invalid policy/pools cannot activate and definitions are immutable',async()=>{
   await db.actor(student,'postgres')
   const missing={...pool};delete missing.policyId
   assert.equal((await db.query('SELECT sitov_pronunciation_private.valid_authoring($1,$2) value',['Paul geht nach Hause.',pool])).rows[0].value,false)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.valid_pool($1) value',[missing])).rows[0].value,false)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.valid_pool($1) value',[{...pool,tasks:pool.tasks.slice(0,5)}])).rows[0].value,false)
   await assert.rejects(db.exec("UPDATE sitov_pronunciation_private.pretest_definitions SET definition=definition||'{\"extra\":true}'::jsonb"),/immutable_pretest_definition/)
  })
  await t.test('zero old evidence starts/resumes one balanced account form without keys/body leakage',async()=>{
   await db.actor(student);assert.deepEqual((await db.query('SELECT id FROM learning_reading_texts WHERE id=$1',[text])).rows,[]);const req=sitovId(seq++);const first=await rpc(db,'sitov_start_pronunciation_pretest',[text,req]);assert.equal(first.ok,true)
   assert.deepEqual(await rpc(db,'sitov_start_pronunciation_pretest',[text,req]),first)
   current=first.data.attempt;assert.equal(first.data.tasks.length,12);assert.ok(!JSON.stringify(first).includes('DO NOT LEAK'));assert.ok(!JSON.stringify(first).includes('correctOptionId'));assert.ok(!JSON.stringify(first).includes('audio_cache'))
   assert.equal((await start()).data.attempt.id,current.id)
   for(const core of pool.competencies)assert.equal(first.data.tasks.filter(q=>q.competencyId===core.id).length,3)
   await db.actor(sitovUsers.explicitAll);assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_attempt',[current.id])).error,'not_found')
   await db.actor(student);assert.equal((await rpc(db,'sitov_start_pronunciation_pretest',[sitovId(9999),req])).error,'not_found')
  })
  await t.test('CAS, incomplete/malformed/foreign answers, receipts and no missing-core pass',async()=>{
   assert.equal((await submit(current,{})).error,'incomplete_attempt')
   assert.equal((await submit(current,{'sitov.foreign':'sitov.a'})).error,'invalid_answer')
   assert.equal((await submit(current,answers(current),undefined,999)).error,'attempt_conflict')
   const req=sitovId(seq++), partial={[current.questionIds[0]]:'sitov.a'}
   const saved=await rpc(db,'sitov_save_pronunciation_pretest_answers',[current.id,0,partial,req]);assert.equal(saved.data.revision,1)
   assert.deepEqual(await rpc(db,'sitov_save_pronunciation_pretest_answers',[current.id,0,partial,req]),saved)
   assert.equal((await rpc(db,'sitov_save_pronunciation_pretest_answers',[current.id,0,{},req])).error,'request_conflict');current=saved.data
   const bad=answers(current);for(const id of current.questionIds.filter(id=>id.startsWith('sitov.case')))bad[id]='sitov.b'
   const failed=await submit(current,bad);assert.equal(failed.data.result.correct,9);assert.equal(failed.data.result.passed,false);assert.deepEqual(failed.data.result.failedCompetencyIds,['sitov.case'])
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[text])).rows[0].value,false)
  })
  await t.test('retake uses disjoint balanced tasks; pass only exact text/version; duplicate submit stable',async()=>{
   const prior=current.questionIds
   const parallelStart=async request=>{
    const query=`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${student}',false); SELECT sitov_start_pronunciation_pretest('${text}','${request}');`
    const {stdout}=await promisify(execFile)(psql,['-X','-w','-qAt','-h',socket,'-p',port,'-d',database,'-v','ON_ERROR_STOP=1','-c',query],{env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))})
    return JSON.parse(stdout.trim().split('\n').at(-1))
   }
   const parallel=await Promise.all([parallelStart(sitovId(seq++)),parallelStart(sitovId(seq++))]);assert.equal(parallel[0].data.attempt.id,parallel[1].data.attempt.id)
   current=parallel[0].data.attempt;assert.ok(current.questionIds.every(id=>!prior.includes(id)))
   const req=sitovId(seq++), input=answers(current);const done=await submit(current,input,req);assert.equal(done.data.result.passed,true)
   assert.deepEqual(await submit(current,input,req),done);assert.equal((await submit(current,input)).data.result.proof.id,done.data.result.proof.id)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[text])).rows[0].value,true)
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).data[0].status,'passed')
   const ticket=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm']);assert.equal(ticket.ok,true);assert.ok(ticket.data.path.startsWith(student+'/'))
   // Two independently passed texts still cannot share upload tickets.
   const other=sitovId(303)
   await db.actor(null,'postgres');await db.exec(`INSERT INTO learning_reading_texts(id,unit_id,sentence_de,focus) SELECT '${other}','${sitovId(232)}'::uuid,'Paul lernt Deutsch.',focus FROM learning_reading_texts WHERE id='${text}'`);await seedDefinition(other);await db.actor(student)
   const otherAttempt=(await rpc(db,'sitov_start_pronunciation_pretest',[other,sitovId(seq++)])).data.attempt
   assert.equal((await submit(otherAttempt,answers(otherAttempt))).data.result.passed,true)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[other])).rows[0].value,true)
   assert.ok((await rpc(db,'create_pronunciation_submission',[other,'storage://pronunciation_audio/'+ticket.data.path])).error)
   const otherTicket=await rpc(db,'sitov_create_pronunciation_upload_ticket',[other,sitovId(seq++),'webm']);assert.equal(otherTicket.ok,true)
   await db.exec(`INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('pronunciation_audio','${otherTicket.data.path}','${student}','{"size":1000,"mimetype":"audio/webm"}')`)
   await db.actor(null,'postgres');await db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=false WHERE text_id='${other}'`);await seedDefinition(other,{authorRevision:'sitov.synthetic.v2'});await db.actor(student)
   assert.ok((await rpc(db,'create_pronunciation_submission',[other,'storage://pronunciation_audio/'+otherTicket.data.path])).error)
   assert.equal((await db.query('SELECT count(*)::int n FROM submissions WHERE prompt_id=$1',[other])).rows[0].n,0)
   // Isolate a trial granting only this item: unit-wide guards deliberately deny it.
   await db.actor(null,'postgres');await db.exec(`DELETE FROM student_level_access WHERE auth_user_id='${student}'; INSERT INTO sitov_access_private.students(student_id,trial) VALUES('${student}','{"version":1,"rules":[{"level":"A1.1","trainer":"pronunciation","unit_ids":["${sitovId(231)}"],"items":[{"unit_id":"${sitovId(231)}","refs":[{"kind":"reading_text","id":"${text}"}]}]}]}') ON CONFLICT(student_id) DO UPDATE SET trial=excluded.trial`);await db.actor(student)
   await db.actor(sitovUsers.explicitAll);assert.equal((await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm'])).error,'test_required');await db.actor(student)
   assert.equal((await db.query('SELECT id FROM learning_units WHERE id=$1',[sitovId(231)])).rows[0].id,sitovId(231))
   assert.equal((await db.query('SELECT sentence_de FROM learning_reading_texts WHERE id=$1',[text])).rows[0].sentence_de,'Paul geht nach Hause.')
   const upload=async path=>db.exec(`INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('pronunciation_audio','${path}','${student}','{"size":1000,"mimetype":"audio/webm"}')`)
   await assert.rejects(upload(`${student}/${sitovId(seq++)}.webm`),/row-level security/)
   await db.actor(sitovUsers.explicitAll);await assert.rejects(upload(ticket.data.path),/row-level security/);await db.actor(student)
   await upload(ticket.data.path)
   assert.ok((await rpc(db,'create_pronunciation_submission',[sitovId(99999),'storage://pronunciation_audio/'+ticket.data.path])).error)
   const submitSql=`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${student}',false); SELECT create_pronunciation_submission('${text}','storage://pronunciation_audio/${ticket.data.path}');`
   const concurrent=await Promise.all([nativeCall(submitSql),nativeCall(submitSql)])
   const submission=concurrent[0];assert.equal(typeof submission,'string',JSON.stringify(concurrent));assert.equal(concurrent[1],submission)
   assert.equal((await db.query('SELECT count(*)::int n FROM submissions WHERE content_url=$1',['storage://pronunciation_audio/'+ticket.data.path])).rows[0].n,1)
   await db.actor(student,'postgres');await assert.rejects(db.exec(`INSERT INTO submissions(auth_user_id,type,content_url,status,level,prompt_id) VALUES('${student}','audio','storage://pronunciation_audio/${ticket.data.path}','pending','A1.1','${text}')`),/invalid_upload_ticket/);await db.actor(student)
   assert.equal((await db.query('SELECT text_content FROM submissions WHERE id=$1',[submission])).rows[0].text_content,'Paul geht nach Hause.')
   assert.equal(await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+ticket.data.path]),submission)
   const direct=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm']);await upload(direct.data.path)
   // Native owner exercises the trigger with learner claims; API roles have no table INSERT grant.
   await db.actor(student,'postgres');await db.exec(`INSERT INTO submissions(auth_user_id,type,content_url,status,level,prompt_id) VALUES('${student}','audio','storage://pronunciation_audio/${direct.data.path}','pending','A1.1','${text}')`);await db.actor(student)
   const directId=(await db.query('SELECT id FROM submissions WHERE content_url=$1',['storage://pronunciation_audio/'+direct.data.path])).rows[0].id
   assert.equal(await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+direct.data.path]),directId)
   const expired=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm']);await db.actor(null,'postgres');await db.exec(`UPDATE sitov_pronunciation_private.upload_tickets SET expires_at=now()-interval '1 minute' WHERE id='${expired.data.ticketId}'`);await db.actor(student);await assert.rejects(upload(expired.data.path),/row-level security/)
   const revoked=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm']);await db.actor(null,'postgres');await db.exec(`DELETE FROM student_level_access WHERE auth_user_id='${student}'; UPDATE sitov_access_private.students SET trial='{"version":1,"rules":[]}' WHERE student_id='${student}'`);await db.actor(student)
   await assert.rejects(upload(revoked.data.path),/row-level security/);assert.deepEqual((await db.query('SELECT id FROM learning_reading_texts WHERE id=$1',[text])).rows,[])
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_attempt',[current.id])).data.result.passed,true)
   assert.equal((await db.query('SELECT id FROM submissions WHERE id=$1',[submission])).rows[0].id,submission)
   assert.equal(await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+ticket.data.path]),submission)
   await db.actor(sitovUsers.explicitAll);assert.ok((await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+ticket.data.path])).error);await db.actor(student)
   const reply=await rpc(db,'sitov_create_pronunciation_reply_upload_ticket',[submission,sitovId(seq++),'webm']);assert.equal(reply.ok,true);await upload(reply.data.path)
   await db.exec(`INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path) VALUES('${submission}','${student}','Danke!','storage://pronunciation_audio/${reply.data.path}')`)
   await assert.rejects(db.exec(`INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path) VALUES('${submission}','${student}','Noch einmal','storage://pronunciation_audio/${reply.data.path}')`),/invalid_reply_ticket/)
   await db.actor(null,'postgres');await db.exec(`INSERT INTO student_level_access(auth_user_id,level) VALUES('${student}','A1.1')`);await db.actor(student)
   assert.ok((await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+reply.data.path])).error)
   const racing=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm']);await upload(racing.data.path)
   const editor=nativeCall(`/*sitov-s3-content-race*/ BEGIN; UPDATE learning_reading_texts SET sentence_de='Paul fährt nach Hause.' WHERE id='${text}'; SELECT pg_sleep(0.5); COMMIT; SELECT '{}'::jsonb;`)
   await db.actor(null,'postgres')
   let editLocked=false
   for(let i=0;i<20&&!editLocked;i++)editLocked=(await db.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query LIKE '/*sitov-s3-content-race*/%' AND wait_event='PgSleep') value")).rows[0].value
   assert.equal(editLocked,true,'editor must hold the actual text row lock before submission')
   const blockedSubmission=nativeCall(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${student}',false); SELECT create_pronunciation_submission('${text}','storage://pronunciation_audio/${racing.data.path}');`)
   await editor;assert.ok((await blockedSubmission).error);await db.actor(student)
   assert.equal((await db.query('SELECT count(*)::int n FROM submissions WHERE content_url=$1',['storage://pronunciation_audio/'+racing.data.path])).rows[0].n,0)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[text])).rows[0].value,false)
   assert.equal((await start()).error,'authoring_not_ready');assert.equal((await submit(current,input)).error,'version_conflict')
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).data[0].lockedReason,'version_changed')
   assert.equal(await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+ticket.data.path]),submission)
   assert.equal((await db.query('SELECT text_content FROM submissions WHERE id=$1',[submission])).rows[0].text_content,'Paul geht nach Hause.')
   const history=await rpc(db,'sitov_get_pronunciation_pretest_attempt',[current.id]);assert.equal(history.data.result.passed,true)
  })
  await t.test('admin requires verified TOTP/AAL2 under existing password-only teacher policy',async()=>{
   await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET role='admin' WHERE id='${sitovUsers.teacher}'`)
   await db.actor(sitovUsers.teacher);assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,null])).error,'not_found')
   await db.actor(sitovUsers.teacher,'postgres');await db.exec(`INSERT INTO auth.mfa_factors(user_id,status,factor_type) VALUES('${sitovUsers.teacher}','verified','totp')`)
   await db.actor(sitovUsers.teacher,'authenticated',{aal:'aal2'});const staff=await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,student]);assert.equal(staff.ok,true);assert.equal(staff.data.definitions.length,1)
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,sitovUsers.outsider])).data.attempts.length,0)
  })
  await t.test('old access evidence, unsent checkpoint and historical conversation are unchanged',async()=>{
   assert.deepEqual(await sitovHistorySnapshot(db),originalHistory);await db.actor(student)
  })
  await t.test('rollback freezes preuploaded targets/replies through RPC, triggers and storage; replay restores exact gates',async()=>{
   await db.actor(null,'postgres');await db.exec(`UPDATE learning_reading_texts SET sentence_de='Paul geht nach Hause.' WHERE id='${text}'`);await db.actor(student)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[text])).rows[0].value,true)
   const target=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm'])
   const old=(await db.query('SELECT id FROM submissions WHERE auth_user_id=$1 AND prompt_id=$2 ORDER BY id',[student,text])).rows[0].id
   const reply=await rpc(db,'sitov_create_pronunciation_reply_upload_ticket',[old,sitovId(seq++),'webm'])
   const untouched=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm'])
   for(const ticket of [target,reply])await db.exec(`INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('pronunciation_audio','${ticket.data.path}','${student}','{"size":1000,"mimetype":"audio/webm"}')`)
   await db.exec(`INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES('${old}','${student}','Hallo!')`)
   await db.actor(null,'postgres');const before=(await db.query('SELECT count(*)::int n FROM sitov_pronunciation_private.pretest_attempts')).rows[0].n
   const controlBefore=(await db.query('SELECT id,consumed_at FROM sitov_pronunciation_private.upload_tickets WHERE id IN($1,$2)',[target.data.ticketId,reply.data.ticketId])).rows
   await db.exec(await readFile(new URL('../vps/rollback/94_sitov_pronunciation_pretests.sql',import.meta.url),'utf8'))
   await db.actor(student);await assert.rejects(rpc(db,'sitov_get_pronunciation_pretests',['A1.1']),/permission denied/)
   await assert.rejects(db.exec('UPDATE sitov_pronunciation_private.write_control SET enabled=true'),/permission denied/)
   await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.write_control'),/permission denied/)
   assert.ok((await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+target.data.path])).error)
   await assert.rejects(db.exec(`INSERT INTO storage.objects(bucket_id,name,owner) VALUES('pronunciation_audio','${untouched.data.path}','${student}')`),/frozen|row-level security/)
   await assert.rejects(db.exec(`INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path) VALUES('${old}','${student}','Danke!','storage://pronunciation_audio/${reply.data.path}')`),/frozen/)
   await assert.rejects(db.exec(`INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES('${old}','${student}','Danke!')`),/frozen/)
   await db.actor(student,'postgres')
   await assert.rejects(db.exec(`INSERT INTO submissions(auth_user_id,type,content_url,status,level,prompt_id) VALUES('${student}','audio','storage://pronunciation_audio/${target.data.path}','pending','A1.1','${text}')`),/frozen/)
   await assert.rejects(db.exec(`UPDATE storage.objects SET metadata='{}' WHERE name='${target.data.path}'`),/frozen/)
   await assert.rejects(db.exec(`UPDATE storage.objects SET bucket_id='sitov_unrelated' WHERE name='${target.data.path}'`),/frozen/)
   await assert.rejects(db.exec(`DELETE FROM storage.objects WHERE name='${target.data.path}'`),/frozen/)
   await assert.rejects(db.exec(`DELETE FROM submissions WHERE id='${old}'`),/frozen/)
   const message=(await db.query('SELECT id FROM pronunciation_messages WHERE submission_id=$1 LIMIT 1',[old])).rows[0].id
   await db.actor(sitovUsers.teacher,'authenticated',{aal:'aal2'});assert.ok((await rpc(db,'set_pronunciation_message_hidden',[message,true])).error)
   await db.actor(student,'postgres')
   assert.deepEqual((await db.query('SELECT id,consumed_at FROM sitov_pronunciation_private.upload_tickets WHERE id IN($1,$2)',[target.data.ticketId,reply.data.ticketId])).rows,controlBefore)
   assert.equal((await db.query('SELECT count(*)::int n FROM sitov_pronunciation_private.pretest_attempts')).rows[0].n,before)
   await db.actor(student);assert.equal((await db.query('SELECT id FROM submissions WHERE id=$1',[old])).rows[0].id,old)
   await db.actor(sitovUsers.teacher,'authenticated',{aal:'aal2'});assert.equal((await db.query('SELECT id FROM submissions WHERE id=$1',[old])).rows[0].id,old)
   await db.actor(null,'postgres');await db.exec(sql);await db.actor(student)
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).ok,true)
   const created=await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+target.data.path]);assert.equal(typeof created,'string')
   await db.exec(`INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path) VALUES('${old}','${student}','Danke!','storage://pronunciation_audio/${reply.data.path}')`)
   await assert.rejects(db.exec(`INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path) VALUES('${old}','${student}','Danke!','storage://pronunciation_audio/${reply.data.path}')`),/invalid_reply_ticket/)
   await db.exec(`INSERT INTO storage.objects(bucket_id,name,owner) VALUES('pronunciation_audio','${untouched.data.path}','${student}')`)
   await db.actor(sitovUsers.explicitAll);assert.ok((await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+target.data.path])).error)
   assert.deepEqual(await sitovHistorySnapshot(db),originalHistory)
  })
  await t.test('private96 reference conversion preserves exact current passage and reference revocation',async()=>{
   await db.actor(null,'postgres')
   const before=(await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id id',[text])).rows[0].id
   assert.ok(before)
   const audio=(await db.query('SELECT reference_path path FROM sitov_pronunciation_private.pretest_approvals WHERE definition_id=$1 ORDER BY reviewed_at DESC LIMIT 1',[before])).rows[0]
   const private96=await readFile(new URL('../vps/96_sitov_private_audio_delivery.sql',import.meta.url),'utf8')
   await db.exec(private96);await db.exec(private96)
   assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id id',[text])).rows[0].id,before)
   assert.equal((await db.query("SELECT public FROM storage.buckets WHERE id='audio_cache'")).rows[0].public,false)
   await db.actor(student);assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).ok,true)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) allowed',[text])).rows[0].allowed,true)
   await db.actor(null,'postgres');await db.exec(`UPDATE storage.objects SET archived_at=now() WHERE bucket_id='audio_cache' AND name='${audio.path}'`)
   assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id id',[text])).rows[0].id,null)
   await db.exec(`UPDATE storage.objects SET archived_at=NULL WHERE bucket_id='audio_cache' AND name='${audio.path}'`)
   assert.equal((await db.query('SELECT (sitov_pronunciation_private.current_pretest($1)).id id',[text])).rows[0].id,before)
   assert.deepEqual(await sitovHistorySnapshot(db),originalHistory)
  })
  await t.test('question asset revocation blocks current passage and new target writes while preserving history; bounded gate timing',async()=>{
   await db.actor(student);const ticket=await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm']);assert.equal(ticket.ok,true)
   await db.exec(`INSERT INTO storage.objects(bucket_id,name,owner) VALUES('pronunciation_audio','${ticket.data.path}','${student}')`)
   await db.actor(null,'postgres')
   const row=(await db.query("SELECT d.id,d.test_version, d.definition->'tasks'->0->'options'->1->>'textDe' spoken FROM sitov_pronunciation_private.pretest_definitions d WHERE d.text_id=$1 AND d.active",[text])).rows[0]
   const proof=(await db.query('SELECT path FROM sitov_pronunciation_private.pretest_question_audio_proofs WHERE definition_id=$1 AND test_version=$2 AND text_sha256=sitov_pronunciation_private.pretest_hash(vocabulary_private.sitov_normalize_audio_text($3))',[row.id,row.test_version,row.spoken])).rows[0]
   await db.exec(`UPDATE storage.objects SET archived_at=now() WHERE bucket_id='audio_cache' AND name='${proof.path}'`);await db.actor(student)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[text])).rows[0].value,false)
   assert.equal((await rpc(db,'sitov_create_pronunciation_upload_ticket',[text,sitovId(seq++),'webm'])).error,'authoring_not_ready')
   assert.ok((await rpc(db,'create_pronunciation_submission',[text,'storage://pronunciation_audio/'+ticket.data.path])).error)
   assert.deepEqual((await db.query('SELECT id FROM learning_reading_texts WHERE id=$1',[text])).rows,[])
   await db.actor(null,'postgres');await db.exec(`UPDATE storage.objects SET archived_at=NULL WHERE bucket_id='audio_cache' AND name='${proof.path}'`);await db.actor(student)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[text])).rows[0].value,true)
   assert.deepEqual(await sitovHistorySnapshot(db),originalHistory)
   const normalized=(await db.query('SELECT vocabulary_private.sitov_normalize_audio_text($1) value',['  Grüße   am Abend. '])).rows[0].value
   assert.equal(normalized,'Grüße am Abend.')
   const output=db.raw(`SET ROLE postgres; SELECT set_config('request.jwt.claim.sub','${student}',false); CREATE FUNCTION pg_temp.sitov_gate_measure() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE started timestamptz:=clock_timestamp();passed boolean;BEGIN FOR i IN 1..10 LOOP passed:=sitov_pronunciation_private.current_pass('${text}');IF NOT passed THEN RAISE EXCEPTION 'measurement_requires_valid_pass';END IF;END LOOP;RETURN jsonb_build_object('calls',10,'total_ms',extract(epoch FROM clock_timestamp()-started)*1000);END $$; SELECT pg_temp.sitov_gate_measure();`)
   const measure=JSON.parse(output.split('\n').at(-1));t.diagnostic(JSON.stringify(measure));assert.equal(measure.calls,10)
  })
 }finally{await db.close();execFileSync(psql,['-X','-w','-h',socket,'-p',port,'-d','postgres','-c',`DROP DATABASE ${database} WITH (FORCE)`],{stdio:'pipe'})}
})
