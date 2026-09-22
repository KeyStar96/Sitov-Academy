import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase3Database,actor,id,student,outsider,vocabularyUnit,result,apply} from './helpers/phase3-db.mjs'

// Migration 22: the Leitner box follows the phase-6 core rules.
//   1. First attempt right  -> one phase up, the new phase's interval.
//   2. First attempt wrong  -> one phase down (never below 1), due TOMORROW.
//   3. Only the first attempt of the day counts; later attempts are retries
//      that are graded from stored content but never move phase or date.
// Dates are Berlin calendar days: "1 day" means "from tomorrow 00:00".

const MIGRATIONS=['18_vocabulary_self_rating.sql','19_vocabulary_self_rating_fix.sql','20_vocabulary_learner_mode.sql',
 '21_vocabulary_sentence_learner_choice.sql','22_vocabulary_phase6_rules.sql']
const INTERVALS=[1,3,9,29,90,90]

await test('phase-6 rules: first attempt decides, wrong comes back tomorrow, retries never write',async t=>{
 const db=await createPhase3Database()
 await apply(db,MIGRATIONS)
 let sequence=900
 const admin=()=>db.exec('RESET ROLE')
 const addCard=async({word='Haus',article='das',plural=null}={})=>{
  const cardId=id(sequence++)
  await admin()
  await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,plural,sentence_practice) VALUES($1,$2,$3,$4,$5,false)',
   [cardId,vocabularyUnit,word,article,plural])
  for(const [locale,value] of [['de',word],['ru','дом'],['en','house'],['uk','будинок'],['tr','ev']])
   await db.query('INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,$2,$3)',[cardId,locale,value])
  await actor(db,student)
  await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId,alreadyKnown:false}])])
  return cardId
 }
 const progressOf=async(cardId,direction='native_to_de')=>
  (await db.query('SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction=$2',[cardId,direction])).rows[0].id
 const stateOf=async(progressId)=>{
  await admin()
  const row=(await db.query('SELECT box_number,lapses,next_review_date,last_answered_at FROM vocabulary_direction_progress WHERE id=$1',[progressId])).rows[0]
  await actor(db,student)
  return row
 }
 const reviewDay=async(days)=>{
  await admin()
  const value=(await db.query('SELECT vocabulary_private.review_day($1) v',[days])).rows[0].v
  await actor(db,student)
  return value
 }
 /** Due again in a chosen box, not answered today, spacing cursor cleared. */
 const arm=async(progressId,box)=>{
  await admin()
  await db.query("UPDATE vocabulary_direction_progress SET box_number=$2,next_review_date='2020-01-01',last_answered_at=NULL WHERE id=$1",[progressId,box])
  await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student])
  await actor(db,student)
 }
 const type=async(progressId,answer,lang='ru')=>
  result(db,'SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4) result',[id(sequence++),progressId,answer,lang])
 const rate=async(progressId,known,lang='ru')=>
  result(db,'SELECT submit_vocabulary_self_rating_once($1,$2,$3,$4) result',[id(sequence++),progressId,known,lang])
 const retry=async(progressId,answer,lang='ru')=>
  result(db,'SELECT check_vocabulary_retry($1,$2,$3) result',[progressId,answer,lang])

 await t.test('review_day lands on Berlin midnight, today and tomorrow',async()=>{
  await admin()
  const row=(await db.query(`SELECT to_char(vocabulary_private.review_day(1) AT TIME ZONE 'Europe/Berlin','HH24:MI') midnight,
   vocabulary_private.review_day(0)<=now() today, vocabulary_private.review_day(1)>now() tomorrow,
   extract(epoch FROM vocabulary_private.review_day(1)-vocabulary_private.review_day(0))/3600 hours`)).rows[0]
  assert.equal(row.midnight,'00:00')
  assert.equal(row.today,true)
  assert.equal(row.tomorrow,true)
  assert.ok(row.hours>=23 && row.hours<=25,'one calendar day, DST included')
 })

 await t.test('a right first attempt climbs one phase and waits the new interval (typed and flashcard)',async()=>{
  const progressId=await progressOf(await addCard())
  for(const mode of ['typed','flashcard']) for(let box=1;box<=6;box++) {
   await arm(progressId,box)
   const response=mode==='typed'?await type(progressId,'das Haus'):await rate(progressId,true)
   assert.equal(response.isCorrect,true,`${mode} box ${box}`)
   assert.equal(response.newPhase,Math.min(6,box+1))
   assert.equal(response.becameLearned,box===6)
   assert.equal(response.intervalInDays,INTERVALS[box-1])
   const state=await stateOf(progressId)
   assert.equal(state.box_number,box===6?7:box+1)
   assert.equal(state.next_review_date.getTime(),(await reviewDay(INTERVALS[box-1])).getTime())
  }
 })

 await t.test('a wrong first attempt drops exactly one phase, never below 1, and is due tomorrow',async()=>{
  const progressId=await progressOf(await addCard())
  for(const mode of ['typed','flashcard']) for(let box=1;box<=6;box++) {
   await arm(progressId,box)
   const lapses=(await stateOf(progressId)).lapses
   const response=mode==='typed'?await type(progressId,'das Auto'):await rate(progressId,false)
   assert.equal(response.isCorrect,false,`${mode} box ${box}`)
   assert.equal(response.newPhase,Math.max(1,box-1))
   assert.equal(response.movedBack,box>1)
   assert.equal(response.intervalInDays,1,'phase 6 rule: a wrong word comes back the next day, whatever its phase')
   const state=await stateOf(progressId)
   assert.equal(state.box_number,Math.max(1,box-1))
   assert.equal(state.lapses,lapses+1)
   assert.equal(state.next_review_date.getTime(),(await reviewDay(1)).getTime())
  }
 })

 await t.test('only the first attempt of the day counts',async()=>{
  const progressId=await progressOf(await addCard())
  await arm(progressId,4)
  assert.equal((await type(progressId,'das Auto')).newPhase,3)
  await admin(); await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student]); await actor(db,student)
  // A right answer later the same day must not undo the demotion.
  assert.equal((await type(progressId,'das Haus')).error,'review_not_due')
  assert.equal((await rate(progressId,true)).error,'review_not_due')
  assert.equal((await stateOf(progressId)).box_number,3)
 })

 await t.test('retries grade from stored content without touching phase, date, lapses, cursor or receipts',async()=>{
  const progressId=await progressOf(await addCard({word:'Haus',article:'das',plural:'Häuser'}))
  await arm(progressId,5)
  // Before the day's graded attempt the retry path stays closed: it must not
  // reveal whether an answer is right ahead of the attempt that counts.
  assert.equal((await retry(progressId,'das Haus')).error,'retry_not_available')
  assert.equal((await type(progressId,'das Auto')).newPhase,4)
  await admin()
  const snapshot=async()=>({
   progress:(await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1',[progressId])).rows[0],
   receipts:(await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts')).rows[0].n,
   cursor:(await db.query('SELECT * FROM vocabulary_learning_state WHERE auth_user_id=$1',[student])).rows,
  })
  const before=await snapshot()
  await actor(db,student)
  const wrong=await retry(progressId,'das Auto')
  assert.equal(wrong.success,true); assert.equal(wrong.isCorrect,false); assert.equal(wrong.correctAnswer,'das Haus')
  const right=await retry(progressId,'das Haus')
  assert.equal(right.isCorrect,true); assert.equal(right.softError,null); assert.equal(right.isAlternative,false)
  const plural=await retry(progressId,'die Häuser')
  assert.equal(plural.isCorrect,true,'the retry accepts exactly what the graded attempt accepts')
  assert.equal(plural.isAlternative,true)
  await admin()
  assert.deepEqual(await snapshot(),before,'a retry writes nothing')
 })

 await t.test('retries are private to the learner and closed to anonymous callers',async()=>{
  const progressId=await progressOf(await addCard())
  await arm(progressId,2)
  await type(progressId,'das Auto')
  await actor(db,outsider)
  assert.equal((await retry(progressId,'das Haus')).error,'progress_not_found')
  await actor(db,null,'anon')
  await assert.rejects(db.query("SELECT check_vocabulary_retry($1,'das Haus','ru')",[progressId]),/permission denied/)
  await actor(db,student)
  assert.equal((await retry(progressId,'','ru')).error,'answer_required')
  assert.equal((await retry(progressId,'das Haus','de')).error,'trainer_access_denied')
 })

 await db.close()
})

