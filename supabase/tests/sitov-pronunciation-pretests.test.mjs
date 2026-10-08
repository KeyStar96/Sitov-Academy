import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createSitovCurrentNativeDatabase } from './helpers/sitov-night-current-native-db.mjs'
import { sitovId, sitovUsers } from './helpers/sitov-night-current-db.mjs'
const psql='/opt/homebrew/opt/postgresql@17/bin/psql', socket='/tmp/sitov-night-2026-10-08-pg', port='55438'
const text=sitovId(302), student=sitovUsers.german
const sql=await readFile(new URL('../vps/94_sitov_pronunciation_pretests.sql',import.meta.url),'utf8')
const rpc=async(db,name,args=[]) => (await db.query(`SELECT ${name}(${args.map((_,i)=>`$${i+1}`).join(',')}) result`,args)).rows[0].result
const pool={policyId:'sitov-pronunciation-language-prerequisites-v1',competencies:['words','syntax','verbs','case'].map(id=>({id:`sitov.${id}`,itemsPerAttempt:3})),tasks:[]}
for(const core of pool.competencies)for(let i=0;i<6;i++)pool.tasks.push({id:`${core.id}.q${i}`,competencyId:core.id,kind:'single_choice',promptDe:`Wähle die passende Form für Aufgabe ${i+1}.`,fragmentDe:null,options:[{id:'sitov.a',textDe:'Paul geht.'},{id:'sitov.b',textDe:'Paul gehen.'},{id:'sitov.c',textDe:'Paul gehst.'}],correctOptionId:'sitov.a',privateEvidence:'DO NOT LEAK'})
test('94 private pretest core on native full92+93 synthetic PostgreSQL',async t=>{
 const database=`sitov_night_s3_${process.pid}_${Date.now()}`
 execFileSync(psql,['-X','-w','-h',socket,'-p',port,'-d','postgres','-v','ON_ERROR_STOP=1','-c',`CREATE DATABASE ${database}`],{stdio:'pipe'})
 const db=await createSitovCurrentNativeDatabase({database})
 let seq=9000, current
 const start=()=>rpc(db,'sitov_start_pronunciation_pretest',[text,sitovId(seq++)])
 const submit=(a,answers,request=sitovId(seq++),revision=a.revision)=>rpc(db,'sitov_submit_pronunciation_pretest',[a.id,revision,answers,request])
 const answers=a=>Object.fromEntries(a.questionIds.map(id=>[id,'sitov.a']))
 try{
  await db.exec(await readFile(new URL('../vps/93_sitov_commercial_access.sql',import.meta.url),'utf8'));await db.exec(sql)
  await t.test('migration mirrors and replays; private keys/DML and anonymous endpoints denied',async()=>{
   assert.equal(sql,await readFile(new URL('../migrations/20261008213100_sitov_pronunciation_pretests.sql',import.meta.url),'utf8'))
   await db.exec(sql);await db.actor(student)
   await assert.rejects(db.query('SELECT * FROM sitov_pronunciation_private.pretest_definitions'),/permission denied/)
   await assert.rejects(db.exec('INSERT INTO sitov_pronunciation_private.pretest_passes DEFAULT VALUES'),/permission denied/)
   await db.actor(null,'anon');await assert.rejects(rpc(db,'sitov_get_pronunciation_pretests',['A1.1']),/permission denied/)
  })
  await t.test('missing definition fails closed; commercial denied IDs omitted; staff MFA required',async()=>{
   await db.actor(student);assert.equal((await start()).error,'authoring_not_ready')
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).data[0].status,'locked')
   await db.actor(sitovUsers.outsider);assert.equal((await start()).error,'not_found');assert.deepEqual((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).data,[])
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,null])).error,'not_found')
   await db.actor(student,'postgres')
   await db.exec(`INSERT INTO sitov_pronunciation_private.pretest_definitions(text_id,text_version,test_version,definition,active) SELECT '${text}',sitov_pronunciation_private.pretest_hash(sentence_de),repeat('a',64),'${JSON.stringify(pool).replaceAll("'","''")}'::jsonb,true FROM learning_reading_texts WHERE id='${text}'`)
  })
  await t.test('invalid policy/pools cannot activate and definitions are immutable',async()=>{
   await db.actor(student,'postgres')
   const missing={...pool};delete missing.policyId
   assert.equal((await db.query('SELECT sitov_pronunciation_private.valid_pool($1) value',[missing])).rows[0].value,false)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.valid_pool($1) value',[{...pool,tasks:pool.tasks.slice(0,5)}])).rows[0].value,false)
   await assert.rejects(db.exec("UPDATE sitov_pronunciation_private.pretest_definitions SET definition=definition||'{\"extra\":true}'::jsonb"),/immutable_pretest_definition/)
  })
  await t.test('zero old evidence starts/resumes one balanced account form without keys/body leakage',async()=>{
   await db.actor(student);const req=sitovId(seq++);const first=await rpc(db,'sitov_start_pronunciation_pretest',[text,req]);assert.equal(first.ok,true)
   assert.deepEqual(await rpc(db,'sitov_start_pronunciation_pretest',[text,req]),first)
   current=first.data.attempt;assert.equal(first.data.tasks.length,12);assert.ok(!JSON.stringify(first).includes('DO NOT LEAK'));assert.ok(!JSON.stringify(first).includes('correctOptionId'))
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
   await db.actor(student,'postgres');await db.exec(`UPDATE learning_reading_texts SET sentence_de='Paul fährt nach Hause.' WHERE id='${text}'`);await db.actor(student)
   assert.equal((await db.query('SELECT sitov_pronunciation_private.current_pass($1) value',[text])).rows[0].value,false)
   assert.equal((await start()).error,'authoring_not_ready');assert.equal((await submit(current,input)).error,'version_conflict')
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).data[0].lockedReason,'version_changed')
   const history=await rpc(db,'sitov_get_pronunciation_pretest_attempt',[current.id]);assert.equal(history.data.result.passed,true)
  })
  await t.test('admin requires verified TOTP/AAL2 under existing password-only teacher policy',async()=>{
   await db.actor(null,'postgres');await db.exec(`UPDATE profiles SET role='admin' WHERE id='${sitovUsers.teacher}'`)
   await db.actor(sitovUsers.teacher);assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,null])).error,'not_found')
   await db.actor(sitovUsers.teacher,'postgres');await db.exec(`INSERT INTO auth.mfa_factors(user_id,status,factor_type) VALUES('${sitovUsers.teacher}','verified','totp')`)
   await db.actor(sitovUsers.teacher,'authenticated',{aal:'aal2'});const staff=await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,student]);assert.equal(staff.ok,true);assert.equal(staff.data.definitions.length,1)
   assert.equal((await rpc(db,'sitov_get_pronunciation_pretest_staff',[text,sitovUsers.outsider])).data.attempts.length,0)
  })
  await t.test('rollback revokes APIs without deleting results; replay restores API only',async()=>{
   await db.actor(student,'postgres')
   const before=(await db.query('SELECT count(*)::int n FROM sitov_pronunciation_private.pretest_attempts')).rows[0].n
   await db.exec(await readFile(new URL('../vps/rollback/94_sitov_pronunciation_pretests.sql',import.meta.url),'utf8'))
   await db.actor(student);await assert.rejects(rpc(db,'sitov_get_pronunciation_pretests',['A1.1']),/permission denied/)
   await db.actor(student,'postgres');assert.equal((await db.query('SELECT count(*)::int n FROM sitov_pronunciation_private.pretest_attempts')).rows[0].n,before)
   await db.exec(sql);await db.actor(student);assert.equal((await rpc(db,'sitov_get_pronunciation_pretests',['A1.1'])).ok,true)
  })
 }finally{await db.close();execFileSync(psql,['-X','-w','-h',socket,'-p',port,'-d','postgres','-c',`DROP DATABASE ${database} WITH (FORCE)`],{stdio:'pipe'})}
})
