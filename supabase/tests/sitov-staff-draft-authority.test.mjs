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
const sql103=await readFile(new URL('../migrations/20261009011000_sitov_staff_draft_authority.sql',import.meta.url),'utf8'),sql102=await readFile(new URL('../migrations/20261009010000_sitov_pretest_staff_publication.sql',import.meta.url),'utf8')
const sql=await readFile(new URL('../migrations/20261009004000_sitov_pretest_staff_drafts.sql',import.meta.url),'utf8'),sql97=await readFile(new URL('../migrations/20261009001000_sitov_storage_proof_compatibility.sql',import.meta.url),'utf8')
const literal=v=>`'${JSON.stringify(v).replaceAll("'","''")}'::jsonb`,hash=t=>createHash('sha256').update(t).digest('hex'),fingerprint='96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const drafts=JSON.parse(await readFile(new URL('../seeds/sitov-pronunciation-pretests-2026-10-08.json',import.meta.url),'utf8')).drafts,sources=await sitovReadAuthoringSources()
const sql99=await readFile(new URL('../migrations/20261009003000_sitov_readonly_audio_proofs.sql',import.meta.url),'utf8')
const sql98=await readFile(new URL('../migrations/20261009002000_sitov_pretest_option_presentation.sql',import.meta.url),'utf8')
test('103 draft authority remains current across source/request/factor waits and preserves100/102',async t=>{
 const name=`sitov_night_authority103_${process.pid}_${Date.now()}`,admin=new SitovNativeDatabase();admin.raw(`CREATE DATABASE ${name}`);let db
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
  let first;let replay;let adminReplay
  await t.test('mirrors/replays;student/anonymous/service deny and private DML inaccessible',async()=>{
   assert.equal(sql,await readFile(new URL('../vps/100_sitov_pretest_staff_drafts.sql',import.meta.url),'utf8'));await db.exec(sql);await db.exec(sql);const before=(await db.query("SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='sitov_pronunciation_private.save_draft(uuid,text,uuid,jsonb,uuid)'::regprocedure")).rows[0];assert.equal(sql103,await readFile(new URL('../vps/103_sitov_staff_draft_authority.sql',import.meta.url),'utf8'));await db.exec(sql103);await db.exec(sql103);await db.exec(sql102);assert.deepEqual((await db.query("SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid='sitov_pronunciation_private.save_draft(uuid,text,uuid,jsonb,uuid)'::regprocedure")).rows[0],before)
   await db.actor(sitovUsers.german);assert.equal((await call(d.id,revise('Student darf das nicht.'))).error,'not_found');await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.draft_receipts'),/permission denied/);await assert.rejects(db.query('SELECT sitov_pronunciation_private.sitov_lock_draft_staff_authority()'),/permission denied/);await assert.rejects(db.exec('INSERT INTO sitov_pronunciation_private.pretest_definitions DEFAULT VALUES'),/permission denied/)
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
   await db.actor(adminId,'authenticated',{aal:'aal1'});assert.equal((await call(first.data.id,revise('Admin AAL1.'))).error,'not_found');await db.actor(adminId,'authenticated',{aal:'aal2'});adminReplay={base:first.data.id,def:revise('Admin bestätigt die Erklärung.'),req:request()};const next=await call(adminReplay.base,adminReplay.def,adminReplay.req);assert.equal(next.ok,true);adminReplay.ack=next;first=next
   await db.actor(null,'postgres');await db.exec(`DELETE FROM auth.mfa_factors WHERE id='${sitovId(100106)}';UPDATE profiles SET role='student',sitov_mfa_required=false WHERE id='${adminId}'`)
  })
  await t.test('actual concurrent different saves CAS one winner;same request identical receipt',async()=>{
   const parallel=async(def,req)=>{const query=`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${sitovUsers.teacher}',false);SELECT sitov_save_pronunciation_pretest_draft('${textId}','${d.text_version}','${first.data.id}',${literal(def)},'${req}');`;const {stdout}=await promisify(execFile)('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',name,'-v','ON_ERROR_STOP=1','-c',query],{env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))});return JSON.parse(stdout.trim().split('\n').at(-1))}
   const results=await Promise.all([parallel(revise('Parallel A.'),request()),parallel(revise('Parallel B.'),request())]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).error,'version_conflict');first=results.find(r=>r.ok)
   const replayBase=first.data.id,def=revise('Identische Wiederholung.'),req=request(),same=await Promise.all([parallel(def,req),parallel(def,req)]);assert.equal(same[0].ok,true);assert.deepEqual(same[0],same[1]);first=same[0];replay={base:replayBase,def,req,ack:first}
   await db.actor(null,'postgres');await db.exec(`UPDATE learning_reading_texts SET sentence_de=sentence_de||' Geändert.' WHERE id='${textId}'`);await db.actor(sitovUsers.teacher);assert.deepEqual(await call(replayBase,def,req),first);assert.equal((await parallel(revise('Nach Quellenänderung.'),request())).error,'version_conflict');await db.actor(null,'postgres');await db.exec(`UPDATE learning_reading_texts SET sentence_de='${body.replaceAll("'","''")}' WHERE id='${textId}'`)
  })
  const execProcess=sql=>promisify(execFile)('/opt/homebrew/opt/postgresql@17/bin/psql',['-X','-w','-qAt','-h','/tmp/sitov-night-2026-10-08-pg','-p','55438','-d',name,'-v','ON_ERROR_STOP=1','-c',sql],{env:Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('PG')))})
  const waitFor=async(app,event)=>{for(let i=0;i<60;i++){if((await db.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1 AND wait_event_type=$2) value',[app,event])).rows[0].value)return;await new Promise(r=>setTimeout(r,10))}assert.fail(`fixture process ${app} did not reach ${event}`)}
  const claimSql=(uid,extra={})=>`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${uid}',true);SELECT set_config('request.jwt.claims',${literal({sub:uid,role:'authenticated',...extra})}::text,true);`
  const draftSql=(v,uid=sitovUsers.teacher,extra={})=>claimSql(uid,extra)+`SELECT sitov_save_pronunciation_pretest_draft('${textId}','${d.text_version}','${v.base}',${literal(v.def)},'${v.req}');`
  const state=async()=>{await db.actor(null,'postgres');return(await db.query('SELECT (SELECT count(*) FROM sitov_pronunciation_private.pretest_definitions)::int definitions,(SELECT count(*) FROM sitov_pronunciation_private.draft_receipts)::int receipts')).rows[0]}
  const blockedRevocation=async({kind,uid,extra={},v,revoke,restore})=>{
   await db.actor(null,'postgres');const before=await state(),holderApp='sitov-authority103-holder-'+kind,waiterApp='sitov-authority103-waiter-'+kind
   const lock=kind==='profile-row'?`UPDATE profiles SET role='student' WHERE id='${uid}';`:kind==='factor-row'?`UPDATE auth.mfa_factors SET status='unverified' WHERE id='${sitovId(103106)}';`:kind.startsWith('advisory')?`SELECT pg_advisory_xact_lock(hashtextextended('sitov-pretest-draft-request:${uid}:${v.req}',0));`:`UPDATE learning_reading_texts SET sentence_de=sentence_de WHERE id='${textId}';`
   const holder=execProcess(`BEGIN;SET application_name='${holderApp}';${lock}SELECT pg_sleep(1);COMMIT;`);let waiter
   try{await waitFor(holderApp,'Timeout');waiter=execProcess(`BEGIN;SET application_name='${waiterApp}';${draftSql(v,uid,extra)}COMMIT;`);await waitFor(waiterApp,'Lock');await db.exec(revoke);await holder;const out=JSON.parse((await waiter).stdout.trim().split('\n').at(-1));assert.equal(out.error,'not_found');assert.deepEqual(await state(),before)}finally{await holder;await waiter;await db.exec(restore)}
  }
  await t.test('actual source-lock wait then teacher role revoked creates no definition or receipt',async()=>{
   await blockedRevocation({kind:'source-role',uid:sitovUsers.teacher,v:{base:first.data.id,def:revise('Rollenentzug während Quellsperre.'),req:request()},revoke:`UPDATE profiles SET role='student' WHERE id='${sitovUsers.teacher}'`,restore:`UPDATE profiles SET role='teacher' WHERE id='${sitovUsers.teacher}'`})
  })
  await t.test('actor profile lock wait rereads committed role revocation',async()=>{
   await blockedRevocation({kind:'profile-row',uid:sitovUsers.teacher,v:{base:first.data.id,def:revise('Profilstatus wird nach Sperre neu gelesen.'),req:request()},revoke:'SELECT 1',restore:`UPDATE profiles SET role='teacher' WHERE id='${sitovUsers.teacher}'`})
  })
  await t.test('actual advisory new-save/receipt wait then role revoked denies existing receipt and changed payload',async()=>{
   await blockedRevocation({kind:'advisory-new',uid:sitovUsers.teacher,v:{base:first.data.id,def:revise('Neue Fassung nach entzogenem Request-Lock.'),req:request()},revoke:`UPDATE profiles SET role='student' WHERE id='${sitovUsers.teacher}'`,restore:`UPDATE profiles SET role='teacher' WHERE id='${sitovUsers.teacher}'`})
   await blockedRevocation({kind:'advisory-role',uid:sitovUsers.teacher,v:replay,revoke:`UPDATE profiles SET role='student' WHERE id='${sitovUsers.teacher}'`,restore:`UPDATE profiles SET role='teacher' WHERE id='${sitovUsers.teacher}'`})
   await blockedRevocation({kind:'advisory-changed',uid:sitovUsers.teacher,v:{...replay,def:revise('Andere Antwort trotz Rollenentzug.')},revoke:`UPDATE profiles SET role='student' WHERE id='${sitovUsers.teacher}'`,restore:`UPDATE profiles SET role='teacher' WHERE id='${sitovUsers.teacher}'`})
  })
  await t.test('current admin AAL2/verified factor required; forged role/aal cannot substitute DB authority',async()=>{
   const uid=sitovUsers.explicitAll;await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET role='admin',sitov_mfa_required=true WHERE id='${uid}'`)
   await db.actor(uid,'authenticated',{aal:'aal2',app_metadata:{role:'admin'}});assert.equal((await call(adminReplay.base,adminReplay.def,adminReplay.req)).error,'not_found')
   await db.actor(sitovUsers.german,'authenticated',{aal:'aal2',app_metadata:{role:'admin'},user_metadata:{role:'teacher'}});assert.equal((await call(first.data.id,revise('Gefälschte Rollendeklaration.'))).error,'not_found')
   await db.actor(null,'postgres');await db.exec(`INSERT INTO auth.mfa_factors(id,user_id,factor_type,status) VALUES('${sitovId(103106)}','${uid}','totp','verified')`)
   await db.actor(uid,'authenticated',{aal:'aal1'});assert.equal((await call(adminReplay.base,adminReplay.def,adminReplay.req)).error,'not_found');await db.actor(uid,'authenticated',{aal:'aal2'});assert.deepEqual(await call(adminReplay.base,adminReplay.def,adminReplay.req),adminReplay.ack)
   await blockedRevocation({kind:'factor-row',uid,extra:{aal:'aal2'},v:{base:first.data.id,def:revise('MFA-Status wird nach Faktor-Sperre geprüft.'),req:request()},revoke:'SELECT 1',restore:`UPDATE auth.mfa_factors SET status='verified' WHERE id='${sitovId(103106)}'`})
   await blockedRevocation({kind:'source-factor',uid,extra:{aal:'aal2'},v:{base:first.data.id,def:revise('MFA-Entzug während Quellsperre.'),req:request()},revoke:`UPDATE auth.mfa_factors SET status='unverified' WHERE id='${sitovId(103106)}'`,restore:`UPDATE auth.mfa_factors SET status='verified' WHERE id='${sitovId(103106)}'`})
   await blockedRevocation({kind:'advisory-factor',uid,extra:{aal:'aal2'},v:adminReplay,revoke:`DELETE FROM auth.mfa_factors WHERE id='${sitovId(103106)}'`,restore:`INSERT INTO auth.mfa_factors(id,user_id,factor_type,status) VALUES('${sitovId(103106)}','${uid}','totp','verified')`})
  })
  await t.test('profile and factor SHARE locks survive successful save or receipt until transaction end',async()=>{
   const uid=sitovUsers.explicitAll;await db.actor(null,'postgres')
   for(const [kind,v] of [['new',{base:first.data.id,def:revise('Transaktion schützt aktuelle Autorität.'),req:request()}],['receipt',adminReplay]]){
    const before=await state(),app='sitov-authority103-commit-'+kind,holder=execProcess(`BEGIN;SET application_name='${app}';${draftSql(v,uid,{aal:'aal2'})}SELECT pg_sleep(1.2);ROLLBACK;`)
    try{await waitFor(app,'Timeout');await assert.rejects(db.exec(`SET lock_timeout='120ms';UPDATE profiles SET role='student' WHERE id='${uid}'`),/lock timeout/);await assert.rejects(db.exec(`SET lock_timeout='120ms';DELETE FROM auth.mfa_factors WHERE id='${sitovId(103106)}'`),/lock timeout/)}finally{const out=(await holder).stdout.trim().split('\n');assert.ok(out.some(line=>line.startsWith('{')&&JSON.parse(line).ok===true))}assert.deepEqual(await state(),before)
   }
   await db.exec(`DELETE FROM auth.mfa_factors WHERE id='${sitovId(103106)}';UPDATE profiles SET role='student',sitov_mfa_required=false WHERE id='${uid}'`)
  })
  await t.test('current102 readiness remains read-only and unapproved publication cannot alter old active',async()=>{
   await db.actor(null,'postgres');const out=db.raw(`BEGIN READ ONLY;${claimSql(sitovUsers.teacher)}SELECT sitov_get_pronunciation_pretest_publication('${textId}','${first.data.id}','${first.data.text_version}','${first.data.test_version}','${d.id}');COMMIT;`);assert.equal(JSON.parse(out.split('\n').at(-1)).data.ready,false)
   await db.actor(sitovUsers.teacher);assert.equal((await rpc('sitov_publish_pronunciation_pretest',[textId,first.data.id,first.data.text_version,first.data.test_version,d.id,request()])).error,'authoring_not_ready')
  })
  await t.test('active version/attempt/pass/history unchanged;new draft immutable,no approval/audio waiver',async()=>{
   await db.actor(null,'postgres');assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_definitions WHERE id=$1',[d.id])).rows[0],before);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_attempts ORDER BY id')).rows,oldAttempts);assert.deepEqual((await db.query('SELECT * FROM sitov_pronunciation_private.pretest_passes ORDER BY id')).rows,oldPasses);assert.deepEqual(await sitovHistorySnapshot(db),history)
   await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET definition=definition||'{"bad":true}' WHERE id='${first.data.id}'`),/immutable_pretest_definition/);await assert.rejects(db.exec(`UPDATE sitov_pronunciation_private.pretest_definitions SET active=true WHERE id='${first.data.id}'`),/pretest_publication_proof_required/)
   await db.actor(sitovUsers.german);assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[textId])).rows[0].value,true)
  })
 }finally{await db?.close();admin.raw(`DROP DATABASE ${name} WITH(FORCE)`)}
})
