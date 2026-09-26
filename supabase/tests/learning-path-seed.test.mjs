import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  createLearningPathDatabase, apply, actor, id, student, teacher, outsider,
  exerciseUnit, vocabularyUnit, result,
} from './helpers/learning-path-db.mjs'

const migration = '36_migrate_old_grammar_progress.sql'
const locales = ['en', 'ru', 'uk', 'tr']
const translations = value => Object.fromEntries(locales.map(locale => [locale, structuredClone(value)]))
// Minimal artificial catalog contract; this suite never authors or modifies curriculum.
function pathFixture(order = 1) {
  let number = 40000 + order * 100
  const exercise = () => ({
    id: id(number++), ref: `fixture-${number}`, goal: 'grammar', exercise_type: 'multiple_choice',
    content: { target_form: ['Ja'], question: 'Welche Antwort?', options: ['Ja', 'Nein'], correct_answer: 'Ja', accepted_answers: ['Ja'] },
    hint: 'Wähle Ja.', explanation: 'Ja ist richtig.', explanation_card: 'fixture-rule',
    translations: translations({ instruction: 'Choose.', hint: 'Choose yes.', explanation: 'Yes is correct.' }),
  })
  return {
    id: `fixture-path-${order}`, level: 'A1.1', path: order, slug: `fixture-path-${order}`, title: `Prüfpfad ${order}`,
    translations: translations({ title: `Test path ${order}` }),
    unit: { level: 'A1.1', trainer: 'exercises', label: `Prüfpfad ${order}`, sort_order: order },
    objectives: [{ id: 'grammar', area: 'grammar', description: 'Eine Antwort wählen.' }],
    nodes: ['practice', 'review', 'test'].map((kind, index) => ({
      id: `fixture-${kind}`, kind, sort_order: index + 1, title: 'Prüfknoten', topic: 'Prüfung',
      translations: translations({ title: 'Test node' }), goals: ['grammar'],
      ...(kind === 'test' ? { test_size: 1 } : kind === 'practice' ? {
        merkkarte: { card: 'fixture-rule', rule: 'Wähle Ja.', examples: ['Ja.'], highlight: null, translations: translations({ rule: 'Choose yes.' }) },
      } : {}), exercises: kind === 'test' ? [exercise(), exercise()] : [exercise()],
    })),
  }
}
const legacyExercise = id(49000), laterLegacy = id(49001), otherLevel = id(49002), inactiveLegacy = id(49003)
const legacyContent = { target_form: ['Alt'], text_before: 'Schreibe', text_after: '.', correct_answer: 'Alt', accepted_answers: ['Alt'] }
const call = (db, name, value) => result(db, `SELECT public.${name}($1::jsonb) result`, [JSON.stringify(value)])
const service = db => actor(db, null, 'service_role')
const admin = db => db.exec('RESET ROLE')
const apply36 = db => apply(db, [migration])
const count = async (db, table) => (await db.query(`SELECT count(*)::int count FROM ${table}`)).rows[0].count

