import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { createLearningPathDatabase, actor, id, student, teacher, result } from './helpers/learning-path-db.mjs'

const require = createRequire(import.meta.url)
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
const { learningPathSeedSchema } = require('../../lib/learning-path-schema.ts')
const locales = ['en', 'ru', 'uk', 'tr']
const titleTranslations = Object.fromEntries(locales.map(locale => [locale, { title: `Fixture ${locale}` }]))
const translations = Object.fromEntries(locales.map(locale => [locale, { instruction: `Instruction ${locale}`, hint: `Hint ${locale}`, explanation: `Explanation ${locale}` }]))
const common = { target_form: ['Testform'], instruction: 'Prüfe die Testdaten.' }
const choice = { ...common, question: 'Testauswahl?', options: ['Ja', 'Nein'], correct_answer: 'Ja', accepted_answers: ['Ja'] }
const gap = { ...common, text_before: 'Test ', text_after: '.', correct_answer: 'Wort', accepted_answers: ['Wort'], needs_article: false }
const contentByType = {
  multiple_choice: choice, fill_in_blank: gap,
  sentence_building: { ...common, parts: ['Test', 'ist', 'Test'], correct_answer: 'Test ist Test.', accepted_answers: ['Test ist Test.'] },
  multi_blank: { ...common, text: 'Test {a}.', blanks: [{ id: 'a', accepted_answers: ['Wort'], needs_article: true }] },
  matching: { ...common, pairs: [{ id: 'a', left: 'Links', right: 'Rechts' }] },
  categorize: { ...common, categories: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], items: [{ id: 'item', text: 'Testkarte', category_id: 'a' }] },
  dialogue: { ...common, turns: [{ id: 'a', speaker: 'Person A', prompt: 'Test?', type: 'fill_in_blank', accepted_answers: ['Antwort'] }] },
  listening: { ...common, transcript: 'Testwort.', audio: { normal: '/audio/fixture.wav', slow: '/audio/fixture-slow.wav' }, exercise: { type: 'fill_in_blank', content: gap } },
  transform: { ...common, source: 'Testsatz.', accepted_answers: ['Testfrage?'], needs_article: true },
}

/** Artificial source contract fixture only. The real curriculum is never imported. */
function fixture() {
  let sequence = 9700
  const exercise = (exercise_type = 'multiple_choice') => {
    const content = contentByType[exercise_type]
    return { id: id(sequence++), ref: `fixture-${sequence}`, goal: 'fixture-goal', exercise_type, content,
      ...(content.accepted_answers ? { accepted_answers: content.accepted_answers } : {}),
      hint: 'Testhinweis.', explanation: 'Testerklärung.', explanation_card: 'fixture-card', translations }
  }
  const node = (kind, sort_order, exercises) => ({ id: `fixture-${kind}`, kind, sort_order,
    topic: 'Vertragsprüfung', title: 'Prüfknoten', translations: titleTranslations, goals: ['fixture-goal'], exercises })
  return {
    id: 'fixture-import', level: 'A1.1', path: 1, slug: 'fixture-import', title: 'Importprüfung',
    translations: titleTranslations, unit: { level: 'A1.1', trainer: 'exercises', label: 'Importprüfung', sort_order: 1 },
    objectives: [{ id: 'fixture-goal', area: 'grammar', description: 'Künstliches Prüfziel.' }],
    nodes: [
      { ...node('practice', 1, Object.keys(contentByType).map(type => exercise(type))), merkkarte: {
        card: 'fixture-card', rule: 'Prüfregel.', examples: ['Testbeispiel.'], highlight: null,
        translations: Object.fromEntries(locales.map(locale => [locale, { rule: `Rule ${locale}` }])),
      } },
      node('review', 2, [exercise()]),
      { ...node('test', 3, [exercise(), exercise(), exercise(), exercise()]), test_size: 2 },
      { ...node('special', 4, [exercise()]), anchor_node_id: 'fixture-practice' },
    ],
  }
}

