import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase3Database,actor,id,student,teacher,outsider,exerciseUnit,vocabularyUnit,result,apply} from './helpers/phase3-db.mjs'

await test('Phase 4 SQL aggregation and statement-scoped RLS preserve authorization', async t => {
 const db=await createPhase3Database()
 const card=id(101),otherCard=id(102),exercise=id(103),otherExercise=id(104),otherUnit=id(105)
 try {
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2)")
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','exercises','Second level')",[otherUnit])
  for(const uid of [card,otherCard]) {
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$2,'Haus')",[uid,vocabularyUnit])
   await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом')",[uid])
  }
  for(const [uid,unit] of [[exercise,exerciseUnit],[otherExercise,otherUnit]])
   await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Artikel','fill_in_blank','{\"correct_answer\":\"ein\",\"accepted_answers\":[\"ein\"]}')",[uid,unit])
  await db.query("INSERT INTO user_exercise_progress(auth_user_id,exercise_id,completed) VALUES($1,$2,true)",[student,exercise])
  for(const [uid,direction,box] of [[card,'de_to_native',7],[card,'native_to_de',7],[otherCard,'de_to_native',7],[otherCard,'native_to_de',6]])
   await db.query('INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number) VALUES($1,$2,$3,$4)',[student,uid,direction,box])
  await apply(db,['09_progress_aggregate.sql'])
  await t.test('staff-only aggregation includes both mastered directions and zero levels',async()=>{
   await actor(db,student)
   assert.equal((await result(db,'SELECT public.get_all_students_progress_data() result')).error,'not_authorized')
   await actor(db,null,'anon')
   await assert.rejects(db.query('SELECT public.get_all_students_progress_data()'),e=>e.code==='42501')
   await actor(db,null)
   assert.equal((await result(db,'SELECT public.get_all_students_progress_data() result')).error,'not_authorized')
   await actor(db,teacher)
   assert.deepEqual(await result(db,'SELECT public.get_all_students_progress_data() result'),{[student]:{'A1.1':67,'A1.2':0}})
   await db.exec('RESET ROLE')
   const security=(await db.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='public.get_all_students_progress_data()'::regprocedure")).rows[0]
   assert.equal(security.prosecdef,true);assert.deepEqual(security.proconfig,['search_path=""'])
  })
  await t.test('unexpected SQL errors return safe structured JSON and migration is replayable',async()=>{
   await db.exec('RESET ROLE');await apply(db,['09_progress_aggregate.sql'])
   await db.exec('BEGIN; ALTER TABLE public.user_exercise_progress RENAME TO temporarily_unavailable;')
   await actor(db,teacher)
   const error=await result(db,'SELECT public.get_all_students_progress_data() result')
   assert.equal(error.error,'request_failed');assert.equal(error.sqlstate,'42P01')
   assert.equal(error.message,'Progress could not be loaded.')
   await db.exec('ROLLBACK; RESET ROLE;')
  })
  const snapshot=async()=>Object.fromEntries(await Promise.all(['learning_units','learning_vocabulary_cards','vocabulary_translations','vocabulary_direction_progress'].map(async table=>[table,(await db.query(`SELECT to_jsonb(t) row FROM public.${table} t ORDER BY to_jsonb(t)::text`)).rows])))
  const matrix=async()=>{
   const results=[]
   for(const scenario of ['student','outsider','teacher','no_identity','disabled','selected_empty','selected_granted','inactive','german_ui']) {
    await db.exec('RESET ROLE')
    await db.query('DELETE FROM learning_unit_grants WHERE auth_user_id=$1',[student])
    await db.query('DELETE FROM learning_trainer_grants WHERE auth_user_id=$1',[student])
    await db.query("UPDATE profiles SET ui_language=$2 WHERE id=$1",[student,scenario==='german_ui'?'de':'ru'])
    await db.query('UPDATE learning_units SET is_active=$2 WHERE id=$1',[vocabularyUnit,scenario!=='inactive'])
    if(['disabled','selected_empty','selected_granted'].includes(scenario))
     await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES($1,'A1.1','vocabulary',$2,$3)",[student,scenario!=='disabled',scenario==='disabled'?'all':'selected'])
    if(scenario==='selected_granted')await db.query("INSERT INTO learning_unit_grants VALUES($1,'A1.1','vocabulary',$2)",[student,vocabularyUnit])
    await actor(db,scenario==='teacher'?teacher:scenario==='outsider'?outsider:scenario==='no_identity'?null:student)
    results.push([scenario,await snapshot()])
    if ((await db.query("SELECT to_regprocedure('learning_private.allowed_unit_ids()') IS NOT NULL installed")).rows[0].installed) {
     const optimized=await result(db,'SELECT learning_private.allowed_unit_ids() result')
     await db.exec('RESET ROLE')
     // Keep the same JWT actor while reading the full unit catalog as test owner.
     const original=(await db.query('SELECT id FROM learning_units WHERE learning_private.unit_allowed(id) ORDER BY id')).rows.map(row=>row.id)
     assert.deepEqual([...optimized].sort(),original,scenario)
    }
   }
   await db.exec('RESET ROLE')
   return results
  }
  const before=await matrix()
  await apply(db,['10_rls_performance.sql'])
  await t.test('optimized RLS equals original policies for ownership, releases, revocations, language and staff',async()=>{
   assert.deepEqual(await matrix(),before)
  })
  await t.test('replay preserves policies and the same session sees changes on the next statement',async()=>{
   await apply(db,['10_rls_performance.sql']);assert.deepEqual(await matrix(),before)
   await db.query("UPDATE profiles SET ui_language='ru' WHERE id=$1",[student])
   await actor(db,student)
   assert.equal((await db.query('SELECT * FROM learning_vocabulary_cards')).rows.length,2)
   await db.exec('RESET ROLE')
   await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled) VALUES($1,'A1.1','vocabulary',false)",[student])
   await actor(db,student)
   assert.equal((await db.query('SELECT * FROM learning_vocabulary_cards')).rows.length,0)
   assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress')).rows.length,0)
  })
 } finally { await db.close() }
})