await test('Phase 4 seed RPC: atomic import, service permissions, preserved progress and reversible archival', async t => {
  const db = await createLearningPathDatabase({ beforePathMigrations: async baseline => {
    await baseline.query('INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,\'Alt\',\'fill_in_blank\',$3)', [legacyExercise, exerciseUnit, JSON.stringify(legacyContent)])
    await baseline.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,attempts,completed,score) VALUES($1,$2,4,true,100)', [student, legacyExercise])
    await baseline.exec("INSERT INTO learning_levels(code,cefr_level,sort_order) VALUES('A1.2','A1',2)")
    await baseline.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.2','exercises','Andere Stufe',true),($2,'A1.1','exercises','Schon archiviert',false)", [otherLevel, inactiveLegacy])
  } })
  let imported, node, legacyBefore, progressBefore, staffDefinition
  const seed = [pathFixture(1), pathFixture(2)]
  try {
    staffDefinition = (await db.query("SELECT pg_get_functiondef('public.import_learning_path(jsonb)'::regprocedure) definition")).rows[0].definition
    // A unit added since 35 proves 36 does not archive before successful content import.
    await db.query("INSERT INTO learning_units(id,level,trainer,label,is_active) VALUES($1,'A1.1','exercises','Später Altbestand',true)", [laterLegacy])
    legacyBefore = (await db.query('SELECT * FROM user_exercise_progress ORDER BY id')).rows
    await apply36(db)

    await t.test('only service_role can call batch import; staff keeps the existing staff API', async () => {
      const permissions = (await db.query(`SELECT has_function_privilege('anon','public.import_learning_path_seed(jsonb)','EXECUTE') anon,
        has_function_privilege('authenticated','public.import_learning_path_seed(jsonb)','EXECUTE') authenticated,
        has_function_privilege('service_role','public.import_learning_path_seed(jsonb)','EXECUTE') service,
        has_function_privilege('service_role','path_private.import_path_catalog(jsonb,uuid)','EXECUTE') private_core`)).rows[0]
      assert.deepEqual(permissions, { anon: false, authenticated: false, service: true, private_core: false })
      await actor(db, student)
      await assert.rejects(call(db, 'import_learning_path_seed', seed), error => error.code === '42501')
      assert.equal((await call(db, 'import_learning_path', seed[0])).error, 'not_authorized')
      await admin(db)
      // Defence in depth: an accidental grant still cannot trust forged JWT claims.
      await db.exec('GRANT EXECUTE ON FUNCTION public.import_learning_path_seed(jsonb) TO authenticated')
      await actor(db, teacher)
      await db.exec("SELECT set_config('request.jwt.claim.role','service_role',false)")
      assert.equal((await call(db, 'import_learning_path_seed', seed)).error, 'not_authorized')
      await admin(db)
      await db.exec('REVOKE EXECUTE ON FUNCTION public.import_learning_path_seed(jsonb) FROM authenticated')
      assert.equal(await count(db, 'public.path_legacy_progress_notes'), 0)
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [laterLegacy])).rows[0].is_active, true)
    })

    await t.test('valid shape and SQL-time failures both roll back the whole batch before archival', async () => {
      await service(db)
      assert.equal((await call(db, 'import_learning_path_seed', [])).error, 'invalid_input')
      assert.equal((await call(db, 'import_learning_path_seed', [seed[0], seed[0]])).error, 'invalid_input')
      const duplicateSlug = structuredClone(seed)
      duplicateSlug[1].slug = duplicateSlug[0].slug
      assert.equal((await call(db, 'import_learning_path_seed', duplicateSlug)).error, 'invalid_input')
      const bad = structuredClone(seed)
      bad[1].nodes[2].test_size = 2 // pool has only two items: SQL-time failure after importing path 1.
      assert.equal((await call(db, 'import_learning_path_seed', bad)).error, 'test_pool_invalid')
      await admin(db)
      assert.equal(await count(db, 'path_nodes'), 0)
      assert.equal(await count(db, 'path_private.phase4_imported_units'), 0)
      assert.equal(await count(db, 'path_legacy_progress_notes'), 0)
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [laterLegacy])).rows[0].is_active, true)
      assert.deepEqual((await db.query('SELECT * FROM user_exercise_progress ORDER BY id')).rows, legacyBefore)
    })

    await t.test('imports all paths and translations with explicit, staff-only zero-credit notes', async () => {
      await service(db)
      imported = await call(db, 'import_learning_path_seed', seed)
      assert.ok(!imported.error, JSON.stringify(imported))
      assert.deepEqual({ paths: imported.path_count, nodes: imported.node_count, exercises: imported.exercise_count, objectives: imported.objective_count }, { paths: 2, nodes: 6, exercises: 8, objectives: 2 })
      assert.deepEqual(imported.migration, { archived_units: 1, notes_created: 1 })
      assert.deepEqual(imported.paths.map(path => path.source_id), seed.map(path => path.id))
      await admin(db)
      assert.equal(await count(db, 'path_unit_translations'), 10)
      assert.equal(await count(db, 'path_node_translations'), 30)
      assert.equal(await count(db, 'grammar_translations'), 40)
      assert.equal((await db.query('SELECT count(*)::int count FROM learning_units WHERE trainer=\'exercises\' AND NOT is_path AND is_active')).rows[0].count, 0)
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [vocabularyUnit])).rows[0].is_active, true)
      assert.equal((await db.query('SELECT count(*)::int count FROM path_nodes WHERE created_by IS NOT NULL')).rows[0].count, 0, 'service imports invent no staff identity')
      await actor(db, student)
      assert.deepEqual((await db.query('SELECT * FROM path_legacy_progress_notes')).rows, [])
      await actor(db, outsider)
      assert.deepEqual((await db.query('SELECT * FROM path_legacy_progress_notes')).rows, [])
      await actor(db, teacher)
      const notes = (await db.query('SELECT * FROM path_legacy_progress_notes')).rows
      assert.equal(notes.length, 1)
      assert.equal(notes[0].initial_path_progress, 0)
      assert.equal(notes[0].legacy_exercise_count, 1)
      assert.equal(notes[0].legacy_completed_count, 1)
      assert.equal(Number(notes[0].legacy_attempt_count), 4)
      assert.deepEqual(Object.keys(notes[0].note).sort(), ['de', 'en', 'ru', 'tr', 'uk'])
      await assert.rejects(db.exec('UPDATE path_legacy_progress_notes SET initial_path_progress=1'), error => error.code === '42501')
    })

    await t.test('reimport updates content in place without resetting old or new progress', async () => {
      await admin(db)
      node = (await db.query("SELECT id FROM path_nodes WHERE unit_id=$1 AND kind='practice'", [imported.paths[0].unit_id])).rows[0].id
      await db.query("INSERT INTO path_node_progress(auth_user_id,node_id,status,best_stars,first_attempt_accuracy,completed_at) VALUES($1,$2,'completed',3,100,now())", [student, node])
      progressBefore = (await db.query('SELECT * FROM path_node_progress ORDER BY node_id')).rows
      const notesBefore = (await db.query('SELECT * FROM path_legacy_progress_notes ORDER BY auth_user_id,level')).rows
      const identifiers = (await db.query('SELECT id,unit_id,source_id FROM path_nodes ORDER BY id')).rows
      const revised = structuredClone(seed)
      revised[0].title = 'Überarbeiteter Prüfpfad'
      await service(db)
      const again = await call(db, 'import_learning_path_seed', revised)
      assert.deepEqual(again.paths, imported.paths)
      assert.deepEqual(again.migration, { archived_units: 0, notes_created: 0 })
      await admin(db)
      assert.deepEqual((await db.query('SELECT id,unit_id,source_id FROM path_nodes ORDER BY id')).rows, identifiers)
      assert.deepEqual((await db.query('SELECT * FROM path_node_progress ORDER BY node_id')).rows, progressBefore)
      assert.deepEqual((await db.query('SELECT * FROM user_exercise_progress ORDER BY id')).rows, legacyBefore)
      assert.deepEqual((await db.query('SELECT * FROM path_legacy_progress_notes ORDER BY auth_user_id,level')).rows, notesBefore)
      assert.equal((await db.query('SELECT path_title FROM learning_units WHERE id=$1', [imported.paths[0].unit_id])).rows[0].path_title, revised[0].title)
      await actor(db, teacher)
      const staff = await call(db, 'import_learning_path', revised[0])
      assert.equal(staff.unit_id, imported.paths[0].unit_id, JSON.stringify(staff))
    })

    await t.test('migration, rollback and reapply are repeatable and preserve all learner records', async () => {
      await admin(db)
      const snapshot = (await db.query('SELECT id,unit_id,node_id,content FROM learning_exercises ORDER BY id')).rows
      await apply36(db)
      await apply36(db)
      const rollback = await readFile(new URL(`../vps/rollback/${migration}`, import.meta.url), 'utf8')
      await db.exec('BEGIN;' + rollback + 'COMMIT;')
      await db.exec('BEGIN;' + rollback + 'COMMIT;')
      assert.equal((await db.query("SELECT pg_get_functiondef('public.import_learning_path(jsonb)'::regprocedure) definition")).rows[0].definition, staffDefinition)
      assert.equal((await db.query('SELECT count(*)::int count FROM learning_units WHERE is_path AND is_active')).rows[0].count, 0)
      for (const unit of [exerciseUnit, laterLegacy, otherLevel]) assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [unit])).rows[0].is_active, true)
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [inactiveLegacy])).rows[0].is_active, false)
      await service(db)
      await assert.rejects(call(db, 'import_learning_path_seed', seed), error => error.code === '42501')
      await admin(db)
      await apply36(db)
      assert.equal((await db.query('SELECT count(*)::int count FROM learning_units WHERE is_path AND is_active')).rows[0].count, 2)
      assert.equal((await db.query('SELECT count(*)::int count FROM learning_units WHERE trainer=\'exercises\' AND NOT is_path AND is_active')).rows[0].count, 0)
      assert.deepEqual((await db.query('SELECT * FROM path_node_progress ORDER BY node_id')).rows, progressBefore)
      assert.deepEqual((await db.query('SELECT * FROM user_exercise_progress ORDER BY id')).rows, legacyBefore)
      assert.deepEqual((await db.query('SELECT id,unit_id,node_id,content FROM learning_exercises ORDER BY id')).rows, snapshot)
      assert.equal(await count(db, 'path_legacy_progress_notes'), 1)
    })
  } finally { await db.close() }
})

