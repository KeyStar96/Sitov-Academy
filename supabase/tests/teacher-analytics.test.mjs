import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPhase3Database, actor, id, student, teacher, outsider, exerciseUnit, vocabularyUnit, result, apply } from './helpers/phase3-db.mjs'

await test('Phase 5 teacher analytics uses authorized SQL aggregates and real Berlin-day receipts', async t => {
 const db = await createPhase3Database()
 const course = id(510), unlinked = id(511), cards = [id(520), id(521), id(522)], exercise = id(523)
 const read = (studentId = student, courseId = course) => result(db, 'SELECT public.get_all_students_progress_data($1::uuid,$2::uuid) result', [studentId, courseId])
 try {
  await db.query("INSERT INTO courses(id,slug,title,type,category,level,audience_code,unit_price) VALUES($1,'analytics-a1','A1 Course','presence','german','A1.1','A1.1',5),($2,'analytics-private','Private','online','private',NULL,NULL,10)", [course, unlinked])
  for (const card of cards) await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$2,'Haus')", [card, vocabularyUnit])
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2)")
  await db.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','vocabulary','Other course level')", [id(540)])
  await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de) VALUES($1,$2,'Fremd')", [id(541),id(540)])
  await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Artikel','fill_in_blank','{\"correct_answer\":\"ein\",\"accepted_answers\":[\"ein\"]}')", [exercise, exerciseUnit])
  await db.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,completed) VALUES($1,$2,true)', [student, exercise])
  for (const [card, direction, box] of [[cards[0], 'de_to_native', 7], [cards[0], 'native_to_de', 7], [cards[1], 'de_to_native', 7], [cards[1], 'native_to_de', 6]])
   await db.query('INSERT INTO vocabulary_direction_progress(auth_user_id,card_id,direction,box_number) VALUES($1,$2,$3,$4)', [student, card, direction, box])
  const progress = (await db.query('SELECT id FROM vocabulary_direction_progress WHERE auth_user_id=$1 AND card_id=$2 ORDER BY direction LIMIT 1', [student, cards[0]])).rows[0].id
  // The client boolean is intentionally opposite to the stored server grade.
  for (const [request, correct, instant] of [
   [id(530), true, "((now() AT TIME ZONE 'Europe/Berlin')::date-2)::timestamp AT TIME ZONE 'Europe/Berlin'"],
   [id(531), false, "(((now() AT TIME ZONE 'Europe/Berlin')::date-2)::timestamp AT TIME ZONE 'Europe/Berlin')-interval '30 minutes'"],
   [id(532), true, "(((now() AT TIME ZONE 'Europe/Berlin')::date-29)::timestamp AT TIME ZONE 'Europe/Berlin')-interval '1 second'"],
  ]) await db.query(`INSERT INTO vocabulary_private.answer_receipts(auth_user_id,request_id,progress_id,is_correct,typed_answer,ui_language,response,created_at) VALUES($1,$2,$3,$4,'private answer','ru',$5,${instant})`, [student, request, progress, !correct, { success: true, isCorrect: correct }])
  await apply(db, ['09_progress_aggregate.sql'])
  await actor(db, teacher)
  const original = await result(db, 'SELECT public.get_all_students_progress_data() result')
  await db.exec('RESET ROLE')
  await apply(db, ['11_teacher_analytics.sql'])
  await t.test('keeps Phase 4 callers compatible and aggregates both directions', async () => {
   await actor(db, teacher)
   assert.deepEqual(await result(db, 'SELECT public.get_all_students_progress_data() result'), original)
   const analytics = await read()
   assert.equal(analytics.level, 'A1.1'); assert.equal(analytics.completionByLevel['A1.1'], 50)
   assert.deepEqual(analytics.distribution, {
    buckets: [1, 2, 3, 4, 5, 6, 'learned'].map(key => ({ key, count: key === 6 || key === 'learned' ? 1 : 0 })),
    totalCards: 3, totalInBox: 2, overallPercent: 62,
   })
   assert.equal((await read(student,null)).distribution.totalCards,4)
  })
  await t.test('counts real server grades on Berlin calendar days and limits the history window', async () => {
   const analytics = await read()
   assert.equal(analytics.timezone, 'Europe/Berlin'); assert.equal(analytics.history.length, 30)
   assert.equal(analytics.history[27].answers, 1); assert.equal(analytics.history[27].correct, 1)
   assert.equal(analytics.history[26].answers, 1); assert.equal(analytics.history[26].correct, 0)
   assert.equal(analytics.history.reduce((total, day) => total + day.answers, 0), 2)
   assert.equal(JSON.stringify(analytics).includes('private answer'), false)
  })
  await t.test('does not fabricate another student or an unmapped course learning level', async () => {
   const empty = await read(outsider)
   assert.equal(empty.distribution.totalInBox, 0)
   assert.ok(empty.history.every(day => day.answers === 0))
   const noLevel = await read(student, unlinked)
   assert.equal(noLevel.level, null); assert.equal(noLevel.distribution.totalCards, 0)
   assert.equal((await read(null)).error, 'invalid_input')
   assert.equal((await read(teacher)).error, 'not_found')
   assert.equal((await read(student, id(999))).error, 'not_found')
  })
  await t.test('denies anonymous and nonstaff access before touching private data', async () => {
   await actor(db, student); assert.equal((await read()).error, 'not_authorized')
   await actor(db, null); assert.equal((await read()).error, 'not_authorized')
   await actor(db, null, 'anon'); await assert.rejects(read(), error => error.code === '42501')
  })
  await t.test('is repeatable, has an empty search_path and reports structured SQL failures', async () => {
   await db.exec('RESET ROLE'); await apply(db, ['11_teacher_analytics.sql'])
   const security = (await db.query("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='public.get_all_students_progress_data(uuid,uuid)'::regprocedure")).rows[0]
   assert.equal(security.prosecdef, true); assert.deepEqual(security.proconfig, ['search_path=""'])
   await db.exec('BEGIN; ALTER TABLE vocabulary_private.answer_receipts RENAME TO temporarily_unavailable;')
   await actor(db, teacher)
   const failure = await read()
   assert.equal(failure.error, 'request_failed'); assert.equal(failure.sqlstate, '42P01')
   assert.equal(failure.message, 'Learning analytics could not be loaded.')
   await db.exec('ROLLBACK; RESET ROLE;')
  })
 } finally { await db.close() }
})
