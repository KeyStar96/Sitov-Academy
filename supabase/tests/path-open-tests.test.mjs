import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createLearningPathDatabase, apply, actor, id, student, teacher, outsider, result } from './helpers/learning-path-db.mjs'

// Three tiny paths in one level: practice → review → test, the third without review.
const units = [id(43000), id(43001), id(43002)]
const nodes = {
  practice1: id(43100), review1: id(43101), test1: id(43102),
  practice2: id(43110), review2: id(43111), test2: id(43112),
  practice3: id(43120), test3: id(43122),
}
const layout = [
  [nodes.practice1, 0, 'practice', 1], [nodes.review1, 0, 'review', 2], [nodes.test1, 0, 'test', 3],
  [nodes.practice2, 1, 'practice', 1], [nodes.review2, 1, 'review', 2], [nodes.test2, 1, 'test', 3],
  [nodes.practice3, 2, 'practice', 1], [nodes.test3, 2, 'test', 2],
]
const content = JSON.stringify({ target_form: ['Ja'], question: 'Wähle Ja.', options: ['Ja', 'Nein'], correct_answer: 'Ja', accepted_answers: ['Ja'] })

const as = async (db, user) => { await db.exec('RESET ROLE'); await actor(db, user) }
const call = (db, fn, params = []) => result(db, `SELECT ${fn} result`, params)

async function fixture() {
  const db = await createLearningPathDatabase()
  try {
    await apply(db, ['36_migrate_old_grammar_progress.sql', '37_vocabulary_carryover.sql', '38_learning_sessions.sql', '39_teacher_dashboard.sql', '43_path_open_tests.sql'])
    for (const [index, unit] of units.entries()) {
      await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises',$2,$3,true,$4,$4,$2)", [unit, `Pfad ${index + 1}`, index + 1, `open-test-${index + 1}`])
      await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Prüfziel')", [unit])
    }
    let exercise = 43500
    for (const [node, unit, kind, order] of layout) {
      await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,test_size) VALUES($1,$2,$3,$4,$5,'Prüfknoten','Prüfung',$6,ARRAY['goal'],$7)",
        [node, units[unit], `node-${node}`, kind, order, kind === 'test' ? null : JSON.stringify({ rule: 'Wähle Ja.', examples: ['Ja.'] }), kind === 'test' ? 1 : null])
      for (let n = 0; n < (kind === 'test' ? 2 : 1); n++) {
        await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'goal',$4,$5,'Prüfung','multiple_choice',$6)",
          [id(exercise), units[unit], node, `open-test-${exercise}`, n + 1, content])
        exercise++
      }
    }
    await as(db, student)
    return db
  } catch (error) { await db.close(); delete error.query; throw error }
}

/** Availability of every node, keyed by node name, as the learner's map reports it. */
async function learnerMap(db) {
  const map = await call(db, "get_learning_path('A1.1','en')")
  assert.ok(!map.error, JSON.stringify(map))
  const byId = new Map(map.paths.flatMap(path => path.nodes).map(node => [node.id, node.available]))
  return { map, open: Object.fromEntries(Object.entries(nodes).map(([name, node]) => [name, byId.get(node)])) }
}

async function takeTest(db, node, index) {
  const attempt = await call(db, "start_path_test($1,'en')", [node])
  assert.ok(attempt.attempt_id, JSON.stringify(attempt))
  for (const exercise of attempt.exercises) await call(db, 'submit_path_test_answer($1,$2,$3)', [attempt.attempt_id, exercise.id, JSON.stringify({ index })])
  return call(db, "finish_path_test($1,'en')", [attempt.attempt_id])
}

const scenario = (name, fn) => test(`open path tests: ${name}`, async () => {
  const db = await fixture()
  try { await fn(db) } finally { await db.close() }
})

scenario('every test is open from the start, lessons stay in order', async db => {
  const { map, open } = await learnerMap(db)
  assert.deepEqual(open, { practice1: true, review1: false, test1: true, practice2: false, review2: false, test2: true, practice3: false, test3: true })
  assert.deepEqual(map.paths.map(path => path.available), [true, false, false])
  assert.equal((await call(db, "start_path_node($1,'en')", [nodes.review1])).error, 'node_locked')
  assert.equal((await call(db, "start_path_node($1,'en')", [nodes.practice2])).error, 'node_locked')
  assert.ok((await call(db, "start_path_test($1,'en')", [nodes.test2])).attempt_id, 'a test in a locked path can be started')
})

