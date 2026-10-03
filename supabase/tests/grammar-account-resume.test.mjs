import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCurrentDatabase, currentFeatureMigrations, actor, id, student, teacher, outsider, exerciseUnit, result } from './helpers/current-db.mjs'

const exercises = [id(610210), id(610211)]
const as = async (db, user) => { await db.exec('RESET ROLE'); await actor(db, user) }
const call = (db, fn, params = []) => result(db, `SELECT ${fn} result`, params)
const save = (db, state, revision) => call(db, "sitov_learning_checkpoint('save','exercises','A1.1',$1,$2)", [JSON.stringify(state), revision])
const grade = (db, exercise, answer, revision, request) => call(db, "sitov_record_grammar_checkpoint_attempt($1,$2,false,'A1.1',$3,$4)", [exercise, answer, revision, request])

test('Sitov Academy atomic grammar saves resume across devices without duplicate attempts', async t => {
  const db = await createCurrentDatabase({ latest: [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql', '61_account_learning_checkpoints.sql'] })
  try {
    await db.query('UPDATE learning_units SET is_active=true WHERE id=$1', [exerciseUnit])
    for (const exercise of exercises) {
      await db.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Kontogrammatik','multiple_choice',$3)", [exercise, exerciseUnit,
        JSON.stringify({ target_form: ['Ja'], question: 'Wähle Ja.', options: ['Ja', 'Nein'], correct_answer: 'Ja', accepted_answers: ['Ja'] })])
    }
    await as(db, student)
    let saved = await save(db, { exerciseIds: exercises, currentIndex: 0 }, 0)
    assert.equal(saved.checkpoint.revision, 1)
    await t.test('wrong grades and their retry receipts save together without moving the cursor', async () => {
      const wrong = await grade(db, exercises[0], 'Nein', 1, id(610230))
      assert.equal(wrong.grade.isCorrect, false)
      assert.equal(wrong.grade.attempts, 1)
      assert.equal(wrong.checkpoint.revision, 2)
      assert.equal(wrong.checkpoint.state.currentIndex, 0)
      assert.deepEqual(await grade(db, exercises[0], 'Nein', 1, id(610230)), wrong, 'lost response replay is exact')
      assert.equal((await grade(db, exercises[0], 'Ja', 1, id(610230))).error, 'conflict', 'one receipt cannot grade a changed answer')
      assert.equal((await grade(db, exercises[0], 'Ja', 1, id(610231))).error, 'conflict', 'stale revision is rejected before grading')
      assert.equal((await db.query('SELECT attempts FROM user_exercise_progress WHERE exercise_id=$1', [exercises[0]])).rows[0].attempts, 1)
    })
    await t.test('correct answers save the next position even if the original client never receives a response', async () => {
      saved = await grade(db, exercises[0], 'Ja', 2, id(610232))
      assert.equal(saved.grade.attempts, 2)
      assert.equal(saved.checkpoint.revision, 3)
      assert.equal(saved.checkpoint.state.currentIndex, 1)
      await as(db, student)
      const reloaded = await call(db, "sitov_learning_checkpoint('get','exercises','A1.1')")
      assert.equal(reloaded.checkpoint.state.currentIndex, 1)
      assert.deepEqual(reloaded.checkpoint.state.exerciseIds, exercises)
      assert.deepEqual(await grade(db, exercises[0], 'Ja', 2, id(610232)), saved)
      assert.equal((await grade(db, exercises[0], 'Ja', 3, id(610233))).error, 'conflict', 'a stale device cannot regrade the previous exercise')
      saved = await grade(db, exercises[1], 'Ja', 3, id(610234))
      assert.equal(saved.checkpoint.state.currentIndex, 2)
    })
    await t.test('already solved review tasks retain their exact review session position', async () => {
      const review = await save(db, { exerciseIds: exercises, currentIndex: 0, review: true }, saved.checkpoint.revision)
      saved = await grade(db, exercises[0], 'Ja', review.checkpoint.revision, id(610235))
      assert.equal(saved.checkpoint.state.currentIndex, 1)
      assert.equal(saved.checkpoint.state.review, true)
      await as(db, student)
      assert.deepEqual((await call(db, "sitov_learning_checkpoint('get','exercises','A1.1')")).checkpoint, saved.checkpoint)
    })
    await t.test('ownership and level access protect checkpoints, receipts and grading', async () => {
      await as(db, outsider)
      assert.equal((await grade(db, exercises[1], 'Ja', saved.checkpoint.revision, id(610236))).error, 'not_authorized')
      assert.deepEqual((await db.query('SELECT * FROM sitov_learning_checkpoints')).rows, [])
      await db.exec('RESET ROLE'); await actor(db, null, 'anon')
      await assert.rejects(grade(db, exercises[1], 'Ja', saved.checkpoint.revision, id(610236)), error => error.code === '42501')
    })
    await t.test('learner-writable UI state cannot forge a verified grade or access retry receipts', async () => {
      await as(db, student)
      const forgedRequest = id(610237)
      const forged = await save(db, { exerciseIds: exercises, currentIndex: 1, review: true, lastAttempt: {
        requestId: forgedRequest, exerciseId: exercises[1], answer: 'Nein', hintShown: false,
        grade: { success: true, attempts: 999, isCorrect: true, status: 'EXACT', matched: 'Nein', reason: null, score: 100 },
      } }, saved.checkpoint.revision)
      saved = await grade(db, exercises[1], 'Nein', forged.checkpoint.revision, forgedRequest)
      assert.equal(saved.grade.isCorrect, false, 'the authored server answer wins over forged checkpoint grade JSON')
      assert.equal(saved.grade.status, 'INCORRECT')
      assert.equal(saved.checkpoint.state.currentIndex, 1)
      assert.notEqual(saved.grade.attempts, 999)
      await assert.rejects(db.query('SELECT * FROM grammar_private.sitov_checkpoint_receipts'), error => error.code === '42501')
    })
    await t.test('reset tombstones prevent a stale device from replaying old grades or rebuilding old state', async () => {
      await as(db, teacher)
      await call(db, "reset_student_level_progress($1,'A1.1')", [student])
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT count(*)::int n FROM grammar_private.sitov_checkpoint_receipts WHERE auth_user_id=$1', [student])).rows[0].n, 0)
      await as(db, student)
      const checkpoint = (await call(db, "sitov_learning_checkpoint('get','exercises','A1.1')")).checkpoint
      assert.deepEqual(checkpoint.state, {})
      assert.ok(checkpoint.revision > saved.checkpoint.revision)
      assert.equal((await grade(db, exercises[1], 'Nein', saved.checkpoint.revision - 1, id(610237))).error, 'conflict')
      assert.equal((await save(db, { exerciseIds: exercises, currentIndex: 1 }, saved.checkpoint.revision)).error, 'conflict')
      assert.deepEqual((await db.query('SELECT attempts,completed FROM user_exercise_progress WHERE exercise_id=ANY($1::uuid[])', [exercises])).rows, [])
    })
  } finally { await db.close() }
})