await test('path JSON import/export preserves source contracts and enforces staff writes', async t => {
  const db = await createLearningPathDatabase()
  const call = (sql, params = []) => result(db, `SELECT ${sql} result`, params)
  const source = fixture()
  const importPath = data => call('import_learning_path($1)', [JSON.stringify(data)])
  let unitId
  try {
    assert.deepEqual(learningPathSeedSchema.parse([source]), [source])

    await t.test('rejects student imports and exposes only structured RPC errors', async () => {
      await actor(db, student)
      assert.equal((await importPath(source)).error, 'not_authorized')
      assert.equal((await call('export_learning_path($1)', [id(9999)])).error, 'not_authorized')
      await actor(db, teacher)
      for (const signature of ['import_learning_path(jsonb)', 'export_learning_path(uuid)']) {
        const fn = (await db.query("SELECT prosecdef, proconfig, has_function_privilege('anon',oid,'EXECUTE') anonymous FROM pg_proc WHERE oid=$1::regprocedure", [`public.${signature}`])).rows[0]
        assert.deepEqual(fn, { prosecdef: true, proconfig: ['search_path=""'], anonymous: false })
      }
    })

    await t.test('imports all nine types with their original IDs and exports valid source JSON', async () => {
      const imported = await importPath(source)
      assert.ok(imported.unit_id, JSON.stringify(imported))
      unitId = imported.unit_id
      assert.equal(imported.node_count, 4)
      assert.equal(imported.exercise_count, 15)
      const exported = await call('export_learning_path($1)', [unitId])
      assert.ok(!exported.error, JSON.stringify(exported))
      assert.deepEqual(learningPathSeedSchema.parse([exported]), [exported])
      assert.deepEqual(exported, { ...source, is_active: true })
      assert.equal(exported.nodes[0].merkkarte.highlight, null)
      assert.ok(!('merkkarte' in exported.nodes[1]))
      assert.ok(!('accepted_answers' in exported.nodes[0].exercises.find(item => item.exercise_type === 'matching')))
    })

    await t.test('reimport uses the same unit, node and exercise identities', async () => {
      assert.ok(unitId, 'the initial fixture import must succeed')
      const before = await call('export_learning_path($1)', [unitId])
      const nodeIdsBefore = (await db.query('SELECT id,source_id FROM path_nodes WHERE unit_id=$1 ORDER BY sort_order', [unitId])).rows
      assert.equal((await importPath(source)).unit_id, unitId)
      assert.deepEqual(await call('export_learning_path($1)', [unitId]), before)
      assert.deepEqual((await db.query('SELECT id,source_id FROM path_nodes WHERE unit_id=$1 ORDER BY sort_order', [unitId])).rows, nodeIdsBefore)
    })

    await t.test('failed pool validation and mismatched answer mirrors roll back the entire import', async () => {
      assert.ok(unitId, 'the initial fixture import must succeed')
      const before = await call('export_learning_path($1)', [unitId])
      const invalidPool = structuredClone(source)
      invalidPool.title = 'Darf nicht gespeichert werden'
      invalidPool.nodes[2].test_size = 3
      assert.ok((await importPath(invalidPool)).error)
      assert.deepEqual(await call('export_learning_path($1)', [unitId]), before)
      const invalidAnswer = structuredClone(source)
      invalidAnswer.nodes[0].exercises[0].accepted_answers = ['Andere Antwort']
      assert.ok((await importPath(invalidAnswer)).error)
      assert.deepEqual(await call('export_learning_path($1)', [unitId]), before)
    })

    await t.test('rejects missing translations, malformed memory cards and duplicate source identities before writing', async () => {
      assert.ok(unitId, 'the initial fixture import must succeed')
      const before = await call('export_learning_path($1)', [unitId])
      const alterations = [
        data => { delete data.nodes[0].exercises[0].translations.uk },
        data => { data.nodes[0].exercises[0].translations.tr.hint = '   ' },
        data => { delete data.nodes[0].merkkarte.highlight },
        data => { data.nodes[0].merkkarte.examples = [] },
        data => { data.nodes[0].merkkarte.card = '' },
        data => { data.nodes.push(structuredClone(data.nodes[0])) },
        data => { data.objectives.push(structuredClone(data.objectives[0])) },
        data => { data.nodes[0].exercises.push(structuredClone(data.nodes[0].exercises[0])) },
        data => { data.nodes[0].exercises[0].unknown_field = 'ignored?' },
      ]
      for (const alter of alterations) {
        const invalid = structuredClone(source)
        alter(invalid)
        assert.equal((await importPath(invalid)).error, 'invalid_input')
        assert.deepEqual(await call('export_learning_path($1)', [unitId]), before)
      }
    })

    await t.test('German source fields and translated memory-card copy are stored separately', async () => {
      assert.ok(unitId, 'the initial fixture import must succeed')
      const row = (await db.query('SELECT n.merkkarte,t.rule FROM path_nodes n JOIN path_node_translations t ON t.node_id=n.id WHERE n.unit_id=$1 AND n.kind=\'practice\' AND t.locale=\'ru\'', [unitId])).rows[0]
      assert.ok(!('translations' in row.merkkarte))
      assert.equal(row.rule, 'Rule ru')
      const exported = await call('export_learning_path($1)', [unitId])
      const invalid = structuredClone(source)
      delete invalid.nodes[0].merkkarte.translations.uk
      assert.ok((await importPath(invalid)).error)
      assert.deepEqual(await call('export_learning_path($1)', [unitId]), exported)
    })

    await t.test('omitted optional nodes are archived and can be restored using the same identities', async () => {
      assert.ok(unitId, 'the initial fixture import must succeed')
      const branchBefore = (await db.query("SELECT id FROM path_nodes WHERE unit_id=$1 AND kind='special'", [unitId])).rows[0].id
      const withoutBranch = structuredClone(source)
      withoutBranch.nodes.pop()
      assert.equal((await importPath(withoutBranch)).unit_id, unitId)
      assert.deepEqual(await call('export_learning_path($1)', [unitId]), { ...withoutBranch, is_active: true })
      const archived = (await db.query("SELECT id,is_active FROM path_nodes WHERE unit_id=$1 AND kind='special'", [unitId])).rows[0]
      assert.deepEqual(archived, { id: branchBefore, is_active: false })
      assert.equal((await importPath(source)).unit_id, unitId)
      assert.deepEqual((await db.query("SELECT id,is_active FROM path_nodes WHERE unit_id=$1 AND kind='special'", [unitId])).rows[0], { id: branchBefore, is_active: true })
      assert.deepEqual(await call('export_learning_path($1)', [unitId]), { ...source, is_active: true })
    })

    await t.test('validates the existing seven-path source read-only without importing any curriculum records', async () => {
      const existing = JSON.parse(await readFile(new URL('../seeds/path-a1.1.json', import.meta.url), 'utf8'))
      const before = (await db.query('SELECT count(*)::int total FROM learning_exercises')).rows[0].total
      for (const path of existing) {
        assert.equal((await db.query('SELECT path_private.valid_seed_shape($1) valid', [JSON.stringify(path)])).rows[0].valid, true, path.id)
      }
      assert.equal((await db.query('SELECT count(*)::int total FROM learning_exercises')).rows[0].total, before)
    })
  } finally { await db.close() }
})
