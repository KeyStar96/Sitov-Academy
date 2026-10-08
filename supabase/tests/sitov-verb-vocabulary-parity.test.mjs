import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, apply, actor, id, student, outsider, result, vocabularyUnit } from './helpers/current-db.mjs'

await test('Sitov vocabulary and verb trainers share graded daily phase rules and read-only repeats', async t => {
 const db = await createCurrentDatabase()
 let sequence=92000
 const admin=()=>db.exec('RESET ROLE')
 const login=()=>actor(db,student)
 const verb='sitov-verb-fahren', otherVerb='sitov-verb-arbeiten'
 const grade=(cid,answer)=>result(db,'SELECT sitov_submit_verb_answer($1,$2) result',[cid,JSON.stringify(answer)])
 const retry=(cid,answer)=>result(db,'SELECT sitov_check_verb_retry($1,$2) result',[cid,JSON.stringify(answer)])
 const challenge=async({expected=[['fährt']],tense='present',which=verb,expires=null}={})=>{
  const cid=id(sequence++); await admin()
  await db.query("INSERT INTO sitov_verb_challenges(id,auth_user_id,verb_id,context_level,tense,expected,solution,expires_at) VALUES($1,$2,$3,'A1.2',$4,$5,'fährt',coalesce($6::timestamptz,clock_timestamp()+interval '2 hours'))",[cid,student,which,tense,JSON.stringify(expected),expires]);await login();return cid
 }
 const arm=async(box=1,which=verb,tense='present',date='2020-01-01',last=null)=>{
  await admin();await db.query('DELETE FROM sitov_verb_progress WHERE auth_user_id=$1',[student])
  await db.query('INSERT INTO sitov_verb_progress(auth_user_id,verb_id,tense,box,attempts,correct,lapses,next_review_at,last_answered_at) VALUES($1,$2,$3,$4,10,8,2,$5,$6)',[student,which,tense,box,date,last]);await login()
 }
 const snapshot=async()=>{
  await admin();return result(db,`SELECT jsonb_build_object('progress',(SELECT jsonb_agg(to_jsonb(p) ORDER BY auth_user_id,verb_id,tense) FROM sitov_verb_progress p),
   'challenges',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM sitov_verb_challenges c),
   'activity',(SELECT jsonb_agg(to_jsonb(d) ORDER BY auth_user_id,day) FROM learning_activity_days d),
   'box',(SELECT jsonb_agg(to_jsonb(b) ORDER BY auth_user_id,verb_id) FROM sitov_verb_box b)) result`)
 }
 const date=(n,at='now()')=>db.query(`SELECT sitov_verb_private.review_day(${at},$1) value`,[n]).then(r=>r.rows[0].value)
 try {
  await db.exec("INSERT INTO cefr_levels VALUES('A2'),('B1'),('B2'),('C1') ON CONFLICT DO NOTHING;INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A2',3),('A2.2','A2',4),('B1.1','B1',5),('B1.2','B1',6) ON CONFLICT DO NOTHING")
  for(const f of ['59_daily_quests.sql','60_daily_quest_resume.sql','61_account_learning_checkpoints.sql','62_verb_trainer_enums.sql','63_verb_trainer.sql','65_sitov_verb_learning_progress.sql'])await apply(db,[f])
  await db.query('INSERT INTO student_level_access(auth_user_id,level) VALUES($1,\'A1.2\') ON CONFLICT DO NOTHING',[student]);await login()
  await result(db,"SELECT sitov_set_verb_box('A1.2',ARRAY['sitov-verb-fahren','sitov-verb-arbeiten'],true) result")
  await t.test('legacy dates reschedule without rewriting boxes, counts, selected verbs or receipts',async()=>{
   await arm(5)
   const cid=await challenge();await admin()
   const before=(await db.query('SELECT * FROM sitov_verb_progress')).rows[0]
   await db.query("UPDATE sitov_verb_progress SET last_answered_at=now(),next_review_at=now()+interval '5 minutes'")
   await db.query("UPDATE sitov_verb_challenges SET answer='[\"wrong\"]',result=jsonb_build_object('correct',false,'progress',jsonb_build_object('lastAnsweredAt',now())) WHERE id=$1",[cid])
   const receipt=(await db.query('SELECT result FROM sitov_verb_challenges WHERE id=$1',[cid])).rows[0].result
   // Keep exact matching answer timestamps across separate fixture statements.
   await db.query("UPDATE sitov_verb_progress SET last_answered_at=($1::jsonb->'progress'->>'lastAnsweredAt')::timestamptz",[JSON.stringify(receipt)])
   await apply(db,['92_sitov_verb_vocabulary_parity.sql'])
   const after=(await db.query('SELECT * FROM sitov_verb_progress')).rows[0]
   for(const key of ['box','attempts','correct','lapses'])assert.equal(after[key],before[key])
   assert.equal(after.next_review_at.getTime(),(await date(1)).getTime())
   assert.deepEqual((await db.query('SELECT result FROM sitov_verb_challenges WHERE id=$1',[cid])).rows[0].result,receipt)
   const state=await snapshot();await apply(db,['92_sitov_verb_vocabulary_parity.sql']);assert.deepEqual(await snapshot(),state)
  })
  await t.test('correct answers climb one phase with vocabulary calendar intervals and phase7 archive',async()=>{
   for(let box=1;box<=6;box++){
    await arm(box);const cid=await challenge();const r=await grade(cid,['fährt'])
    assert.equal(r.correct,true,JSON.stringify(r));assert.equal(r.retry,false);assert.equal(r.progress.box,box+1);assert.equal(r.progress.attempts,11)
    await admin();assert.equal((await db.query('SELECT next_review_at FROM sitov_verb_progress')).rows[0].next_review_at.getTime(),(await date([1,3,9,29,90,90][box-1])).getTime())
    assert.equal(r.progress.nextReviewAt===null,box===6)
   }
  })
  await t.test('wrong forms from every phase return directly to1 and tomorrow, including reveal',async()=>{
   for(let box=1;box<=6;box++){
    await arm(box);const cid=await challenge();const r=await grade(cid,[box===1?'':'wrong'])
    assert.equal(r.correct,false,JSON.stringify(r));assert.equal(r.progress.box,1);assert.equal(r.progress.attempts,11);assert.equal(r.progress.correct,8);assert.equal(r.progress.lapses,3)
    await admin();assert.equal((await db.query('SELECT next_review_at FROM sitov_verb_progress')).rows[0].next_review_at.getTime(),(await date(1)).getTime())
   }
  })
  await t.test('same-day retries reuse original challenge and never write progress, receipts or activity',async()=>{
   await arm(5);const cid=await challenge();const r=await grade(cid,['wrong']);assert.equal(r.progress.box,1)
   await admin();await db.query("UPDATE sitov_verb_challenges SET expires_at=now()-interval '1 minute' WHERE id=$1",[cid])
   const state=await snapshot();await login()
   assert.equal((await retry(cid,['wrong'])).correct,false)
   const fixed=await retry(cid,['fährt']);assert.equal(fixed.correct,true);assert.equal(fixed.retry,true);assert.deepEqual(fixed.progress,r.progress)
   const fresh=await challenge();const freshState=await snapshot();await login();assert.equal((await retry(fresh,['fährt'])).error,'retry_not_available');assert.equal((await grade(fresh,['fährt'])).error,'review_not_due')
   assert.deepEqual(await snapshot(),freshState)
   await admin();await db.query('DELETE FROM sitov_verb_challenges WHERE id=$1',[fresh]);assert.deepEqual(await snapshot(),state)
   await login();assert.deepEqual(await grade(cid,['wrong']),r,'expired receipt replay stays idempotent');assert.equal((await grade(cid,['fährt'])).error,'conflict')
  })
  await t.test('future forms and learned forms reject fresh attempts, previous-day retry is unavailable',async()=>{
   for(const [box,when] of [[4,'2099-01-01'],[7,'2020-01-01']]){
    await arm(box,verb,'present',when);const cid=await challenge();const state=await snapshot();await login();assert.equal((await grade(cid,['fährt'])).error,'review_not_due');assert.deepEqual(await snapshot(),state)
   }
   await arm(5);const cid=await challenge();await grade(cid,['wrong']);await admin();await db.query("UPDATE sitov_verb_progress SET last_answered_at=now()-interval '1 day'");await login();assert.equal((await retry(cid,['fährt'])).error,'retry_not_available')
   // Old five-minute records cannot score twice today even when their date is due.
   await arm(4,verb,'present','2020-01-01',new Date().toISOString());const due=await challenge();assert.equal((await grade(due,['fährt'])).error,'review_not_due')
  })
  await t.test('shared grader accepts spelling/capitalization and soft errors keep previous interval',async()=>{
   for(const [answer,soft,interval] of [['FÄHRT.',null,29],['faehrt','umlaut',9],['färt','typo',9]]){
    await arm(4);const cid=await challenge();const r=await grade(cid,[answer]);assert.equal(r.correct,true,JSON.stringify(r));assert.equal(r.softError,soft);assert.equal(r.progress.box,5)
    await admin();assert.equal((await db.query('SELECT next_review_at FROM sitov_verb_progress')).rows[0].next_review_at.getTime(),(await date(interval)).getTime())
   }
  })
  await t.test('the latest graded verb blocks sibling forms until another verb, without affecting replay/retry',async()=>{
   await arm(2,verb,'present','2020-01-01','2020-01-01');const sibling=await challenge({tense:'perfect'});assert.equal((await grade(sibling,['fährt'])).error,'spacing_required')
   const next=await challenge({which:otherVerb});assert.equal((await grade(next,['fährt'])).correct,true)
   assert.equal((await grade(sibling,['fährt'])).correct,true)
  })
  await t.test('calendar intervals cross Berlin DST without turning days into24hours',async()=>{
   await admin()
   for(const [at,expected] of [["'2026-03-28 21:00+00'::timestamptz",'2026-03-28T23:00:00.000Z'],["'2026-10-24 21:00+00'::timestamptz",'2026-10-24T22:00:00.000Z']])assert.equal((await date(1,at)).toISOString(),expected)
  })
  await t.test('vocabulary typed/flashcard later-phase mistakes use phase1 and nextday with unchanged receipt replay',async()=>{
   await admin();const card=id(sequence++);await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article) VALUES($1,$2,'Haus','das')",[card,vocabularyUnit])
   await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом'),($1,'de','Haus')",[card])
   await login();await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId:card,alreadyKnown:false}])])
   const progress=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='native_to_de'",[card])).rows[0].id
   for(const typed of [true,false]){
    await admin();await db.query("UPDATE vocabulary_direction_progress SET box_number=6,next_review_date='2020-01-01',last_answered_at=NULL WHERE id=$1",[progress]);await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student]);await login()
    const request=id(sequence++);const q=typed?'SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4) result':'SELECT submit_vocabulary_self_rating_once($1,$2,$3,$4) result';const params=[request,progress,typed?'das Auto':false,'ru'];const r=await result(db,q,params)
    assert.equal(r.isCorrect,false,JSON.stringify(r));assert.equal(r.newPhase,1);assert.equal(r.intervalInDays,1);assert.deepEqual(await result(db,q,params),r)
    await admin();const p=(await db.query('SELECT box_number,next_review_date FROM vocabulary_direction_progress WHERE id=$1',[progress])).rows[0];assert.equal(p.box_number,1);assert.equal(p.next_review_date.getTime(),(await date(1)).getTime())
   }
  })
  await t.test('native smoke verifies the deployed contract and rolls back all fixture rows',async()=>{
   await admin();await db.exec("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb DEFAULT '{}';ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS aud text;ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role text;ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS updated_at timestamptz")
   const before=await snapshot();const sql=await readFile(new URL('../../deploy/vps/tests/sitov-verb-vocabulary-parity.sql',import.meta.url),'utf8');await db.exec(sql.replace(/^\\set[^\n]*\n/gm,''));assert.deepEqual(await snapshot(),before)
  })
  await t.test('other users, anonymous callers and revoked selection cannot inspect retry answer keys',async()=>{
   await arm(5);const cid=await challenge();await grade(cid,['wrong']);await actor(db,outsider);assert.equal((await retry(cid,['fährt'])).error,'not_found')
   await actor(db,null,'anon');await assert.rejects(db.query("SELECT sitov_check_verb_retry($1,'[\"fährt\"]')",[cid]),e=>e.code==='42501')
   await login();await result(db,"SELECT sitov_set_verb_box('A1.2',ARRAY['sitov-verb-fahren'],false) result");assert.equal((await retry(cid,['fährt'])).error,'not_authorized');assert.equal((await grade(cid,['wrong'])).error,'not_authorized')
  })
 }finally{await db.close()}
})
