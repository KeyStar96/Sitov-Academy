import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createLearningPathDatabase, actor, id, student, teacher, outsider, vocabularyUnit, result, apply } from './helpers/learning-path-db.mjs'

const migration='38_learning_sessions.sql'
const card=id(97001),progress=id(97002),card2=id(97003),progress2=id(97004)
const unit=id(97010),node=id(97011),exercise=id(97012),run=id(97013),attempt=id(97014),submission=id(97015)

await test('Phase7 learning sessions: events, honest duration, privacy, retention and reversible migration',async t=>{
 const db=await createLearningPathDatabase()
 const admin=()=>db.exec('RESET ROLE')
 const as=async user=>{await admin();await actor(db,user)}
 const query=async(sql,args=[])=>{await admin();return (await db.query(sql,args)).rows}
 const clean=async()=>{await admin();await db.exec('DELETE FROM learning_sessions; DELETE FROM learning_activity_days')}
 const event=(user,mode,level,at)=>db.query('SELECT learning_private.record_learning_event($1,$2,$3,$4)',[user,mode,level,at])
 const sessions=()=>query('SELECT mode::text,level,answer_count,study_seconds FROM learning_sessions ORDER BY started_at')
 try {
  await apply(db,['36_migrate_old_grammar_progress.sql','37_vocabulary_carryover.sql',migration])
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2)")
  await db.query("INSERT INTO student_level_access(auth_user_id,level) VALUES($1,'A1.2')",[student])
  for(const [c,p] of [[card,progress],[card2,progress2]]) {
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[c,vocabularyUnit])
   await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом')",[c])
   await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date) VALUES($1,$2,$3,'native_to_de',2,'2020-01-01')",[p,student,c])
  }
  await t.test('activation is not a session; actual vocabulary writes are, and resets are not',async()=>{
   assert.deepEqual(await sessions(),[])
   await db.query('UPDATE vocabulary_direction_progress SET last_answered_at=clock_timestamp() WHERE id=$1',[progress])
   assert.deepEqual(await sessions(),[{mode:'vocabulary',level:'A1.1',answer_count:1,study_seconds:0}])
   await db.query('UPDATE vocabulary_direction_progress SET box_number=1,last_answered_at=NULL WHERE id=$1',[progress])
   assert.equal((await sessions())[0].answer_count,1)
  })
  await t.test('successive events join, five-minute idle breaks and mode changes do not overcount time',async()=>{
   await clean()
   const base=(await db.query("SELECT date_trunc('day',now())+interval '12 hours' AS at")).rows[0].at
   const at=seconds=>new Date(new Date(base).getTime()+seconds*1000).toISOString()
   await event(student,'vocabulary','A1.1',at(0));await event(student,'vocabulary','A1.1',at(90))
   await event(student,'vocabulary','A1.1',at(391));await event(student,'path','A1.1',at(420))
   await event(student,'path','A1.1',at(450))
   assert.deepEqual(await sessions(),[
    {mode:'vocabulary',level:'A1.1',answer_count:2,study_seconds:90},
    {mode:'vocabulary',level:'A1.1',answer_count:1,study_seconds:0},
    {mode:'path',level:'A1.1',answer_count:2,study_seconds:30},
   ])
   assert.deepEqual(await query('SELECT study_seconds,answer_count,mode_seconds FROM learning_activity_days'),[
    {study_seconds:120,answer_count:5,mode_seconds:{vocabulary:90,path:30}},
   ])
  })
  await t.test('Berlin midnight splits seconds and counts answers on their actual day',async()=>{
   await clean()
   const [times]=await query("SELECT ((current_date-2)+time '23:59:30') AT TIME ZONE 'Europe/Berlin' AS a, ((current_date-1)+time '00:00:30') AT TIME ZONE 'Europe/Berlin' AS b")
   await event(student,'path','A1.1',times.a);await event(student,'path','A1.1',times.b)
   assert.deepEqual(await query('SELECT study_seconds,answer_count FROM learning_activity_days ORDER BY day'),[
    {study_seconds:30,answer_count:1},{study_seconds:30,answer_count:1},
   ])
   assert.equal((await sessions())[0].study_seconds,60)
  })
  await t.test('daylight-saving rollback counts elapsed time rather than wall-clock hour',async()=>{
   await clean()
   await event(student,'path','A1.1','2090-10-29T02:59:30+02:00')
   await event(student,'path','A1.1','2090-10-29T02:00:30+01:00')
   assert.equal((await sessions())[0].study_seconds,60)
  })
  await t.test('carryover uses target level for typed/self-rated answers, retries are idempotent and context clears',async()=>{
   await clean();await as(student)
   assert.equal((await result(db,"SELECT set_vocabulary_carryover('A1.2',true) result")).enabled,true)
   const args=[id(97100),progress,'das Haus','ru','A1.2']
   const sql='SELECT submit_vocabulary_answer_once($1,$2,false,$3,$4,$5) result'
   const first=await result(db,sql,args)
   assert.ok(first.success,JSON.stringify(first))
   assert.deepEqual(await result(db,sql,args),first)
   assert.equal((await db.query("SELECT current_setting('learning.session_target_level',true) AS context")).rows[0].context,'')
   const rated=await result(db,'SELECT submit_vocabulary_self_rating_once($1,$2,true,$3,$4) result',[id(97101),progress2,'ru','A1.2'])
   assert.ok(rated.success,JSON.stringify(rated))
   const rows=await sessions();assert.equal(rows.length,1);assert.equal(rows[0].level,'A1.2');assert.equal(rows[0].answer_count,2)
   await as(student)
   assert.ok((await result(db,sql,[id(97102),progress,'','ru','A1.2'])).error)
   assert.equal((await db.query("SELECT current_setting('learning.session_target_level',true) AS context")).rows[0].context,'')
  })
  await t.test('legacy vocabulary API is also captured at original level',async()=>{
   await clean()
   await db.query("UPDATE vocabulary_direction_progress SET next_review_date='2020-01-01' WHERE id=$1",[progress])
   await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student])
   await as(student)
   const answer=await result(db,"SELECT submit_vocabulary_answer($1,false,'das Haus','ru') result",[progress])
   assert.ok(answer.success,JSON.stringify(answer))
   assert.deepEqual((await sessions()).map(x=>[x.level,x.answer_count]),[['A1.1',1]])
  })
  await t.test('path practice receipts and unique test answers count; test revisions and grading do not',async()=>{
   await clean()
   await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Prüfpfad',1,true,'session-fixture','session-fixture','Prüfpfad')",[unit])
   await db.query("INSERT INTO path_objectives VALUES($1,'goal','grammar','Prüfung')",[unit])
   await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals) VALUES($1,$2,'practice','practice',1,'Prüfung','Prüfung','{\"rule\":\"Wähle Ja.\",\"examples\":[\"Ja.\"]}',ARRAY['goal'])",[node,unit])
   await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,topic,type,content) VALUES($1,$2,$3,'goal','Prüfung','multiple_choice','{\"target_form\":[\"Ja\"],\"question\":\"Wähle Ja.\",\"options\":[\"Ja\",\"Nein\"],\"correct_answer\":\"Ja\",\"accepted_answers\":[\"Ja\"]}')",[exercise,unit,node])
   await db.query('INSERT INTO path_practice_runs(id,auth_user_id,node_id,queue,total) VALUES($1,$2,$3,ARRAY[$4::uuid],1)',[run,student,node,exercise])
   await db.query("INSERT INTO path_private.answer_receipts VALUES($1,$2,$3,'{\"index\":0}','{}')",[run,id(97110),exercise])
   await db.query('INSERT INTO path_test_attempts(id,auth_user_id,node_id,selected_exercise_ids) VALUES($1,$2,$3,ARRAY[$4::uuid])',[attempt,student,node,exercise])
   await db.query("INSERT INTO path_private.test_items VALUES($1,$2,'{}',1)",[attempt,exercise])
   await db.query("INSERT INTO path_test_answers(attempt_id,exercise_id,answer) VALUES($1,$2,'{\"index\":1}')",[attempt,exercise])
   await db.query("UPDATE path_test_answers SET answer='{\"index\":0}',result='{\"status\":\"EXACT\"}' WHERE attempt_id=$1",[attempt])
   assert.equal((await sessions())[0].answer_count,2)
   assert.equal((await query('SELECT answer_count FROM learning_activity_days'))[0].answer_count,2)
  })
  await t.test('only learner recordings, not teacher replies or text chat, create pronunciation activity',async()=>{
   await clean()
   await db.query("INSERT INTO submissions(id,auth_user_id,type,level,status) VALUES($1,$2,'audio','A1.1','pending')",[submission,student])
   // Bypass the existing conversation validator for synthetic rows that have
   // no uploaded object. Re-enable our activity trigger to test real inserts.
   await db.exec('ALTER TABLE pronunciation_messages DISABLE TRIGGER USER; ALTER TABLE pronunciation_messages ENABLE TRIGGER learning_session_pronunciation_reply')
   await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,sender_role,text_content,audio_path) VALUES($1,$2,'teacher','Hinweis',NULL),($1,$3,'student','Danke',NULL),($1,$3,'student','','test/audio.webm')",[submission,teacher,student])
   await db.exec('ALTER TABLE pronunciation_messages ENABLE TRIGGER USER')
   const [row]=await sessions();assert.equal(row.mode,'pronunciation');assert.equal(row.answer_count,2)
  })
  await t.test('learners only read own sessions/days, staff reads all, and no client can write or invoke helpers',async()=>{
   await event(outsider,'path','A1.1',new Date().toISOString())
   await as(outsider)
   for(const table of ['learning_sessions','learning_activity_days']) {
    const rows=(await db.query(`SELECT auth_user_id FROM ${table}`)).rows
    assert.ok(rows.length>0&&rows.every(row=>row.auth_user_id===outsider),table)
    await assert.rejects(db.exec(`DELETE FROM ${table}`),e=>e.code==='42501')
   }
   await assert.rejects(event(outsider,'path','A1.1',new Date().toISOString()),e=>e.code==='42501')
   await as(teacher)
   assert.equal((await db.query('SELECT DISTINCT auth_user_id FROM learning_sessions')).rows.length,2)
   assert.equal((await db.query('SELECT DISTINCT auth_user_id FROM learning_activity_days')).rows.length,2)
   await admin();await db.exec('SET ROLE anon')
   await assert.rejects(db.exec('SELECT * FROM learning_sessions'),e=>e.code==='42501')
  })
  await t.test('any new event purges globally after 180 days while permanent aggregates survive',async()=>{
   await clean()
   await db.query("INSERT INTO learning_sessions(auth_user_id,mode,level,started_at,ended_at,answer_count,study_seconds) VALUES($1,'path','A1.1',now()-interval '181 days',now()-interval '181 days',4,120),($1,'path','A1.1',now()-interval '179 days',now()-interval '179 days',2,60)",[outsider])
   await db.query("INSERT INTO learning_activity_days(auth_user_id,day,answer_count,study_seconds,mode_seconds) VALUES($1,current_date-181,4,120,'{\"path\":120}')",[outsider])
   await event(student,'vocabulary','A1.1',new Date().toISOString())
   assert.equal((await query('SELECT count(*)::int n FROM learning_sessions WHERE auth_user_id=$1',[outsider]))[0].n,1)
   assert.deepEqual(await query('SELECT answer_count,study_seconds,mode_seconds FROM learning_activity_days WHERE auth_user_id=$1',[outsider]),[{answer_count:4,study_seconds:120,mode_seconds:{path:120}}])
  })
  await t.test('reapply is idempotent, rollback archives history and restores grading, then reapply works',async()=>{
   const before=await sessions()
   await apply(db,[migration]);assert.deepEqual(await sessions(),before)
   await db.exec(await readFile(new URL('../vps/rollback/38_learning_sessions.sql',import.meta.url),'utf8'))
   assert.equal((await query('SELECT count(*)::int n FROM learning_sessions WHERE is_active'))[0].n,0)
   assert.equal((await query('SELECT count(*)::int n FROM learning_sessions'))[0].n,before.length)
   assert.equal((await query("SELECT position('learning.session_target_level' IN pg_get_functiondef('vocabulary_private.submit_answer(uuid,boolean,text,text,text)'::regprocedure)) AS n"))[0].n,0)
   await apply(db,[migration])
   await event(student,'path','A1.1',new Date().toISOString())
   assert.equal((await query('SELECT count(*)::int n FROM learning_sessions WHERE is_active'))[0].n,1)
   assert.equal((await query("SELECT count(*)::int n FROM pg_trigger WHERE tgname='learning_sessions_archived_retention'"))[0].n,0)
  })
 } finally {await db.close()}
})
