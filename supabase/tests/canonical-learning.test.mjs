import { grammarSeedSql } from '../../scripts/lib/grammar-seed.mjs'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const student=uid(1), other=uid(2), teacher=uid(3), card=uid(10)
await test('canonical learning tables without compatibility views (isolated PostgreSQL)',async t=>{
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
  // This migration also replaces the note RPC; its composite type belongs to
  // the business baseline, whereas this fixture focuses on learning tables.
  await db.exec('CREATE TABLE teacher_student_notes(id uuid,student_id uuid,teacher_id uuid,note_text text,discount_percent numeric,is_blackboard boolean);')
  await db.exec(await read('../migrations/20260913144640_application_conflict_responses.sql'))
  await db.exec(`CREATE SCHEMA identity_private;
    CREATE FUNCTION identity_private.current_profile_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM public.profiles WHERE id=(SELECT auth.uid()) $$;
    GRANT USAGE ON SCHEMA identity_private TO authenticated,service_role;
    GRANT EXECUTE ON FUNCTION identity_private.current_profile_role() TO authenticated,service_role;
    CREATE TABLE locales(code text PRIMARY KEY);INSERT INTO locales VALUES('de'),('en'),('ru'),('uk'),('tr');
    GRANT SELECT ON locales TO authenticated;
    CREATE FUNCTION public.mark_feedback_seen(uuid) RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$;
    UPDATE profiles SET native_language=CASE native_language WHEN 'Russisch' THEN 'ru' WHEN 'Deutsch' THEN 'de' ELSE NULL END;`)
  // Reproduce all 89 retained inactive texts: 59 have units, 30 only a CEFR family.
  for(let index=0;index<89;index++) {
    const id=uid(500+index), family=['B2','C1','C2'][Math.floor(index/10)]
    if(index<30) await db.query('INSERT INTO learning_reading_texts(id,legacy_cefr_level,sentence_de) VALUES($1,$2,$3)',[id,family,`Archivtext ${index}: unverändert überführt.`])
    else {
      await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.1','pronunciation',$2,false)",[id,`Archivtext ${index}`])
      await db.query('INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$1,$2)',[id,`Archivtext ${index}: unverändert überführt.`])
    }
  }
  const resourceUrls=['https://learngerman.dw.com/de/hallo/l-37250531','https://learngerman.dw.com/de/wie-heißt-du/l-37250532',null]
  for(let index=0;index<3;index++) {
    await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.1','videos',$2,true)",[uid(800+index),`Video ${index}`])
    await db.query("INSERT INTO learning_videos(id,unit_id,external_url,is_external) VALUES($1,$1,$2,$3)",[uid(800+index),resourceUrls[index],index<2])
  }
  const before=(await db.query('SELECT id,sentence_de,focus,audio_url FROM learning_reading_texts ORDER BY id')).rows
  await db.exec('BEGIN;'+await read('../standardization/learning.sql')+await read('../standardization/learning-videos.sql')+'COMMIT;')
  const actor=async(id,role='authenticated')=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id??'']);await db.exec(`SET ROLE ${role}`)}
  const unit=(await db.query('SELECT unit_id FROM learning_vocabulary_cards WHERE id=$1',[card])).rows[0].unit_id
  await t.test('preserves all 149 texts verbatim with complete unit and CEFR references',async()=>{
    assert.equal(before.length,149)
    assert.deepEqual((await db.query('SELECT id,sentence_de,focus,audio_url FROM learning_reading_texts ORDER BY id')).rows,before)
    assert.equal((await db.query('SELECT count(*)::int n FROM learning_reading_texts r JOIN learning_units u ON u.id=r.unit_id JOIN learning_levels l ON l.code=u.level JOIN cefr_levels c ON c.code=l.cefr_level')).rows[0].n,149)
    assert.equal((await db.query('SELECT count(*)::int n FROM learning_reading_texts r JOIN learning_units u ON u.id=r.unit_id WHERE u.is_active')).rows[0].n,60)
    assert.equal((await db.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1)",[['vocabulary_cards','exercises','pronunciation_prompts','videos','user_vocabulary_progress','teacher_feedback','student_trainer_access']])).rows[0].n,0)
    assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='public' AND column_name IN('legacy_cefr_level','started_lesson','parent_id','attempt_number')")).rows[0].n,0)
  })
  await t.test('exposes inactive family texts to staff only and rejects invalid locale references',async()=>{
    await actor(teacher)
    assert.equal((await db.query("SELECT count(*)::int n FROM learning_reading_texts r JOIN learning_units u ON u.id=r.unit_id WHERE u.level IN('B2','C1','C2')")).rows[0].n,30)
    await assert.rejects(db.query("INSERT INTO grammar_translations(exercise_id,locale,hint) SELECT id,'xx','invalid' FROM learning_exercises LIMIT 1"),e=>e.code==='23503')
    await actor(student)
    assert.equal((await db.query("SELECT count(*)::int n FROM learning_reading_texts r JOIN learning_units u ON u.id=r.unit_id WHERE NOT u.is_active")).rows[0].n,0)
  })
  await t.test('unit grants and grading remain scoped; directions and request receipts stay independent',async()=>{
    await actor(student)
    await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false,direction:'de_to_native'}])])
    await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:true,direction:'native_to_de'}])])
    const forward=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE direction='de_to_native'")).rows[0].id
    const answer=(await db.query("SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[uid(90),forward])).rows[0].result
    assert.equal(answer.newPhase,2)
    assert.deepEqual((await db.query("SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[uid(90),forward])).rows[0].result,answer)
    assert.equal((await db.query("SELECT box_number FROM vocabulary_direction_progress WHERE direction='native_to_de'")).rows[0].box_number,6)
    await actor(other);assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress')).rows.length,0)
    await actor(teacher)
    await db.query("SELECT set_student_trainer_access($1,'A1.1','vocabulary',true,ARRAY[]::uuid[],true)",[student])
    await actor(student)
    assert.equal((await db.query('SELECT * FROM learning_vocabulary_cards')).rows.length,0)
    await assert.rejects(db.query("SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru')",[uid(90),forward]),e=>e.code==='42501')
    await actor(teacher);await db.query("SELECT set_student_trainer_access($1,'A1.1','vocabulary',true,NULL,true)",[student])
  })
  await t.test('canonical CMS stores translation rows and never duplicates localized grammar JSON',async()=>{
    await actor(teacher)
    const payload={unit:{level:'A1.1',label:'Neue Grammatik'},fields:{topic:'Artikel',type:'fill_in_blank',content:{text_before:'Das ist ',text_after:' Haus.',correct_answer:'ein'}},translations:[{locale:'ru',hint:'Средний род',smart_hint:'Подумай об артикле'}]}
    const saved=(await db.query("SELECT save_learning_content('exercises',$1) result",[JSON.stringify(payload)])).rows[0].result
    assert.ok(saved.id)
    const exercise=(await db.query('SELECT * FROM learning_exercises WHERE id=$1',[saved.id])).rows[0]
    assert.equal(exercise.content.smart_hint,undefined)
    assert.equal((await db.query('SELECT hint FROM grammar_translations WHERE exercise_id=$1',[saved.id])).rows[0].hint,'Средний род')
    await actor(student)
    assert.equal((await db.query("SELECT record_grammar_attempt($1,'ein',false) result",[saved.id])).rows[0].result.isCorrect,true)
    await assert.rejects(db.query("SELECT save_learning_content('exercises',$1)",[JSON.stringify(payload)]),e=>e.code==='42501')
  })
  await t.test('individual newly authored texts use their own unit FK for permissions and audio',async()=>{
    await actor(teacher)
    const payload={unit:{level:'A1.1',label:'Mein neuer Lesetext',is_active:true},fields:{sentence_de:'Hallo. Ich bin Anna und wohne in Hannover.',focus:'Klar sprechen'}}
    const reading=(await db.query("SELECT save_learning_content('pronunciation',$1) result",[JSON.stringify(payload)])).rows[0].result
    const readingUnit=(await db.query('SELECT unit_id FROM learning_reading_texts WHERE id=$1',[reading.id])).rows[0].unit_id
    assert.notEqual(reading.id,readingUnit)
    await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,$2::uuid[],true)",[student,[readingUnit]])
    await actor(student)
    assert.deepEqual((await db.query("SELECT r.id FROM learning_reading_texts r JOIN learning_units u ON u.id=r.unit_id WHERE u.level='A1.1'")).rows,[{id:reading.id}])
    const file=student+'/'+uid(96)+'.webm'
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[file])
    const thread=(await db.query('SELECT create_pronunciation_submission($1,$2) id',[reading.id,'storage://pronunciation_audio/'+file])).rows[0].id
    assert.equal((await db.query('SELECT pronunciation_private.can_access_submission($1) allowed',[thread])).rows[0].allowed,true)
    await actor(teacher);await db.query("SELECT set_student_trainer_access($1,'A1.1','pronunciation',true,NULL,true)",[student])
  })
  await t.test('preserves both DW sources and the empty draft in one canonical source field',async()=>{
    await actor(teacher)
    assert.deepEqual((await db.query('SELECT source_url FROM learning_videos ORDER BY id')).rows.map(row=>row.source_url),resourceUrls)
    assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1',[uid(802)])).rows[0].is_active,false)
    await assert.rejects(db.query("UPDATE learning_units SET is_active=true WHERE id=$1",[uid(802)]),e=>e.code==='23514')
    await assert.rejects(db.query("UPDATE learning_videos SET source_url='javascript:alert(1)' WHERE id=$1",[uid(800)]),e=>e.code==='23514')
    const payload={unit:{level:'A1.1',label:'Neues Video',is_active:true},fields:{source_url:'https://www.youtube.com/watch?v=abcdefghijk'}}
    await db.query("SELECT save_learning_content('videos',$1,$2)",[JSON.stringify(payload),uid(802)])
    await actor(student)
    assert.equal((await db.query('SELECT count(*)::int n FROM learning_videos')).rows[0].n,3)
  })
  await t.test('canonical author imports use relational hints and preserve teacher edits on reimport',async()=>{
    await actor(teacher)
    const records=[{id:uid(999),level:'A1.1',lesson:'Autorenimport',topic:'Artikel',type:'fill_in_blank',content:{text_before:'Das ist ',text_after:' Haus.',correct_answer:'ein',smart_hint:'Ein Haus ist neutral.'}}]
    const sql=grammarSeedSql(records)
    await db.exec(sql)
    const exercise=(await db.query('SELECT unit_id,content FROM learning_exercises WHERE id=$1',[uid(999)])).rows[0]
    assert.ok(exercise.unit_id)
    assert.equal(exercise.content.smart_hint,undefined)
    assert.equal((await db.query("SELECT smart_hint FROM grammar_translations WHERE exercise_id=$1 AND locale='de'",[uid(999)])).rows[0].smart_hint,'Ein Haus ist neutral.')
    await db.query("UPDATE learning_exercises SET topic='Von Lehrerin überarbeitet' WHERE id=$1",[uid(999)])
    await db.query("UPDATE grammar_translations SET smart_hint='Eigener Hinweis' WHERE exercise_id=$1",[uid(999)])
    await db.exec(sql)
    assert.equal((await db.query('SELECT topic FROM learning_exercises WHERE id=$1',[uid(999)])).rows[0].topic,'Von Lehrerin überarbeitet')
    assert.equal((await db.query("SELECT smart_hint FROM grammar_translations WHERE exercise_id=$1 AND locale='de'",[uid(999)])).rows[0].smart_hint,'Eigener Hinweis')
  })
  await t.test('onboarding and lesson reset identify an existing unit through UUID, never a label fallback',async()=>{
    await actor(student)
    await db.query("SELECT skip_vocabulary_assessment('A1.1')")
    assert.equal((await db.query('SELECT started_unit_id FROM vocabulary_onboarding')).rows[0].started_unit_id,unit)
    assert.equal((await db.query("SELECT trainer_access_private.unit_allowed('A1.1','vocabulary','Lektion 1') allowed")).rows[0].allowed,false)
    await db.query('SELECT reset_vocabulary_lesson_progress($1)',[unit])
    assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress')).rows[0].n,0)
  })
  await t.test('audio and replies survive canonical reads and reset without resubmission columns',async()=>{
    await actor(student)
    const prompt=(await db.query("SELECT r.id FROM learning_reading_texts r JOIN learning_units u ON u.id=r.unit_id WHERE u.is_active AND u.level='A1.1' ORDER BY r.id LIMIT 1")).rows[0].id
    const file=student+'/'+uid(95)+'.webm'
    await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('pronunciation_audio',$1)",[file])
    const thread=(await db.query('SELECT create_pronunciation_submission($1,$2) id',[prompt,'storage://pronunciation_audio/'+file])).rows[0].id
    await actor(teacher);await db.query("INSERT INTO pronunciation_messages(submission_id,sender_id,text_content) VALUES($1,$2,'Gut gelesen')",[thread,teacher])
    await actor(other);assert.equal((await db.query('SELECT * FROM pronunciation_messages WHERE submission_id=$1',[thread])).rows.length,0)
    await actor(student);await db.query('SELECT mark_pronunciation_seen($1)',[thread])
    assert.ok((await db.query('SELECT seen_at FROM pronunciation_messages WHERE submission_id=$1',[thread])).rows[0].seen_at)
    const token=(await db.query("SELECT begin_learning_reset('RESET_LEARNING_DATA') token")).rows[0].token
    await assert.rejects(db.query('SELECT finish_learning_reset($1)',[token]),e=>e.code==='55000')
    await db.query("DELETE FROM storage.objects WHERE bucket_id='pronunciation_audio' AND name LIKE $1",[student+'/%'])
    assert.equal((await db.query('SELECT finish_learning_reset($1) done',[token])).rows[0].done,true)
    assert.equal((await db.query('SELECT count(*)::int n FROM submissions')).rows[0].n,0)
    assert.equal((await db.query('SELECT count(*)::int n FROM pronunciation_messages')).rows[0].n,0)
  })
 } finally {await db.close()}
})
