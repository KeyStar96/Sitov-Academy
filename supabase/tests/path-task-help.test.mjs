import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLearningPathDatabase, apply, actor, id, student, teacher, outsider, result } from './helpers/learning-path-db.mjs'

// Phase-8 prompt, items 1-3: translation help next to the German task, a base-form
// hint in every gap (migration 44) and the evaluation of the last test (migration 45).
const unit = id(44000)
const nodes = { practice: id(44100), review: id(44101), test: id(44102) }
const gap = { target_form: ['heißen'], instruction: 'Ergänze die richtige Verbform.', text_before: 'Hallo, ich ', text_after: ' Lara.',
  correct_answer: 'heiße', options: ['heiße', 'heißt', 'heißen'], accepted_answers: ['heiße'], gap_hint: 'heißen' }
const choice = { target_form: ['Begrüßung'], instruction: 'Was sagst du?', question: 'Es ist sieben Uhr am Morgen.',
  options: ['Guten Morgen!', 'Gute Nacht!'], correct_answer: 'Guten Morgen!', accepted_answers: ['Guten Morgen!'] }
const exercises = { gap: id(44500), choice: id(44501), test: [id(44510), id(44511), id(44512), id(44513)] }

const as = async (db, user) => { await db.exec('RESET ROLE'); await actor(db, user) }
const call = (db, fn, params = []) => result(db, `SELECT ${fn} result`, params)
const exercise = (db, exerciseId, node, type, content, order) => db.query(
  "INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'goal',$4,$5,'Prüfung',$6,$7)",
  [exerciseId, unit, node, `help-${exerciseId}`, order, type, JSON.stringify(content)])
const translate = (db, exerciseId, locale, fields) => db.query(
  'INSERT INTO grammar_translations(exercise_id,locale,instruction,task,gap_hint) VALUES($1,$2,$3,$4,$5) ON CONFLICT(exercise_id,locale) DO UPDATE SET instruction=excluded.instruction,task=excluded.task,gap_hint=excluded.gap_hint',
  [exerciseId, locale, fields.instruction ?? null, fields.task ?? null, fields.gap_hint ?? null])

async function fixture() {
  const db = await createLearningPathDatabase()
  try {
    await apply(db, ['36_migrate_old_grammar_progress.sql', '37_vocabulary_carryover.sql', '38_learning_sessions.sql', '39_teacher_dashboard.sql', '43_path_open_tests.sql', '44_path_task_help.sql', '45_path_test_review.sql'])
    await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Pfad 1',1,true,'help-1','help-1','Pfad 1')", [unit])
    await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Prüfziel')", [unit])
    for (const [node, kind, order] of [[nodes.practice, 'practice', 1], [nodes.review, 'review', 2], [nodes.test, 'test', 3]]) {
      await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,test_size) VALUES($1,$2,$3,$4,$5,'Knoten','Prüfung',$6,ARRAY['goal'],$7)",
        [node, unit, `node-${node}`, kind, order, kind === 'test' ? null : JSON.stringify({ rule: 'Regel.', examples: ['Beispiel.'] }), kind === 'test' ? 2 : null])
    }
    await exercise(db, exercises.gap, nodes.practice, 'fill_in_blank', gap, 1)
    await exercise(db, exercises.choice, nodes.practice, 'multiple_choice', choice, 2)
    await exercise(db, id(44502), nodes.review, 'multiple_choice', choice, 1)
    for (const [index, exerciseId] of exercises.test.entries()) await exercise(db, exerciseId, nodes.test, 'multiple_choice', choice, index + 1)
    await translate(db, exercises.gap, 'ru', { instruction: 'Вставьте форму глагола.', task: 'Привет, меня зовут Лара.' })
    await translate(db, exercises.choice, 'ru', { instruction: 'Что вы скажете?', task: 'Семь часов утра.' })
    await translate(db, exercises.choice, 'en', { instruction: 'What do you say?' })
    for (const exerciseId of exercises.test) await translate(db, exerciseId, 'ru', { task: 'Семь часов утра.' })
    await as(db, student)
    return db
  } catch (error) { await db.close(); delete error.query; throw error }
}

const scenario = (name, fn) => test(`path task help: ${name}`, async () => {
  const db = await fixture()
  try { await fn(db) } finally { await db.close() }
})

