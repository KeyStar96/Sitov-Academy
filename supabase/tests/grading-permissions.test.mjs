import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase3Database,actor,id,student,outsider,vocabularyUnit,exerciseUnit,result,apply} from './helpers/phase3-db.mjs'

await test('grading crosses migration/legacy owner boundary without granting client access',async t=>{
 const db=await createPhase3Database(), card=id(710), progress=id(711), exercise=id(712), request=id(713)
 const admin=()=>db.exec('RESET ROLE')
 const answer=()=>result(db,"SELECT submit_vocabulary_answer_once($1,$2,NULL,'das Haus','en') result",[request,progress])
 try {
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[card,vocabularyUnit])
  await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'en','house')",[card])
  await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date) VALUES($1,$2,$3,'native_to_de',1,now()-interval '1 day')",[progress,student,card])
  await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Artikel','fill_in_blank','{\"correct_answer\":\"das Haus\",\"accepted_answers\":[\"das Haus\"]}')",[exercise,exerciseUnit])
  // PGlite cannot demote its bootstrap postgres role. A NOSUPERUSER legacy
  // owner inherits postgres OBJECT privileges; SUPERUSER is not inherited.
  // Helpers belong to a separate migration admin, exactly the live failure.
  await db.exec(`CREATE ROLE grading_migration_admin SUPERUSER;
   CREATE ROLE legacy_grading_owner NOLOGIN NOSUPERUSER BYPASSRLS;
   GRANT postgres TO legacy_grading_owner;
   ALTER FUNCTION learning_private.normalize_answer(text) OWNER TO grading_migration_admin;
   ALTER FUNCTION learning_private.grade_answer(text,text[]) OWNER TO grading_migration_admin;
   ALTER FUNCTION learning_private.expand_german_letters(text) OWNER TO grading_migration_admin;
   ALTER FUNCTION learning_private.levenshtein_at_most_one(text,text) OWNER TO grading_migration_admin;
   ALTER FUNCTION vocabulary_private.submit_answer(uuid,boolean,text,text) OWNER TO legacy_grading_owner;
   ALTER FUNCTION vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text) OWNER TO legacy_grading_owner;
   ALTER FUNCTION grammar_private.record_attempt(uuid,text,boolean) OWNER TO legacy_grading_owner;`)
  assert.equal((await db.query("SELECT rolsuper FROM pg_roles WHERE rolname='legacy_grading_owner'")).rows[0].rolsuper,false)
  const original=(await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1',[progress])).rows[0]
  const definitions=(await db.query("SELECT oid,proowner,prosrc,prosecdef,proconfig FROM pg_proc WHERE oid IN ('vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure,'vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text)'::regprocedure) ORDER BY oid")).rows
  await t.test('reproduces 42501 for an existing progress row and preserves all its state',async()=>{
   await actor(db,student)
   const response=await answer()
   assert.equal(response.error,'not_authorized'); assert.equal(response.sqlstate,'42501')
   await admin()
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1',[progress])).rows[0],original)
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts')).rows[0].n,0)
  })
  await t.test('two precise grants restore authoritative grading and exactly-once retry',async()=>{
   await apply(db,['15_grading_helper_permissions.sql'])
   await apply(db,['15_grading_helper_permissions.sql'])
   await actor(db,student)
   const first=await answer()
   assert.equal(first.success,true,JSON.stringify(first)); assert.equal(first.isCorrect,true); assert.equal(first.newPhase,2)
   assert.deepEqual(await answer(),first)
   await admin()
   assert.equal((await db.query('SELECT box_number FROM vocabulary_direction_progress WHERE id=$1',[progress])).rows[0].box_number,2)
   assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts')).rows[0].n,1)
   assert.deepEqual((await db.query("SELECT oid,proowner,prosrc,prosecdef,proconfig FROM pg_proc WHERE oid IN ('vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure,'vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text)'::regprocedure) ORDER BY oid")).rows,definitions)
  })
  await t.test('grammar uses the same restricted helper boundary',async()=>{
   await actor(db,student)
   const response=await result(db,"SELECT record_grammar_attempt($1,'das Haus',false) result",[exercise])
   assert.equal(response.success,true,JSON.stringify(response)); assert.equal(response.isCorrect,true)
   await admin()
   assert.equal((await db.query('SELECT completed FROM user_exercise_progress WHERE exercise_id=$1',[exercise])).rows[0].completed,true)
  })
  await t.test('clients cannot call grading helpers or change another learner progress',async()=>{
   for(const role of ['anon','authenticated']) {
    await actor(db,student,role)
    await assert.rejects(db.query("SELECT learning_private.normalize_answer('Haus')"),e=>e.code==='42501')
    await assert.rejects(db.query("SELECT learning_private.grade_answer('Haus',ARRAY['Haus'])"),e=>e.code==='42501')
   }
   await actor(db,outsider)
   assert.equal((await answer()).error,'trainer_access_denied')
   await admin()
   assert.equal((await db.query("SELECT has_function_privilege('legacy_grading_owner','learning_private.expand_german_letters(text)','EXECUTE') allowed")).rows[0].allowed,false)
  })
  await t.test('inverse REVOKE restores the original boundary without deleting progress',async()=>{
   await db.exec('REVOKE EXECUTE ON FUNCTION learning_private.normalize_answer(text),learning_private.grade_answer(text,text[]) FROM postgres')
   await actor(db,student)
   assert.equal((await answer()).error,'not_authorized')
   await admin(); await apply(db,['15_grading_helper_permissions.sql'])
   await actor(db,student); assert.equal((await answer()).success,true)
  })
 } finally { await db.close() }
})
