import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPhase1Database,actor,id,student,outsider,vocabularyUnit,exerciseUnit,result} from './helpers/phase1-db.mjs'
import {apply} from './helpers/phase3-db.mjs'

// Master 4, Phase 2.6 (Migration 32): get_last_active_level() liefert das
// Niveau mit der jüngsten eigenen Lernhandlung — nur freigeschaltete Niveaus,
// Rückfall erst angefangen, dann erstes freigeschaltetes Niveau.

await test('get_last_active_level follows the most recent learning action of the caller',async t=>{
 const db=await createPhase1Database()
 const admin=()=>db.exec('RESET ROLE')
 const a12Unit=id(8201), a12Exercises=id(8202), a12Reading=id(8203)
 const cardA11=id(8210), cardA11b=id(8211), cardA12=id(8212), exercise=id(8220), prompt=id(8230)
 let request=8300
 const last=async user=>{ await actor(db,user); return result(db,'SELECT get_last_active_level() result') }
 const initialize=async cardId=>{
  await actor(db,student)
  const response=await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId,alreadyKnown:false}])])
  assert.ok(!response?.error,JSON.stringify(response))
 }
 const progressOf=async cardId=>{
  await admin()
  return (await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND auth_user_id=$2 AND direction='de_to_native'",[cardId,student])).rows[0].id
 }
 /** Eine echte Selbsteinschätzung über die öffentliche RPC — PostgreSQL schreibt Quittung und Antwortzeit. */
 const answer=async cardId=>{
  const progress=await progressOf(cardId)
  await db.query("UPDATE vocabulary_direction_progress SET next_review_date='2020-01-01' WHERE id=$1",[progress])
  await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student])
  await actor(db,student)
  const response=await result(db,"SELECT submit_vocabulary_self_rating_once($1,$2,true,'ru') result",[id(request++),progress])
  assert.equal(response.success,true,JSON.stringify(response))
  return progress
 }
 /** Rückt alle bisherigen Handlungen einer Person um einen Tag nach hinten. */
 const age=async (interval='1 day')=>{
  await admin()
  await db.query(`UPDATE vocabulary_private.answer_receipts SET created_at=created_at-interval '${interval}' WHERE auth_user_id=$1`,[student])
  await db.query(`UPDATE vocabulary_direction_progress SET last_answered_at=last_answered_at-interval '${interval}' WHERE auth_user_id=$1 AND last_answered_at IS NOT NULL`,[student])
  await db.query(`UPDATE user_exercise_progress SET updated_at=updated_at-interval '${interval}' WHERE auth_user_id=$1`,[student])
  await db.query(`UPDATE submissions SET created_at=created_at-interval '${interval}' WHERE auth_user_id=$1`,[student])
 }
 try {
  await apply(db,['31_vocabulary_target_forms.sql'])
  await apply(db,['32_last_active_level.sql'])
  await admin()
  await db.exec(`INSERT INTO cefr_levels VALUES('A2') ON CONFLICT DO NOTHING;
   INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A2',3) ON CONFLICT DO NOTHING;`)
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','vocabulary','Lektion 1'),($2,'A1.2','exercises','Lektion 1'),($3,'A1.2','pronunciation','Lektion 1')",[a12Unit,a12Exercises,a12Reading])
  for(const [card,unit,word] of [[cardA11,vocabularyUnit,'Haus'],[cardA11b,vocabularyUnit,'Baum'],[cardA12,a12Unit,'Tisch']]) {
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,$3,'das',false)",[card,unit,word])
   await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','слово'),($1,'de',$2)",[card,word])
  }
  await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Artikel','fill_in_blank','{\"correct_answer\":\"das Haus\",\"accepted_answers\":[\"das Haus\"],\"target_form\":[\"Haus\"]}')",[exercise,exerciseUnit])
  await db.query("INSERT INTO learning_reading_texts(id,unit_id,sentence_de) VALUES($1,$2,'Heute lernen wir zusammen.')",[prompt,a12Reading])

  await t.test('only authenticated callers may execute it; it is a read-only SECURITY DEFINER function',async()=>{
   await admin()
   const fn=(await db.query("SELECT prosecdef,proconfig,provolatile FROM pg_proc WHERE oid='public.get_last_active_level()'::regprocedure")).rows[0]
   assert.deepEqual(fn,{prosecdef:true,proconfig:['search_path=""'],provolatile:'s'})
   assert.equal((await db.query("SELECT has_function_privilege('anon','public.get_last_active_level()','EXECUTE') ok")).rows[0].ok,false)
   await actor(db,null,'anon')
   await assert.rejects(db.query('SELECT get_last_active_level()'),error=>error.code==='42501')
   await actor(db,null)
   assert.deepEqual(await result(db,'SELECT get_last_active_level() result'),
    {error:'authentication_required',message:'Sign in to continue.',sqlstate:'42501'},'R10: structured error, no exception')
  })

  await t.test('without any unlocked level there is nothing to follow',async()=>{
   assert.deepEqual(await last(outsider),{level:null,mode:null,source:'none',levels:[]})
  })

  await t.test('without learning actions the first unlocked level is used',async()=>{
   await admin()
   await db.query("INSERT INTO student_level_access VALUES($1,'A1.2')",[student])
   assert.deepEqual(await last(student),{level:'A1.1',mode:null,source:'unlocked',levels:[]})
  })

  await t.test('a switched-on lesson without an answer makes a level "started", not "active"',async()=>{
   await initialize(cardA12)
   assert.deepEqual(await last(student),{level:'A1.2',mode:null,source:'started',levels:[]})
  })

  await t.test('half done in A1.1, one vocabulary answer in A1.2 → A1.2',async()=>{
   await initialize(cardA11)
   await initialize(cardA11b)
   await answer(cardA11)
   await age()
   const before=await last(student)
   assert.equal(before.level,'A1.1','A1.1 is the only level with an answer so far')
   await answer(cardA12)
   const response=await last(student)
   assert.equal(response.level,'A1.2')
   assert.equal(response.mode,'vocabulary')
   assert.equal(response.source,'activity')
   assert.deepEqual(response.levels.map(entry=>[entry.level,entry.mode,entry.unit_label]),
    [['A1.2','vocabulary','Lektion 1'],['A1.1','vocabulary','Lektion 1']])
  })

  await t.test('a newer grammar attempt or recording moves the level and names the mode',async()=>{
   await age()
   await admin()
   await db.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,attempts,completed) VALUES($1,$2,0,false)',[student,exercise])
   assert.equal((await last(student)).level,'A1.2','an untouched grammar row is not an attempt')
   await admin()
   await db.query('UPDATE user_exercise_progress SET attempts=1,updated_at=now() WHERE auth_user_id=$1 AND exercise_id=$2',[student,exercise])
   const grammar=await last(student)
   assert.deepEqual([grammar.level,grammar.mode,grammar.levels[0].topic],['A1.1','exercises','Artikel'])
   await age()
   await admin()
   await db.query("INSERT INTO submissions(auth_user_id,type,level,status,prompt_id) VALUES($1,'audio','A1.2','pending',$2)",[student,prompt])
   const speech=await last(student)
   assert.deepEqual([speech.level,speech.mode],['A1.2','pronunciation'])
   assert.deepEqual(speech.levels.map(entry=>entry.level),['A1.2','A1.1'])
  })

  await t.test('activity in a level without a valid unlock is ignored',async()=>{
   await admin()
   await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level='A1.2'",[student])
   const response=await last(student)
   assert.deepEqual([response.level,response.mode],['A1.1','exercises'])
   assert.deepEqual(response.levels.map(entry=>entry.level),['A1.1'])
   await admin()
   await db.query("INSERT INTO student_level_access VALUES($1,'A1.2')",[student])
  })

  await t.test('another learner never sees this activity',async()=>{
   await admin()
   await db.query("INSERT INTO student_level_access VALUES($1,'A1.2')",[outsider])
   assert.deepEqual(await last(outsider),{level:'A1.2',mode:null,source:'unlocked',levels:[]})
  })

  await t.test('the migration is idempotent and the rollback only removes the function',async()=>{
   await admin()
   const definition=async()=>(await db.query("SELECT pg_get_functiondef('public.get_last_active_level()'::regprocedure) body,proacl::text acl FROM pg_proc WHERE oid='public.get_last_active_level()'::regprocedure")).rows[0]
   const counts=async()=>(await db.query(`SELECT (SELECT count(*)::int FROM vocabulary_private.answer_receipts) receipts,
    (SELECT count(*)::int FROM vocabulary_direction_progress) progress,(SELECT count(*)::int FROM submissions) submissions`)).rows[0]
   const before=await definition(), data=await counts(), expected=await last(student)
   await admin()
   await apply(db,['32_last_active_level.sql'])
   assert.deepEqual(await definition(),before)
   assert.deepEqual(await last(student),expected)
   await admin()
   await db.exec('BEGIN;'+await readFile(new URL('../vps/rollback/32_last_active_level.sql',import.meta.url),'utf8')+'COMMIT;')
   assert.equal((await db.query("SELECT to_regprocedure('public.get_last_active_level()') fn")).rows[0].fn,null)
   assert.deepEqual(await counts(),data,'no learner data is touched')
   await apply(db,['32_last_active_level.sql'])
   assert.deepEqual(await definition(),before)
   assert.deepEqual(await last(student),expected)
  })
 } finally { await db.close() }
})
