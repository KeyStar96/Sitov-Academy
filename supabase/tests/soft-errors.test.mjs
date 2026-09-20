import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase3Database,actor,id,student,outsider,exerciseUnit,result,apply} from './helpers/phase3-db.mjs'

await test('Phase 3 shared grading and canonical grammar answers',async t=>{
 const legacy=id(100),canonical=id(101)
 let beforeAcl,publicBefore
 const catalog=async(db)=>(await db.query(`SELECT oid::regprocedure::text name,proacl::text acl,prosecdef,proconfig FROM pg_proc
  WHERE oid IN('grammar_private.record_attempt(uuid,text,boolean)'::regprocedure,'vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure,
   'vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text)'::regprocedure,
   'public.record_grammar_attempt(uuid,text,boolean)'::regprocedure,'public.submit_vocabulary_answer(uuid,boolean,text,text)'::regprocedure,
   'public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text)'::regprocedure) ORDER BY 1`)).rows
 const db=await createPhase3Database({beforeSoftErrors:async(db)=>{
  beforeAcl=await catalog(db)
  publicBefore=(await db.query("SELECT pg_get_functiondef('public.record_grammar_attempt(uuid,text,boolean)'::regprocedure) body")).rows[0].body
  await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Answers','fill_in_blank',$3)",[legacy,exerciseUnit,JSON.stringify({correct_answer:'Guten Tag.',accepted_answers:['Guten Tag.','Hallo.'],alternative_answers:['Servus.','Hallo.']})])
 }})
 const grade=async(input,accepted)=>result(db,'SELECT learning_private.grade_answer($1,$2::text[]) result',[input,accepted])
 const exercise=async(n,correct,accepted=[correct],type='fill_in_blank')=>{
  await db.exec('RESET ROLE')
  await db.query('INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,$3,$4,$5)',[id(n),exerciseUnit,'Grammar',type,JSON.stringify({correct_answer:correct,accepted_answers:accepted,options:[correct,'den']})])
  await actor(db,student);return id(n)
 }
 const answer=async(exerciseId,value)=>result(db,'SELECT record_grammar_attempt($1,$2,false) result',[exerciseId,value])
 try{
  await t.test('canonicalizes every legacy answer once, removes the old key and prevents reintroduction',async()=>{
   const content=(await db.query('SELECT content FROM learning_exercises WHERE id=$1',[legacy])).rows[0].content
   assert.deepEqual(content.accepted_answers,['Guten Tag.','Hallo.','Servus.']);assert.equal('alternative_answers' in content,false)
   const snapshot=(await db.query('SELECT * FROM learning_exercises ORDER BY id')).rows
   await apply(db);assert.deepEqual((await db.query('SELECT * FROM learning_exercises ORDER BY id')).rows,snapshot)
   assert.deepEqual(await catalog(db),beforeAcl)
   assert.equal((await db.query("SELECT pg_get_functiondef('public.record_grammar_attempt(uuid,text,boolean)'::regprocedure) body")).rows[0].body,publicBefore)
   await assert.rejects(db.query("UPDATE learning_exercises SET content=content||'{\"alternative_answers\":[]}' WHERE id=$1",[legacy]),e=>e.code==='23514')
  })
  await t.test('EXACT outranks soft matches; trims and collapses whitespace; stable matched contract',async()=>{
   assert.deepEqual(await grade('  Ich\tlerne\nDeutsch. ',['Ich lerne Deutsch.']),{status:'EXACT',matched:'Ich lerne Deutsch.',reason:null})
   assert.deepEqual(await grade('Hallo',['Hallo.','Hallo']),{status:'EXACT',matched:'Hallo',reason:null})
   assert.deepEqual(await grade('Anders',['Völlig falsch']),{status:'INCORRECT',matched:null,reason:null})
  })
  await t.test('pure punctuation, capitalization, umlaut and Unicode wordwise typo have explicit reasons',async()=>{
   for(const [input,target,reason] of [
    ['Ich lerne Deutsch','Ich lerne Deutsch.','punctuation'],['„Hallo!“','Hallo!','punctuation'],
    ['ich lerne deutsch.','Ich lerne Deutsch.','capitalization'],['MÜDE','müde','capitalization'],
    ['Ich mag Aepfel und Kaese.','Ich mag Äpfel und Käse.','umlaut'],['Strasse','Straße','umlaut'],
    ['Ich lerne Deutch.','Ich lerne Deutsch.','typo'],['Hauss','Haus','typo'],['Hsus','Haus','typo'],
    ['кошкаа','кошка','typo'],['öffen','öffnen','typo'],
   ]) assert.deepEqual(await grade(input,[target]),{status:'SOFT_ERROR',matched:target,reason},input)
   assert.equal((await grade('hallo',['Hallo','hallo!'])).reason,'punctuation')
  })
  await t.test('short grammatical words, reordered/missing words and combined mistakes are never forgiven',async()=>{
   for(const [input,target] of [['der','den'],['ihm','ihn'],['am','an'],['Haus','aus'],['Hund','und'],
    ['Ich Deutsch lerne.','Ich lerne Deutsch.'],['Ichlerne Deutsch.','Ich lerne Deutsch.'],['Ich Deutsch.','Ich lerne Deutsch.'],
    ['ich lerne Deutsch','Ich lerne Deutsch.'],['Ich lerne Deutch','Ich lerne Deutsch.'],
    ['ich lerne Deutch.','Ich lerne Deutsch.'],['Ich mag Kaese','Ich mag Käse.'],['Huas','Haus'],
    ['Hsus Katxe','Haus Katze'],['Guten,Tag','Guten Tag'],['Guten-Tag','Guten Tag'],['Guten Tag','GutenTag']])
    assert.equal((await grade(input,[target])).status,'INCORRECT',`${input} / ${target}`)
  })
  await t.test('thresholded Levenshtein is Unicode aware for insertions, deletions, replacements and limits',async()=>{
   for(const [left,right,distance] of [['','',0],['','a',1],['a','',1],['','ab',2],['ä','ö',1],['Haus','Hauss',1],['Hauss','Haus',1],['Hsus','Haus',1],['Huas','Haus',2],['a'.repeat(4000),'a'.repeat(3999)+'b',1]])
    assert.equal(await result(db,'SELECT learning_private.levenshtein_at_most_one($1,$2) result',[left,right]),distance)
  })
  await t.test('invalid grader input is explicit JSONB, and helper functions are private with fixed search_path',async()=>{
   for(const [input,accepted] of [[null,['Hallo']],['',['Hallo']],['a'.repeat(4001),['Hallo']],['Hallo',null],['Hallo',[]],['Hallo',[null]],['Hallo',['']],['Hallo',Array(129).fill('Hallo')]]) {
    const error=await grade(input,accepted);assert.ok(error.error);assert.ok(error.message);assert.equal(error.sqlstate,'22023');assert.equal('status' in error,false)
   }
   const fn=(await db.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='learning_private.grade_answer(text,text[])'::regprocedure")).rows[0]
   assert.equal(fn.prosecdef,true);assert.deepEqual(fn.proconfig,['search_path=""'])
   const enums=(await db.query("SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='learning_private' AND t.typtype='e' ORDER BY typname")).rows.map(r=>r.typname)
   assert.deepEqual(enums,['answer_status','soft_error_reason'])
   await actor(db,student)
   await assert.rejects(grade('Hallo',['Hallo']),e=>e.code==='42501')
   await db.exec('RESET ROLE')
  })
  await t.test('canonical-only accepted alternative marks DB progress completed without legacy key',async()=>{
   await exercise(101,'Guten Tag.',['Guten Tag.','Servus.'])
   const response=await answer(canonical,'Servus.')
   assert.equal(response.status,'EXACT');assert.equal(response.matched,'Servus.');assert.equal(response.score,100)
   assert.equal((await db.query('SELECT completed FROM user_exercise_progress WHERE exercise_id=$1',[canonical])).rows[0].completed,true)
  })
  await t.test('soft scores cap at90, preserve attempt penalties, and cap previous100 explicitly',async()=>{
   const fresh=await exercise(102,'Ich lerne Deutsch.')
   const first=await answer(fresh,'Ich lerne Deutch.');assert.equal(first.status,'SOFT_ERROR');assert.equal(first.score,90);assert.equal(first.isCorrect,true)
   assert.equal((await db.query('SELECT score,completed FROM user_exercise_progress WHERE exercise_id=$1',[fresh])).rows[0].score,90)
   const retry=await exercise(103,'Ich lerne Deutsch.')
   assert.equal((await answer(retry,'Völlig falsch')).score,0)
   assert.equal((await answer(retry,'Ich lerne Deutsch')).score,80)
   assert.equal((await answer(canonical,'Servus')).score,90)
   assert.equal((await answer(canonical,'Völlig falsch')).score,90)
   assert.equal((await db.query('SELECT score FROM user_exercise_progress WHERE exercise_id=$1',[canonical])).rows[0].score,90)
  })
  await t.test('multiple choice cannot accept a wrong choice by case, punctuation or typo',async()=>{
   const target=await exercise(104,'Haus',['Haus'],'multiple_choice')
   for(const input of ['Hsus','haus','Haus.']) assert.equal((await answer(target,input)).status,'INCORRECT')
   assert.equal((await answer(target,'Haus')).status,'EXACT')
  })
  await t.test('RPC failures are JSONB and unauthenticated/unauthorized attempts never mutate progress',async()=>{
   const before=(await db.query('SELECT * FROM user_exercise_progress ORDER BY exercise_id')).rows
   for(const value of ['',null,'a'.repeat(1001)]) {const error=await answer(canonical,value);assert.equal(error.error,'invalid_answer');assert.ok(error.message)}
   await actor(db,outsider);assert.equal((await answer(canonical,'Servus.')).error,'trainer_access_denied')
   assert.equal((await db.query('SELECT * FROM user_exercise_progress')).rows.length,0)
   await actor(db,null);assert.equal((await answer(canonical,'Servus.')).error,'authentication_required')
   await actor(db,null,'anon');await assert.rejects(answer(canonical,'Servus.'),e=>e.code==='42501')
   await db.exec('RESET ROLE');assert.deepEqual((await db.query('SELECT * FROM user_exercise_progress ORDER BY exercise_id')).rows,before)
  })
  await t.test('a nested grading JSONB error aborts mutation and remains explicit at public boundary',async()=>{
   const definition=(await db.query("SELECT pg_get_functiondef('learning_private.grade_answer(text,text[])'::regprocedure) body")).rows[0].body
   await db.exec(`CREATE OR REPLACE FUNCTION learning_private.grade_answer(p_input text,p_accepted text[]) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{"error":"invalid_answer","message":"test grading error","sqlstate":"22023"}'::jsonb $$`)
   const before=(await db.query('SELECT * FROM user_exercise_progress WHERE exercise_id=$1',[canonical])).rows[0]
   await actor(db,student);assert.equal((await answer(canonical,'Servus.')).error,'invalid_answer')
   await db.exec('RESET ROLE');assert.deepEqual((await db.query('SELECT * FROM user_exercise_progress WHERE exercise_id=$1',[canonical])).rows[0],before)
   await db.exec(definition)
  })
 } finally {await db.close()}
})
