import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createPhase3Database,actor,id,student,teacher,outsider,vocabularyUnit,result,apply} from './helpers/phase3-db.mjs'

// Historical migration/copy and legacy API invariants remain in vocabulary-history.test.mjs.
// This suite executes the current Phase 2 + Phase 3 SQL, not obsolete grading bodies.
await test('Phase 3 vocabulary server grading, Leitner intervals and transactional receipts',async t=>{
 let legacySentence,legacyWord,legacyResponse,legacyProgress,legacyReceiptTime
 const db=await createPhase3Database({beforeSoftErrors:async(db)=>{
  for(const [cardId,sentence] of [[id(180),true],[id(181),false]]) {
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',$3)",[cardId,vocabularyUnit,sentence])
   await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation,context_sentence) VALUES($1,'de','Haus','Ich öffne die Tür.'),($1,'ru','дом','Я открываю дверь.')",[cardId])
  }
  await actor(db,student)
  await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId:id(180),alreadyKnown:false},{cardId:id(181),alreadyKnown:false}])])
  legacySentence=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='native_to_de'",[id(180)])).rows[0].id
  legacyWord=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='de_to_native'",[id(181)])).rows[0].id
  legacyResponse=await result(db,"SELECT submit_vocabulary_answer_once($1,$2,false,'Ich öffne die Tür.','ru') result",[id(900),legacySentence])
  assert.equal(legacyResponse.success,true);assert.equal('softError' in legacyResponse,false)
  assert.equal((await result(db,"SELECT submit_vocabulary_answer_once($1,$2,true,NULL,'ru') result",[id(901),legacyWord])).success,true)
  legacyProgress=(await db.query('SELECT * FROM vocabulary_direction_progress ORDER BY id')).rows
  await db.exec('RESET ROLE')
  await db.query("UPDATE vocabulary_private.answer_receipts SET response=response-'isAlternative' WHERE request_id=$1",[id(900)])
  legacyReceiptTime=(await db.query('SELECT created_at FROM vocabulary_private.answer_receipts WHERE request_id=$1',[id(900)])).rows[0].created_at
 }});let sequence=200
 const states=async(cardId)=>(await db.query('SELECT * FROM vocabulary_direction_progress WHERE card_id=$1 ORDER BY direction',[cardId])).rows
 const review=async(progressId,text,claimed=true,lang='ru')=>result(db,'SELECT submit_vocabulary_answer($1,$2,$3,$4) result',[progressId,claimed,text,lang])
 const once=async(requestId,progressId,text,claimed=true,lang='ru')=>result(db,'SELECT submit_vocabulary_answer_once($1,$2,$3,$4,$5) result',[requestId,progressId,claimed,text,lang])
 const resetDue=async(progressId,box=1,lapses=0)=>{
  await db.exec('RESET ROLE')
  await db.query("UPDATE vocabulary_direction_progress SET box_number=$2,lapses=$3,next_review_date='2020-01-01' WHERE id=$1",[progressId,box,lapses])
  await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student]);await actor(db,student)
 }
 const add=async({sentence=false,word='Haus',article='das',known=false,user=student,alternatives=[],translation='дом'}={})=>{
  const cardId=id(sequence++);await db.exec('RESET ROLE')
  await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice,alternative_answers_de) VALUES($1,$2,$3,$4,$5,$6)',[cardId,vocabularyUnit,word,article,sentence,alternatives])
  for(const [locale,value,context] of [['de',word,'Ich öffne die Tür.'],['ru',translation,'Я открываю дверь.'],['en','house','I open the door.'],['uk','будинок','Я відчиняю двері.'],['tr','ev','Kapıyı açıyorum.']])
   await db.query('INSERT INTO vocabulary_translations(card_id,locale,translation,context_sentence) VALUES($1,$2,$3,$4)',[cardId,locale,value,context])
  await actor(db,user)
  assert.deepEqual(await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId,alreadyKnown:known}])]),{addedKnown:known?1:0,addedNew:known?0:1})
  const pair=await states(cardId);return {cardId,forward:pair[0].id,reverse:pair[1].id}
 }
 const receipts=async()=>{await db.exec('RESET ROLE');const rows=(await db.query('SELECT * FROM vocabulary_private.answer_receipts ORDER BY request_id')).rows;await actor(db,student);return rows}
 try{
  await t.test('pre-migration sentence receipts replay with the new result shape; old bool-only ratings fail closed',async()=>{
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_direction_progress ORDER BY id')).rows,legacyProgress)
   const receipt=(await db.query('SELECT response,created_at FROM vocabulary_private.answer_receipts WHERE request_id=$1',[id(900)])).rows[0]
   assert.equal(receipt.created_at.getTime(),legacyReceiptTime.getTime());assert.equal(receipt.response.softError,null);assert.equal(receipt.response.isAlternative,false)
   await actor(db,student)
   assert.deepEqual(await once(id(900),legacySentence,'Ich öffne die Tür.',false),{...legacyResponse,softError:null})
   assert.equal((await once(id(901),legacyWord,null,true)).error,'answer_required')
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_direction_progress ORDER BY id')).rows,legacyProgress)
  })
  await t.test('unknown and known initialize independently, retry preserves prior grades, and SQL replay preserves state',async()=>{
   const unknown=await add(),known=await add({known:true})
   assert.deepEqual((await states(unknown.cardId)).map(p=>p.box_number),[1,1]);assert.deepEqual((await states(known.cardId)).map(p=>p.box_number),[6,6])
   assert.deepEqual(await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId:known.cardId,alreadyKnown:false}])]),{addedKnown:0,addedNew:0})
   const before=await states(known.cardId);await db.exec('RESET ROLE');await apply(db);await actor(db,student);assert.deepEqual(await states(known.cardId),before)
  })
  await t.test('all word cards ignore forged correctness in both directions and return canonical answers',async()=>{
   const a=await add()
   const wrong=await review(a.forward,'неверно',true);assert.equal(wrong.isCorrect,false);assert.equal(wrong.correctAnswer,'дом');assert.equal(wrong.softError,null);assert.equal(wrong.isAlternative,false)
   await resetDue(a.forward)
   const exact=await review(a.forward,'дом',false);assert.equal(exact.isCorrect,true);assert.equal(exact.newPhase,2)
   await resetDue(a.reverse)
   assert.equal((await review(a.reverse,'den Haus',true)).isCorrect,false)
   await resetDue(a.reverse)
   const german=await review(a.reverse,'das Haus',false);assert.equal(german.isCorrect,true);assert.equal(german.correctAnswer,'das Haus')
   for(const article of ['none',null]) {
    const plain=await add({word:'lernen',article});const value=await review(plain.reverse,'lernen',false)
    assert.equal(value.correctAnswer,'lernen');assert.equal(value.isCorrect,true)
   }
  })
  await t.test('native direction uses the selected interface locale and never accepts another locale answer',async()=>{
   for(const [locale,translation] of [['en','house'],['ru','дом'],['uk','будинок'],['tr','ev']]) {
    const a=await add();assert.equal((await review(a.forward,translation,false,locale)).isCorrect,true)
    await resetDue(a.forward);assert.equal((await review(a.forward,'das Haus',true,locale)).isCorrect,false)
   }
  })
  await t.test('sentence typo, punctuation, capitalization and umlaut are soft; trim-only remains exact',async()=>{
   const a=await add({sentence:true})
   for(const [text,reason] of [['Ich öffne die Tür','punctuation'],['ich öffne die tür.','capitalization'],['Ich oeffne die Tuer.','umlaut'],['Ich öffn die Tür.','typo'],[' Ich\töffne die Tür. ',null]]) {
    const input=text
    await resetDue(a.reverse,3,2)
    const response=await review(a.reverse,input,false)
    assert.equal(response.isCorrect,true,input);assert.equal(response.softError,reason,input);assert.equal(response.newPhase,4)
    assert.equal(response.correctAnswer,'Ich öffne die Tür.');assert.equal(response.isAlternative,false)
    assert.equal((await states(a.cardId))[1].lapses,2)
    assert.equal(response.intervalInDays,reason?3:9)
   }
   await resetDue(a.reverse,3,2);const wrong=await review(a.reverse,'Ich schließe die Tür.',true)
   assert.equal(wrong.isCorrect,false);assert.equal(wrong.softError,null);assert.equal(wrong.newPhase,2);assert.equal(wrong.movedBack,true)
   assert.equal((await states(a.cardId))[1].lapses,3)
  })
  await t.test('accepted alternatives receive the canonical answer disclosure and accurate alternative flags',async()=>{
   const a=await add({sentence:true,alternatives:['Ich mache die Tür auf.']})
   for(const [text,reason] of [['Ich mache die Tür auf.',null],['Ich mache die Tür auf','punctuation']]) {
    await resetDue(a.reverse)
    const response=await review(a.reverse,text,false);assert.equal(response.isCorrect,true);assert.equal(response.isAlternative,true)
    assert.equal(response.softError,reason);assert.equal(response.correctAnswer,'Ich öffne die Tür.')
   }
  })
  await t.test('soft reviews advance all six phases, preserve lapses and cap intervals including difficult words',async()=>{
   for(const difficult of [false,true]) for(let box=1;box<=6;box++) {
    const a=await add({sentence:true});await db.exec('RESET ROLE')
    await db.query("UPDATE vocabulary_translations SET is_difficult=$2 WHERE card_id=$1 AND locale='ru'",[a.cardId,difficult])
    await resetDue(a.reverse,box,3)
    const response=await review(a.reverse,'Ich öffne die Tür',false)
    const base=[1,1,3,9,29,90][box-1],expected=difficult?Math.max(1,Math.floor(base/2)):base
    assert.equal(response.newPhase,Math.min(6,box+1));assert.equal(response.becameLearned,box===6);assert.equal(response.intervalInDays,expected)
    const state=(await states(a.cardId))[1];assert.equal(state.box_number,Math.min(7,box+1));assert.equal(state.lapses,3)
    assert.ok(Math.abs((state.next_review_date.getTime()-state.last_answered_at.getTime())/86400000-expected)<0.001)
    assert.equal((await review(a.reverse,'Ich öffne die Tür.',false)).error,'review_not_due')
   }
  })
  await t.test('missing text, missing content, invalid locale and inaccessible rows produce explicit nonmutating errors',async()=>{
   const a=await add();const before=await states(a.cardId)
   for(const text of [null,'',' \t ']) {const response=await review(a.forward,text,true);assert.equal(response.error,'answer_required');assert.ok(response.message)}
   assert.equal((await review(a.forward,'дом',true,'fr')).error,'invalid_language')
   assert.equal((await review(a.forward,'дом',true,'de')).error,'trainer_access_denied')
   assert.equal((await review(a.forward,'x'.repeat(4001))).error,'answer_too_long')
   await db.exec('RESET ROLE');await db.query("DELETE FROM vocabulary_translations WHERE card_id=$1 AND locale='ru'",[a.cardId]);await actor(db,student)
   assert.equal((await review(a.forward,'дом')).error,'exercise_unavailable');assert.deepEqual(await states(a.cardId),before)
   const sentence=await add({sentence:true});await db.exec('RESET ROLE');await db.query("UPDATE vocabulary_translations SET context_sentence=NULL WHERE card_id=$1 AND locale='de'",[sentence.cardId]);await actor(db,student)
   assert.equal((await review(sentence.reverse,'Ich öffne die Tür.')).error,'sentence_content_missing')
   await actor(db,outsider);assert.equal((await review(a.forward,'дом')).error,'progress_not_found');assert.deepEqual(await states(a.cardId),[])
   await actor(db,null);assert.equal((await review(a.forward,'дом')).error,'authentication_required')
   await actor(db,null,'anon');await assert.rejects(review(a.forward,'дом'),e=>e.code==='42501')
   await actor(db,student);assert.deepEqual(await states(a.cardId),before)
  })
  await t.test('RLS rejects direct progress/cursor/onboarding changes and private helper/receipt access',async()=>{
   const a=await add()
   for(const sql of ["UPDATE vocabulary_direction_progress SET box_number=7",'DELETE FROM vocabulary_learning_state',"UPDATE vocabulary_onboarding SET status='completed'",'SELECT * FROM vocabulary_private.answer_receipts',"SELECT learning_private.grade_answer('Haus',ARRAY['Haus'])"])
    await assert.rejects(db.exec(sql),e=>e.code==='42501')
   await actor(db,outsider)
   const denied=await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId:a.cardId,alreadyKnown:false}])]);assert.equal(denied.error,'level_access_denied')
   await actor(db,student)
  })
  await t.test('server spacing prevents immediate opposite-direction review and stale retries',async()=>{
   const a=await add();await review(a.forward,'дом')
   const before=(await states(a.cardId))[1]
   assert.equal((await review(a.reverse,'das Haus')).error,'vocabulary_spacing_required');assert.deepEqual((await states(a.cardId))[1],before)
   const spacer=await add();await review(spacer.forward,'дом');assert.equal((await review(a.reverse,'das Haus')).isCorrect,true)
   assert.equal((await review(a.reverse,'das Haus')).error,'review_not_due')
  })
  await t.test('receipt replay preserves soft outcome, score, cursor and exact request payload binding',async()=>{
   const a=await add({sentence:true});const key=id(1000)
   const first=await once(key,a.reverse,'Ich öffne die Tür',false);assert.equal(first.softError,'punctuation')
   const state=await states(a.cardId)
   assert.deepEqual(await once(key,a.reverse,'Ich öffne die Tür',false),first)
   const spacer=await add();await review(spacer.forward,'дом')
   const cursor=(await db.query('SELECT * FROM vocabulary_learning_state')).rows
   assert.deepEqual(await once(key,a.reverse,'Ich öffne die Tür',false),first);assert.deepEqual(await states(a.cardId),state)
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_learning_state')).rows,cursor)
   for(const payload of [[a.forward,'Ich öffne die Tür',false,'ru'],[a.reverse,'Ich öffne die Tür',true,'ru'],[a.reverse,'Ich öffne die Tür.',false,'ru'],[a.reverse,'Ich öffne die Tür',false,'en']])
    assert.equal((await once(key,...payload)).error,'vocabulary_request_conflict')
   assert.equal((await once(null,a.reverse,'x')).error,'invalid_answer_request')
   assert.equal((await once(id(1001),a.reverse,'Ich öffne die Tür')).error,'review_not_due')
  })
  await t.test('same receipt key is scoped per user and cannot disclose another learner outcome',async()=>{
   const a=await add();await once(id(1010),a.forward,'дом')
   await actor(db,teacher);assert.equal((await once(id(1010),a.forward,'дом')).error,'trainer_access_denied')
   const own=await add({user:teacher});assert.equal((await once(id(1010),own.forward,'дом')).isCorrect,true)
   await actor(db,student);assert.equal((await once(id(1010),a.forward,'дом')).isCorrect,true)
  })
  await t.test('grade/receipt/cursor roll back together on transaction, insert and nested grading failures',async()=>{
   const a=await add();const before=await states(a.cardId),count=(await receipts()).length
   const cursorBefore=(await db.query('SELECT * FROM vocabulary_learning_state ORDER BY auth_user_id')).rows
   await db.exec('BEGIN');await once(id(1020),a.forward,'falsch');await db.exec('ROLLBACK')
   assert.deepEqual(await states(a.cardId),before);assert.equal((await receipts()).length,count)
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_learning_state ORDER BY auth_user_id')).rows,cursorBefore)
   await db.exec('RESET ROLE')
   await db.exec(`CREATE FUNCTION vocabulary_private.test_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='P9998',MESSAGE='test_receipt_failure'; END $$;
    CREATE TRIGGER test_receipt_failure BEFORE INSERT ON vocabulary_private.answer_receipts FOR EACH ROW EXECUTE FUNCTION vocabulary_private.test_receipt_failure();`)
   await actor(db,student)
   const failure=await once(id(1021),a.forward,'дом');assert.equal(failure.error,'request_failed');assert.equal(failure.sqlstate,'P9998')
   assert.deepEqual(await states(a.cardId),before);assert.equal((await receipts()).length,count)
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_learning_state ORDER BY auth_user_id')).rows,cursorBefore)
   await db.exec('RESET ROLE');await db.exec('DROP TRIGGER test_receipt_failure ON vocabulary_private.answer_receipts; DROP FUNCTION vocabulary_private.test_receipt_failure()')
   const definition=(await db.query("SELECT pg_get_functiondef('learning_private.grade_answer(text,text[])'::regprocedure) body")).rows[0].body
   await db.exec(`CREATE OR REPLACE FUNCTION learning_private.grade_answer(p_input text,p_accepted text[]) RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path TO '' AS $$ SELECT '{"error":"invalid_answer","message":"grading failure","sqlstate":"22023"}'::jsonb $$`)
   await actor(db,student);assert.equal((await once(id(1022),a.forward,'дом')).error,'invalid_answer')
   assert.deepEqual(await states(a.cardId),before);assert.equal((await receipts()).length,count)
   assert.deepEqual((await db.query('SELECT * FROM vocabulary_learning_state ORDER BY auth_user_id')).rows,cursorBefore)
   await db.exec('RESET ROLE');await db.exec(definition);await actor(db,student)
   assert.equal((await once(id(1022),a.forward,'дом')).isCorrect,true)
  })
  await t.test('duplicate queued requests grade once, malformed initialization is atomic, and reset cannot resurrect progress',async()=>{
   const a=await add();const [first,second]=await Promise.all([once(id(1030),a.forward,'falsch'),once(id(1030),a.forward,'falsch')])
   assert.deepEqual(first,second);assert.equal((await states(a.cardId))[0].lapses,1)
   const before=(await db.query('SELECT count(*)::int count FROM vocabulary_direction_progress')).rows[0].count
   const uninitialized=id(199);await db.exec('RESET ROLE')
   await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$2,'Buch')",[uninitialized,vocabularyUnit]);await actor(db,student)
   const bad=await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify([{cardId:uninitialized,alreadyKnown:false},{cardId:id(999999),alreadyKnown:false}])]);assert.equal(bad.error,'level_access_denied')
   assert.equal((await db.query('SELECT count(*)::int count FROM vocabulary_direction_progress')).rows[0].count,before)
   assert.deepEqual(await states(uninitialized),[])
   await result(db,'SELECT reset_vocabulary_lesson_progress($1) result',[vocabularyUnit]);assert.deepEqual(await states(a.cardId),[])
   assert.equal((await once(id(1030),a.forward,'falsch')).error,'trainer_access_denied')
   assert.deepEqual(await states(a.cardId),[])
  })
 } finally {await db.close()}
})
