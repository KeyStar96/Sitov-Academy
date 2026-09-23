import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPhase3Database,actor,id,student,teacher,outsider,vocabularyUnit,result,apply} from './helpers/phase3-db.mjs'

// Migration 23: „Eigene Wörter" — eine private Vokabel-Lektion je Person und
// Niveau, die wie jede Kurslektion durch den Karteikasten läuft, aber nur ihrer
// Besitzerin gehört und nie in Kursfortschritt oder Lehrer-Auswertung zählt.

// 08 enthält psql-Metabefehle (CONCURRENTLY) und läuft hier nicht.
const MIGRATIONS=['07_content_quality.sql','09_progress_aggregate.sql','10_rls_performance.sql','11_teacher_analytics.sql',
 '12_media_upload.sql','13_mail_exception_kind.sql','14_mail_exceptions.sql','15_grading_helper_permissions.sql',
 '16_uploaded_video_visibility.sql','17_remove_video_placeholders.sql','18_vocabulary_self_rating.sql',
 '19_vocabulary_self_rating_fix.sql','20_vocabulary_learner_mode.sql','21_vocabulary_sentence_learner_choice.sql',
 '22_vocabulary_phase6_rules.sql','23_vocabulary_own_words.sql']
const LABEL='Eigene Wörter'