scenario('a failed test (< 80 %) unlocks nothing', async db => {
  const finished = await takeTest(db, nodes.test2, 1)
  assert.equal(finished.passed, false)
  assert.equal(Number(finished.percentage), 0)
  const { map, open } = await learnerMap(db)
  assert.deepEqual(open, { practice1: true, review1: false, test1: true, practice2: false, review2: false, test2: true, practice3: false, test3: true })
  assert.deepEqual(map.paths.map(path => path.completed), [false, false, false])
})

scenario('a passed test unlocks its whole path, every earlier path and the next path', async db => {
  const finished = await takeTest(db, nodes.test2, 0)
  assert.equal(finished.passed, true)
  const { map, open } = await learnerMap(db)
  assert.deepEqual(open, { practice1: true, review1: true, test1: true, practice2: true, review2: true, test2: true, practice3: true, test3: true })
  assert.deepEqual(map.paths.map(path => path.available), [true, true, true])
  assert.deepEqual(map.paths.map(path => path.completed), [false, true, false], 'completed still means: this path’s own test is passed')
  assert.equal(map.completed, false)
  const run = await call(db, "start_path_node($1,'en')", [nodes.review2])
  assert.ok(run.run_id, JSON.stringify(run))
})

scenario('the step-by-step route still works and a passed first test opens path 2 as before', async db => {
  for (const node of [nodes.practice1, nodes.review1]) {
    const run = await call(db, "start_path_node($1,'en')", [node])
    const answer = await call(db, "submit_path_answer($1,$2,'{\"index\":0}'::jsonb,$3,'en')", [run.run_id, run.queue[0], id(Number(node.slice(-5)) + 1000)])
    assert.equal(answer.completed, true)
  }
  assert.equal((await takeTest(db, nodes.test1, 0)).passed, true)
  const { open } = await learnerMap(db)
  assert.deepEqual(open, { practice1: true, review1: true, test1: true, practice2: true, review2: false, test2: true, practice3: false, test3: true })
})

scenario('tests stay closed without level access; a teacher reset of the passing test relocks', async db => {
  await as(db, outsider)
  assert.ok((await call(db, "start_path_test($1,'en')", [nodes.test1])).error, 'no level access, no test')
  await as(db, student)
  await takeTest(db, nodes.test2, 0)
  await as(db, teacher)
  const reset = await call(db, "manage_learning_path($1,$2,'reset_test',$3,$4)", [student, units[1], nodes.test2, id(43900)])
  assert.equal(reset.success, true, JSON.stringify(reset))
  await as(db, student)
  const { open } = await learnerMap(db)
  assert.deepEqual(open, { practice1: true, review1: false, test1: true, practice2: false, review2: false, test2: true, practice3: false, test3: true })
})

scenario('the teacher dashboard shows the same availability as the learner', async db => {
  await takeTest(db, nodes.test2, 0)
  const learner = (await learnerMap(db)).map
  await as(db, teacher)
  const detail = await call(db, "get_teacher_student_detail($1,'path','en')", [student])
  assert.equal(detail.success, true, JSON.stringify(detail))
  const teacherPaths = detail.data.paths.filter(path => units.includes(path.id))
  assert.deepEqual(teacherPaths.map(path => path.available), learner.paths.map(path => path.available))
  assert.deepEqual(teacherPaths.flatMap(path => path.nodes.map(node => node.available)), learner.paths.flatMap(path => path.nodes.map(node => node.available)))
})

scenario('rollback restores locked tests; reapplying is idempotent', async db => {
  await db.exec('RESET ROLE')
  await db.exec('BEGIN;' + await readFile(new URL('../vps/rollback/43_path_open_tests.sql', import.meta.url), 'utf8') + 'COMMIT;')
  await actor(db, student)
  let { open } = await learnerMap(db)
  assert.equal(open.test1, false, 'before 43 a test waits for all lessons')
  assert.equal(open.test2, false)
  await db.exec('RESET ROLE')
  await apply(db, ['43_path_open_tests.sql'])
  await apply(db, ['43_path_open_tests.sql'])
  await actor(db, student)
  ;({ open } = await learnerMap(db))
  assert.equal(open.test1, true)
  assert.equal(open.test2, true)
})