await test('Phase 4 migration backfills already imported Phase 3 catalogs without discarding new progress', async () => {
  const db = await createLearningPathDatabase()
  try {
    await actor(db, teacher)
    const imported = await call(db, 'import_learning_path', pathFixture(1))
    assert.ok(!imported.error, JSON.stringify(imported))
    await admin(db)
    const node = (await db.query("SELECT id FROM path_nodes WHERE unit_id=$1 AND kind='practice'", [imported.unit_id])).rows[0].id
    await db.query("INSERT INTO path_node_progress(auth_user_id,node_id,status,best_stars) VALUES($1,$2,'completed',2)", [student, node])
    await db.query('INSERT INTO learning_exercises(id,unit_id,topic,type,content) VALUES($1,$2,\'Alt\',\'fill_in_blank\',$3)', [legacyExercise, exerciseUnit, JSON.stringify(legacyContent)])
    await db.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,attempts,completed) VALUES($1,$2,2,true)', [student, legacyExercise])
    await apply36(db)
    await apply36(db)
    assert.equal((await db.query('SELECT existing_path_progress_preserved FROM path_legacy_progress_notes')).rows[0].existing_path_progress_preserved, true)
    assert.equal((await db.query('SELECT best_stars FROM path_node_progress')).rows[0].best_stars, 2)
    await service(db)
    assert.ok(!(await call(db, 'import_learning_path_seed', [pathFixture(1)])).error)
    await admin(db)
    const rollback = await readFile(new URL(`../vps/rollback/${migration}`, import.meta.url), 'utf8')
    await db.exec('BEGIN;' + rollback + 'COMMIT;')
    assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [imported.unit_id])).rows[0].is_active, true, 'pre-Phase-4 paths retain their original active flag')
  } finally { await db.close() }
})