await test('own words: private lesson, normal Leitner training, invisible to everyone else',async t=>{
 const db=await createPhase3Database()
 await apply(db,MIGRATIONS)
 let sequence=700
 const admin=()=>db.exec('RESET ROLE')
 const as=async user=>{ await admin(); await actor(db,user) }
 // A second learner with the same level access, to prove isolation.
 await admin()
 await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')",[outsider])
 const courseCard=id(sequence++)
 await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Haus','das',false)",[courseCard,vocabularyUnit])
 await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,'ru','дом')",[courseCard])

 const add=(word,translation='перевод',article=null,locale='ru',level='A1.1')=>
  result(db,'SELECT add_own_vocabulary($1,$2,$3,$4,$5) result',[level,word,article,translation,locale])
 const ownUnit=async user=>{
  await admin()
  const row=(await db.query('SELECT id,label,sort_order FROM learning_units WHERE owner_auth_user_id=$1',[user])).rows[0]
  return row
 }
 const progress=async(user,cardId)=>{
  await admin()
  return (await db.query('SELECT direction,box_number,next_review_date<=now() due FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2 ORDER BY direction',[user,cardId])).rows
 }

 let first
 await t.test('the first word creates the private lesson; nothing is trained before activation',async()=>{
  await as(student)
  const added=await add('Brot','хлеб')
  assert.equal(added.activated,false)
  first=added.cardId
  const unit=await ownUnit(student)
  assert.equal(unit.label,LABEL)
  assert.ok(unit.sort_order>1000,'sorts after every course lesson')
  assert.deepEqual(await progress(student,first),[])
  await as(student)
  const translation=(await db.query("SELECT translation FROM vocabulary_translations WHERE card_id=$1 AND locale='ru'",[first])).rows[0]
  assert.equal(translation.translation,'хлеб','the owner reads her own translation')
 })

 await t.test('input is validated and duplicates are refused',async()=>{
  await as(student)
  assert.equal((await add('  Brot  ','хлеб')).error,'own_word_exists','whitespace does not make a new word')
  assert.equal((await add('brot','хлеб')).error,'own_word_exists','case does not make a new word')
  assert.equal((await add('Tisch','стол',null,'de')).error,'invalid_language','German is not a translation language')
  assert.equal((await add('   ','стол')).error,'invalid_input')
  assert.equal((await add('Tisch','стол','dem')).error,'invalid_input')
  assert.ok((await add('Brot','хлеб','das')).cardId,'another article is another word')
 })

 await t.test('nobody else sees the lesson, its words or its translations',async()=>{
  await as(outsider)
  const units=(await db.query("SELECT id FROM learning_units WHERE label=$1",[LABEL])).rows
  assert.deepEqual(units,[])
  const cards=(await db.query('SELECT id FROM learning_vocabulary_cards WHERE id=$1',[first])).rows
  assert.deepEqual(cards,[])
  const translations=(await db.query('SELECT card_id FROM vocabulary_translations WHERE card_id=$1',[first])).rows
  assert.deepEqual(translations,[])
  assert.equal((await result(db,'SELECT delete_own_vocabulary($1) result',[first])).error,'not_found')
  await as(teacher)
  const staffUnits=(await db.query('SELECT id FROM learning_units WHERE id = ANY(learning_private.allowed_unit_ids())')).rows.map(row=>row.id)
  assert.ok(!staffUnits.includes((await ownUnit(student)).id),'staff read paths list course content only')
 })

 await t.test('allowed_unit_ids and unit_allowed agree for every unit and learner',async()=>{
  for(const user of [student,outsider,teacher]) {
   await as(user)
   const rows=(await db.query(`SELECT u.id, u.id = ANY(learning_private.allowed_unit_ids()) listed, learning_private.unit_allowed(u.id) allowed
    FROM learning_units u`)).rows
   await admin()
   for(const row of rows) {
    // Staff may manage every course unit, but unit_allowed also covers the
    // (bypassed) per-unit selection; only private units must agree strictly.
    const owner=(await db.query('SELECT owner_auth_user_id FROM learning_units WHERE id=$1',[row.id])).rows[0].owner_auth_user_id
    if(owner) assert.equal(row.listed,row.allowed,`unit ${row.id} for ${user}`)
    if(owner) assert.equal(row.allowed,owner===user)
   }
  }
 })

 await t.test('first activation puts every word into phase 1; later words start in phase 1 at once',async()=>{
  await as(student)
  const {rows}=await db.query('SELECT c.id FROM learning_vocabulary_cards c JOIN learning_units u ON u.id=c.unit_id WHERE u.owner_auth_user_id=$1',[student])
  const init=await result(db,'SELECT initialize_vocabulary_cards($1) result',[JSON.stringify(rows.map(row=>({cardId:row.id,alreadyKnown:false})))])
  assert.equal(init.addedNew,rows.length)
  assert.deepEqual((await progress(student,first)).map(row=>[row.direction,row.box_number,row.due]),
   [['de_to_native',1,true],['native_to_de',1,true]])
  await as(student)
  const later=await add('Käse','сыр','der')
  assert.equal(later.activated,true)
  assert.deepEqual((await progress(student,later.cardId)).map(row=>[row.direction,row.box_number,row.due]),
   [['de_to_native',1,true],['native_to_de',1,true]])
 })

 await t.test('own words are trained and graded like course words',async()=>{
  await admin()
  const progressId=(await db.query("SELECT id FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2 AND direction='de_to_native'",[student,first])).rows[0].id
  await as(student)
  const typed=await result(db,'SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4) result',[id(sequence++),progressId,'хлеб','ru'])
  assert.equal(typed.isCorrect,true,'graded against the learner\'s own translation')
  assert.equal(typed.newPhase,2)
 })

 await t.test('a changed interface language keeps own words answerable; course words stay strict',async()=>{
  const due=async(cardId,direction='de_to_native')=>{
   await admin()
   const row=(await db.query('SELECT id FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2 AND direction=$3',[student,cardId,direction])).rows[0]
   await db.query("UPDATE vocabulary_direction_progress SET next_review_date='2020-01-01',last_answered_at=NULL WHERE id=$1",[row.id])
   await db.query('DELETE FROM vocabulary_learning_state WHERE auth_user_id=$1',[student])
   await actor(db,student)
   return row.id
  }
  await admin()
  const cheese=(await db.query("SELECT c.id FROM learning_vocabulary_cards c JOIN learning_units u ON u.id=c.unit_id WHERE u.owner_auth_user_id=$1 AND c.word_de='Käse'",[student])).rows[0].id
  // Eingetragen mit russischer Oberfläche, jetzt auf Englisch unterwegs.
  const cheeseProgress=await due(cheese)
  const typed=await result(db,'SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4) result',[id(sequence++),cheeseProgress,'сыр','en'])
  assert.equal(typed.isCorrect,true)
  assert.equal(typed.correctAnswer,'сыр')
  // Die Wiederholung in derselben Sitzung löst dieselbe Übersetzung auf.
  const retry=await result(db,'SELECT check_vocabulary_retry($1,$2,$3) result',[cheeseProgress,'сыр','en'])
  assert.equal(retry.isCorrect,true)
  const rated=await result(db,'SELECT submit_vocabulary_self_rating_once($1,$2,$3,$4) result',[id(sequence++),await due(first),true,'en'])
  assert.equal(rated.correctAnswer,'хлеб')
  // Kursvokabel ohne englische Übersetzung: weiterhin nicht abfragbar.
  await admin()
  await db.query(`INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number,next_review_date)
   VALUES($1,$2,'de_to_native',1,'2020-01-01') ON CONFLICT(auth_user_id,card_id,direction) DO UPDATE SET next_review_date='2020-01-01'`,[student,courseCard])
  const course=await result(db,'SELECT submit_vocabulary_answer_once($1,$2,NULL,$3,$4) result',[id(sequence++),await due(courseCard),'дом','en'])
  assert.equal(course.error,'exercise_unavailable')
 })

 await t.test('a per-lesson selection never hides the own lesson',async()=>{
  await admin()
  await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled,unit_mode) VALUES($1,'A1.1','vocabulary',true,'selected')",[student])
  await as(student)
  const unit=await ownUnit(student)
  await as(student)
  assert.equal((await db.query('SELECT learning_private.unit_allowed($1) ok',[unit.id])).rows[0].ok,true)
  assert.equal((await db.query('SELECT learning_private.unit_allowed($1) ok',[vocabularyUnit])).rows[0].ok,false,'course lesson is not selected')
  await admin()
  await db.query("UPDATE learning_trainer_grants SET enabled=false WHERE auth_user_id=$1",[student])
  await as(student)
  assert.equal((await db.query('SELECT learning_private.unit_allowed($1) ok',[unit.id])).rows[0].ok,false,'a disabled trainer disables own words too')
  assert.equal((await add('Milch','молоко')).error,'trainer_access_denied')
  await admin()
  await db.query('DELETE FROM learning_trainer_grants WHERE auth_user_id=$1',[student])
 })

 await t.test('skipping the assessment never starts the own lesson',async()=>{
  await admin()
  await db.query('UPDATE learning_units SET sort_order=-1 WHERE owner_auth_user_id=$1',[student])
  await as(student)
  const skipped=await result(db,"SELECT skip_vocabulary_assessment('A1.1') result")
  assert.equal(skipped.lesson,'Lektion 1')
 })

 await t.test('course content can neither use the reserved name nor land in a private lesson',async()=>{
  await admin()
  await assert.rejects(db.query("INSERT INTO learning_units(level,trainer,label) VALUES('A1.1','vocabulary',$1)",[LABEL]))
  const found=(await db.query("SELECT learning_private.ensure_unit(NULL,'A1.1','vocabulary',$1) id",['Lektion 1'])).rows[0].id
  assert.equal(found,vocabularyUnit)
  await assert.rejects(db.query("SELECT learning_private.ensure_unit(NULL,'A1.1','vocabulary',$1)",[LABEL]),'staff cannot create or reuse it')
 })

 await t.test('course progress and teacher analytics count course words only',async()=>{
  await admin()
  // Alle eigenen Wörter gelernt: Der Kursfortschritt darf sich nicht bewegen.
  await db.query(`UPDATE vocabulary_direction_progress v SET box_number=7 FROM learning_vocabulary_cards c JOIN learning_units u ON u.id=c.unit_id
   WHERE v.card_id=c.id AND u.owner_auth_user_id=$1`,[student])
  await as(teacher)
  const before=await result(db,'SELECT get_all_students_progress_data() result')
  assert.equal(before.error,undefined)
  assert.equal(before?.[student]?.['A1.1'] ?? 0,0,'learned own words do not raise course progress')
  // Die eine Kursvokabel gelernt: 100 % — eigene Wörter im Nenner drückten das.
  await admin()
  await db.query(`INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number)
   SELECT $1,$2,d::vocabulary_direction,7 FROM unnest(ARRAY['de_to_native','native_to_de']) d
   ON CONFLICT(auth_user_id,card_id,direction) DO UPDATE SET box_number=7`,[student,courseCard])
  await as(teacher)
  const after=await result(db,'SELECT get_all_students_progress_data() result')
  assert.equal(after[student]['A1.1'],100)
  const detail=await result(db,'SELECT get_all_students_progress_data($1,NULL) result',[student])
  assert.equal(detail.error,undefined)
  assert.equal(detail.distribution.totalCards,1,'only the course card is counted')
  await admin()
  const receipts=(await db.query('SELECT count(*)::int n FROM vocabulary_private.answer_receipts WHERE auth_user_id=$1',[student])).rows[0].n
  assert.ok(receipts>0,'the own-word answer left a receipt')
  assert.ok(detail.history.every(day=>day.answers===0),'answers on own words stay out of the teacher history')
 })

 await t.test('deleting a word removes it with its progress; deleting the person removes the lesson',async()=>{
  await as(student)
  assert.deepEqual(await result(db,'SELECT delete_own_vocabulary($1) result',[first]),{success:true})
  assert.deepEqual(await progress(student,first),[])
  await admin()
  const unit=await ownUnit(student)
  await db.query('DELETE FROM learning_units WHERE id=$1',[unit.id])
  const left=(await db.query('SELECT count(*)::int n FROM learning_vocabulary_cards WHERE unit_id=$1',[unit.id])).rows[0].n
  assert.equal(left,0)
 })

 await t.test('rollback restores the previous schema and the migration re-applies',async()=>{
  await admin()
  await as(outsider)
  assert.ok((await add('Apfel','яблоко')).cardId)
  await admin()
  const rollback=await readFile(new URL('../vps/rollback/23_vocabulary_own_words.sql',import.meta.url),'utf8')
  await db.exec('BEGIN;'+rollback+'COMMIT;')
  const column=(await db.query("SELECT 1 FROM information_schema.columns WHERE table_name='learning_units' AND column_name='owner_auth_user_id'")).rows
  assert.deepEqual(column,[])
  await apply(db,['23_vocabulary_own_words.sql'])
  await apply(db,['23_vocabulary_own_words.sql'])
 })
 await db.close()
})
