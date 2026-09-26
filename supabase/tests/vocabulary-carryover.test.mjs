import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createLearningPathDatabase, actor, id, student, teacher, outsider, vocabularyUnit, result, apply } from './helpers/learning-path-db.mjs'

const target='A1.2', migration='37_vocabulary_carryover.sql'
const targetUnit=id(80), pausedUnit=id(81), ownUnit=id(82), foreignUnit=id(83), futureUnit=id(84)
const cards={course:id(100),self:id(101),never:id(102),learned:id(103),paused:id(104),own:id(105),foreign:id(106),future:id(107),target:id(108),targetNew:id(109)}
const progress=(card,direction='native_to_de')=>id(1000+Number(card.slice(-3))*2+(direction==='de_to_native'?1:0))
const as=async(db,user)=>{await db.exec('RESET ROLE');await actor(db,user)}
const admin=db=>db.exec('RESET ROLE')
const read=db=>result(db,'SELECT public.get_vocabulary_carryover($1) result',[target])
const toggle=(db,enabled,level=target)=>result(db,'SELECT public.set_vocabulary_carryover($1,$2) result',[level,enabled])
const catalog=(db,level=target)=>result(db,'SELECT public.get_vocabulary_carryover_cards($1) result',[level])
const submit=(db,request=id(500),card=cards.course,level=target)=>result(db,'SELECT public.submit_vocabulary_answer_once($1,$2,false,$3,$4,$5) result',[request,progress(card),'das Haus','ru',level])
const self=(db,request=id(501),card=cards.self,level=target)=>result(db,'SELECT public.submit_vocabulary_self_rating_once($1,$2,true,$3,$4) result',[request,progress(card),'ru',level])
const retry=(db,card=cards.course,level=target)=>result(db,'SELECT public.check_vocabulary_retry($1,$2,$3,$4) result',[progress(card),'das Haus','ru',level])

async function fixture() {
 const db=await createLearningPathDatabase()
 try {
  await apply(db,['36_migrate_old_grammar_progress.sql',migration])
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A1',3),('A2.2','A1',4)")
  for(const [unit,level,label,owner] of [[targetUnit,target,'Lektion 1',null],[pausedUnit,'A1.1','Paused',null],[ownUnit,'A1.1','Eigene Wörter',student],[foreignUnit,'A1.1','Eigene Wörter',outsider],[futureUnit,'A2.1','Lektion 1',null]]) {
   await db.query("INSERT INTO learning_units(id,level,trainer,label,owner_auth_user_id) VALUES($1,$2,'vocabulary',$3,$4)",[unit,level,label,owner])
  }
  await db.query("INSERT INTO student_level_access VALUES($1,'A1.2'),($1,'A2.1'),($1,'A2.2')",[student])
  for(const [name,card] of Object.entries(cards)) {
   const unit={paused:pausedUnit,own:ownUnit,foreign:foreignUnit,future:futureUnit,target:targetUnit,targetNew:targetUnit}[name]??vocabularyUnit
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[card,unit])
   await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом')",[card])
   if(['never','targetNew'].includes(name))continue
   const boxes={course:[3,5],learned:[7,7],target:[7,7]}[name]??[2,4]
   for(const [index,direction] of ['native_to_de','de_to_native'].entries()) {
    await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,next_review_date) VALUES($1,$2,$3,$4,$5,'2020-01-01')",[progress(card,direction),student,card,direction,boxes[index]])
   }
  }
  await db.query('INSERT INTO vocabulary_lesson_pauses(auth_user_id,unit_id) VALUES($1,$2)',[student,pausedUnit])
  await as(db,student)
  return db
 } catch(error) { await db.close();throw error }
}
const scenario=(name,fn)=>test(`carryover: ${name}`,async()=>{const db=await fixture();try{await fn(db)}finally{await db.close()}})

