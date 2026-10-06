import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, currentFeatureMigrations, apply, actor, id, student, result } from './helpers/current-db.mjs'

const migration = '58_path_authored_wrong_forms.sql'
// Every released path seed: no stored wrong form of any gap may pass, in lessons, reviews and tests.
const SEEDS = ['path-a1.1.json', 'path-a1.2.json', 'path-a2.1.json', 'path-a2.2.json', 'path-b1.1.json', 'path-b1.2.json', 'path-b2.1.json']
const unit = id(58100), node = id(58101)
const base = { target_form: ['Dativ'], instruction: 'Ergänze die Form.' }
const dative = { ...base, text_before: 'Ich arbeite seit ', text_after: ' Jahr hier.', gap_hint: 'ein', correct_answer: 'einem', options: ['einen', 'einem', 'einer'], accepted_answers: ['einem'] }
const umlaut = { ...base, text_before: 'Er ', text_after: ' nach Köln.', gap_hint: 'fahren', correct_answer: 'fährt', options: ['fahrt', 'fährt', 'fahren'], accepted_answers: ['fährt'] }
const plain = { ...base, text_before: 'Ihr ', text_after: ' nach Köln.', gap_hint: 'fahren', correct_answer: 'fahrt', options: ['fährt', 'fahrt', 'fahren'], accepted_answers: ['fahrt'] }
const word = { ...base, text_before: 'Ich habe eine ', text_after: '.', correct_answer: 'Krankenversicherung', options: ['Krankenversicherung', 'Krankenschwester', 'Krankmeldung'], accepted_answers: ['Krankenversicherung'] }
const listening = { ...base, transcript: 'Ich arbeite seit einem Jahr hier.', audio: { normal: '/audio/normal.wav', slow: '/audio/slow.wav' }, exercise: { type: 'fill_in_blank', content: dative } }
const signatures = ['learning_private.grade_answer(text,text[])', 'learning_private.normalize_answer(text)', 'learning_private.answer_without_punctuation(text)']
const catalog = async (db, names = signatures) => (await db.query(`SELECT oid::regprocedure::text name,proowner,proacl::text acl,prosecdef,proconfig,
 pg_get_functiondef(oid) definition FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY 1`, [names])).rows
const metadata = rows => rows.map(entry => Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'definition')))
const pathGrade = (db, type, content, answer) => result(db, 'SELECT path_private.grade($1::exercise_type,$2::jsonb,$3::jsonb) result', [type, JSON.stringify(content), JSON.stringify(answer)])

