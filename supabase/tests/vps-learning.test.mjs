import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const student=uid(1), other=uid(2), teacher=uid(3), card=uid(10)
await test('VPS normalized learning catalog and permissions (isolated PostgreSQL only)',async t=>{
 const db=new PGlite()
 try {
  await db.exec(await read('./fixtures/trainer-access-baseline.sql'))
  await db.exec(`ALTER TABLE vocabulary_cards ADD article text, ADD plural text, ADD image_url text, ADD audio_url text, ADD created_at timestamptz DEFAULT now(),ADD translation_en text,ADD translation_ru text,ADD translation_tr text;
   ALTER TABLE exercises ADD created_at timestamptz DEFAULT now();
   ALTER TABLE videos ADD title text DEFAULT 'Video',ADD lesson text DEFAULT 'Lektion 1',ADD description text,ADD video_url text,ADD external_url text,ADD is_external boolean DEFAULT true,ADD created_at timestamptz DEFAULT now();
   CREATE TABLE people(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),auth_user_id uuid UNIQUE REFERENCES profiles(id),display_name text,email text,phone text,street text,postal_code text,city text);
   GRANT SELECT ON people TO authenticated; CREATE VIEW profile_details WITH(security_invoker=true) AS SELECT * FROM profiles;`)
  await db.query("INSERT INTO profiles VALUES($1,'student',ARRAY['A1.1','A1.2'],'Russisch','ru'),($2,'student',ARRAY['A1.1'],'Russisch','ru'),($3,'teacher',ARRAY[]::text[],'Deutsch','de')",[student,other,teacher])
  await db.query("INSERT INTO vocabulary_cards(id,word_de,lesson,level,translation_ru,translation_en) VALUES($1,'Haus','Lektion 1','A1.1','дом','house')",[card])
  for(const migration of ['20260910133125_vocabulary_bidirectional_learning.sql','20260910151533_vocabulary_answer_receipts.sql','20260910184438_pronunciation_reading_conversations.sql','20260910184937_grammar_curriculum_and_progress.sql','20260910213453_student_trainer_access.sql','20260910214425_trainer_access_policy_commands.sql','20260911000000_localize_grammar_hints.sql','20260912102100_vocabulary_alternative_answers.sql','20260912112100_lesson_trainer_access.sql','20260913104728_repair_learning_unit_permissions.sql']) await db.exec(await read('../migrations/'+migration))
  await db.exec('DROP SCHEMA learning_reset_private CASCADE; GRANT DELETE,UPDATE ON storage.objects TO authenticated;')
  await db.exec(await read('../migrations/20260910195205_complete_learning_reset.sql'))
  await db.exec(await read('../vps/learning.sql'))
  const actor=async(person,role='authenticated')=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[person??'']);await db.exec(`SET ROLE ${role}`)}
  await actor(teacher)
  const vocabUnit=(await db.query('SELECT unit_id FROM vocabulary_cards WHERE id=$1',[card])).rows[0].unit_id
  const texts=(await db.query("SELECT id,unit_id FROM pronunciation_prompts WHERE level='A1.1' AND is_active ORDER BY sort_order")).rows
  await t.test('content is preserved in normalized storage with compatibility views',async()=>{
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_translations')).rows[0].n,5)
   assert.equal((await db.query('SELECT translation_ru FROM vocabulary_cards WHERE id=$1',[card])).rows[0].translation_ru,'дом')
   assert.equal((await db.query('SELECT count(*)::int n FROM exercises')).rows[0].n,600)
   assert.equal(texts.length,10)
   const kinds=(await db.query("SELECT relname,relkind FROM pg_class WHERE relname IN('vocabulary_cards','exercises','user_vocabulary_progress','student_trainer_access') ORDER BY relname")).rows
   assert.ok(kinds.every(row=>row.relkind==='v'))
  })
  await t.test('staff selects one reading text and empty selection denies all',async()=>{
   await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,$2,true)",[student,[texts[0].unit_id]])
   await actor(student)
   assert.deepEqual((await db.query("SELECT id FROM pronunciation_prompts WHERE level='A1.1'")).rows.map(row=>row.id),[texts[0].id])
   await actor(teacher)
   await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,ARRAY[]::uuid[],true)",[student])
   await actor(student);assert.equal((await db.query("SELECT count(*)::int n FROM pronunciation_prompts WHERE level='A1.1'")).rows[0].n,0)
  })
  await t.test('students cannot self-grant, cross-scope units are rejected, level remains required',async()=>{
   await assert.rejects(db.query("SELECT set_student_level_access($1,ARRAY['B1.2'])",[student]),e=>e.code==='42501')
   await actor(teacher)
   await assert.rejects(db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,$2,true)",[student,[vocabUnit]]),e=>e.code==='23514')
   await db.query("SELECT set_student_level_access($1,ARRAY[]::text[])",[other]);await actor(other)
   assert.equal((await db.query('SELECT * FROM vocabulary_cards')).rows.length,0)
  })
  await t.test('assessment and grading store each direction only once and preserve six phases',async()=>{
   await actor(student)
   await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false,direction:'de_to_native'}])])
   assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress')).rows.length,1)
   await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:true,direction:'native_to_de'}])])
   assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress')).rows.length,2)
   const progress=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE direction='de_to_native'")).rows[0].id
   const result=(await db.query("SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[uid(40),progress])).rows[0].result
   assert.equal(result.newPhase,2)
   assert.equal((await db.query('SELECT box_number FROM user_vocabulary_progress')).rows[0].box_number,2)
   assert.equal((await db.query("SELECT box_number FROM vocabulary_direction_progress WHERE direction='native_to_de'")).rows[0].box_number,6)
  })
  await t.test('CMS updates translations and lesson placement without changing existing content IDs',async()=>{
   await actor(teacher)
   const saved=(await db.query("SELECT save_learning_content('vocabulary',$1,$2) row",[JSON.stringify({translation_ru:'здание',lesson:'Neue Lektion'}),card])).rows[0].row
   assert.equal(saved.id,card);assert.equal(saved.translation_ru,'здание');assert.equal(saved.translation_en,'house');assert.notEqual(saved.unit_id,vocabUnit)
   const created=(await db.query("SELECT save_learning_content('pronunciation',$1,NULL) row",[JSON.stringify({level:'A1.1',title:'Neuer Text',sentence_de:'Ein neuer eigener Text.',is_active:true})])).rows[0].row
   assert.equal(created.id,created.unit_id)
   await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,$2,true)",[student,[created.unit_id]])
   await actor(student);assert.deepEqual((await db.query("SELECT id FROM pronunciation_prompts WHERE level='A1.1'")).rows.map(row=>row.id),[created.id])
   await assert.rejects(db.query("SELECT save_learning_content('vocabulary',$1,$2)",[JSON.stringify({word_de:'Forged'}),card]),e=>e.code==='42501')
  })
  await t.test('localized grammar round-trips without duplicate JSON translations and grading enforces its unit',async()=>{
   await actor(teacher)
   const payload={level:'A1.1',lesson:'Eigene Grammatik',topic:'Artikel',type:'fill_in_blank',hint:{de:'Ein Haus',ru:'Средний род'},content:{sentence:'Das ist ___ Haus.',correct_answer:'ein',smart_hint:{de:'Unbestimmt',en:'Indefinite'},explanation:{ru:'Средний род'}}}
   const saved=(await db.query("SELECT save_learning_content('exercises',$1,NULL) row",[JSON.stringify(payload)])).rows[0].row
   assert.equal(saved.hint.ru,payload.hint.ru);assert.equal(saved.content.smart_hint.en,'Indefinite')
   assert.equal((await db.query("SELECT content ? 'smart_hint' duplicated FROM learning_exercises WHERE id=$1",[saved.id])).rows[0].duplicated,false)
   await db.query("SELECT set_student_trainer_access($1,'A1.1','exercises',true,$2,true)",[student,[saved.unit_id]])
   await actor(student)
   assert.deepEqual((await db.query("SELECT id FROM exercises WHERE level='A1.1'")).rows.map(row=>row.id),[saved.id])
   await actor(teacher)
   await assert.rejects(db.query('UPDATE learning_exercises SET unit_id=$1 WHERE id=$2',[texts[0].unit_id,saved.id]),e=>e.code==='23514')
  })
  await t.test('private recordings and teacher feedback use one message store with participant-only access',async()=>{
   await actor(teacher)
   await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,$2,true)",[student,[texts[0].unit_id]])
   await actor(student)
   const object=student+'/'+uid(90)+'.webm';const ref='storage://pronunciation_audio/'+object
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[object])
   const thread=(await db.query('SELECT create_pronunciation_submission($1,$2) id',[texts[0].id,ref])).rows[0].id
   await actor(teacher)
   const teacherObject=teacher+'/'+uid(91)+'.webm'
   await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[teacherObject])
   await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,text_content,audio_path) VALUES($1,$2,'Gut gelesen',$3)",[thread,teacher,'storage://pronunciation_audio/'+teacherObject])
   assert.equal((await db.query('SELECT count(*)::int n FROM teacher_feedback WHERE submission_id=$1',[thread])).rows[0].n,1)
   assert.equal((await db.query('SELECT status FROM submissions WHERE id=$1',[thread])).rows[0].status,'reviewed')
   await actor(other)
   assert.equal((await db.query('SELECT * FROM pronunciation_messages WHERE submission_id=$1',[thread])).rows.length,0)
   assert.equal((await db.query('SELECT * FROM storage.objects WHERE name=$1',[object])).rows.length,0)
   await actor(student)
   await db.query('SELECT mark_pronunciation_seen($1)',[thread])
   assert.ok((await db.query('SELECT seen_at FROM teacher_feedback WHERE submission_id=$1',[thread])).rows[0].seen_at)
   await assert.rejects(db.query("UPDATE profiles SET role='admin' WHERE id=$1",[student]),e=>e.code==='42501')
   await assert.rejects(db.query("UPDATE pronunciation_messages SET text_content='forged' WHERE submission_id=$1",[thread]),e=>e.code==='42501')
  })
  await t.test('reset clears both directions atomically and leaves unrelated users and permissions intact',async()=>{
   await actor(student)
   await assert.rejects(db.query("SELECT reset_student_level_progress($1,'A1.1')",[student]),e=>e.code==='42501')
   await actor(teacher)
   await db.query("SELECT reset_student_level_progress($1,'A1.1')",[student])
   await actor(student)
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress')).rows[0].n,0)
   assert.ok((await db.query("SELECT * FROM student_level_access WHERE level='A1.1'")).rows.length)
   await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false,direction:'native_to_de'}])])
   await db.query("SELECT reset_vocabulary_lesson_progress('A1.1','Neue Lektion')")
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress')).rows[0].n,0)
  })
  await t.test('resumable reset removes private participant audio after revocation and rejects foreign reset tokens',async()=>{
   await actor(teacher)
   await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',false,NULL,false)",[student])
   await actor(student)
   assert.equal((await db.query("SELECT count(*)::int n FROM storage.objects WHERE bucket_id='pronunciation_audio'")).rows[0].n,0)
   const token=(await db.query("SELECT begin_learning_reset('RESET_LEARNING_DATA') token")).rows[0].token
   assert.equal((await db.query('SELECT * FROM learning_reset_audio_batch($1)',[token])).rows.length,2)
   await assert.rejects(db.query('SELECT finish_learning_reset($1)',[token]),e=>e.code==='55000')
   await assert.rejects(db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false}])]),e=>e.code==='55000')
   await actor(other)
   await assert.rejects(db.query('SELECT learning_reset_audio_batch($1)',[token]),e=>e.code==='42501')
   await actor(student)
   const removed=(await db.query("DELETE FROM storage.objects WHERE bucket_id='pronunciation_audio' RETURNING id")).rows
   assert.equal(removed.length,2)
   assert.equal((await db.query('SELECT finish_learning_reset($1) done',[token])).rows[0].done,true)
   assert.equal((await db.query('SELECT count(*)::int n FROM submissions')).rows[0].n,0)
   assert.equal((await db.query('SELECT count(*)::int n FROM teacher_feedback')).rows[0].n,0)
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress')).rows[0].n,0)
   assert.ok((await db.query('SELECT * FROM student_level_access')).rows.length)
  })
  await t.test('German interface blocks trainers and anonymous reads are denied',async()=>{
   await db.exec('RESET ROLE');await db.query("UPDATE profiles SET ui_language='de' WHERE id=$1",[student]);await actor(student)
   assert.equal((await db.query('SELECT * FROM vocabulary_cards')).rows.length,0)
   await actor(null,'anon');await assert.rejects(db.query('SELECT * FROM vocabulary_cards'),e=>e.code==='42501')
  })
 } finally {await db.close()}
})