scenario('the German task stays German; the interface language comes along as optional help', async db => {
  const run = await call(db, "start_path_node($1,'ru')", [nodes.practice])
  assert.ok(run.run_id, JSON.stringify(run))
  const byId = Object.fromEntries(run.exercises.map(item => [item.id, item]))
  const fill = byId[exercises.gap], pick = byId[exercises.choice]
  assert.equal(fill.content.text_before, 'Hallo, ich ')
  assert.equal(fill.content.gap_hint, 'heißen', 'the infinitive of the searched word is shown in the gap')
  assert.deepEqual(fill.translation, { task: 'Привет, меня зовут Лара.' })
  assert.equal(pick.content.question, 'Es ist sieben Uhr am Morgen.')
  assert.deepEqual(pick.content.options, ['Guten Morgen!', 'Gute Nacht!'], 'the clickable options stay German')
  assert.deepEqual(pick.translation, { task: 'Семь часов утра.' })
  for (const item of run.exercises) {
    for (const secret of ['correct_answer', 'accepted_answers', 'target_form']) assert.equal(secret in item.content, false, `${secret} never leaves the database`)
  }
  const german = await call(db, "start_path_node($1,'en')", [nodes.practice])
  const english = Object.fromEntries(german.exercises.map(item => [item.id, item]))
  assert.equal('translation' in english[exercises.choice], false, 'no help text, no translation object')
  assert.equal(english[exercises.gap].content.gap_hint, 'heißen')
})

scenario('a meaning hint in the interface language replaces a base form that would give the answer away', async db => {
  await db.exec('RESET ROLE')
  const content = { ...gap, target_form: ['Zimmer'], text_before: 'Das Sofa steht im ', text_after: '.', correct_answer: 'Wohnzimmer',
    options: ['Wohnzimmer', 'Bad'], accepted_answers: ['Wohnzimmer'] }
  delete content.gap_hint
  await db.query('UPDATE learning_exercises SET content=$2 WHERE id=$1', [exercises.gap, JSON.stringify(content)])
  await translate(db, exercises.gap, 'ru', { task: 'Диван стоит в гостиной.', gap_hint: 'гостиная' })
  await as(db, student)
  const run = await call(db, "start_path_node($1,'ru')", [nodes.practice])
  const fill = run.exercises.find(item => item.id === exercises.gap)
  assert.equal('gap_hint' in fill.content, false)
  assert.deepEqual(fill.translation, { task: 'Диван стоит в гостиной.', gap_hint: 'гостиная' })
})

scenario('tasks frozen before 44 still get the current help texts', async db => {
  await db.exec('RESET ROLE')
  await db.exec('DELETE FROM grammar_translations')
  await as(db, student)
  const before = await call(db, "start_path_node($1,'ru')", [nodes.practice])
  assert.equal(before.exercises.some(item => 'translation' in item), false)
  await db.exec('RESET ROLE')
  await translate(db, exercises.choice, 'ru', { task: 'Семь часов утра.' })
  await as(db, student)
  const resumed = await call(db, "start_path_node($1,'ru')", [nodes.practice])
  assert.equal(resumed.run_id, before.run_id, 'the same run is resumed')
  assert.deepEqual(resumed.exercises.find(item => item.id === exercises.choice).translation, { task: 'Семь часов утра.' })
})

scenario('the content contract accepts only a short German gap hint on gaps', async db => {
  await db.exec('RESET ROLE')
  const valid = content => call(db, "path_private.valid_content('fill_in_blank',$1)", [JSON.stringify(content)])
  assert.equal(await valid(gap), true)
  assert.equal(await valid({ ...gap, gap_hint: 'x'.repeat(101) }), false)
  assert.equal(await valid({ ...gap, gap_hint: 'гостиная' }), false, 'meaning hints belong in the translations')
  assert.equal(await call(db, "path_private.valid_content('multiple_choice',$1)", [JSON.stringify({ ...choice, gap_hint: 'sein' })]), false)
  await assert.rejects(db.query("UPDATE learning_exercises SET content=content||'{\"gap_hint\":\"гостиная\"}' WHERE id=$1", [exercises.gap]))
})