scenario('only begun, open, unpaused own/course cards from all earlier sort orders qualify',async db=>{
 const state=await read(db)
 assert.equal(state.enabled,false);assert.equal(state.decidedAt,null);assert.equal(state.promptRequired,false)
 assert.deepEqual(state.cards.map(c=>c.cardId).sort(),[cards.course,cards.self,cards.own].sort())
 const later=await result(db,'SELECT get_vocabulary_carryover($1) result',['A2.2'])
 assert.deepEqual(later.cards.map(c=>c.cardId).sort(),[cards.course,cards.self,cards.own,cards.future].sort())
 assert.deepEqual([...new Set(later.cards.map(c=>c.originLevel))],['A1.1','A2.1'])
 // A partial record is begun, but it is never fabricated into a second row.
 await admin(db);await db.query("DELETE FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='de_to_native'",[cards.course]);await as(db,student)
 assert.ok((await read(db)).cards.some(c=>c.cardId===cards.course))
 assert.equal((await catalog(db)).progress.filter(p=>p.card_id===cards.course).length,1)
})

scenario('toggle keeps original IDs, both direction boxes and dates; metadata is separate',async db=>{
 const before=await catalog(db);await toggle(db,true);const after=await catalog(db)
 assert.deepEqual(after,before)
 const entries=after.progress.filter(p=>p.card_id===cards.course)
 assert.deepEqual(entries.map(p=>p.box_number).sort(),[3,5])
 assert.equal(Math.min(...entries.map(p=>p.box_number)),3)
 assert.ok(entries.every(p=>p.next_review_date.startsWith('2020-01-01')))
 assert.equal(after.cards.find(c=>c.id===cards.own).unit.owner_auth_user_id,student)
 assert.equal(after.cards.find(c=>c.id===cards.course).translations[0].translation,'дом')
})

scenario('first learning or assessment asks once and remembers a declined decision',async db=>{
 const begin=()=>result(db,'SELECT begin_vocabulary_level($1) result',[target])
 const first=await begin();assert.equal(first.promptRequired,true);assert.ok(first.startedAt)
 assert.equal((await begin()).startedAt,first.startedAt)
 const decline=await toggle(db,false);assert.ok(decline.decidedAt);assert.equal(decline.promptRequired,false)
 assert.equal((await begin()).promptRequired,false)
 assert.equal((await toggle(db,true)).enabled,true)
 assert.equal((await begin()).promptRequired,false)
})

scenario('first begin without candidates never asks on a later round',async db=>{
 await admin(db);await db.query('DELETE FROM vocabulary_direction_progress WHERE auth_user_id=$1',[student]);await as(db,student)
 const first=await result(db,'SELECT begin_vocabulary_level($1) result',[target]);assert.ok(first.decidedAt);assert.equal(first.promptRequired,false)
 await admin(db);await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction) VALUES($1,$2,'native_to_de')",[student,cards.course]);await as(db,student)
 assert.equal((await result(db,'SELECT begin_vocabulary_level($1) result',[target])).promptRequired,false)
})

scenario('typed answer in target updates the original source progress and exact receipt once',async db=>{
 await toggle(db,true)
 const first=await submit(db);assert.equal(first.success,true);assert.equal(first.previousPhase,3);assert.equal(first.newPhase,4);assert.equal(first.intervalInDays,9)
 assert.deepEqual(await submit(db),first)
 await admin(db)
 const rows=(await db.query('SELECT * FROM vocabulary_direction_progress WHERE card_id=$1 ORDER BY direction',[cards.course])).rows
 assert.equal(rows.length,2);assert.equal(rows.find(r=>r.direction==='native_to_de').id,progress(cards.course));assert.equal(rows.find(r=>r.direction==='native_to_de').box_number,4)
 assert.equal(rows.find(r=>r.direction==='de_to_native').box_number,5)
 assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts')).rows[0].n,1)
 await as(db,student);assert.equal((await retry(db)).isCorrect,true)
 // The same request is bound to its target even when source access remains.
 assert.equal((await submit(db,id(500),cards.course,'A1.1')).error,'vocabulary_request_conflict')
})

scenario('self rating preserves source identity and cache guard',async db=>{
 await toggle(db,true);const first=await self(db);assert.equal(first.success,true);assert.equal(first.newPhase,3);assert.deepEqual(await self(db),first)
 await toggle(db,false);assert.equal((await self(db)).error,'trainer_access_denied')
 await toggle(db,true);assert.deepEqual(await self(db),first)
})

