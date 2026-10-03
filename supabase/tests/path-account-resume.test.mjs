import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCurrentDatabase, currentFeatureMigrations, actor, id, student, teacher, outsider, result } from './helpers/current-db.mjs'

const unit = id(610100), practice = id(610101), exam = id(610102)
const tasks = [id(610110), id(610111)], examTasks = [id(610120), id(610121), id(610122), id(610123)]
const content = JSON.stringify({ target_form: ['Ja'], question: 'Wähle Ja.', options: ['Ja', 'Nein'], correct_answer: 'Ja', accepted_answers: ['Ja'] })
const as = async (db, user) => { await db.exec('RESET ROLE'); await actor(db, user) }
const call = (db, fn, params = []) => result(db, `SELECT ${fn} result`, params)

test('Sitov Academy account path checkpoints survive device changes and reject stale overwrites', async t => {
  const db = await createCurrentDatabase({ latest: [...currentFeatureMigrations, '59_daily_quests.sql', '60_daily_quest_resume.sql', '61_account_learning_checkpoints.sql'] })
  try {
    await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Kontopfad',1,true,'sitov-account-fixture','sitov-account-fixture','Kontopfad')", [unit])
    await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'sitov-goal','grammar','Prüfziel')", [unit])
    for (const [node, kind, order] of [[practice, 'practice', 1], [exam, 'test', 2]]) {
      await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals,test_size) VALUES($1,$2,$3,$4,$5,'Kontostation','Kontothema',$6,ARRAY['sitov-goal'],$7)",
        [node, unit, `sitov-account-${kind}`, kind, order, kind === 'test' ? null : JSON.stringify({ rule: 'Wähle Ja.', examples: ['Ja.'] }), kind === 'test' ? 2 : null])
      for (const [index, task] of (kind === 'test' ? examTasks : tasks).entries()) {
        await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'sitov-goal',$4,$5,'Kontothema','multiple_choice',$6)", [task, unit, node, `sitov-account-${task}`, index + 1, content])
      }
    }
    await as(db, student)
    let run, attempt
    await t.test('a new device reads the same saved practice queue, including an incorrect answer rotation', async () => {
      run = await call(db, "start_path_node($1,'en')", [practice])
      const wrong = await call(db, "submit_path_answer($1,$2,'{\"index\":1}'::jsonb,$3,'en')", [run.run_id, tasks[0], id(610150)])
      assert.deepEqual(wrong.queue, [tasks[1], tasks[0]])
      // Fresh cookie/JWT client, no React state or browser storage carried over.
      await as(db, student)
      const map = await call(db, "get_learning_path('A1.1','en')")
      assert.equal(map.resume_node_id, practice)
      const resumed = await call(db, "start_path_node($1,'en')", [map.resume_node_id])
      assert.equal(resumed.run_id, run.run_id)
      assert.deepEqual(resumed.queue, wrong.queue)
      const correct = await call(db, "submit_path_answer($1,$2,'{\"index\":0}'::jsonb,$3,'en')", [run.run_id, tasks[1], id(610151)])
      assert.deepEqual(correct.queue, [tasks[0]])
      await call(db, "submit_path_answer($1,$2,'{\"index\":0}'::jsonb,$3,'en')", [run.run_id, tasks[0], id(610152)])
      assert.equal((await call(db, "get_learning_path('A1.1','en')")).resume_node_id, null)
    })
    await t.test('another device resumes unanswered exam tasks and cannot replace an already saved answer', async () => {
      attempt = await call(db, "start_path_test($1,'en')", [exam])
      const first = attempt.exercises[0].id
      assert.deepEqual(await call(db, "submit_path_test_answer($1,$2,'{\"index\":0}'::jsonb)", [attempt.attempt_id, first]), { saved: true })
      await as(db, student)
      assert.equal((await call(db, "get_learning_path('A1.1','en')")).resume_node_id, exam)
      const resumed = await call(db, "start_path_test($1,'en')", [exam])
      assert.equal(resumed.attempt_id, attempt.attempt_id)
      assert.deepEqual(resumed.exercises[0].answer, { index: 0 })
      assert.equal(resumed.exercises[1].answer, null)
      assert.deepEqual(await call(db, "submit_path_test_answer($1,$2,'{\"index\":0}'::jsonb)", [attempt.attempt_id, first]), { saved: true }, 'lost responses may be replayed safely')
      assert.equal((await call(db, "submit_path_test_answer($1,$2,'{\"index\":1}'::jsonb)", [attempt.attempt_id, first])).error, 'request_conflict')
      assert.deepEqual((await call(db, "start_path_test($1,'en')", [exam])).exercises[0].answer, { index: 0 })
    })
    await t.test('a different account never sees or mutates the saved checkpoint', async () => {
      await as(db, outsider)
      assert.ok((await call(db, "get_learning_path('A1.1','en')")).error)
      assert.equal((await call(db, "submit_path_test_answer($1,$2,'{\"index\":0}'::jsonb)", [attempt.attempt_id, attempt.exercises[1].id])).error, 'attempt_unavailable')
      assert.deepEqual((await db.query('SELECT id FROM path_test_attempts')).rows, [])
    })
    await t.test('reset clears resumability and blocks the old device from reviving a stale exam', async () => {
      await as(db, teacher)
      assert.equal((await call(db, "manage_learning_path($1,$2,'reset_test',$3,$4)", [student, unit, exam, id(610153)])).success, true)
      await as(db, student)
      assert.equal((await call(db, "get_learning_path('A1.1','en')")).resume_node_id, null)
      assert.equal((await call(db, "submit_path_test_answer($1,$2,'{\"index\":0}'::jsonb)", [attempt.attempt_id, attempt.exercises[1].id])).error, 'attempt_unavailable')
      const restarted = await call(db, "start_path_test($1,'en')", [exam])
      assert.notEqual(restarted.attempt_id, attempt.attempt_id)
      assert.ok(restarted.exercises.every(exercise => exercise.answer === null))
    })
  } finally { await db.close() }
})