scenario('the latest completed test can be reviewed with own answers and solutions', async db => {
  assert.equal((await call(db, "get_path_test_review($1,'ru')", [nodes.test])).error, 'attempt_unavailable', 'nothing to review before a test')
  const attempt = await call(db, "start_path_test($1,'ru')", [nodes.test])
  const [first, second] = attempt.exercises
  assert.deepEqual(first.translation, { task: 'Семь часов утра.' })
  await call(db, 'submit_path_test_answer($1,$2,$3)', [attempt.attempt_id, first.id, JSON.stringify({ index: 0 })])
  await call(db, 'submit_path_test_answer($1,$2,$3)', [attempt.attempt_id, second.id, JSON.stringify({ index: 1 })])
  const finished = await call(db, "finish_path_test($1,'ru')", [attempt.attempt_id])
  assert.equal(Number(finished.percentage), 50)
  const review = await call(db, "get_path_test_review($1,'ru')", [nodes.test])
  assert.equal(review.attempt_id, attempt.attempt_id)
  assert.equal(review.passed, false)
  assert.ok(review.completed_at)
  assert.deepEqual(review.answers.map(item => [item.answer.index, item.result.correct, item.solution.content.correct_answer]),
    [[0, true, 'Guten Morgen!'], [1, false, 'Guten Morgen!']])
  const again = await call(db, "get_path_test_review($1,'ru')", [nodes.test])
  assert.deepEqual(again.answers, review.answers, 'reviewing changes nothing')

  await as(db, outsider)
  assert.equal((await call(db, "get_path_test_review($1,'ru')", [nodes.test])).error, 'attempt_unavailable', 'strangers see nothing of it')
  await as(db, student)
  const next = await call(db, "start_path_test($1,'ru')", [nodes.test])
  assert.notEqual(next.attempt_id, attempt.attempt_id, 'starting again after a review creates a new attempt')
})

scenario('a test reset by the teacher disappears from the map and the review', async db => {
  const attempt = await call(db, "start_path_test($1,'en')", [nodes.test])
  for (const item of attempt.exercises) await call(db, 'submit_path_test_answer($1,$2,$3)', [attempt.attempt_id, item.id, JSON.stringify({ index: 0 })])
  assert.equal((await call(db, "finish_path_test($1,'en')", [attempt.attempt_id])).passed, true)
  const listed = async () => (await call(db, "get_learning_path('A1.1','en')")).paths[0].nodes.find(node => node.id === nodes.test).tests
  assert.equal((await listed()).length, 1)
  await as(db, teacher)
  const reset = await call(db, "manage_learning_path($1,$2,'reset_test',$3)", [student, unit, nodes.test])
  assert.ok(!reset?.error, JSON.stringify(reset))
  await as(db, student)
  assert.deepEqual(await listed(), [], 'archived attempts are no longer shown to the learner')
  assert.equal((await call(db, "get_path_test_review($1,'en')", [nodes.test])).error, 'attempt_unavailable')
})

test('path task help: the complete A1.1 seed satisfies the 44 contract, every gap is unambiguous', async () => {
  const { readFile } = await import('node:fs/promises')
  const seed = JSON.parse(await readFile(new URL('../seeds/path-a1.1.json', import.meta.url), 'utf8'))
  const db = await createLearningPathDatabase()
  try {
    await apply(db, ['36_migrate_old_grammar_progress.sql', '37_vocabulary_carryover.sql', '38_learning_sessions.sql', '39_teacher_dashboard.sql', '43_path_open_tests.sql', '44_path_task_help.sql'])
    for (const path of seed) assert.equal((await db.query('SELECT path_private.valid_seed_shape($1) valid', [JSON.stringify(path)])).rows[0].valid, true, path.id)
    const exercises = seed.flatMap(path => path.nodes.flatMap(node => node.exercises))
    const invalid = (await db.query(`SELECT e->>'ref' ref FROM jsonb_array_elements($1::jsonb) e
      WHERE NOT path_private.valid_content((e->>'exercise_type')::exercise_type,e->'content')`, [JSON.stringify(exercises)])).rows
    assert.deepEqual(invalid, [])
    // Every gap names its word (German base form or its meaning) unless the task itself
    // already shows it: writing a number, forming a plural of the given noun, copying into a form.
    const selfEvident = ['Schreib die Zahl als Wort.', 'Ergänze die Pluralform.', 'Ergänze das Formular.']
    const unhinted = exercises.filter(e => e.exercise_type === 'fill_in_blank' && !selfEvident.includes(e.content.instruction)
      && !e.content.gap_hint && !['en', 'ru', 'uk', 'tr'].every(lang => e.translations[lang].gap_hint))
    assert.deepEqual(unhinted.map(e => e.ref), [])
    const translated = exercises.filter(e => ['en', 'ru', 'uk', 'tr'].every(lang => e.translations[lang].task))
    assert.ok(translated.length >= 720, `${translated.length} tasks translated`)
  } finally { await db.close() }
})
