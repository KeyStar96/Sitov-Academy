import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase2Database, phase2Actor, phase2Id as id, readPhase2Sql } from './helpers/phase2-db.mjs'

const student=id(1), other=id(2), teacher=id(3), exercise=id(10), card=id(11), reading=id(12), object=id(20)
const tables = [
  'public.student_level_access','public.learning_trainer_grants','public.learning_unit_grants',
  'public.user_exercise_progress','public.vocabulary_direction_progress','public.vocabulary_learning_state',
  'public.vocabulary_onboarding','public.submissions','vocabulary_private.answer_receipts',
  'learning_reset_private.audio_objects','learning_reset_private.jobs',
]

await test('identity alignment preserves learning rows, dependency identities and authorization', async t => {
  const db=await createPhase2Database()
  try {
    await db.exec(`INSERT INTO locales VALUES('de'),('ru'); INSERT INTO cefr_levels VALUES('A1');
      INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.1','A1',1);
      INSERT INTO learning_trainers VALUES('vocabulary'),('exercises'),('pronunciation'),('videos');`)
    for (const [actor,role] of [[student,'student'],[other,'student'],[teacher,'teacher']]) {
      await db.query('INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,$2,now())',[actor,`${actor}@example.test`])
      await db.query("INSERT INTO profiles(id,role,native_language,ui_language) VALUES($1,$2,'ru','ru')",[actor,role])
      await db.query('INSERT INTO people(auth_user_id,display_name,email) VALUES($1,$2,$3)',[actor,role,`${actor}@example.test`])
    }
    for (const [unit,trainer] of [[exercise,'exercises'],[card,'vocabulary'],[reading,'pronunciation']]) {
      await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.1',$2,'Unveränderte Lektion')",[unit,trainer])
    }
    await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$1,'Artikel','fill_in_blank','{\"correct_answer\":\"ein\"}')",[exercise])
    await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$1,'Haus')",[card])
    await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом')",[card])
    await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$1,'Guten Tag.')",[reading])
    await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')",[student])
    await db.query("INSERT INTO learning_trainer_grants(user_id,level,trainer,enabled) VALUES($1,'A1.1','vocabulary',true)",[student])
    await db.query("INSERT INTO learning_unit_grants VALUES($1,'A1.1','vocabulary',$2)",[student,card])
    await db.query('INSERT INTO user_exercise_progress(user_id,exercise_id,score,attempts) VALUES($1,$2,80,2)',[student,exercise])
    await db.query("INSERT INTO vocabulary_direction_progress(id,user_id,card_id,direction,box_number) VALUES($1,$2,$3,'de_to_native',3)",[id(30),student,card])
    await db.query('INSERT INTO vocabulary_learning_state(user_id,last_card_id) VALUES($1,$2)',[student,card])
    await db.query("INSERT INTO vocabulary_onboarding(user_id,level,status,started_unit_id) VALUES($1,'A1.1','skipped',$2)",[student,card])
    await db.query("INSERT INTO submissions(id,user_id,type,level,prompt_id,prompt_title) VALUES($1,$2,'audio','A1.1',$3,'Unverändert')",[id(31),student,reading])
    await db.query("INSERT INTO vocabulary_private.answer_receipts(user_id,request_id,progress_id,is_correct,ui_language,response) VALUES($1,$2,$3,true,'ru','{\"newPhase\":3}')",[student,id(40),id(30)])
    await db.query('INSERT INTO learning_reset_private.jobs(user_id,active) VALUES($1,false)',[student])
    await db.query("INSERT INTO storage.objects(id,bucket_id,name,owner) VALUES($1,'pronunciation_audio',$2,$3)",[object,`${student}/recording.webm`,student])
    await db.query("INSERT INTO learning_reset_private.audio_objects VALUES($1,$2,'pronunciation_audio',$3)",[student,object,`${student}/recording.webm`])

    const before = new Map()
    for (const table of tables) before.set(table,(await db.query(`SELECT * FROM ${table}`)).rows)
    const people=(await db.query('SELECT * FROM people ORDER BY id')).rows
    const dependencies=async()=>({
      relations:(await db.query('SELECT oid,relname FROM pg_class WHERE oid=ANY($1::regclass[]) ORDER BY oid',[tables])).rows,
      constraints:(await db.query('SELECT oid,conrelid,confrelid,contype,conkey,confkey FROM pg_constraint WHERE conrelid=ANY($1::regclass[]) ORDER BY oid',[tables])).rows,
      policies:(await db.query('SELECT oid,polrelid,polname,polroles,polcmd FROM pg_policy WHERE polrelid=ANY($1::regclass[]) ORDER BY oid',[tables])).rows,
      routines:(await db.query("SELECT p.oid,proargnames,prosecdef,proconfig,proacl FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('grammar_private','learning_private','learning_reset_private','pronunciation_private','trainer_access_private','vocabulary_private','public') ORDER BY p.oid")).rows,
    })
    const originalDependencies=await dependencies()
    const sql=await readPhase2Sql('02_identity_alignment.sql')
    await db.exec('BEGIN;'+sql+'COMMIT;')

    await t.test('renames all eleven columns without rewriting data, object identities, FKs or RPC contracts',async()=>{
      for (const table of tables) {
        const expected=before.get(table).map(({user_id,...row})=>({...row,auth_user_id:user_id}))
        assert.deepEqual((await db.query(`SELECT * FROM ${table}`)).rows,expected,table)
      }
      assert.deepEqual((await db.query('SELECT * FROM people ORDER BY id')).rows,people)
      assert.deepEqual(await dependencies(),originalDependencies)
      assert.equal((await db.query("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema IN('public','vocabulary_private','learning_reset_private') AND column_name='user_id'")).rows[0].n,0)
      assert.equal((await db.query("SELECT count(*)::int n FROM pg_policies WHERE schemaname='public' AND (coalesce(qual,'') ~ '\\muser_id\\M' OR coalesce(with_check,'') ~ '\\muser_id\\M')")).rows[0].n,0)
    })
    await t.test('repeating the migration preserves later function improvements and every row',async()=>{
      const source=(await db.query("SELECT pg_get_functiondef('public.set_student_level_access(uuid,text[])'::regprocedure) definition")).rows[0].definition
      await db.exec(source.replace('BEGIN','BEGIN\n -- later independently reviewed improvement'))
      await db.exec('BEGIN;'+sql+'COMMIT;')
      assert.match((await db.query("SELECT prosrc FROM pg_proc WHERE oid='public.set_student_level_access(uuid,text[])'::regprocedure")).rows[0].prosrc,/later independently reviewed improvement/)
      assert.deepEqual(await dependencies(),originalDependencies)
      for (const table of tables) assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,before.get(table).length)
    })
    await t.test('ownership policies, composite FKs and grading operate on the renamed columns',async()=>{
      await phase2Actor(db,other)
      assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress')).rows.length,0)
      assert.equal((await db.query('SELECT * FROM student_level_access')).rows.length,0)
      await phase2Actor(db,student)
      assert.equal((await db.query('SELECT auth_user_id FROM vocabulary_direction_progress')).rows[0].auth_user_id,student)
      assert.equal((await db.query("SELECT record_grammar_attempt($1,'ein',false) result",[exercise])).rows[0].result.isCorrect,true)
      assert.equal((await db.query('SELECT completed FROM user_exercise_progress')).rows[0].completed,true)
      await db.query('SELECT initialize_vocabulary_cards($1)',[JSON.stringify([{cardId:card,alreadyKnown:false,direction:'native_to_de'}])])
      assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress')).rows.length,2)
      await phase2Actor(db,teacher)
      await db.query("SELECT set_student_level_access(p_user_id=>$1,p_levels=>ARRAY['A1.1'])",[other])
      await db.query("SELECT set_student_trainer_access(p_user_id=>$1,p_level=>'A1.1',p_trainer=>'vocabulary',p_enabled=>true,p_unit_ids=>$2::uuid[],p_replace_units=>true)",[other,[card]])
      assert.equal((await db.query('SELECT auth_user_id FROM learning_unit_grants WHERE auth_user_id=$1',[other])).rows[0].auth_user_id,other)
      await assert.rejects(db.query("INSERT INTO learning_unit_grants(auth_user_id,level,trainer,unit_id) VALUES($1,'A1.1','vocabulary',$2)",[id(99),card]),error=>error.code==='23503')
      await db.query("SELECT reset_student_level_progress(p_student_id=>$1,p_level=>'A1.1')",[student])
      assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress WHERE auth_user_id=$1',[student])).rows.length,0)
    })
    await t.test('private reset manifests keep ownership through begin, listing and finish',async()=>{
      await phase2Actor(db,student)
      const token=(await db.query("SELECT begin_learning_reset('RESET_LEARNING_DATA') token")).rows[0].token
      assert.deepEqual((await db.query('SELECT * FROM learning_reset_audio_batch($1)',[token])).rows,[{bucket_id:'pronunciation_audio',object_name:`${student}/recording.webm`}])
      await phase2Actor(db,other)
      await assert.rejects(db.query('SELECT * FROM learning_reset_audio_batch($1)',[token]),error=>error.code==='42501')
      await phase2Actor(db,null,'service_role')
      await db.query('DELETE FROM storage.objects WHERE id=$1',[object])
      await phase2Actor(db,student)
      assert.equal((await db.query('SELECT finish_learning_reset($1) finished',[token])).rows[0].finished,true)
      // Inspect private implementation state as the fixture owner. service_role
      // deliberately has no schema USAGE here; the public reset RPC is its API.
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT active FROM learning_reset_private.jobs WHERE auth_user_id=$1',[student])).rows[0].active,false)
      assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts WHERE auth_user_id=$1',[student])).rows[0].n,0)
      assert.deepEqual((await db.query('SELECT * FROM people ORDER BY id')).rows,people)
    })
  } finally { await db.close() }
})
