import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, currentFeatureMigrations, actor, id, student, teacher, vocabularyUnit, result, apply } from './helpers/current-db.mjs'

const migration = '55_preserve_course_outages_focus_access.sql'
const latest = currentFeatureMigrations

test('course edits preserve cancellation IDs and never overwrite the central calendar', async () => {
  const db = await createCurrentDatabase({ latest })
  const courseId = id(57001), first = id(57002), concurrent = id(57003)
  const payload = { id: courseId, slug: 'preserved-outages', title: 'Renamed course', description: '', type: 'online', category: 'german', level: 'A1.1', unit_price: 10, unit_minutes: 45, start_date: '', end_date: '', trial_lessons: false, sort_order: 500, archived: false, schedules: [{ weekday: 4, start_time: '19:00', end_time: '20:30' }], translations: [] }
  const outages = async () => { await db.exec('RESET ROLE'); return (await db.query('SELECT id,date,reason FROM course_exceptions WHERE course_id=$1 ORDER BY date', [courseId])).rows }
  try {
    await db.query("INSERT INTO courses(id,slug,title,type,category,unit_price,unit_minutes) VALUES($1,'preserved-outages','Original title','online','german',10,45)", [courseId])
    await db.query("INSERT INTO course_exceptions(id,course_id,date,reason) VALUES($1,$2,'2099-10-08','Edited centrally'),($3,$2,'2099-10-15','Added concurrently')", [first, courseId, concurrent])
    const before = await outages()
    await actor(db, teacher)
    assert.equal(await result(db, 'SELECT save_business_course($1) result', [payload]), courseId)
    assert.deepEqual(await outages(), before)
    // A rolling-upgrade client may resend the identical calendar, but edits to
    // that legacy field are rejected instead of silently discarded.
    await actor(db, teacher)
    assert.equal(await result(db, 'SELECT save_business_course($1) result', [{ ...payload, exceptions: before.map(({ date, reason }) => ({ date, reason })) }]), courseId)
    assert.deepEqual(await outages(), before)
    await actor(db, teacher)
    const stale = await result(db, 'SELECT save_business_course($1) result', [{ ...payload, title: 'Must roll back', exceptions: [{ date: '2099-10-08', reason: 'Stale client reason' }] }])
    assert.equal(stale.error, 'invalid_input')
    assert.deepEqual(await outages(), before)
    assert.equal((await db.query('SELECT title FROM courses WHERE id=$1', [courseId])).rows[0].title, payload.title)
    await apply(db, [migration])
    assert.deepEqual(await outages(), before, 'reapplying migration only replaces code')
    await db.exec(await readFile(new URL('../../deploy/vps/tests/refactoring-consistency.sql', import.meta.url), 'utf8'))
  } finally { await db.close() }
})

test('focus answer replay follows current trainer permissions while retaining all receipts', async () => {
  const db = await createCurrentDatabase({ latest })
  const card = id(57101), progress = id(57102), request = id(57103)
  const submit = async () => { await actor(db, student); return result(db, "SELECT submit_vocabulary_focus_answer($1,$2,'article','der','ru') result", [request, card]) }
  try {
    await db.query('UPDATE learning_units SET is_active=true WHERE id=$1', [vocabularyUnit])
    await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,sentence_practice) VALUES($1,$2,'Tisch','der',false)", [card, vocabularyUnit])
    await db.query("INSERT INTO vocabulary_direction_progress(id,auth_user_id,card_id,direction,box_number,lapses,next_review_date) VALUES($1,$2,$3,'native_to_de',2,3,now())", [progress, student, card])
    await db.query("INSERT INTO vocabulary_focus_words(auth_user_id,card_id,status,wrong_count,due_at) VALUES($1,$2,'active',3,now())", [student, card])
    const accepted = await submit()
    assert.equal(accepted.correct, true)
    await actor(db, teacher)
    await db.query("SELECT set_student_trainer_access($1,'A1.1','vocabulary',false)", [student])
    assert.equal((await submit()).error, 'trainer_access_denied')
    await actor(db, teacher)
    await db.query("SELECT set_student_trainer_access($1,'A1.1','vocabulary',true,NULL,true)", [student])
    assert.deepEqual(await submit(), accepted)
    await actor(db, teacher)
    await db.query("SELECT set_student_trainer_access($1,'A1.1','vocabulary',true,ARRAY[]::uuid[],true)", [student])
    assert.equal((await submit()).error, 'trainer_access_denied', 'lesson restrictions also apply to replay')
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT count(*)::int n FROM vocabulary_private.focus_receipts WHERE auth_user_id=$1', [student])).rows[0].n, 1)
    assert.equal((await db.query('SELECT practice_count FROM vocabulary_focus_words WHERE auth_user_id=$1 AND card_id=$2', [student, card])).rows[0].practice_count, 1)
  } finally { await db.close() }
})