await test('the legacy owner of submit_answer can run the helpers the migration admin installs',async()=>{
 // Live, submit_answer belongs to postgres (NOSUPERUSER) while everything that
 // migrate-local creates belongs to supabase_admin — the split behind 15. The
 // new helpers must be executable across that boundary, or every typed answer
 // fails with 42501 -> "could not be saved".
 const db=await createPhase3Database(), cardId=id(980)
 try {
  await db.exec(`CREATE ROLE phase6_migration_admin SUPERUSER;
   CREATE ROLE phase6_legacy_owner NOLOGIN NOSUPERUSER BYPASSRLS;
   GRANT postgres TO phase6_legacy_owner;`)
  await apply(db,['15_grading_helper_permissions.sql',...MIGRATIONS.slice(0,-1)])
  await db.exec('SET ROLE phase6_migration_admin')
  await apply(db,['22_vocabulary_phase6_rules.sql'])
  await db.exec(`RESET ROLE;
   ALTER FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text) OWNER TO phase6_legacy_owner;
   ALTER FUNCTION vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text) OWNER TO phase6_legacy_owner;`)
  const owner=(await db.query("SELECT pg_get_userbyid(proowner) o FROM pg_proc WHERE oid='vocabulary_private.answer_key(uuid,text,text)'::regprocedure")).rows[0].o
  assert.equal(owner,'phase6_migration_admin')
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[cardId,vocabularyUnit])
  await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом')",[cardId])
  await actor(db,student)
  await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId,alreadyKnown:false}])])
  const progressId=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='native_to_de'",[cardId])).rows[0].id
  const response=await result(db,"SELECT submit_vocabulary_answer_once($1,$2,NULL,'das Haus','ru') result",[id(981),progressId])
  assert.equal(response.error,undefined,JSON.stringify(response))
  assert.equal(response.newPhase,2)
  assert.equal((await result(db,"SELECT check_vocabulary_retry($1,'das Haus','ru') result",[progressId])).isCorrect,true)
 } finally { await db.close() }
})
