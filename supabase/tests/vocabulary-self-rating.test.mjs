import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {createPhase3Database,actor,id,student,vocabularyUnit,result,apply} from './helpers/phase3-db.mjs'

// Flashcard self-rating (migration 18), the EXECUTE grant it forgot (19) and
// the learner-chosen mode (20). R5 stays intact: the learner's "Kenn ich" is an
// INPUT; PostgreSQL alone decides box, interval and next review, and still
// refuses the mode where the card must be typed - a sentence.

const repoFile=async(relative)=>readFile(fileURLToPath(new URL(`../../${relative}`,import.meta.url)),'utf8')

await test('flashcard self-rating: learner-chosen mode, authorization, idempotency and TS/SQL parity',async t=>{
 const db=await createPhase3Database()
 await apply(db,['18_vocabulary_self_rating.sql','19_vocabulary_self_rating_fix.sql','20_vocabulary_learner_mode.sql','21_vocabulary_sentence_learner_choice.sql'])

 let sequence=400
 const addCard=async({sentence=false,word='Haus',article='das'}={})=>{
  const cardId=id(sequence++)
  await db.exec('RESET ROLE')
  await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,$3,$4,$5)',
   [cardId,vocabularyUnit,word,article,sentence])
  for(const [locale,value] of [['de',word],['ru','дом'],['en','house'],['uk','будинок'],['tr','ev']])
   await db.query('INSERT INTO vocabulary_translations(card_id,locale,translation,context_sentence) VALUES($1,$2,$3,$4)',
    [cardId,locale,value,'Ich öffne die Tür.'])
  await actor(db,student)
  await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId,alreadyKnown:false}])])
  return cardId
 }
 const progressOf=async(cardId,direction='de_to_native')=>
  (await db.query('SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction=$2',[cardId,direction])).rows[0].id
 const stateOf=async(progressId)=>
  (await db.query('SELECT box_number,lapses,next_review_date FROM vocabulary_direction_progress WHERE id=$1',[progressId])).rows[0]
 /** Makes the card due again in a chosen box and clears the spacing cursor. */
 const arm=async(progressId,box)=>{
  await db.exec('RESET ROLE')
  await db.query("UPDATE vocabulary_direction_progress SET box_number=$2,next_review_date='2020-01-01' WHERE id=$1",[progressId,box])
  await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student])
  await actor(db,student)
 }
 const rate=async(requestId,progressId,known=true,lang='ru')=>
  result(db,'SELECT submit_vocabulary_self_rating_once($1,$2,$3,$4) result',[requestId,progressId,known,lang])

 await t.test('authenticated may actually execute the receipt function (regression for migration 18)',async()=>{
  // The original bug: 18 revoked vocabulary_private.submit_self_rating_once from PUBLIC
  // and never granted it back. The public wrapper is SECURITY INVOKER, so the
  // call raised 42501, the boundary mapped it to not_authorized and the trainer
  // showed "could not be saved". Assert the grant itself, not just a happy path.
  await db.exec('RESET ROLE')
  const granted=await db.query(
   "SELECT has_function_privilege('authenticated','vocabulary_private.submit_self_rating_once(uuid,uuid,boolean,text)','EXECUTE') ok")
  assert.equal(granted.rows[0].ok,true,'authenticated must be able to execute the self-rating receipt function')
  const wrapper=await db.query(
   "SELECT has_function_privilege('authenticated','public.submit_vocabulary_self_rating_once(uuid,uuid,boolean,text)','EXECUTE') ok")
  assert.equal(wrapper.rows[0].ok,true)
  // The boundary wrapper must stay SECURITY INVOKER; privileges belong to the
  // private function it delegates to, never to the public surface.
  const invoker=await db.query(
   "SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='submit_vocabulary_self_rating_once'")
  assert.equal(invoker.rows[0].prosecdef,false)
 })

 await t.test('box 1 and 2 accept a self-rating and PostgreSQL decides the schedule',async()=>{
  const progressId=await progressOf(await addCard())
  for(const box of [1,2]) {
   await arm(progressId,box)
   const response=await rate(id(700+box),progressId,true)
   assert.equal(response.success,true)
   assert.equal(response.isCorrect,true)
   assert.equal(response.previousPhase,box)
   assert.equal(response.newPhase,box+1,'a known card advances exactly one box')
   assert.equal(response.softError,null)
   assert.equal(response.isAlternative,false)
   assert.ok(response.intervalInDays>0)
   // The client never supplied box, interval or correctness - only "known".
   assert.equal((await stateOf(progressId)).box_number,box+1)
  }
 })

 await t.test('"Kenn ich nicht" moves the card back and counts a lapse',async()=>{
  const progressId=await progressOf(await addCard({word:'Tisch',article:'der'}))
  await arm(progressId,2)
  const response=await rate(id(710),progressId,false)
  assert.equal(response.isCorrect,false)
  assert.equal(response.previousPhase,2)
  assert.equal(response.newPhase,1)
  assert.equal(response.movedBack,true)
  const state=await stateOf(progressId)
  assert.equal(state.box_number,1)
  assert.equal(state.lapses,1)
 })

 await t.test('a word may be self-rated in every box - the learner picks the mode (20)',async()=>{
  // Before migration 20 the box decided the mode and boxes 3..6 were refused.
  // The UI now carries a toggle, so the database has to honour it in every box
  // - otherwise every click above phase 2 told the learner his progress was
  // lost. R5 is untouched: the box still moves by PostgreSQL's own arithmetic.
  const progressId=await progressOf(await addCard({word:'Stuhl',article:'der'}))
  for(const box of [3,4,5,6]) {
   await arm(progressId,box)
   const response=await rate(id(720+box),progressId,true)
   assert.equal(response.success,true,`box ${box} must accept a self-rating`)
   assert.equal(response.previousPhase,box)
   assert.equal((await stateOf(progressId)).box_number,box===6?7:box+1,'the server advances the box itself')
  }
 })

 await t.test('a sentence may be self-rated too, and its correct answer is the German sentence',async()=>{
  // Seit Migration 21 werden Sätze wie Vokabeln behandelt: Der Lernende darf
  // auch einen Satz per "Kenn ich" bewerten. Die zurückgegebene Musterlösung
  // ist der deutsche Kontextsatz, nicht das Einzelwort.
  const cardId=await addCard({word:'Tür',article:'die',sentence:true})
  const progressId=await progressOf(cardId,'native_to_de')
  await arm(progressId,1)
  const response=await rate(id(730),progressId,true)
  assert.equal(response.success,true,'a sentence self-rating is accepted')
  assert.equal(response.correctAnswer,'Ich öffne die Tür.','the correct answer is the German sentence')
  assert.equal((await stateOf(progressId)).box_number,2,'the server advances the box itself')
 })

 await t.test('replaying one request_id returns the same receipt and moves the box once',async()=>{
  const progressId=await progressOf(await addCard({word:'Fenster',article:'das'}))
  await arm(progressId,1)
  const first=await rate(id(740),progressId,true)
  assert.equal(first.success,true)
  const afterFirst=await stateOf(progressId)
  const replay=await rate(id(740),progressId,true)
  assert.deepEqual(replay,first,'the committed receipt is final')
  assert.deepEqual(await stateOf(progressId),afterFirst,'a replay must not advance the box twice')
 })

 await t.test('the same request_id with a different payload is a conflict, not a second grade',async()=>{
  const progressId=await progressOf(await addCard({word:'Buch',article:'das'}))
  await arm(progressId,1)
  await rate(id(750),progressId,true)
  const before=await stateOf(progressId)
  const conflict=await rate(id(750),progressId,false)
  // The boundary passes the precise domain code through its allowlist rather
  // than flattening it to invalid_input.
  assert.equal(conflict.error,'vocabulary_request_conflict')
  assert.deepEqual(await stateOf(progressId),before)
 })

 await t.test('a foreign learner cannot self-rate someone else\'s card',async()=>{
  const progressId=await progressOf(await addCard({word:'Lampe',article:'die'}))
  await arm(progressId,1)
  await actor(db,id(3))
  const denied=await rate(id(760),progressId,true)
  assert.equal(denied.error,'trainer_access_denied')
  await actor(db,student)
  assert.equal((await stateOf(progressId)).box_number,1)
 })

 await t.test('every failure is JSONB with a machine-readable code (R10)',async()=>{
  const progressId=await progressOf(await addCard({word:'Stift',article:'der'}))
  await arm(progressId,1)
  // German interface is not a learning language for a German course.
  const german=await rate(id(770),progressId,true,'de')
  assert.equal(german.error,'invalid_learning_language')
  assert.equal(typeof german.message,'string')
  // An unknown progress id is refused by the ownership EXISTS check before the
  // row lookup, so it cannot be used to probe which progress rows exist.
  const unknownProgress=await rate(id(771),id(999),true)
  assert.equal(unknownProgress.error,'trainer_access_denied')
  assert.ok(!('success' in unknownProgress))
 })

 await t.test('the self-rating rule is identical in TypeScript and SQL',async()=>{
  // lib/leitner.ts and vocabulary_private.self_rating_allowed encode the same
  // rule twice. If they drift, the client offers a mode the RPC then rejects
  // and the trainer dies with flashcard_not_allowed - exactly what this asserts.
  //
  // Migration 21 gab die Wahl vollends an den Lernenden: JEDE Karte darf in
  // jedem Fach selbst eingeschätzt werden - Wort wie Satz. Die TypeScript-Seite
  // sagt das in selfRatingAllowed(); das Literal bleibt lesbar, damit dieser
  // Test laut fehlschlägt, wenn jemand nur eine Seite wieder verengt.
  const leitner=await repoFile('lib/leitner.ts')
  assert.match(leitner,/export function selfRatingAllowed\(_format: 'word' \| 'sentence'\): boolean \{\s*return true/,
   'lib/leitner.ts:selfRatingAllowed must stay a readable literal rule')
  await db.exec('RESET ROLE')
  for(let box=1;box<=7;box+=1) {
   assert.equal((await db.query('SELECT vocabulary_private.self_rating_allowed($1,false) allowed',[box])).rows[0].allowed,true,
    `box ${box}: SQL refuses a word flashcard the UI offers`)
   assert.equal((await db.query('SELECT vocabulary_private.self_rating_allowed($1,true) allowed',[box])).rows[0].allowed,true,
    `box ${box}: SQL refuses a sentence flashcard the UI now offers`)
  }
 })

 await db.close()
})
