import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  createLearningPathDatabase, learningPathMigrations, apply,
  actor, id, student, teacher, outsider, exerciseUnit, result,
} from './helpers/learning-path-db.mjs'

// Deliberately tiny, artificial contract fixtures. The curriculum JSON is never
// imported, edited or substituted by this suite.
const unit1 = id(9100), unit2 = id(9101)
const practice = id(9110), review = id(9111), testNode = id(9112), special = id(9113)
const secondPractice = id(9120), secondReview = id(9121), secondTest = id(9122)
const firstExercise = id(9200), reviewExercise = id(9220)
const goals = ['fixture-one', 'fixture-two', 'fixture-three']
const exerciseContent = { target_form: ['Gruß'], question: 'Wähle Ja.', options: ['Ja', 'Nein'], correct_answer: 'Ja', accepted_answers: ['Ja'] }
const rpcSignatures = [
  'get_learning_path(text,text)', 'start_path_node(uuid,text,boolean)',
  'submit_path_answer(uuid,uuid,jsonb,uuid,text)', 'start_path_test(uuid,text)',
  'submit_path_test_answer(uuid,uuid,jsonb)', 'finish_path_test(uuid,text)',
  'manage_learning_path(uuid,uuid,text,uuid)',
]

function withoutSolutions(value) {
  const forbidden = new Set(['accepted_answers', 'correct_answer', 'correct_index', 'solution', 'solution_audio_url', 'explanation', 'smart_hint', 'result', 'grade', 'is_correct'])
  const visit = object => {
    if (!object || typeof object !== 'object') return
    for (const [key, child] of Object.entries(object)) {
      assert.ok(!forbidden.has(key), `Premature disclosure of ${key}: ${JSON.stringify(value)}`)
      visit(child)
    }
  }
  visit(value)
}

async function fixtures(db) {
  await db.exec('RESET ROLE')
  await db.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2) ON CONFLICT DO NOTHING")
  for (const [unit, order] of [[unit1, 1], [unit2, 2]]) {
    await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises',$2,$3,true,$4,$4,$2)", [unit, `Prüfpfad ${order}`, order, `fixture-path-${order}`])
    for (const goal of goals) await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,$2,'grammar','Künstliches Prüfziel')", [unit, goal])
  }
  for (const [node, unit, kind, order] of [
    [practice, unit1, 'practice', 1], [review, unit1, 'review', 2], [testNode, unit1, 'test', 3], [special, unit1, 'special', 4],
    [secondPractice, unit2, 'practice', 1], [secondReview, unit2, 'review', 2], [secondTest, unit2, 'test', 3],
  ]) {
    await db.query(`INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,anchor_node_id,test_size,created_by)
      VALUES($1,$2,$3,$4,$5,'Prüfknoten','Prüfung',$6,$7,$8,$9,$10)`, [node, unit, `fixture-${kind}-${node}`, kind, order,
      kind === 'test' ? null : JSON.stringify({ rule: 'Wähle das erste Wort.', examples: ['Ja.'], highlight: null }), goals,
      kind === 'special' ? practice : null, kind === 'test' ? 15 : null, teacher])
    await db.query("INSERT INTO path_node_translations(node_id,locale,title,rule) VALUES($1,'en','Test node','Choose the first word.')", [node])
  }
  for (const [node, count, offset, unit] of [[practice, 10, 9200, unit1], [review, 1, 9220, unit1], [special, 1, 9230, unit1], [testNode, 30, 9300, unit1], [secondPractice, 1, 9400, unit2], [secondReview, 1, 9410, unit2], [secondTest, 30, 9500, unit2]]) {
    for (let n = 0; n < count; n++) {
      const exercise = id(offset + n)
      await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,$4,$5,$6,'Prüfung','multiple_choice',$7)", [exercise, unit, node, goals[n % goals.length], `fixture-${offset + n}`, n + 1, JSON.stringify(exerciseContent)])
      await db.query("INSERT INTO grammar_translations(exercise_id,locale,hint,smart_hint,explanation) VALUES($1,'en','A private hint.','A private smart hint.','A private explanation.')", [exercise])
    }
  }
}

