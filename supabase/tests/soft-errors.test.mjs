import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase1Database,actor,id,student,outsider,exerciseUnit,result,applyCurrent as apply} from './helpers/phase1-db.mjs'

await test('Phase 1 shared grading and canonical grammar answers',async t=>{
 const legacy=id(100),canonical=id(101)
 let beforeAcl,publicBefore
 const catalog=async(db)=>(await db.query(`SELECT oid::regprocedure::text name,proacl::text acl,prosecdef,proconfig FROM pg_proc
  WHERE oid IN('grammar_private.record_attempt(uuid,text,boolean)'::regprocedure,'vocabulary_private.submit_answer(uuid,boolean,text,text)'::regprocedure,
   'vocabulary_private.submit_answer_once(uuid,uuid,boolean,text,text)'::regprocedure,
   'public.record_grammar_attempt(uuid,text,boolean)'::regprocedure,'public.submit_vocabulary_answer(uuid,boolean,text,text)'::regprocedure,
   'public.submit_vocabulary_answer_once(uuid,uuid,boolean,text,text)'::regprocedure) ORDER BY 1`)).rows
 const db=await createPhase1Database({beforeSoftErrors:async(db)=>{
  publicBefore=(await db.query("SELECT pg_get_functiondef('public.record_grammar_attempt(uuid,text,boolean)'::regprocedure) body")).rows[0].body
  await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Answers','fill_in_blank',$3)",[legacy,exerciseUnit,JSON.stringify({correct_answer:'Guten Tag.',accepted_answers:['Guten Tag.','Hallo.'],alternative_answers:['Servus.','Hallo.'],target_form:['Gruß']})])
 },beforeFairGrading:async(db)=>{beforeAcl=await catalog(db)}})
 const grade=async(input,accepted)=>result(db,'SELECT learning_private.grade_answer($1,$2::text[]) result',[input,accepted])
 const exercise=async(n,correct,accepted=[correct],type='fill_in_blank')=>{
  await db.exec('RESET ROLE')
  await db.query('INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,$3,$4,$5)',[id(n),exerciseUnit,'Grammar',type,JSON.stringify({correct_answer:correct,accepted_answers:accepted,options:[correct,'den'],target_form:['Antwort']})])
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
   assert.deepEqual(await grade('  Ich\tlerne\nDeutsch. ',['Ich lerne Deutsch.']),{status:'EXACT',matched:'Ich lerne Deutsch.',reason:null,hint:null})
   assert.deepEqual(await grade('Hallo',['Hallo.','Hallo']),{status:'EXACT',matched:'Hallo',reason:null,hint:null})
   assert.deepEqual(await grade('Anders',['Völlig falsch']),{status:'INCORRECT',matched:null,reason:null,hint:null})
  })
  await t.test('umlaut and Unicode wordwise typo have explicit reasons',async()=>{
   for(const [input,target,reason] of [
    ['Ich mag Aepfel und Kaese.','Ich mag Äpfel und Käse.','umlaut'],['Strasse','Straße','umlaut'],
    ['Ich lerne Deutch.','Ich lerne Deutsch.','typo'],['Hauss','Haus','typo'],['Hsus','Haus','typo'],
    ['кошкаа','кошка','typo'],['öffen','öffnen','typo'],
    ['Ich lerne Deutch','Ich lerne Deutsch.','typo'],['ich lerne Deutch.','Ich lerne Deutsch.','typo'],
    ['Ich mag Kaese','Ich mag Käse.','umlaut'],
   ]) assert.deepEqual(await grade(input,[target]),{status:'SOFT_ERROR',matched:target,reason,hint:null},input)
   assert.equal((await grade('hallo',['Hallo','hallo!'])).hint,'capitalization')
  })
  await t.test('short grammatical words, reordered/missing words and multiple content mistakes are never forgiven',async()=>{
   for(const [input,target] of [['der','den'],['ihm','ihn'],['am','an'],['Haus','aus'],['Hund','und'],
    ['Ich Deutsch lerne.','Ich lerne Deutsch.'],['Ichlerne Deutsch.','Ich lerne Deutsch.'],['Ich Deutsch.','Ich lerne Deutsch.'],
    ['Huas','Haus'],
    ['Hsus Katxe','Haus Katze'],['2,50 €','250 €'],['50 %','50'],['50 €','50'],['50 + 2','50 2'],['Hauss €','Haus'],['Guten,Tag','Guten Tag'],['Guten-Tag','Guten Tag'],['Guten Tag','GutenTag']])
    assert.equal((await grade(input,[target])).status,'INCORRECT',`${input} / ${target}`)
  })
  await t.test('case and punctuation are exact with neutral hints; typography is identical',async()=>{
   for(const [input,target,hint] of [
    ['ich heiße anna','Ich heiße Anna.','capitalization_punctuation'],
    ['ich lerne Deutsch','Ich lerne Deutsch.','capitalization_punctuation'],
    ['ich heiße anna.','Ich heiße Anna.','capitalization'],
    ['Ich heiße Anna','Ich heiße Anna.','punctuation'],
    ['„Hallo!“','Hallo!','punctuation'],['MÜDE','müde','capitalization'],
    ["Wie geht’s?","Wie geht's?",null],['Er sagt „Hallo“.','Er sagt "Hallo".',null],
    ['A–B','A-B',null],['  A   B  ','A B',null],
   ]) assert.deepEqual(await grade(input,[target]),{status:'EXACT',matched:target,reason:null,hint},input)
   for(const [input,reason] of [['Ich heisse Anna','umlaut'],['ich heisse anna','umlaut'],['ich heise anna','typo']])
    assert.deepEqual(await grade(input,['Ich heiße Anna.']),{status:'SOFT_ERROR',matched:'Ich heiße Anna.',reason,hint:null},input)
   assert.equal((await grade('ich mag kaese',['Ich mag Käse.','Ich mag kase'])).reason,'umlaut')
  })
  await t.test('neutral hints give 100 points and fill-in distractors remain incorrect',async()=>{
   const target=await exercise(110,'Ich heiße Anna.')
   const response=await answer(target,'ich heiße anna')
   assert.equal(response.status,'EXACT');assert.equal(response.score,100);assert.equal(response.reason,null)
   assert.equal(response.hint,'capitalization_punctuation')
   const distractor=await exercise(111,'arbeitet')
   await db.exec('RESET ROLE')
   await db.query("UPDATE learning_exercises SET content=content||'{\"options\":[\"arbeitet\",\"arbeiten\"]}'::jsonb WHERE id=$1",[distractor])
   await actor(db,student)
   assert.equal((await answer(distractor,'arbeiten')).status,'INCORRECT')
   assert.equal((await answer(distractor,'arbeitet')).status,'EXACT')
   const typography=await exercise(112,"Wie geht's?")
   await db.exec('RESET ROLE')
   await db.query('UPDATE learning_exercises SET content=content||$2::jsonb WHERE id=$1',[typography,JSON.stringify({options:["Wie geht's?",'Wie geht’s?']})])
   await actor(db,student)
   assert.equal((await answer(typography,'Wie geht’s?')).status,'INCORRECT')
   await db.exec('RESET ROLE')
  })
  await t.test('numbers and numeric-bearing codes require exact or authored alternatives, never typo tolerance',async()=>{
   for(const [input,target] of [['2001','2000'],['A123','A124'],['12000 Euro','12001 Euro'],['Ich zahle 2001 Euro.','Ich zahle 2000 Euro.']])
    assert.deepEqual(await grade(input,[target]),{status:'INCORRECT',matched:null,reason:null,hint:null},input)
   assert.equal((await grade('Ich zahle 2000 Euron.',['Ich zahle 2000 Euro.'])).reason,'typo')
   assert.deepEqual(await grade('2001',['2000','2001']),{status:'EXACT',matched:'2001',reason:null,hint:null})
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
   assert.deepEqual(enums,['answer_hint','answer_status','soft_error_reason'])
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
   assert.equal((await answer(canonical,'Serrvus')).score,90)
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
