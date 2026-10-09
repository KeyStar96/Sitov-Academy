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
const sql=await readFile(new URL('../migrations/20261009002000_sitov_pretest_option_presentation.sql',import.meta.url),'utf8'),sql97=await readFile(new URL('../migrations/20261009001000_sitov_storage_proof_compatibility.sql',import.meta.url),'utf8')
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`,hash=t=>createHash('sha256').update(t).digest('hex'),fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const drafts=JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-pretests-2026-10-08.json',import.meta.url),'utf8')).drafts,sources=await sitovReadAuthoringSources()
const tokenPattern=/^sitov\.option\.[a-f0-9]{12}4[a-f0-9]{3}[89ab][a-f0-9]{15}$/
test('98 freezes opaque shuffled options only in new attempts and grades actual authorized RPC tokens',async t=>{
 const name=`sitov_night_options98_${process.pid}_${Date.now()}`,admin=new SitovNativeDatabase();admin.raw(`CREATE DATABASE ${name}`);let db
 try{
  db=await createSitovIntegrated96NativeDatabase({database:name});await db.actor(null,'postgres');await db.exec(sql97)
  const history=await sitovHistorySnapshot(db),draft=drafts[0],definition=draft.definition,body=sources.rows.find(s=>s.id===draft.textId).text,textId=sitovId(98302)
  const rpc=async(name,args)=>(await db.query(`SELECT ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value
  let serial=98400;const request=()=>sitovId(serial++)
  const seedAsset=async text=>{const spoken=(await db.query('SELECT vocabulary_private.sitov_normalize_audio_text($1) value',[text])).rows[0].value,path='sitov-qwen-v1/de/'+hash(JSON.stringify({text:spoken,voice:'sitov-qwen-male-de-v1',rate:'qwen-native-1-lufs-18-aligned-v1',format:'audio-24khz-48kbitrate-mono-mp3',leadIn:.35,profile:fingerprint}))+'.mp3',metadata={engine:'qwen3-tts',voice:'sitov-qwen-male-de-v1',revision:'sitov-qwen-base-bf16-v1',profileFingerprint:fingerprint,textSha256:hash(spoken),audioSha256:'a'.repeat(64),wordTimings:spoken.split(' ').map((_,i)=>({start:i,end:i+.5}))};await db.exec(`INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES('audio_cache','${path}','{"mimetype":"audio/mpeg","size":1000}',${literal(metadata)}) ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=excluded.metadata,user_metadata=excluded.user_metadata`);return{spoken,path}}
  await db.exec(`INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES('${textId}','${sitovId(232)}','${body.replaceAll("'","''")}');INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition) VALUES('${textId}','${draft.textVersion}',repeat('a',64),${literal(definition)})`)
  const d=(await db.query('SELECT id,text_version,test_version,definition FROM sitov_pronunciation_private.pretest_definitions WHERE text_id=$1',[textId])).rows[0],ref=await seedAsset(body)
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_approvals(definition_id,text_version,test_version,author_identity,reviewer_identity,review_status,reviewed_at,review_document_ref,review_document_sha256,reference_kind,reference_bucket,reference_path,reference_audio_sha256) VALUES('${d.id}','${d.text_version}','${d.test_version}','sitov.qa.author','sitov.qa.editor','independent_approved',now(),'sitov.editorial.review.synthetic98',repeat('b',64),'prepared_qwen','audio_cache','${ref.path}',repeat('a',64))`)
  const assets=[];for(const row of (await db.query('SELECT sitov_pronunciation_private.public_audio_texts($1) spoken',[definition])).rows)assets.push(await seedAsset(row.spoken))
  await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_question_audio_proofs(definition_id,test_version,text_sha256,path,audio_sha256,word_timings_sha256) VALUES ${assets.map(a=>`('${d.id}','${d.test_version}','${hash(a.spoken)}','${a.path}',repeat('a',64),(SELECT sitov_pronunciation_private.pretest_hash((user_metadata->'wordTimings')::text) FROM storage.objects WHERE name='${a.path}'))`).join(',')};UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${d.id}'`)
  const start=req=>rpc('sitov_start_pronunciation_pretest',[textId,req??request()]),get=id=>rpc('sitov_get_pronunciation_pretest_attempt',[id]),save=(a,answers,req=request(),revision=a.revision)=>rpc('sitov_save_pronunciation_pretest_answers',[a.id,revision,answers,req]),submit=(a,answers,req=request(),revision=a.revision)=>rpc('sitov_submit_pronunciation_pretest',[a.id,revision,answers,req])
  const canonicalAnswers=data=>Object.fromEntries(data.attempt.questionIds.map(id=>[id,definition.tasks.find(q=>q.id===id).correctOptionId]))
  const presentedAnswers=data=>Object.fromEntries(data.tasks.map(q=>{const canonical=definition.tasks.find(c=>c.id===q.id),correctText=canonical.options.find(o=>o.id===canonical.correctOptionId).textDe;return[q.id,q.options.find(o=>o.textDe===correctText).id]}))
  await db.actor(sitovUsers.explicitAll);const oldPassed=(await start()).data;assert.equal((await submit(oldPassed.attempt,canonicalAnswers(oldPassed))).data.result.passed,true)
  await db.actor(sitovUsers.all);const oldOpen=(await start()).data;const oldSaved=await save(oldOpen.attempt,{[oldOpen.attempt.questionIds[0]]:canonicalAnswers(oldOpen)[oldOpen.attempt.questionIds[0]]})
  await db.actor(null,'postgres');const previous=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts ORDER BY id')).rows,previousPasses=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_passes ORDER BY id')).rows,previousReceipts=(await db.query('SELECT * FROM sitov_pronunciation_private.pretest_receipts ORDER BY request_id')).rows
  const attrs=async()=>(await db.query("SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='sitov_pronunciation_private.pretest_command(text,uuid,uuid,integer,jsonb,uuid,text)'::regprocedure")).rows
  const before=await attrs()
  let first,second
  await t.test('additive migration mirrors/replays and leaves canonical definitions, assets and historical snapshots unchanged',async()=>{
   assert.equal(sql,await readFile(new URL('../../supabase/vps/98_sitov_pretest_option_presentation.sql',import.meta.url),'utf8'));await db.exec(sql);await db.exec(sql)
   assert.deepEqual(await attrs(),before);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts ORDER BY id')).rows,previous);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_passes ORDER BY id')).rows,previousPasses);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_receipts ORDER BY request_id')).rows,previousReceipts)
   assert.deepEqual((await db.query('SELECT id,text_version,test_version,definition FROM sitov_pronunciation_private.pretest_definitions WHERE id=$1',[d.id])).rows[0],d)
   await db.actor(sitovUsers.all);const oldResumed=await get(oldOpen.attempt.id);assert.deepEqual(oldResumed.data.tasks,oldOpen.tasks);assert.deepEqual(oldResumed.data.attempt.answers,oldSaved.data.answers)
   await db.actor(sitovUsers.explicitAll);assert.equal((await get(oldPassed.attempt.id)).data.result.passed,true)
  })
  await t.test('new public options are opaque UUIDv4 tokens with exact German wording; private mapped key matches meaning',async()=>{
   await db.actor(sitovUsers.german);first=(await start()).data;assert.equal(first.tasks.length,12)
   const values=first.tasks.flatMap(q=>q.options.map(o=>o.id));assert.equal(new Set(values).size,values.length);assert.ok(values.every(id=>tokenPattern.test(id)))
   const publicShape=q=>['competencyId','fragmentDe','id','kind','options','promptDe'].sort()
   for(const q of first.tasks){const authored=definition.tasks.find(c=>c.id===q.id);assert.deepEqual(Object.keys(q).sort(),publicShape(q));assert.equal(q.promptDe,authored.promptDe);assert.equal(q.fragmentDe,authored.fragmentDe);assert.deepEqual(q.options.map(o=>o.textDe).sort(),authored.options.map(o=>o.textDe).sort());for(const o of q.options)assert.deepEqual(Object.keys(o).sort(),['id','textDe']);assert.ok(!q.options.some(o=>authored.options.some(a=>a.id===o.id)))}
   await db.actor(null,'postgres');const privateTasks=(await db.query('SELECT tasks FROM sitov_pronunciation_private.pretest_attempts WHERE id=$1',[first.attempt.id])).rows[0].tasks,expected=presentedAnswers(first)
   for(const q of privateTasks){assert.equal(q.correctOptionId,expected[q.id]);assert.deepEqual(q.options,first.tasks.find(p=>p.id===q.id).options)}await db.actor(sitovUsers.german)
   assert.ok(!JSON.stringify(first).includes('correctOptionId'));assert.ok(!JSON.stringify(first).includes('rationaleDe'));assert.ok(!JSON.stringify(first).includes('sourceSpans'))
  })
  await t.test('canonical and foreign option answers denied; tokens/CAS/receipt/resume remain stable',async()=>{
   const a=first.attempt,id=a.questionIds[0];assert.equal((await save(a,{[id]:canonicalAnswers(first)[id]})).error,'invalid_answer')
   const other=first.tasks.find(q=>q.id!==id).options[0].id;assert.equal((await save(a,{[id]:other})).error,'invalid_answer')
   const req=request(),input={[id]:presentedAnswers(first)[id]},saved=await save(a,input,req);assert.equal(saved.ok,true);assert.equal(saved.data.revision,1);assert.deepEqual(await save(a,input,req),saved);assert.equal((await save(a,{},req)).error,'request_conflict');assert.equal((await save(a,input,request(),0)).error,'attempt_conflict')
   const resumed=await get(a.id);assert.deepEqual(resumed.data.tasks,first.tasks);assert.deepEqual(resumed.data.attempt.answers,input);assert.deepEqual((await start()).data.tasks,first.tasks);first=resumed.data
   const wrong=Object.fromEntries(first.tasks.map(q=>{const key=presentedAnswers(first)[q.id];return[q.id,q.options.find(o=>o.id!==key).id]}));const failed=await submit(first.attempt,wrong);assert.equal(failed.data.result.correct,0);assert.equal(failed.data.result.passed,false)
  })
  await t.test('retake is balanced/disjoint; correct German choices map to tokens and actual current-pass grading',async()=>{
   // Two actual simultaneous sessions must publish one newly randomized snapshot.
   const concurrentStart=async req=>{const query=`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${sitovUsers.german}',false);SELECT sitov_start_pronunciation_pretest('${textId}','${req}');`;const {stdout}=await promisify(execFile)('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',name,'-v','ON_ERROR_STOP=1','-c',query],{env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))});return JSON.parse(stdout.trim().split('\n').at(-1))}
   const concurrent=await Promise.all([concurrentStart(request()),concurrentStart(request())]);assert.equal(concurrent[0].ok,true);assert.deepEqual(concurrent[0],concurrent[1]);second=concurrent[0].data;assert.equal(second.tasks.length,12);assert.ok(second.attempt.questionIds.every(id=>!first.attempt.questionIds.includes(id)))
   const firstTokens=new Set(first.tasks.flatMap(q=>q.options.map(o=>o.id)));assert.ok(second.tasks.every(q=>q.options.every(o=>tokenPattern.test(o.id)&&!firstTokens.has(o.id))))
   for(const c of definition.competencies)assert.equal(second.tasks.filter(q=>q.competencyId===c.id).length,3)
   const req=request(),answers=presentedAnswers(second),done=await submit(second.attempt,answers,req);assert.equal(done.ok,true);assert.equal(done.data.result.correct,12);assert.equal(done.data.result.passed,true);assert.deepEqual(await submit(second.attempt,answers,req),done);assert.equal((await get(second.attempt.id)).data.result.proof.id,done.data.result.proof.id);assert.equal((await submit(second.attempt,answers)).data.result.proof.id,done.data.result.proof.id)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[textId])).rows[0].value,true)
   assert.equal((await db.query('SELECT sentence_de FROM learning_reading_texts WHERE id=$1',[textId])).rows[0].sentence_de,body)
  })
  await t.test('private presenter remains inaccessible;97 metadata guards and original histories remain effective',async()=>{
   await db.actor(sitovUsers.german);await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts'),/permission denied/)
   for(const role of ['anon','authenticated','service_role']){await db.actor(null,role);await assert.rejects(db.query('SELECT sitov_pronunciation_private.present_task($1)',[definition.tasks[0]]),/permission denied/)}
   await db.actor(null,'postgres');assert.deepEqual(await sitovHistorySnapshot(db),history);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts WHERE student_id<>$1 ORDER BY id',[sitovUsers.german])).rows,previous)
   const option=assets.find(a=>a.spoken===definition.tasks[0].options[0].textDe);await db.exec(`UPDATE storage.objects SET user_metadata=user_metadata||'{"voice":"wrong-profile"}'::jsonb WHERE name='${option.path}'`);await db.actor(sitovUsers.german);assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[textId])).rows[0].value,false)
  })
 }finally{await db?.close();admin.raw(`DROP DATABASE ${name} WITH(FORCE)`)}
})