scenario('disabled target rejects typed grading, non-once grading, retry and cached receipts despite unlocked source',async db=>{
 await toggle(db,true);assert.equal((await submit(db)).success,true);await toggle(db,false)
 assert.equal((await read(db)).enabled,false)
 assert.equal((await submit(db)).error,'trainer_access_denied')
 assert.equal((await retry(db)).error,'trainer_access_denied')
 const raw=await result(db,'SELECT submit_vocabulary_answer($1,false,$2,$3,$4) result',[progress(cards.self),'das Haus','ru',target])
 assert.equal(raw.error,'trainer_access_denied')
 // Old origin-level API remains supported, not an implicit target authorization.
 const own=await result(db,'SELECT submit_vocabulary_answer_once($1,$2,false,$3,$4) result',[id(600),progress(cards.self),'das Haus','ru'])
 assert.equal(own.success,true)
})

scenario('unlocked target can carry locked-source words without exposing other source content',async db=>{
 await toggle(db,true);await admin(db);await db.query("DELETE FROM student_level_access WHERE auth_user_id=$1 AND level='A1.1'",[student]);await as(db,student)
 assert.equal((await db.query('SELECT * FROM learning_vocabulary_cards WHERE id=$1',[cards.course])).rows.length,0)
 assert.equal((await db.query('SELECT * FROM vocabulary_direction_progress WHERE id=$1',[progress(cards.course)])).rows.length,0)
 const carried=await catalog(db);assert.equal(carried.cards.length,3);assert.equal(carried.progress.length,6)
 assert.ok(!carried.cards.some(c=>[cards.never,cards.foreign,cards.paused].includes(c.id)))
 assert.equal((await submit(db)).success,true)
})

scenario('pauses and revoked target access immediately block cached results and candidate reads',async db=>{
 await toggle(db,true);assert.equal((await submit(db)).success,true)
 await result(db,'SELECT set_vocabulary_lesson_paused($1,true) result',[vocabularyUnit])
 assert.ok(!(await read(db)).cards.some(c=>c.cardId===cards.course));assert.equal((await submit(db)).error,'trainer_access_denied');assert.equal((await retry(db)).error,'trainer_access_denied')
 await admin(db);await db.query('DELETE FROM student_level_access WHERE auth_user_id=$1 AND level=$2',[student,target]);await as(db,student)
 assert.equal((await catalog(db)).error,'trainer_access_denied');assert.equal((await toggle(db,true)).error,'trainer_access_denied')
})

scenario('never-started, foreign private, foreign progress and later levels cannot be answered',async db=>{
 await toggle(db,true)
 for(const card of [cards.never,cards.foreign,cards.future])assert.equal((await submit(db,id(700),card)).error,'trainer_access_denied')
 await as(db,outsider);assert.equal((await submit(db)).error,'trainer_access_denied');assert.equal((await read(db)).error,'trainer_access_denied')
 await admin(db);await db.query("INSERT INTO student_level_access VALUES($1,'A1.2')",[outsider]);await as(db,outsider)
 assert.deepEqual((await read(db)).cards,[]);assert.equal((await toggle(db,true)).enabled,true);assert.equal((await submit(db)).error,'trainer_access_denied')
})

scenario('fully learned words leave candidates; completing last direction still permits exact receipt replay',async db=>{
 await admin(db);await db.query("UPDATE vocabulary_direction_progress SET box_number=CASE WHEN direction='native_to_de' THEN 6 ELSE 7 END WHERE card_id=$1",[cards.course]);await as(db,student)
 await toggle(db,true);const first=await submit(db);assert.equal(first.becameLearned,true)
 assert.ok(!(await read(db)).cards.some(c=>c.cardId===cards.course));assert.deepEqual(await submit(db),first)
})

scenario('target percentage counts only target-owned words, independent of carry switch or origin progress',async db=>{
 await as(db,teacher);const before=await result(db,'SELECT get_all_students_progress_data() result');assert.equal(before[student][target],50)
 await as(db,student);await toggle(db,true);await submit(db)
 await as(db,teacher);const after=await result(db,'SELECT get_all_students_progress_data() result');assert.equal(after[student][target],before[student][target])
})

