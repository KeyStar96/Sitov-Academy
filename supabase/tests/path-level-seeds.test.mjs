import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, actor, student, result } from './helpers/current-db.mjs'

// The learning path logic (serial unlocking, test sample, 80 % rule, task translation) is
// level-independent SQL. These seeds must run through it unchanged: imported by the same
// service RPC as A1.1, played in every interface language and passed from 80 %.
const LEVELS = [{ level: 'A1.2', cefr: 'A1', order: 2 }, { level: 'A2.1', cefr: 'A2', order: 3 }, { level: 'A2.2', cefr: 'A2', order: 4 },
  { level: 'B1.1', cefr: 'B1', order: 5 }]
const LOCALES = ['en', 'ru', 'uk', 'tr']
const CYRILLIC = /[Ѐ-ӿ]/
const call = (db, fn, params = []) => result(db, `SELECT ${fn} result`, params)
const as = async (db, user, role) => { await db.exec('RESET ROLE'); await actor(db, user, role) }

/** The tile order that composes the solution, found from the presented (shuffled) parts. */
function tileOrder(parts, solution) {
  const target = solution.replace(/[.?!]$/, '')
  const search = (rest, used) => {
    if (used.length === parts.length) return rest === '' ? used : null
    for (const [index, part] of parts.entries()) {
      if (used.includes(index) || !rest.startsWith(part)) continue
      const next = rest.slice(part.length)
      const found = next === '' || next.startsWith(' ') ? search(next.trimStart(), [...used, index]) : null
      if (found) return found
    }
    return null
  }
  return search(target, [])
}

function answerFor(shown, source, correct) {
  if (shown.type === 'multiple_choice') {
    const right = shown.content.options.indexOf(source.content.correct_answer)
    assert.notEqual(right, -1, `${source.ref}: the solution is one of the presented options`)
    return { index: correct ? right : (right + 1) % shown.content.options.length }
  }
  if (shown.type === 'fill_in_blank') return { text: correct ? source.content.correct_answer : 'falsch' }
  const order = tileOrder(shown.content.parts, source.content.correct_answer)
  assert.ok(order, `${source.ref}: the parts compose the solution`)
  return { indices: correct ? order : [...order.slice(1), order[0]] }
}

