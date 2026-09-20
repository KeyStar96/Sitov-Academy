import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const student=uid(1), other=uid(2), teacher=uid(3), card=uid(10)
await test('Per-student, per-level trainer access in isolated PostgreSQL', async t => {
 const db = new PGlite()
 try {
  await db.exec(await read('./fixtures/trainer-access-baseline.sql'))
  await db.query("INSERT INTO profiles VALUES($1,'student',ARRAY['A1.1','A1.2'],'Russisch','ru'),($2,'student',ARRAY['A1.1'],'Russisch','ru'),($3,'teacher',ARRAY[]::text[],NULL,'de')",[student,other,teacher])
  await db.query("INSERT INTO vocabulary_cards(id,word_de,lesson,level) VALUES($1,'Haus','Lektion 1','A1.1')",[card])
  for (const migration of ['20260910133125_vocabulary_bidirectional_learning.sql','20260910151533_vocabulary_answer_receipts.sql','20260910184438_pronunciation_reading_conversations.sql','20260910184937_grammar_curriculum_and_progress.sql']) await db.exec(await read('./fixtures/history/migrations/'+migration))
  await db.exec("INSERT INTO videos(level) VALUES('A1.1'),('A1.2')")
  const exercise=(await db.query("SELECT id FROM exercises WHERE level='A1.1' LIMIT 1")).rows[0].id
  const prompt=(await db.query("SELECT id FROM pronunciation_prompts WHERE level='A1.1' LIMIT 1")).rows[0].id
  await db.exec(await read('./fixtures/history/migrations/20260910213453_student_trainer_access.sql'))
  await db.exec(await read('./fixtures/history/migrations/20260910214425_trainer_access_policy_commands.sql'))
  await db.exec(await read('./fixtures/history/migrations/20260912102100_vocabulary_alternative_answers.sql'))
  await db.exec(await read('./fixtures/history/migrations/20260912112100_lesson_trainer_access.sql'))
  await db.exec(await read('./fixtures/history/migrations/20260913104728_repair_learning_unit_permissions.sql'))
  const actor=async(id,role='authenticated')=>{await db.exec('RESET ROLE'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']); await db.exec(`SET ROLE ${role}`)}
  const allowed=async(level,trainer)=>(await db.query('SELECT trainer_access_private.allowed($1,$2) ok',[level,trainer])).rows[0].ok
  const override=async(level,trainer,enabled)=>{await actor(teacher);await db.query('INSERT INTO student_trainer_access (user_id,level,trainer,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,level,trainer) DO UPDATE SET enabled=excluded.enabled',[student,level,trainer,enabled]);await actor(student)}
  await actor(student)
  await t.test('migration preserves every existing level entitlement, no defaults written',async()=>{
   for(const trainer of ['vocabulary','exercises','pronunciation','videos']) {assert.equal(await allowed('A1.1',trainer),true);assert.equal(await allowed('B1.2',trainer),false)}
   assert.equal((await db.query('SELECT count(*)::int n FROM student_trainer_access')).rows[0].n,0)
  })
  await t.test('student cannot grant, revoke or read another student’s overrides',async()=>{
   await assert.rejects(db.query("INSERT INTO student_trainer_access(user_id,level,trainer,enabled) VALUES($1,'A1.1','videos',false)",[student]),e=>e.code==='42501')
   await override('A1.1','videos',false)
   assert.equal((await db.query('UPDATE student_trainer_access SET enabled=true RETURNING *')).rows.length,0)
   assert.equal((await db.query('DELETE FROM student_trainer_access RETURNING *')).rows.length,0)
   await actor(other);assert.equal((await db.query('SELECT * FROM student_trainer_access')).rows.length,0);await actor(student)
  })
  await t.test('teacher override affects only its exact student, level and trainer',async()=>{
   assert.equal(await allowed('A1.1','videos'),false);assert.equal(await allowed('A1.2','videos'),true);assert.equal(await allowed('A1.1','vocabulary'),true)
   assert.equal((await db.query('SELECT * FROM videos')).rows.length,1)
   await actor(other);assert.equal(await allowed('A1.1','videos'),true);await actor(teacher);assert.equal((await db.query('SELECT * FROM videos')).rows.length,2);await actor(student)
  })
  await t.test('grammar locked read and direct scoring RPC are both blocked',async()=>{
   await override('A1.1','exercises',false)
   assert.equal((await db.query("SELECT * FROM exercises WHERE level='A1.1'")).rows.length,0)
   await assert.rejects(db.query('SELECT record_grammar_attempt($1,$2,false)',[exercise,'der']),e=>e.code==='42501')
   assert.equal((await db.query('SELECT * FROM user_exercise_progress')).rows.length,0)
  })
  let progress,thread,request=uid(20)
  const ref=`storage://pronunciation_audio/${student}/one.webm`
  await t.test('unlocked vocabulary initializes and advances through the real RPC',async()=>{
   await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false}])])
   progress=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE direction='de_to_native'")).rows[0].id
   const r=(await db.query("SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[request,progress])).rows[0].result
   assert.equal(r.success,true); assert.equal(r.newPhase,2)
  })
  await t.test('vocabulary revocation blocks content, init, skip, grading and cached answer replay without erasing progress',async()=>{
   await override('A1.1','vocabulary',false)
   assert.equal((await db.query('SELECT * FROM vocabulary_cards')).rows.length,0)
   await assert.rejects(db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:true}])]),e=>e.code==='42501')
   await assert.rejects(db.query("SELECT skip_vocabulary_assessment('A1.1')"),e=>e.code==='42501')
   await assert.rejects(db.query("SELECT submit_vocabulary_answer($1,true,NULL,'ru')",[progress]),e=>e.code==='42501')
   await assert.rejects(db.query("SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru')",[request,progress]),e=>e.code==='42501')
   assert.equal((await db.query('SELECT box_number FROM vocabulary_direction_progress WHERE id=$1',[progress])).rows[0].box_number,2)
   assert.equal((await db.query('UPDATE user_vocabulary_progress SET box_number=7 RETURNING id')).rows.length,0)
   await override('A1.1','vocabulary',true);assert.equal((await db.query('SELECT * FROM vocabulary_cards')).rows.length,1)
  })
  await t.test('pronunciation upload and conversation work when released',async()=>{
   await db.query("INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('pronunciation_audio',$1,$2)",[`${student}/one.webm`,student])
   thread=(await db.query('SELECT create_pronunciation_submission($1,$2) id',[prompt,ref])).rows[0].id
   await db.query('INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES($1,$2,$3)',[thread,student,'Meine erste Antwort'])
  })
  await t.test('revocation blocks prompts, recordings, dialogue reads/writes and direct submission RPC',async()=>{
   await override('A1.1','pronunciation',false)
   assert.equal((await db.query("SELECT * FROM pronunciation_prompts WHERE level='A1.1'")).rows.length,0)
   assert.equal((await db.query('SELECT * FROM submissions')).rows.length,0)
   assert.equal((await db.query('SELECT * FROM pronunciation_messages')).rows.length,0)
   assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0)
   await assert.rejects(db.query('SELECT create_pronunciation_submission($1,$2)',[prompt,ref]),e=>e.code==='42501')
   await assert.rejects(db.query('INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES($1,$2,$3)',[thread,student,'Blocked']))
   await actor(teacher);assert.equal((await db.query('SELECT * FROM submissions')).rows.length,1);await actor(student)
   await override('A1.2','pronunciation',false)
   await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[`${student}/blocked.webm`]),e=>e.code==='42501')
   await override('A1.1','pronunciation',true)
   assert.equal((await db.query('SELECT * FROM submissions')).rows.length,1)
   assert.equal((await db.query('SELECT * FROM pronunciation_messages')).rows.length,1)
  })
  await t.test('enabled override never grants an otherwise locked level and malformed identifiers fail',async()=>{
   await override('B1.2','vocabulary',true);assert.equal(await allowed('B1.2','vocabulary'),false)
   await actor(teacher);await assert.rejects(db.query("INSERT INTO student_trainer_access(user_id,level,trainer,enabled) VALUES($1,'A1.1','unknown',true)",[student]),e=>e.code==='23514')
  })
  await t.test('lesson restrictions are enforced for reads and RPCs; empty denies and null grants all',async()=>{
   await actor(teacher)
   await db.query("UPDATE student_trainer_access SET allowed_lessons=ARRAY[]::text[] WHERE user_id=$1 AND level='A1.1' AND trainer='vocabulary'",[student])
   await actor(student)
   assert.equal((await db.query('SELECT * FROM vocabulary_cards')).rows.length,0)
   await assert.rejects(db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false}])]),e=>e.code==='42501')
   await assert.rejects(db.query("SELECT submit_vocabulary_answer($1,true,NULL,'ru')",[progress]),e=>e.code==='42501')
   await actor(teacher)
   await db.query("UPDATE student_trainer_access SET allowed_lessons=ARRAY['Lektion 1'] WHERE user_id=$1 AND level='A1.1' AND trainer='vocabulary'",[student])
   await actor(student);assert.equal((await db.query('SELECT * FROM vocabulary_cards')).rows.length,1)
   await actor(teacher)
   await db.query("UPDATE student_trainer_access SET allowed_lessons=NULL WHERE user_id=$1 AND level='A1.1' AND trainer='vocabulary'",[student])
  })
  await t.test('each reading text has its own access ID, and none blocks uploads too',async()=>{
   await actor(teacher)
   await db.query("UPDATE student_trainer_access SET allowed_lessons=ARRAY[$2] WHERE user_id=$1 AND level='A1.1' AND trainer='pronunciation'",[student,prompt])
   await actor(student)
   assert.deepEqual((await db.query("SELECT id FROM pronunciation_prompts WHERE level='A1.1'")).rows.map(r=>r.id),[prompt])
   assert.equal((await db.query('SELECT * FROM submissions')).rows.length,1)
   await actor(teacher)
   await db.query("UPDATE student_trainer_access SET allowed_lessons=ARRAY[]::text[] WHERE user_id=$1 AND trainer='pronunciation'",[student])
   await actor(student)
   assert.equal((await db.query('SELECT * FROM pronunciation_messages')).rows.length,0)
   await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[`${student}/empty.webm`]),e=>e.code==='42501')
  })
  await t.test('German interface blocks all student trainers while German staff can manage content',async()=>{
   await actor(null,'service_role');await db.exec('RESET ROLE')
   await db.query("UPDATE profiles SET ui_language='de' WHERE id=$1",[student])
   await actor(student)
   for(const trainer of ['vocabulary','exercises','pronunciation','videos']) assert.equal(await allowed('A1.1',trainer),false)
   assert.equal((await db.query('SELECT * FROM vocabulary_cards')).rows.length,0)
   await actor(teacher);assert.equal(await allowed('A1.1','vocabulary'),true)
   await db.exec('RESET ROLE');await db.query("UPDATE profiles SET ui_language='ru' WHERE id=$1",[student])
  })
  await t.test('assessment directions initialize independently without a legacy trigger pre-assessing the reverse',async()=>{
   await db.exec('RESET ROLE')
   const newCard=uid(99)
   await db.query("INSERT INTO vocabulary_cards(id,word_de,lesson,level) VALUES($1,'Neu','Lektion 1','A1.1')",[newCard])
   await actor(student)
   const initialize=decision=>db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([decision])])
   await initialize({cardId:newCard,alreadyKnown:true,direction:'de_to_native'})
   assert.deepEqual((await db.query('SELECT direction,box_number FROM vocabulary_direction_progress WHERE card_id=$1',[newCard])).rows,[{direction:'de_to_native',box_number:6}])
   await initialize({cardId:newCard,alreadyKnown:false,direction:'native_to_de'})
   assert.deepEqual((await db.query('SELECT direction,box_number FROM vocabulary_direction_progress WHERE card_id=$1 ORDER BY direction',[newCard])).rows,[{direction:'de_to_native',box_number:6},{direction:'native_to_de',box_number:1}])
   await initialize({cardId:newCard,alreadyKnown:false,direction:'de_to_native'})
   assert.equal((await db.query("SELECT box_number FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='de_to_native'",[newCard])).rows[0].box_number,6)
  })
  await t.test('grammar restricts a single unit and grades accepted alternatives consistently',async()=>{
   await actor(teacher)
   const row=(await db.query("SELECT id,lesson FROM exercises WHERE level='A1.1' ORDER BY lesson LIMIT 1")).rows[0]
   await db.query("UPDATE student_trainer_access SET enabled=true,allowed_lessons=ARRAY[$2] WHERE user_id=$1 AND level='A1.1' AND trainer='exercises'",[student,row.lesson])
   await actor(student)
   assert.equal((await db.query("SELECT count(distinct lesson)::int n FROM exercises WHERE level='A1.1'")).rows[0].n,1)
   await db.exec('RESET ROLE')
   await db.query("UPDATE exercises SET type='fill_in_blank',content=jsonb_build_object('correct_answer','gut','alternative_answers',jsonb_build_array('prima')) WHERE id=$1",[row.id])
   await actor(student)
   assert.equal((await db.query('SELECT record_grammar_attempt($1,$2,false) result',[row.id,'  PRIMA  '])).rows[0].result.isCorrect,true)
   await actor(teacher)
   await db.query("UPDATE student_trainer_access SET allowed_lessons=ARRAY[]::text[] WHERE user_id=$1 AND level='A1.1' AND trainer='exercises'",[student])
   await actor(student)
   await assert.rejects(db.query('SELECT record_grammar_attempt($1,$2,false)',[row.id,'gut']),e=>e.code==='42501')
  })
  await t.test('lesson reset also removes reverse-only assessments without touching another learner',async()=>{
   await db.exec('RESET ROLE')
   const reverse=uid(101)
   await db.query("INSERT INTO vocabulary_cards(id,word_de,lesson,level) VALUES($1,'Rückwärts','Lektion 1','A1.1')",[reverse])
   await actor(student)
   await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:reverse,alreadyKnown:false,direction:'native_to_de'}])])
   await db.query("SELECT reset_vocabulary_lesson_progress('A1.1','Lektion 1')")
   assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress')).rows.length,0)
  })
  await t.test('anonymous caller has neither rights table nor private RPC access',async()=>{
   await actor(null,'anon');await assert.rejects(db.query('SELECT * FROM student_trainer_access'),e=>e.code==='42501');await assert.rejects(allowed('A1.1','videos'),e=>e.code==='42501')
  })
 } finally { await db.close() }
})