scenario('teacher target reset removes choice and its own progress but keeps both source directions',async db=>{
 await toggle(db,true);const before=(await catalog(db)).progress
 await as(db,teacher);assert.equal(await result(db,'SELECT reset_student_level_progress($1,$2) result',[student,target]),null)
 await as(db,student);const state=await read(db);assert.equal(state.enabled,false);assert.equal(state.decidedAt,null);assert.equal(state.startedAt,null);assert.deepEqual((await catalog(db)).progress,before)
 await admin(db);assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress WHERE card_id=$1',[cards.target])).rows[0].n,0)
})

scenario('teacher source reset deletes both directions and removes its cards from every target',async db=>{
 await toggle(db,true);await toggle(db,true,'A2.1');await as(db,teacher)
 assert.equal(await result(db,'SELECT reset_student_level_progress($1,$2) result',[student,'A1.1']),null)
 await as(db,student);assert.equal((await read(db)).enabled,true);assert.deepEqual((await read(db)).cards,[])
 const later=await result(db,'SELECT get_vocabulary_carryover($1) result',['A2.1']);assert.deepEqual(later.cards,[])
 await admin(db);assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress WHERE card_id=$1',[cards.course])).rows[0].n,0)
})

scenario('full learning reset removes all preferences and all directional state',async db=>{
 await toggle(db,true);await toggle(db,true,'A2.1')
 const token=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result");assert.equal(typeof token,'string')
 assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[token]),true)
 assert.deepEqual((await read(db)).cards,[]);assert.equal((await read(db)).decidedAt,null)
 await admin(db);assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_carryover_preferences WHERE auth_user_id=$1',[student])).rows[0].n,0)
})

scenario('RLS isolates choices; direct writes, anonymous RPCs and private helpers are denied',async db=>{
 await toggle(db,true);await as(db,outsider);assert.deepEqual((await db.query('SELECT * FROM vocabulary_carryover_preferences')).rows,[])
 await assert.rejects(db.query('INSERT INTO vocabulary_carryover_preferences(auth_user_id,target_level) VALUES($1,$2)',[outsider,target]),e=>e.code==='42501')
 await assert.rejects(db.query('UPDATE vocabulary_carryover_preferences SET enabled=true'),e=>e.code==='42501')
 await assert.rejects(db.query('DELETE FROM vocabulary_carryover_preferences'),e=>e.code==='42501')
 await assert.rejects(db.query('SELECT vocabulary_private.carryover_candidates($1)',[target]),e=>e.code==='42501')
 await admin(db);await db.exec('SET ROLE anon');await assert.rejects(read(db),e=>e.code==='42501')
 await admin(db);await db.query("SELECT set_config('request.jwt.claim.sub','',false)");await db.exec('SET ROLE authenticated');assert.equal((await read(db)).error,'authentication_required')
})

scenario('invalid RPC input is structured and paged reads contain only the selected card progress',async db=>{
 assert.equal((await toggle(db,null)).error,'invalid_input')
 assert.equal((await result(db,'SELECT get_vocabulary_carryover(NULL) result')).error,'invalid_input')
 assert.equal((await result(db,'SELECT get_vocabulary_carryover_cards($1,-1,500) result',[target])).error,'invalid_input')
 const page=await result(db,'SELECT get_vocabulary_carryover_cards($1,1,1) result',[target]);assert.equal(page.cards.length,1);assert.equal(page.progress.length,2);assert.ok(page.progress.every(p=>p.card_id===page.cards[0].id))
})

scenario('double migration is stable; rollback preserves data, restores latest resets and safely reapplies',async db=>{
 await toggle(db,true);const before=await catalog(db);await admin(db)
 const definition=async()=> (await db.query("SELECT pg_get_functiondef('learning_private.reset_student_level(uuid,text)'::regprocedure) body")).rows[0].body
 const initial=await definition();await apply(db,[migration,migration]);assert.equal(await definition(),initial)
 await as(db,student);assert.deepEqual(await catalog(db),before);assert.equal((await read(db)).enabled,true)
 await admin(db);await db.exec(await readFile(new URL('../vps/rollback/37_vocabulary_carryover.sql',import.meta.url),'utf8'))
 assert.match(await definition(),/path_private.reset_progress/);assert.doesNotMatch(await definition(),/vocabulary_carryover_preferences/)
 const archived=(await db.query('SELECT * FROM vocabulary_carryover_preferences')).rows;assert.equal(archived.length,1);assert.equal(archived[0].is_active,false);assert.equal(archived[0].enabled,true,'rollback preserves the archived choice')
 assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_direction_progress')).rows[0].n,16)
 await as(db,student);await assert.rejects(read(db),e=>e.code==='42501')
 await admin(db);await apply(db,[migration]);assert.equal(await definition(),initial)
 await as(db,student);assert.equal((await read(db)).enabled,false);assert.deepEqual(await catalog(db),before)
})