await test('Phase 3 learning path: PostgreSQL access, progress, grading, exams and rollback', async t => {
  const db = await createLearningPathDatabase({ beforePathMigrations: async baseline => {
    await baseline.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2)")
    await baseline.query("INSERT INTO learning_units(id,level,trainer,label) VALUES($1,'A1.2','exercises','Alte Grammatik')", [id(9099)])
    await baseline.query("INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,'Bestand','fill_in_blank',$3)", [id(9090), exerciseUnit, JSON.stringify({ target_form: ['Test'], text_before: 'Schreibe', text_after: '.', correct_answer: 'Test', accepted_answers: ['Test'] })])
    await baseline.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,attempts,completed) VALUES($1,$2,2,true)', [student, id(9090)])
  } })
  const admin = () => db.exec('RESET ROLE')
  let request = 9900
  const call = (sql, params = []) => result(db, `SELECT ${sql} result`, params)
  const start = (node, restart = false) => call('start_path_node($1,\'en\',$2)', [node, restart])
  const answer = (run, exercise, index = 0, requestId = id(request++)) => call('submit_path_answer($1,$2,$3,$4,\'en\')', [run, exercise, JSON.stringify({ index }), requestId])
  const startTest = () => call("start_path_test($1,'en')", [testNode])
  let completedAttempt, passedAttempt
  try {
    await fixtures(db)

    await t.test('every public RPC is SECURITY DEFINER, fixes search_path and denies anonymous execution', async () => {
      await admin()
      for (const signature of rpcSignatures) {
        const fn = (await db.query("SELECT prosecdef,proconfig,has_function_privilege('anon',oid,'EXECUTE') anonymous FROM pg_proc WHERE oid=$1::regprocedure", [`public.${signature}`])).rows[0]
        assert.deepEqual(fn, { prosecdef: true, proconfig: ['search_path=""'], anonymous: false }, signature)
      }
      await actor(db, null)
      assert.ok((await call("get_learning_path('A1.1','en')")).error)
      await actor(db, outsider)
      assert.ok((await start(practice)).error)
      assert.ok((await startTest()).error)
      await actor(db, student)
    })

    await t.test('archives legacy units without deleting data and retains teacher-controlled trainer grants', async () => {
      await admin()
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [exerciseUnit])).rows[0].is_active, false)
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [id(9099)])).rows[0].is_active, false, 'legacy units are archived in every level')
      assert.deepEqual((await db.query('SELECT attempts,completed FROM user_exercise_progress WHERE auth_user_id=$1 AND exercise_id=$2', [student, id(9090)])).rows, [{ attempts: 2, completed: true }], 'archiving preserves earlier learning records')
      await db.query("INSERT INTO learning_trainer_grants(auth_user_id,level,trainer,enabled) VALUES($1,'A1.1','exercises',false)", [student])
      await actor(db, student)
      assert.ok((await start(practice)).error)
      await admin()
      await db.query("UPDATE learning_trainer_grants SET enabled=true WHERE auth_user_id=$1 AND trainer='exercises'", [student])
      await actor(db, student)
      const map = await call("get_learning_path('A1.1','en')")
      assert.ok(!map.error, JSON.stringify(map))
      assert.ok((await start(secondPractice)).error, 'the second path requires passing the first exam')
      assert.ok((await start(review)).error, 'review requires completing preceding practice')
      assert.ok((await startTest()).error, 'test requires all mandatory nodes')
    })

    await t.test('solutions are absent from starts, raw content tables, translations and legacy grading APIs', async () => {
      const opened = await start(practice)
      assert.ok(opened.run_id, JSON.stringify(opened))
      assert.equal(opened.exercises.length, 10)
      withoutSolutions(opened.exercises)
      for (const table of ['learning_exercises', 'grammar_translations']) {
        const rows = await db.query(`SELECT * FROM ${table} WHERE ${table === 'learning_exercises' ? 'id' : 'exercise_id'}=$1`, [firstExercise])
        assert.deepEqual(rows.rows, [], `${table} must not expose protected path content`)
      }
      assert.ok((await call('record_grammar_attempt($1,\'Ja\',false)', [firstExercise])).error, 'legacy RPC cannot pre-grade a path item')
      await assert.rejects(db.query('SELECT * FROM path_private.practice_items'), error => error.code === '42501')
      await assert.rejects(db.query("INSERT INTO path_node_progress(auth_user_id,node_id) VALUES($1,$2)", [student, secondPractice]), error => error.code === '42501')
    })

    await t.test('practice retries mistakes at the end, resumes, rejects duplicate request conflicts and preserves best stars', async () => {
      const opened = await start(practice)
      const firstRequest = id(request++)
      const wrong = await answer(opened.run_id, firstExercise, 1, firstRequest)
      assert.ok(wrong.grade, JSON.stringify(wrong))
      assert.ok(wrong.solution)
      assert.equal(wrong.completed, false)
      assert.equal(wrong.queue.at(-1), firstExercise)
      const replay = await answer(opened.run_id, firstExercise, 1, firstRequest)
      assert.deepEqual(replay, wrong, 'idempotency replays the same answer receipt')
      assert.ok((await answer(opened.run_id, firstExercise, 0, firstRequest)).error, 'same request ID with a changed answer is rejected')
      const resumed = await start(practice)
      assert.equal(resumed.run_id, opened.run_id)
      assert.deepEqual(resumed.queue, wrong.queue)
      for (const exercise of resumed.queue) {
        const response = await answer(opened.run_id, exercise)
        assert.ok(!response.error, JSON.stringify(response))
      }
      await admin()
      let progress = (await db.query('SELECT best_stars,first_attempt_accuracy FROM path_node_progress WHERE auth_user_id=$1 AND node_id=$2', [student, practice])).rows[0]
      assert.equal(progress.best_stars, 3, '9/10 initial correct answers earn three stars')
      assert.equal(Number(progress.first_attempt_accuracy), 90)
      await actor(db, student)
      const repeat = await start(practice, true)
      assert.notEqual(repeat.run_id, opened.run_id)
      let response
      for (let n = 0; n < repeat.queue.length; n++) response = await answer(repeat.run_id, repeat.queue[n], n < 4 ? 1 : 0)
      for (const exercise of response.queue) response = await answer(repeat.run_id, exercise)
      assert.equal(response.completed, true)
      assert.equal(response.stars, 1, '6/10 initial answers earn one star')
      const seventy = await start(practice, true)
      for (let n = 0; n < seventy.queue.length; n++) response = await answer(seventy.run_id, seventy.queue[n], n < 3 ? 1 : 0)
      for (const exercise of response.queue) response = await answer(seventy.run_id, exercise)
      assert.equal(response.stars, 2, 'exactly 7/10 initial answers earn two stars')
      await admin()
      progress = (await db.query('SELECT best_stars FROM path_node_progress WHERE auth_user_id=$1 AND node_id=$2', [student, practice])).rows[0]
      assert.equal(progress.best_stars, 3, 'a weaker replay never removes stars')
      await actor(db, student)
      assert.ok((await startTest()).error, 'review still blocks the test')
      const reviewRun = await start(review)
      assert.equal((await answer(reviewRun.run_id, reviewExercise)).completed, true)
    })

    await t.test('test selection covers all objectives, requires double-sized pool, conceals grading and fails at 11/15', async () => {
      await admin()
      await db.query('UPDATE path_nodes SET test_size=16 WHERE id=$1', [testNode])
      await actor(db, student)
      assert.equal((await startTest()).error, 'test_pool_invalid', '30 pool items cannot support a 16-item test')
      await admin()
      await db.query('UPDATE path_nodes SET test_size=15 WHERE id=$1', [testNode])
      const thirdGoal = (await db.query('UPDATE learning_exercises SET goal_id=$1 WHERE node_id=$2 AND goal_id=$3 RETURNING id', [goals[0], testNode, goals[2]])).rows.map(row => row.id)
      await actor(db, student)
      assert.equal((await startTest()).error, 'test_pool_invalid', 'each objective needs at least one candidate')
      await admin()
      await db.query('UPDATE learning_exercises SET goal_id=$1 WHERE id=ANY($2::uuid[])', [goals[2], thirdGoal])
      await actor(db, student)
      await db.exec('SELECT setseed(0.314159)')
      const attempt = await startTest()
      assert.ok(attempt.attempt_id, JSON.stringify(attempt))
      assert.equal(attempt.total, 15)
      assert.equal(attempt.exercises.length, 15)
      withoutSolutions(attempt)
      completedAttempt = attempt
      await admin()
      const selection = (await db.query('SELECT DISTINCT goal_id FROM learning_exercises WHERE id=ANY($1::uuid[])', [attempt.exercises.map(exercise => exercise.id)])).rows.map(row => row.goal_id).sort()
      assert.deepEqual(selection, [...goals].sort())
      await actor(db, student)
      assert.ok((await call("finish_path_test($1,'en')", [attempt.attempt_id])).error, 'unfinished tests cannot be finalized')
      for (let n = 0; n < attempt.exercises.length; n++) {
        const response = await call('submit_path_test_answer($1,$2,$3)', [attempt.attempt_id, attempt.exercises[n].id, JSON.stringify({ index: n < 11 ? 0 : 1 })])
        assert.equal(response.saved, true, JSON.stringify(response))
        withoutSolutions(response)
      }
      assert.deepEqual((await db.query('SELECT * FROM path_test_answers WHERE attempt_id=$1', [attempt.attempt_id])).rows, [], 'in-progress rows must hide stored grades')
      const finished = await call("finish_path_test($1,'en')", [attempt.attempt_id])
      assert.equal(finished.passed, false, JSON.stringify(finished))
      assert.ok(Number(finished.percentage) < 80)
      assert.equal(finished.answers.length, 15)
      assert.ok(finished.answers.every(entry => 'answer' in entry && 'solution' in entry))
      assert.ok(finished.recommended_nodes.length > 0)
      assert.ok((await start(secondPractice)).error, '11/15 must not unlock path 2')
      assert.deepEqual(await call("finish_path_test($1,'en')", [attempt.attempt_id]), finished, 'finishing twice is stable')
    })

    await t.test('immediate second test has a different selection, passes at exactly 12/15 and never unlocks a level', async () => {
      // Reproduce the same random stream: the server must still guarantee a
      // different set, instead of relying only on improbable random collisions.
      await db.exec('SELECT setseed(0.314159)')
      const attempt = await startTest()
      passedAttempt = attempt
      assert.ok(attempt.attempt_id, JSON.stringify(attempt))
      assert.notEqual(attempt.attempt_id, completedAttempt.attempt_id)
      assert.notDeepEqual(attempt.exercises.map(exercise => exercise.id).sort(), completedAttempt.exercises.map(exercise => exercise.id).sort())
      await admin()
      const selection = (await db.query('SELECT DISTINCT goal_id FROM learning_exercises WHERE id=ANY($1::uuid[])', [attempt.exercises.map(exercise => exercise.id)])).rows.map(row => row.goal_id).sort()
      assert.deepEqual(selection, [...goals].sort())
      const access = (await db.query('SELECT * FROM student_level_access WHERE auth_user_id=$1 ORDER BY level', [student])).rows
      await actor(db, student)
      for (let n = 0; n < attempt.exercises.length; n++) await call('submit_path_test_answer($1,$2,$3)', [attempt.attempt_id, attempt.exercises[n].id, JSON.stringify({ index: n < 12 ? 0 : 1 })])
      const finished = await call("finish_path_test($1,'en')", [attempt.attempt_id])
      assert.equal(finished.passed, true, JSON.stringify(finished))
      assert.equal(Number(finished.percentage), 80)
      assert.ok((await start(secondPractice)).run_id, 'path 2 unlocks after path 1 test passes')
      await admin()
      assert.deepEqual((await db.query('SELECT * FROM student_level_access WHERE auth_user_id=$1 ORDER BY level', [student])).rows, access)
      await actor(db, student)
    })

    await t.test('optional branches do not block completion; SOFT_ERROR counts and level completion never grants another level', async () => {
      await admin()
      const notifications = (await db.query('SELECT count(*)::int count FROM private.mail_outbox')).rows[0].count
      await db.query("UPDATE learning_exercises SET type='fill_in_blank',content=$1 WHERE id=$2", [JSON.stringify({ target_form: ['Häuser'], text_before: 'Das sind', text_after: '.', correct_answer: 'Häuser', accepted_answers: ['Häuser'] }), id(9230)])
      await actor(db, student)
      const branch = await start(special)
      const soft = await call("submit_path_answer($1,$2,$3,$4,'en')", [branch.run_id, id(9230), JSON.stringify({ text: 'Haeuser' }), id(request++)])
      assert.equal(soft.grade.status, 'SOFT_ERROR', JSON.stringify(soft))
      assert.equal(soft.completed, true)
      assert.equal(soft.stars, 3)
      for (const [node, exercise] of [[secondPractice, id(9400)], [secondReview, id(9410)]]) {
        const run = await start(node)
        assert.equal((await answer(run.run_id, exercise)).completed, true)
      }
      const exam = await call("start_path_test($1,'en')", [secondTest])
      for (const exercise of exam.exercises) await call('submit_path_test_answer($1,$2,$3)', [exam.attempt_id, exercise.id, JSON.stringify({ index: 0 })])
      assert.equal((await call("finish_path_test($1,'en')", [exam.attempt_id])).passed, true)
      const map = await call("get_learning_path('A1.1','en')")
      assert.equal(map.completed, true)
      assert.equal(map.next_level, 'A1.2')
      assert.equal(map.next_level_available, false)
      assert.ok((await call("get_learning_path('A1.2','en')")).error)
      await admin()
      assert.equal((await db.query('SELECT count(*)::int count FROM private.mail_outbox')).rows[0].count, notifications, 'completion sends no notification')
      await db.query("INSERT INTO student_level_access VALUES($1,'A1.2')", [student])
      await actor(db, student)
      assert.equal((await call("get_learning_path('A1.1','en')")).next_level_available, true)
      assert.deepEqual((await call("get_learning_path('A1.2','en')")).paths, [], 'unpopulated unlocked levels have a truthful empty map')
    })

    await t.test('another learner cannot read or mutate attempts, answers, runs or personal progress', async () => {
      await admin()
      await db.query("INSERT INTO student_level_access VALUES($1,'A1.1')", [outsider])
      await actor(db, outsider)
      for (const table of ['path_node_progress', 'path_practice_runs', 'path_test_attempts']) assert.deepEqual((await db.query(`SELECT * FROM ${table} WHERE auth_user_id=$1`, [student])).rows, [], table)
      assert.deepEqual((await db.query('SELECT * FROM path_test_answers WHERE attempt_id=$1', [passedAttempt.attempt_id])).rows, [])
      assert.ok((await call("finish_path_test($1,'en')", [passedAttempt.attempt_id])).error)
      assert.ok((await call('submit_path_test_answer($1,$2,\'{"index":0}\'::jsonb)', [passedAttempt.attempt_id, passedAttempt.exercises[0].id])).error)
      assert.ok((await call("manage_learning_path($1,$2,'unlock',null)", [student, unit2])).error)
      await actor(db, teacher)
      assert.ok((await db.query('SELECT * FROM path_test_attempts WHERE auth_user_id=$1', [student])).rows.length >= 2)
    })

    await t.test('staff may unlock paths and reset a test independently or a whole path with its child state', async () => {
      let response = await call("manage_learning_path($1,$2,'unlock',null)", [outsider, unit2])
      assert.ok(!response.error, JSON.stringify(response))
      await actor(db, outsider)
      assert.ok((await start(secondPractice)).run_id)
      await actor(db, teacher)
      response = await call("manage_learning_path($1,$2,'reset_test',$3)", [student, unit1, testNode])
      assert.ok(!response.error, JSON.stringify(response))
      await admin()
      assert.equal((await db.query('SELECT count(*)::int count FROM path_test_attempts WHERE auth_user_id=$1 AND node_id=$2', [student, testNode])).rows[0].count, 0)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_node_progress WHERE auth_user_id=$1 AND node_id=$2', [student, practice])).rows[0].count, 1)
      await actor(db, teacher)
      response = await call("manage_learning_path($1,$2,'reset_path',null)", [student, unit1])
      assert.ok(!response.error, JSON.stringify(response))
      await admin()
      for (const table of ['path_node_progress', 'path_practice_runs', 'path_test_attempts']) assert.equal((await db.query(`SELECT count(*)::int count FROM ${table} x JOIN path_nodes n ON n.id=x.node_id WHERE x.auth_user_id=$1 AND n.unit_id=$2`, [student, unit1])).rows[0].count, 0, table)
      assert.deepEqual((await db.query('SELECT action,created_by FROM path_interventions WHERE auth_user_id=$1', [student])).rows, [{ action: 'reset_path', created_by: teacher }])
      await actor(db, student)
      assert.ok((await start(secondPractice)).error, 'clearing predecessor completion relocks path 2')
    })

    await t.test('level reset clears every personal path table while retaining content and another learner', async () => {
      await admin()
      await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.2','exercises','Anderes Niveau',1,true,'other-level','other-level','Anderes Niveau')", [id(9600)])
      await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'other-level','grammar','Anderes Prüfziel')", [id(9600)])
      await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,created_by) VALUES($1,$2,'other-level','practice',1,'Prüfknoten','Prüfung',$3,ARRAY['other-level'],$4)", [id(9601), id(9600), JSON.stringify({ rule: 'Wähle das erste Wort.', examples: ['Ja.'] }), teacher])
      await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'other-level','other-level',1,'Prüfung','multiple_choice',$4)", [id(9602), id(9600), id(9601), JSON.stringify(exerciseContent)])
      await actor(db, student)
      const otherLevel = await start(id(9601))
      assert.ok(otherLevel.run_id)
      await start(practice)
      await actor(db, teacher)
      const response = await call("reset_student_level_progress($1,'A1.1')", [student])
      assert.ok(!response?.error, JSON.stringify(response))
      await admin()
      for (const table of ['path_node_progress', 'path_practice_runs', 'path_test_attempts']) assert.equal((await db.query(`SELECT count(*)::int count FROM ${table} p JOIN path_nodes n ON n.id=p.node_id JOIN learning_units u ON u.id=n.unit_id WHERE p.auth_user_id=$1 AND u.level='A1.1'`, [student])).rows[0].count, 0, table)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_interventions WHERE auth_user_id=$1', [student])).rows[0].count, 0)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_practice_runs WHERE id=$1', [otherLevel.run_id])).rows[0].count, 1, 'other levels retain progress')
      assert.ok((await db.query('SELECT count(*)::int count FROM path_practice_runs WHERE auth_user_id=$1', [outsider])).rows[0].count > 0)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_nodes')).rows[0].count, 8)
    })

    await t.test('full learner reset removes path data across levels and blocks concurrent learning until completion', async () => {
      await actor(db, student)
      const run = await start(practice)
      assert.ok(run.run_id)
      assert.ok(!((await answer(run.run_id, firstExercise)).error))
      const active = await call('get_last_active_level()')
      assert.deepEqual([active.level, active.mode, active.source], ['A1.1', 'exercises', 'activity'], 'path answers participate in the existing continue-learning RPC')
      const token = await call("begin_learning_reset('RESET_LEARNING_DATA')")
      assert.equal(typeof token, 'string', JSON.stringify(token))
      assert.equal((await start(practice)).error, 'learning_reset_in_progress')
      assert.equal((await answer(run.run_id, run.queue[1])).error, 'learning_reset_in_progress')
      assert.equal(await call('finish_learning_reset($1)', [token]), true)
      await admin()
      for (const table of ['path_node_progress', 'path_practice_runs', 'path_test_attempts', 'path_interventions']) assert.equal((await db.query(`SELECT count(*)::int count FROM ${table} WHERE auth_user_id=$1`, [student])).rows[0].count, 0, table)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_private.answer_receipts WHERE run_id=$1', [run.run_id])).rows[0].count, 0)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_private.practice_items WHERE run_id=$1', [run.run_id])).rows[0].count, 0)
      assert.ok((await db.query('SELECT count(*)::int count FROM path_practice_runs WHERE auth_user_id=$1', [outsider])).rows[0].count > 0)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_nodes')).rows[0].count, 8)
    })

    await t.test('pre-generated listening audio is staff-writable and learner-readable only after an eligible task starts', async () => {
      await admin()
      for (const exercise of [firstExercise, id(9300)]) {
        const prefix = `/storage/v1/object/authenticated/path-audio/${exercise}`
        await db.query("UPDATE learning_exercises SET type='listening',content=$1 WHERE id=$2", [JSON.stringify({ target_form: ['Gruß'], transcript: 'Ja.', audio: { normal: `${prefix}/normal.mp3`, slow: `${prefix}/slow.mp3` }, exercise: { type: 'multiple_choice', content: exerciseContent } }), exercise])
      }
      await actor(db, teacher)
      for (const exercise of [firstExercise, id(9300)]) for (const speed of ['normal', 'slow']) {
        await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('path-audio',$1)", [`${exercise}/${speed}.mp3`])
      }
      assert.equal((await db.query("UPDATE storage.objects SET metadata='{\"fixture\":true}' WHERE bucket_id='path-audio' RETURNING id")).rows.length, 4)
      await actor(db, student)
      assert.deepEqual((await db.query("SELECT name FROM storage.objects WHERE bucket_id='path-audio'")).rows, [], 'neither practice audio nor test-pool audio is visible before a start')
      const opened = await start(practice)
      assert.ok(opened.run_id, JSON.stringify(opened))
      withoutSolutions(opened.exercises)
      const audio = (await db.query("SELECT name FROM storage.objects WHERE bucket_id='path-audio' ORDER BY name")).rows.map(row => row.name)
      assert.deepEqual(audio, [`${firstExercise}/normal.mp3`, `${firstExercise}/slow.mp3`])
      await admin()
      await db.query("UPDATE learning_exercises SET content=jsonb_set(jsonb_set(content,'{audio,normal}',to_jsonb($1::text)),'{audio,slow}',to_jsonb($2::text)) WHERE id=$3", [`/storage/v1/object/authenticated/path-audio/${firstExercise}/new-normal.mp3`, `/storage/v1/object/authenticated/path-audio/${firstExercise}/new-slow.mp3`, firstExercise])
      await actor(db, student)
      assert.deepEqual((await db.query("SELECT name FROM storage.objects WHERE bucket_id='path-audio' ORDER BY name")).rows.map(row => row.name), audio, 'an active run keeps its snapshotted audio after a content edit')
      await assert.rejects(db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('path-audio','forbidden.mp3')"), error => error.code === '42501')
      assert.equal((await db.query("UPDATE storage.objects SET metadata='{}' WHERE bucket_id='path-audio' RETURNING id")).rows.length, 0)
      await actor(db, outsider)
      assert.deepEqual((await db.query("SELECT name FROM storage.objects WHERE bucket_id='path-audio'")).rows, [], 'another learner cannot reuse the first learner’s start')
    })

    await t.test('DDL is idempotent; rollback preserves archived data and reapplication restores the API', async () => {
      await admin()
      const definitions = async () => (await db.query("SELECT proname,md5(pg_get_functiondef(oid)) definition_digest,proacl::text acl FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=ANY($1::text[]) ORDER BY proname", [rpcSignatures.map(signature => signature.split('(')[0])])).rows
      const before = await definitions()
      const contentBefore = (await db.query('SELECT id,content FROM learning_exercises ORDER BY id')).rows
      for (const migration of learningPathMigrations) await apply(db, [migration])
      assert.deepEqual(await definitions(), before)
      assert.deepEqual((await db.query('SELECT id,content FROM learning_exercises ORDER BY id')).rows, contentBefore)
      await db.exec('BEGIN;' + await readFile(new URL('../vps/rollback/35_path_learning.sql', import.meta.url), 'utf8') + 'COMMIT;')
      assert.deepEqual((await db.query('SELECT id,content FROM learning_exercises ORDER BY id')).rows, contentBefore)
      await apply(db, ['35_path_learning.sql'])
      assert.deepEqual(await definitions(), before)
      assert.deepEqual((await db.query('SELECT id,content FROM learning_exercises ORDER BY id')).rows, contentBefore)
    })
  } finally { await db.close() }
})
