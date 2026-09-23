import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase3Database,actor,id,student,teacher,outsider,vocabularyUnit,exerciseUnit,apply} from './helpers/phase3-db.mjs'

// Migration 24: Lerntage für den Wochenkalender der Startseite und der Name der
// Lehrkraft, die auf eine Aufnahme geantwortet hat.

// 08 enthält psql-Metabefehle (CONCURRENTLY) und läuft hier nicht.
const MIGRATIONS=['07_content_quality.sql','09_progress_aggregate.sql','10_rls_performance.sql','11_teacher_analytics.sql',
 '12_media_upload.sql','13_mail_exception_kind.sql','14_mail_exceptions.sql','15_grading_helper_permissions.sql',
 '16_uploaded_video_visibility.sql','17_remove_video_placeholders.sql','18_vocabulary_self_rating.sql',
 '19_vocabulary_self_rating_fix.sql','20_vocabulary_learner_mode.sql','21_vocabulary_sentence_learner_choice.sql',
 '22_vocabulary_phase6_rules.sql','23_vocabulary_own_words.sql']

await test('learning days are recorded by triggers, private per learner and never writable by clients',async t=>{
 const db=await createPhase3Database()
 const admin=()=>db.exec('RESET ROLE')
 const as=async user=>{ await admin(); await actor(db,user) }
 const days=async user=>{
  await admin()
  return (await db.query("SELECT to_char(day,'YYYY-MM-DD') AS value FROM learning_activity_days WHERE auth_user_id=$1 ORDER BY 1",[user])).rows.map(row=>row.value)
 }
 const berlin=async at=>(await db.query("SELECT to_char(($1::timestamptz AT TIME ZONE 'Europe/Berlin')::date,'YYYY-MM-DD') AS value",[at])).rows[0].value
 const card=id(900), progress=id(901), exercise=id(902), submission=id(903)
 try {
  await apply(db,MIGRATIONS)
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[card,vocabularyUnit])
  // Ein älterer Lernstand vor der Migration: der Rückblick übernimmt seinen Tag.
  const earlier=new Date(Date.now()-3*86400000).toISOString()
  await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date,last_answered_at) VALUES($1,$2,$3,'native_to_de',2,now(),$4)",[progress,student,card,earlier])
  await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date,last_answered_at) VALUES($1,$2,'native_to_de',2,now(),now()-interval '90 days')",[outsider,card])
  await apply(db,['24_learning_activity_days.sql'])

  await t.test('the backfill keeps recent answer days and ignores older ones',async()=>{
   assert.deepEqual(await days(student),[await berlin(earlier)])
   assert.deepEqual(await days(outsider),[],'beyond eight weeks nothing is reconstructed')
  })

  await t.test('activating a lesson is not learning; answering is',async()=>{
   await admin()
   const activated=id(904)
   await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date) VALUES($1,$2,$3,'de_to_native',1,now())",[activated,outsider,card])
   assert.deepEqual(await days(outsider),[])
   await db.query('UPDATE vocabulary_direction_progress SET box_number=2 WHERE id=$1',[activated])
   assert.deepEqual(await days(outsider),[],'a box change without an answer time is not a learning day')
   await db.query('UPDATE vocabulary_direction_progress SET last_answered_at=now() WHERE id=$1',[activated])
   assert.deepEqual(await days(outsider),[await berlin(new Date().toISOString())])
  })

  await t.test('a grammar attempt and a recording count once per day',async()=>{
   await admin()
   await db.query("DELETE FROM learning_activity_days WHERE auth_user_id=$1",[student])
   await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Artikel','fill_in_blank','{\"correct_answer\":\"das Haus\",\"accepted_answers\":[\"das Haus\"],\"target_form\":[\"Haus\"]}')",[exercise,exerciseUnit])
   await db.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,attempts,completed) VALUES($1,$2,0,false)',[student,exercise])
   assert.deepEqual(await days(student),[],'an untouched progress row is not a learning day')
   await db.query('UPDATE user_exercise_progress SET attempts=1 WHERE auth_user_id=$1',[student])
   await db.query('UPDATE user_exercise_progress SET attempts=2,completed=true WHERE auth_user_id=$1',[student])
   await db.query("INSERT INTO submissions(id,auth_user_id,type,level,status) VALUES($1,$2,'audio','A1.1','pending')",[submission,student])
   assert.deepEqual(await days(student),[await berlin(new Date().toISOString())])
  })

  await t.test('learners read only their own days and cannot write any',async()=>{
   await as(outsider)
   const visible=(await db.query('SELECT auth_user_id FROM learning_activity_days')).rows
   assert.ok(visible.length>0 && visible.every(row=>row.auth_user_id===outsider))
   await assert.rejects(db.query("INSERT INTO learning_activity_days VALUES($1,current_date-1)",[outsider]),error=>error.code==='42501')
   await assert.rejects(db.query('DELETE FROM learning_activity_days'),error=>error.code==='42501')
  })

  await t.test('the reply sender name is shown only to the learner the teacher answered',async()=>{
   await admin()
   await db.query("UPDATE people SET display_name='Anastasia Sitov' WHERE auth_user_id=$1",[teacher])
   // Fixture rows: the submission has no reading text, so the app's message
   // validation (prompt access) is bypassed for this setup only.
   await db.exec('SET session_replication_role=replica')
   await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,sender_role,text_content) VALUES($1,$2,'teacher','Sehr schön!'),($1,$3,'student','Danke!')",[submission,teacher,student])
   await db.exec('SET session_replication_role=DEFAULT')
   await as(student)
   const senders=(await db.query('SELECT sender_id,display_name FROM pronunciation_reply_senders()')).rows
   assert.deepEqual(senders,[{sender_id:teacher,display_name:'Anastasia Sitov'}],'only staff senders, never the learner herself')
   await as(outsider)
   assert.deepEqual((await db.query('SELECT * FROM pronunciation_reply_senders()')).rows,[])
   await admin()
   await db.exec('SET ROLE anon')
   await assert.rejects(db.query('SELECT * FROM pronunciation_reply_senders()'),error=>error.code==='42501')
  })

  await t.test('the rollback removes table, triggers and function',async()=>{
   await admin()
   const {readFile}=await import('node:fs/promises')
   await db.exec(await readFile(new URL('../vps/rollback/24_learning_activity_days.sql',import.meta.url),'utf8'))
   assert.equal((await db.query("SELECT to_regclass('public.learning_activity_days') name")).rows[0].name,null)
   await db.query('UPDATE vocabulary_direction_progress SET last_answered_at=now() WHERE id=$1',[progress])
   assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE proname IN('record_activity_day','pronunciation_reply_senders')")).rows[0].n,0)
  })
 } finally { await db.close() }
})