for (const { level, cefr, order } of LEVELS) {
  await test(`${level} learning path seed runs through the existing path logic`, async t => {
    const seed = JSON.parse(await readFile(new URL(`../seeds/path-${level.toLowerCase()}.json`, import.meta.url), 'utf8'))
    const source = new Map(seed.flatMap(path => path.nodes.flatMap(node => node.exercises.map(exercise => [exercise.id, exercise]))))
    const db = await createCurrentDatabase()
    const map = locale => call(db, 'public.get_learning_path($1,$2)', [level, locale])
    /** Plays one test attempt with exactly `right` correct answers. */
    const attempt = async (nodeId, locale, right) => {
      const started = await call(db, 'public.start_path_test($1,$2)', [nodeId, locale])
      assert.ok(started.attempt_id, JSON.stringify(started))
      for (const [index, shown] of started.exercises.entries()) {
        const saved = await call(db, 'public.submit_path_test_answer($1,$2,$3)',
          [started.attempt_id, shown.id, JSON.stringify(answerFor(shown, source.get(shown.id), index < right(started.total)))])
        assert.equal(saved.saved, true, JSON.stringify(saved))
      }
      return { started, finished: await call(db, 'public.finish_path_test($1,$2)', [started.attempt_id, locale]) }
    }
    try {
      await db.query('INSERT INTO cefr_levels VALUES($1) ON CONFLICT DO NOTHING', [cefr])
      await db.query('INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [level, cefr, order])
      await db.query('INSERT INTO student_level_access VALUES($1,$2) ON CONFLICT DO NOTHING', [student, level])

      await t.test('the service import accepts the whole level atomically and is repeatable', async () => {
        await as(db, null, 'service_role')
        const expected = {
          path_count: seed.length, node_count: seed.reduce((sum, path) => sum + path.nodes.length, 0),
          exercise_count: source.size, objective_count: seed.reduce((sum, path) => sum + path.objectives.length, 0),
        }
        for (const round of [1, 2]) {
          const imported = await call(db, 'public.import_learning_path_seed($1::jsonb)', [JSON.stringify(seed)])
          assert.ok(!imported.error, JSON.stringify(imported))
          for (const [key, value] of Object.entries(expected)) assert.equal(imported[key], value, `${key} (import ${round})`)
        }
        await db.exec('RESET ROLE')
        const ready = (await db.query(`SELECT e.content_status::text status,count(*)::int n FROM learning_exercises e
          JOIN learning_units u ON u.id=e.unit_id WHERE u.is_path AND u.level=$1 AND e.path_is_active GROUP BY 1`, [level])).rows
        assert.deepEqual(ready, [{ status: 'ready', n: source.size }], 'every task is released as ready')
      })

      await t.test('the map, the rule cards and the tasks follow the interface language', async () => {
        await as(db, student)
        for (const locale of LOCALES) {
          const shown = await map(locale)
          assert.equal(shown.level, level)
          assert.deepEqual(shown.paths.map(path => path.title), seed.map(path => path.translations[locale].title), locale)
          assert.deepEqual(shown.paths.map(path => path.available), seed.map((_, index) => index === 0), 'only the first path is open')
          for (const path of shown.paths) assert.equal(path.nodes.at(-1).available, true, 'tests are always open (43)')
        }
        const lesson = (await map('tr')).paths[0].nodes[0]
        const run = await call(db, 'public.start_path_node($1,$2)', [lesson.id, 'tr'])
        assert.ok(run.run_id, JSON.stringify(run))
        assert.equal(run.merkkarte.rule, seed[0].nodes[0].merkkarte.translations.tr.rule)
        assert.equal(run.exercises.length, seed[0].nodes[0].exercises.length)
        let last
        for (const shown of run.exercises) {
          const task = source.get(shown.id)
          assert.equal(shown.content.instruction, task.translations.tr.instruction, 'the work instruction is translated')
          assert.equal(shown.translation?.task, task.translations.tr.task, 'the task comes with its translation')
          assert.ok(!('correct_answer' in shown.content) && !('accepted_answers' in shown.content), 'no solution before grading')
          last = await call(db, 'public.submit_path_answer($1,$2,$3,$4,$5)',
            [run.run_id, shown.id, JSON.stringify(answerFor(shown, task, true)), randomUUID(), 'tr'])
          assert.equal(last.grade?.correct, true, `${task.ref}: ${JSON.stringify(last)}`)
          assert.equal(last.solution.explanation, task.translations.tr.explanation)
        }
        assert.equal(last.completed, true)
        assert.equal(last.stars, 3)
      })

      await t.test('every stored solution is graded as correct, every wrong choice as incorrect', async () => {
        await db.exec('RESET ROLE')
        for (const task of source.values()) {
          const shown = { type: task.exercise_type, content: task.content }
          for (const correct of [true, false]) {
            const grade = await call(db, 'path_private.grade($1::exercise_type,$2::jsonb,$3::jsonb)',
              [task.exercise_type, JSON.stringify(task.content), JSON.stringify(answerFor(shown, task, correct))])
            assert.equal(grade.correct, correct, `${task.ref}: ${JSON.stringify(grade)}`)
          }
          // Every accepted alternative of a gap is typed text and must pass as well.
          if (task.exercise_type === 'fill_in_blank') for (const accepted of task.content.accepted_answers) {
            const grade = await call(db, 'path_private.grade($1::exercise_type,$2::jsonb,$3::jsonb)',
              [task.exercise_type, JSON.stringify(task.content), JSON.stringify({ text: accepted })])
            assert.equal(grade.correct, true, `${task.ref}: ${accepted}`)
          }
        }
      })

      await t.test('no gap lets a stored wrong form pass as a typing error', async () => {
        // grade_answer forgives one wrong letter in words of four letters and more; the stored wrong
        // forms of a gap (einem/einer) are exempt from that in lessons, reviews and tests (58).
        await db.exec('RESET ROLE')
        const leaks = []
        for (const task of source.values()) {
          if (task.exercise_type !== 'fill_in_blank') continue
          for (const wrong of task.content.options.filter(option => !task.content.accepted_answers.includes(option))) {
            const grade = await call(db, 'path_private.grade($1::exercise_type,$2::jsonb,$3::jsonb)',
              [task.exercise_type, JSON.stringify(task.content), JSON.stringify({ text: wrong })])
            if (grade.correct) leaks.push(`${task.ref}: ${wrong} (${grade.status})`)
          }
        }
        assert.deepEqual(leaks, [])
      })

      await t.test('a test covers every objective, fails below 80 % and unlocks the next path from 80 %', async () => {
        await as(db, student)
        for (const [index, path] of seed.entries()) {
          const node = (await map('ru')).paths[index].nodes.at(-1)
          const size = path.nodes.at(-1).test_size
          // One correct answer short of the threshold: e.g. 10 of 13 = 76.9 %.
          const needed = Math.ceil(size * 0.8)
          const failed = await attempt(node.id, 'ru', () => needed - 1)
          assert.equal(failed.started.total, size)
          assert.deepEqual([...new Set(failed.started.exercises.map(shown => source.get(shown.id).goal))].sort(),
            path.objectives.map(objective => objective.id).sort(), `${path.id}: every objective is tested`)
          for (const shown of failed.started.exercises) {
            assert.match(shown.content.instruction, CYRILLIC, 'instructions follow the interface language')
            assert.equal(shown.translation?.task, source.get(shown.id).translations.ru.task)
          }
          assert.equal(failed.finished.passed, false, `${path.id}: ${failed.finished.percentage} %`)
          assert.ok(Number(failed.finished.percentage) < 80)
          assert.ok(failed.finished.recommended_nodes.length > 0, 'a failed test recommends lessons')
          assert.equal((await map('ru')).paths[index].completed, false)
          if (index + 1 < seed.length) assert.equal((await map('ru')).paths[index + 1].available, false, 'the next path stays locked')

          const passed = await attempt(node.id, 'ru', () => needed)
          assert.notDeepEqual(passed.started.exercises.map(shown => shown.id).sort(), failed.started.exercises.map(shown => shown.id).sort(),
            'a new attempt draws a different sample')
          assert.equal(passed.finished.passed, true, `${path.id}: ${passed.finished.percentage} %`)
          assert.ok(Number(passed.finished.percentage) >= 80)
          const after = await map('ru')
          assert.equal(after.paths[index].completed, true)
          if (index + 1 < seed.length) assert.equal(after.paths[index + 1].available, true, 'the next path opens')
        }
        assert.equal((await map('ru')).completed, true, 'all path tests passed = level completed')
      })
    } finally { await db.close() }
  })
}