await test('authored wrong forms of a gap withdraw the typing tolerance (58)', async t => {
  // The schema right before 58, so that the migration's own effect is measured.
  const db = await createCurrentDatabase({ latest: currentFeatureMigrations.filter(name => name !== migration) })
  await db.query("INSERT INTO learning_units(id,level,trainer,label,sort_order,is_path,path_source_id,path_slug,path_title) VALUES($1,'A1.1','exercises','Formen',1,true,'forms','forms','Formen')", [unit])
  await db.query("INSERT INTO path_objectives(unit_id,id,area,description) VALUES($1,'goal','grammar','Dativ nach seit')", [unit])
  await db.query("INSERT INTO path_nodes(id,unit_id,source_id,kind,sort_order,title,topic,merkkarte,goals) VALUES($1,$2,'forms-node','practice',1,'Formen','Dativ',$3,ARRAY['goal'])", [node, unit, { rule: 'seit + Dativ.', examples: ['seit einem Jahr'] }])
  for (const [index, [type, content]] of [['fill_in_blank', dative], ['fill_in_blank', word]].entries())
    await db.query("INSERT INTO learning_exercises(id,unit_id,node_id,goal_id,source_ref,sort_order,topic,type,content) VALUES($1,$2,$3,'goal',$4,$5,'Dativ',$6,$7)", [id(58200 + index), unit, node, `forms-${index}`, index + 1, type, content])
  const previous = await catalog(db)
  const previousGrade = await catalog(db, ['path_private.grade(public.exercise_type,jsonb,jsonb)'])
  const before = await pathGrade(db, 'fill_in_blank', dative, { text: 'einer' })
  assert.equal(before.status, 'SOFT_ERROR', 'reproduces the gap before 58: the wrong form counts as a typo')
  assert.equal(before.correct, true)
  await apply(db, [migration])
  const formGrade = (input, accepted, wrong) => result(db, 'SELECT learning_private.grade_form_answer($1,$2::text[],$3::text[]) result', [input, accepted, wrong])
  const plainGrade = (input, accepted) => result(db, 'SELECT learning_private.grade_answer($1,$2::text[]) result', [input, accepted])
  try {
    await t.test('the migration keeps the shared grading helpers, owners and privileges and is repeatable', async () => {
      assert.deepEqual(await catalog(db), previous, 'grade_answer and its helpers are untouched')
      const current = await catalog(db, ['path_private.grade(public.exercise_type,jsonb,jsonb)'])
      assert.deepEqual(metadata(current), metadata(previousGrade))
      const helper = await catalog(db, ['learning_private.grade_form_answer(text,text[],text[])'])
      await apply(db, [migration])
      assert.deepEqual(await catalog(db, ['path_private.grade(public.exercise_type,jsonb,jsonb)']), current)
      assert.deepEqual(await catalog(db, ['learning_private.grade_form_answer(text,text[],text[])']), helper)
      assert.equal(helper[0].prosecdef, true)
      assert.deepEqual(helper[0].proconfig, ['search_path=""'])
      const timestamped = await readFile(new URL('../migrations/20261002164126_path_authored_wrong_forms.sql', import.meta.url), 'utf8')
      assert.equal(timestamped, await readFile(new URL(`../vps/${migration}`, import.meta.url), 'utf8'))
      assert.ok((await readFile(new URL('../schema.sql', import.meta.url), 'utf8')).includes(`-- Consolidated correction: ${migration}\n${timestamped}`))
    })

    await t.test('a tolerated answer that equals a stored wrong form is incorrect', async () => {
      for (const [input, accepted, wrong] of [
        ['einer', ['einem'], ['einen', 'einem', 'einer']], ['Einer.', ['einem'], ['einen', 'einem', 'einer']],
        ['EINEN', ['einem'], ['einen', 'einer']],
        // A missing umlaut is a different verb form, not a spelling variant.
        ['fahrt', ['fährt'], ['fahrt', 'fahren']], ['faehrt', ['fahrt'], ['fährt', 'fahren']],
        ['Masse', ['Maße'], ['Masse', 'Messe']], ['hilfst', ['hilft'], ['hilfst', 'helfen']],
        ['Sehr geehrte Frau Albers', ['Sehr geehrter Frau Albers'], ['Sehr geehrte Frau Albers']],
      ]) {
        assert.equal((await plainGrade(input, accepted)).status, 'SOFT_ERROR', `${input}: the plain tolerance accepts it`)
        assert.deepEqual(await formGrade(input, accepted, wrong), { status: 'INCORRECT', matched: null, reason: null, hint: null }, input)
      }
    })

    await t.test('a task that contrasts near-identical forms forgives no typo at all', async () => {
      // "einen" is not stored, but "einer" is one letter from the solution: the ending is the objective.
      for (const [input, accepted, wrong] of [
        ['einen', ['einem'], ['einer', 'ein']], ['eimem', ['einem'], ['einen', 'einer']], ['einm', ['einem'], ['einem', 'einer', 'ein']],
        ['fährtt', ['fährt'], ['fahrt', 'fahren']], ['hilff', ['hilft'], ['hilfst', 'helfen']],
        ['schönem', ['schönen'], ['schöne', 'schöner']],
      ]) {
        assert.equal((await plainGrade(input, accepted)).reason, 'typo', `${input}: the plain tolerance accepts it`)
        assert.equal((await formGrade(input, accepted, wrong)).status, 'INCORRECT', input)
      }
      // The solution spelled without an umlaut key is no typo and stays accepted there.
      assert.equal((await formGrade('faehrt', ['fährt'], ['fahrt', 'fährt', 'fahren'])).reason, 'umlaut')
      assert.equal((await formGrade('schoenen', ['schönen'], ['schöne', 'schöner'])).reason, 'umlaut')
    })

    await t.test('correct answers and typing errors in every other task keep their grade', async () => {
      for (const [input, accepted, wrong] of [
        ['einem', ['einem'], ['einen', 'einem', 'einer']], ['Einem', ['einem'], ['einen', 'einem', 'einer']],
        ['einem.', ['einem'], ['einen', 'einem', 'einer']],
        // The solution is part of the option list and may be typed with ae/oe/ue/ss.
        ['faehrt', ['fährt'], ['fahrt', 'fährt', 'fahren']], ['Strasse', ['Straße'], ['Straße', 'Strand']],
        // No stored form is close to the solution: a typing error stays a forgiven typo.
        ['Krankenversicherug', ['Krankenversicherung'], ['Krankenschwester', 'Krankmeldung']],
        ['Abnd', ['Abend'], ['Morgen', 'Nacht']], ['gegangn', ['gegangen'], ['gegeht', 'gehen']],
        // Wrong forms that the tolerance never accepted stay incorrect.
        ['den', ['dem'], ['den', 'der']], ['fahren', ['fährt'], ['fahrt', 'fahren']], ['völlig anders', ['einem'], ['einen']],
        ['einer', ['einem'], null], ['einer', ['einem'], []],
      ]) assert.deepEqual(await formGrade(input, accepted, wrong), await plainGrade(input, accepted), `${input} / ${accepted}`)
      assert.equal((await formGrade('Abnd', ['Abend'], ['Morgen', 'Nacht'])).reason, 'typo')
      // Invalid input keeps the error contract of grade_answer.
      assert.deepEqual(await formGrade('   ', ['einem'], ['einer']), await plainGrade('   ', ['einem']))
      assert.equal((await formGrade('   ', ['einem'], ['einer'])).error, 'invalid_answer')
      // Empty or missing entries in the wrong forms are ignored instead of failing the answer.
      assert.equal((await result(db, "SELECT learning_private.grade_form_answer('Abnd',ARRAY['Abend'],ARRAY[NULL,'',' ','Nacht']::text[]) result")).status, 'SOFT_ERROR')
    })

    await t.test('path grading applies the rule to gaps, also inside listening tasks, and to nothing else', async () => {
      for (const [content, wrong, right, typo, forgiven] of [[dative, 'einer', 'einem', 'eimem', false], [dative, 'Einen!', 'Einem', 'einm', false],
        [umlaut, 'fahrt', 'Fährt.', 'fährtt', false], [plain, 'faehrt', 'Fahrt', 'fahrrt', false],
        [word, 'Krankmeldung', 'krankenversicherung', 'Krankenversicherug', true]]) {
        const failed = await pathGrade(db, 'fill_in_blank', content, { text: wrong })
        assert.deepEqual([failed.status, failed.correct, failed.fields[0].status], ['INCORRECT', false, 'INCORRECT'], wrong)
        assert.equal((await pathGrade(db, 'fill_in_blank', content, { text: right })).status, 'EXACT', right)
        const typed = await pathGrade(db, 'fill_in_blank', content, { text: typo })
        assert.deepEqual([typed.status, typed.correct], forgiven ? ['SOFT_ERROR', true] : ['INCORRECT', false], typo)
      }
      // The solution itself may still be typed without an umlaut key.
      assert.deepEqual((({ status, fields }) => [status, fields[0].reason])(await pathGrade(db, 'fill_in_blank', umlaut, { text: 'faehrt' })), ['SOFT_ERROR', 'umlaut'])
      assert.equal((await pathGrade(db, 'listening', listening, { text: 'einer' })).correct, false)
      assert.equal((await pathGrade(db, 'listening', listening, { text: 'einem' })).correct, true)
      // A gap without stored forms and a transform task keep the plain tolerance.
      const open = Object.fromEntries(Object.entries(dative).filter(([key]) => key !== 'options'))
      assert.equal((await pathGrade(db, 'fill_in_blank', open, { text: 'einer' })).status, 'SOFT_ERROR')
      assert.equal((await pathGrade(db, 'transform', { ...base, source: 'Er fährt.', accepted_answers: ['Fährt er?'] }, { text: 'Fahrt er?' })).status, 'SOFT_ERROR')
    })

    await t.test('a learner cannot complete a lesson step with a stored wrong form', async () => {
      await actor(db, student)
      const run = await result(db, "SELECT start_path_node($1,'ru') result", [node])
      assert.ok(run.run_id, JSON.stringify(run))
      const wrong = await result(db, "SELECT submit_path_answer($1,$2,$3,$4,'ru') result", [run.run_id, id(58200), { text: 'einer' }, id(58300)])
      assert.equal(wrong.grade?.correct, false, JSON.stringify(wrong))
      assert.equal(wrong.grade.status, 'INCORRECT')
      const typo = await result(db, "SELECT submit_path_answer($1,$2,$3,$4,'ru') result", [run.run_id, id(58201), { text: 'Krankenversicherug' }, id(58301)])
      assert.equal(typo.grade?.status, 'SOFT_ERROR', JSON.stringify(typo))
      for (const role of ['anon', 'authenticated', 'service_role']) {
        await db.exec('RESET ROLE')
        await actor(db, student, role)
        await assert.rejects(db.query("SELECT learning_private.grade_form_answer('a',ARRAY['a'],ARRAY['b'])"), error => error.code === '42501', role)
      }
      await db.exec('RESET ROLE')
    })

    for (const file of SEEDS) await t.test(`${file}: every solution passes and no stored wrong form does`, async () => {
      const seed = JSON.parse(await readFile(new URL(`../seeds/${file}`, import.meta.url), 'utf8'))
      const gaps = seed.flatMap(path => path.nodes.flatMap(entry => entry.exercises.filter(task => task.exercise_type === 'fill_in_blank')
        .map(task => ({ ref: `${path.id} ${task.ref} (${entry.kind})`, content: task.content }))))
      assert.ok(gaps.length > 100, `${gaps.length} gaps`)
      const leaks = []
      let neighbours = 0
      for (const { ref, content } of gaps) {
        for (const accepted of content.accepted_answers)
          if (!(await pathGrade(db, 'fill_in_blank', content, { text: accepted })).correct) leaks.push(`${ref}: solution ${accepted} rejected`)
        for (const wrong of content.options.filter(option => !content.accepted_answers.includes(option))) {
          if ((await plainGrade(wrong, content.accepted_answers)).status !== 'INCORRECT') neighbours += 1
          const grade = await pathGrade(db, 'fill_in_blank', content, { text: wrong })
          if (grade.correct) leaks.push(`${ref}: ${wrong} (${grade.status})`)
        }
      }
      assert.deepEqual(leaks, [])
      t.diagnostic(`${file}: ${gaps.length} gaps, ${neighbours} wrong forms within the typing tolerance are now incorrect`)
    })

    await t.test('the rollback restores the grading of 34 and removes the helper; reapply works', async () => {
      await db.exec('RESET ROLE')
      const current = await catalog(db, ['path_private.grade(public.exercise_type,jsonb,jsonb)'])
      await db.exec(`BEGIN;${await readFile(new URL(`../vps/rollback/${migration}`, import.meta.url), 'utf8')}COMMIT;`)
      assert.deepEqual(await catalog(db, ['path_private.grade(public.exercise_type,jsonb,jsonb)']), previousGrade)
      assert.deepEqual(await catalog(db), previous)
      assert.equal((await db.query("SELECT to_regprocedure('learning_private.grade_form_answer(text,text[],text[])') found")).rows[0].found, null)
      assert.equal((await pathGrade(db, 'fill_in_blank', dative, { text: 'einer' })).status, 'SOFT_ERROR')
      await apply(db, [migration])
      assert.deepEqual(await catalog(db, ['path_private.grade(public.exercise_type,jsonb,jsonb)']), current)
      assert.equal((await pathGrade(db, 'fill_in_blank', dative, { text: 'einer' })).status, 'INCORRECT')
    })
  } finally { await db.close() }
})
