import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPhase3Database,actor,id,student,outsider,vocabularyUnit,exerciseUnit,result,apply} from './helpers/phase3-db.mjs'

// Migration 25: Lektionen unter „Lektionen“ (Modus Vokabeln) ein- und ausschalten. Ausgeschaltete
// Lektionen merkt sich vocabulary_lesson_pauses je Person; geschrieben wird nur
// über set_vocabulary_lesson_paused, Lernstand bleibt unberührt.

// 08 enthält psql-Metabefehle (CONCURRENTLY) und läuft hier nicht.
const MIGRATIONS=['07_content_quality.sql','09_progress_aggregate.sql','10_rls_performance.sql','11_teacher_analytics.sql',
 '12_media_upload.sql','13_mail_exception_kind.sql','14_mail_exceptions.sql','15_grading_helper_permissions.sql',
 '16_uploaded_video_visibility.sql','17_remove_video_placeholders.sql','18_vocabulary_self_rating.sql',
 '19_vocabulary_self_rating_fix.sql','20_vocabulary_learner_mode.sql','21_vocabulary_sentence_learner_choice.sql',
 '22_vocabulary_phase6_rules.sql','23_vocabulary_own_words.sql','24_learning_activity_days.sql']

await test('lesson switch: private per learner, written only through the RPC, never touches progress',async t=>{
 const db=await createPhase3Database()
 const admin=()=>db.exec('RESET ROLE')
 const as=async user=>{ await admin(); await actor(db,user) }
 const pause=(unit,paused)=>result(db,'SELECT set_vocabulary_lesson_paused($1,$2) result',[unit,paused])
 const pauses=async user=>{
  await admin()
  return (await db.query('SELECT unit_id FROM vocabulary_lesson_pauses WHERE auth_user_id=$1 ORDER BY 1',[user])).rows.map(row=>row.unit_id)
 }
 const card=id(950), progress=id(951)
 try {
  await apply(db,MIGRATIONS)
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[card,vocabularyUnit])
  await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date) VALUES($1,$2,$3,'native_to_de',3,now())",[progress,student,card])
  await apply(db,['25_vocabulary_lesson_switch.sql','25_vocabulary_lesson_switch.sql'])

  await t.test('switching off and on again is idempotent and keeps the learning progress',async()=>{
   await as(student)
   assert.deepEqual(await pause(vocabularyUnit,true),{unitId:vocabularyUnit,paused:true})
   assert.deepEqual(await pause(vocabularyUnit,true),{unitId:vocabularyUnit,paused:true})
   assert.deepEqual(await pauses(student),[vocabularyUnit])
   await as(student)
   assert.deepEqual(await pause(vocabularyUnit,false),{unitId:vocabularyUnit,paused:false})
   assert.deepEqual(await pauses(student),[])
   await admin()
   const row=(await db.query('SELECT box_number FROM vocabulary_direction_progress WHERE id=$1',[progress])).rows[0]
   assert.equal(row.box_number,3,'the switch is a choice, not learning progress')
  })

  await t.test('only vocabulary lessons the learner may use can be switched off',async()=>{
   await as(outsider)
   assert.equal((await pause(vocabularyUnit,true)).error,'trainer_access_denied')
   assert.equal((await pause(exerciseUnit,true)).error,'not_found','a grammar unit is no vocabulary lesson')
   assert.equal((await pause(id(999),true)).error,'not_found')
   assert.equal((await pause(vocabularyUnit,null)).error,'invalid_input')
   assert.deepEqual(await pauses(outsider),[])
   await admin()
   await db.exec('SET ROLE anon')
   await assert.rejects(pause(vocabularyUnit,true),error=>error.code==='42501')
  })

  await t.test('learners read only their own switches and cannot write the table directly',async()=>{
   await as(student)
   await pause(vocabularyUnit,true)
   await as(outsider)
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_lesson_pauses')).rows,[])
   await assert.rejects(db.query('INSERT INTO vocabulary_lesson_pauses(auth_user_id,unit_id) VALUES($1,$2)',[outsider,vocabularyUnit]),error=>error.code==='42501')
   await as(student)
   assert.equal((await db.query('SELECT * FROM vocabulary_lesson_pauses')).rows.length,1)
   await assert.rejects(db.query('DELETE FROM vocabulary_lesson_pauses'),error=>error.code==='42501')
  })

  await t.test('the rollback removes table and function',async()=>{
   await admin()
   await db.exec(await readFile(new URL('../vps/rollback/25_vocabulary_lesson_switch.sql',import.meta.url),'utf8'))
   assert.equal((await db.query("SELECT to_regclass('public.vocabulary_lesson_pauses') name")).rows[0].name,null)
   assert.equal((await db.query("SELECT count(*)::int n FROM pg_proc WHERE proname='set_vocabulary_lesson_paused'")).rows[0].n,0)
  })
 } finally { await db.close() }
})