test('carryover: initial rollout respects prior review/assessment but not merely initialized words',async()=>{
 const db=await createLearningPathDatabase()
 try {
  await apply(db,['36_migrate_old_grammar_progress.sql'])
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2),('A2.1','A1',3)")
  await db.query("INSERT INTO student_level_access VALUES($1,'A1.2'),($1,'A2.1'),($2,'A1.1'),($2,'A1.2')",[student,outsider])
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','vocabulary','Lektion 1'),($2,'A2.1','vocabulary','Lektion 1')",[targetUnit,futureUnit])
  for(const [card,unit] of [[cards.course,vocabularyUnit],[cards.target,targetUnit],[cards.future,futureUnit]])await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,sentence_practice) VALUES($1,$2,'Haus',false)",[card,unit])
  // The earlier level has started words available for all three first-begin cases.
  for(const user of [student,outsider])await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number) VALUES($1,$2,'native_to_de',2)",[user,cards.course])
  await db.query("INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,last_answered_at,created_at) VALUES($1,$2,'native_to_de',1,'2020-01-03','2020-01-01'),($3,$2,'native_to_de',1,NULL,'2020-01-01')",[student,cards.target,outsider])
  await db.query("INSERT INTO vocabulary_onboarding(auth_user_id,level,status,started_unit_id,updated_at) VALUES($1,'A2.1','completed',$2,'2020-01-02')",[student,futureUnit])
  await apply(db,[migration,migration])
  await as(db,student)
  const historical=await result(db,'SELECT begin_vocabulary_level($1) result',[target]);assert.equal(historical.promptRequired,false);assert.ok(historical.decidedAt.startsWith('2020-01-03'));assert.equal(historical.enabled,false)
  const assessed=await result(db,"SELECT begin_vocabulary_level('A2.1') result");assert.equal(assessed.promptRequired,false);assert.ok(assessed.decidedAt.startsWith('2020-01-02'))
  await as(db,outsider);const untouched=await result(db,'SELECT begin_vocabulary_level($1) result',[target]);assert.equal(untouched.promptRequired,true);assert.equal(untouched.decidedAt,null)
  await admin(db);await apply(db,[migration]);await as(db,outsider);assert.equal((await read(db)).promptRequired,true,'rerunning migration never replaces an unanswered first-start prompt')
 } finally {await db.close()}
})

scenario('an active full reset prevents new preferences until audio cleanup finishes',async db=>{
 await toggle(db,true)
 const token=await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
 assert.equal((await toggle(db,false)).error,'learning_reset_in_progress')
 assert.equal((await result(db,'SELECT begin_vocabulary_level($1) result',[target])).error,'learning_reset_in_progress')
 assert.equal((await read(db)).enabled,true,'failed mutations leave the prior decision intact')
 assert.equal(await result(db,'SELECT finish_learning_reset($1) result',[token]),true)
 assert.equal((await result(db,'SELECT begin_vocabulary_level($1) result',[target])).success,true)
})

scenario('rollback safely archives original choice while a full reset awaits audio cleanup',async db=>{
 await toggle(db,true);await result(db,"SELECT begin_learning_reset('RESET_LEARNING_DATA') result")
 await admin(db);await db.exec(await readFile(new URL('../vps/rollback/37_vocabulary_carryover.sql',import.meta.url),'utf8'))
 const archived=(await db.query('SELECT enabled,is_active FROM vocabulary_carryover_preferences WHERE auth_user_id=$1 AND target_level=$2',[student,target])).rows[0]
 assert.deepEqual(archived,{enabled:true,is_active:false})
 await apply(db,[migration]);await as(db,student)
 assert.equal((await read(db)).enabled,false);assert.equal((await toggle(db,true)).error,'learning_reset_in_progress')
})
