import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, actor, id, student, teacher, result } from './helpers/current-db.mjs'

const migrations = [
  '20261003192958_sitov_prepared_own_vocabulary.sql',
  '20261003195521_sitov_prepared_learning_publication.sql',
  '20261003201130_sitov_prepared_path_publication.sql',
]
const fingerprint = '96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const sha = text => createHash('sha256').update(text).digest('hex')
const normalize = text => text.normalize('NFC').trim().replace(/\s+/gu, ' ')
const pathFor = text => `sitov-qwen-v1/de/${sha(JSON.stringify({ text: normalize(text), voice: 'sitov-qwen-male-de-v1', rate: 'qwen-native-1-lufs-18-aligned-v1', format: 'audio-24khz-48kbitrate-mono-mp3', leadIn: 0.35, profile: fingerprint }))}.mp3`
const metadataFor = text => ({ engine: 'qwen3-tts', voice: 'sitov-qwen-male-de-v1', revision: 'sitov-qwen-base-bf16-v1', profileFingerprint: fingerprint,
  textSha256: sha(normalize(text)), audioSha256: 'a'.repeat(64), wordTimings: normalize(text).split(' ').map((_, index) => ({ start: index + 0.35, end: index + 1 })) })
const locales = ['en', 'ru', 'uk', 'tr']
const translated = value => Object.fromEntries(locales.map(locale => [locale, structuredClone(value)]))
function fixture(order = 1) {
  let number = 82000 + order * 100
  const exercise = (type, content) => ({ id: id(number++), ref: `sitov-fixture-${number}`, goal: 'grammar', exercise_type: type,
    content: { instruction: 'Prüfe den Satz.', target_form: ['Prüfform'], ...content }, hint: 'Achte auf den Satz.', explanation: 'Die Antwort passt.', explanation_card: 'sitov-fixture-rule',
    translations: translated({ instruction: 'Complete.', hint: 'Read the sentence.', explanation: 'The answer matches.' }) })
  const gap = () => exercise('fill_in_blank', { text_before: 'Ich ', correct_answer: 'bin', text_after: ' hier.', accepted_answers: ['bin'] })
  const question = () => exercise('multiple_choice', { question: 'Wie heißt du?', options: ['Ich heiße Jan.', 'Ich wohne in Berlin.'], correct_answer: 'Ich heiße Jan.', accepted_answers: ['Ich heiße Jan.'] })
  const choice = () => exercise('multiple_choice', { question: 'Das ist ___ Tisch.', options: ['ein', 'eine'], correct_answer: 'ein', accepted_answers: ['ein'] })
  const build = () => exercise('sentence_building', { parts: ['Ein', 'unvertonter', 'Satz'], correct_answer: 'Ein unvertonter Satz.', accepted_answers: ['Ein unvertonter Satz.'] })
  const node = (kind, sort_order, exercises) => ({ id: `sitov-fixture-${kind}`, kind, sort_order, title: 'Prüfknoten', topic: 'Prüfung', goals: ['grammar'],
    translations: translated({ title: 'Test node' }), exercises })
  return { id: `sitov-fixture-path-${order}`, level: 'A1.1', path: order, slug: `sitov-fixture-path-${order}`, title: `Prüfpfad ${order}`,
    translations: translated({ title: `Test path ${order}` }), unit: { level: 'A1.1', trainer: 'exercises', label: `Prüfpfad ${order}`, sort_order: order },
    objectives: [{ id: 'grammar', area: 'grammar', description: 'Eine Antwort geben.' }], nodes: [
      { ...node('practice', 1, [gap(), build()]), merkkarte: { card: 'sitov-fixture-rule', rule: 'Das Verb passt zum Subjekt.', examples: ['Ich bin hier.'], highlight: null, translations: translated({ rule: 'The verb matches the subject.' }) } },
      node('review', 2, [question()]), { ...node('test', 3, [choice(), choice()]), test_size: 1 },
    ] }
}

test('staff and service learning-path imports require only actual German player utterances', async t => {
  const db = await createCurrentDatabase()
  const original = fixture(), fresh = fixture(2)
  const call = (name, value) => result(db, `SELECT public.${name}($1::jsonb) result`, [JSON.stringify(value)])
  const signatures = [
    'public.import_learning_path(jsonb)', 'public.import_learning_path_seed(jsonb)',
    'path_private.import_path_catalog(jsonb,uuid)', 'path_private.error(text,text)',
  ]
  const fnState = async () => (await db.query('SELECT oid,proacl::text acl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY oid', [signatures])).rows
  const state = async () => ({
    units: (await db.query('SELECT * FROM learning_units ORDER BY id')).rows,
    nodes: (await db.query('SELECT * FROM path_nodes ORDER BY id')).rows,
    exercises: (await db.query('SELECT * FROM learning_exercises ORDER BY id')).rows,
    translations: (await db.query('SELECT * FROM grammar_translations ORDER BY exercise_id,locale')).rows,
    imported: (await db.query('SELECT * FROM path_private.phase4_imported_units ORDER BY unit_id')).rows,
    notes: (await db.query('SELECT * FROM path_legacy_progress_notes ORDER BY auth_user_id,level')).rows,
  })
  const progress = async () => ({
    path: (await db.query('SELECT * FROM path_node_progress ORDER BY node_id')).rows,
    grammar: (await db.query('SELECT * FROM user_exercise_progress ORDER BY id')).rows,
    vocabulary: (await db.query('SELECT * FROM vocabulary_direction_progress ORDER BY id')).rows,
  })
  const put = async (text, changes = {}) => {
    await db.exec('RESET ROLE')
    await db.query('INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES($1,$2,$3,$4) ON CONFLICT(bucket_id,name) DO UPDATE SET user_metadata=excluded.user_metadata',
      ['audio_cache', pathFor(text), '{"mimetype":"audio/mpeg","size":4096}', JSON.stringify({ ...metadataFor(text), ...changes })])
  }
  const prepareCommon = async () => { for (const text of ['bin', 'Ich bin hier.', 'Wie heißt du? Ich heiße Jan.', 'Das ist ein Tisch.']) await put(text) }
  try {
    // Already-authored content and learned progress must survive guard rollout.
    await actor(db, teacher)
    const prior = await call('import_learning_path', original)
    assert.ok(prior.unit_id, JSON.stringify(prior))
    await db.exec('RESET ROLE')
    const nodeId = (await db.query("SELECT id FROM path_nodes WHERE unit_id=$1 AND kind='practice'", [prior.unit_id])).rows[0].id
    await db.query("INSERT INTO path_node_progress(auth_user_id,node_id,status,best_stars,first_attempt_accuracy,completed_at) VALUES($1,$2,'completed',3,100,now())", [student, nodeId])
    await db.query('INSERT INTO user_exercise_progress(auth_user_id,exercise_id,attempts,completed,score) VALUES($1,$2,4,true,100)', [student, original.nodes[0].exercises[0].id])
    await db.query("UPDATE learning_exercises SET solution_audio_url='https://recordings.example.test/path-teacher.mp3' WHERE id=$1", [original.nodes[0].exercises[0].id])
    await db.exec("ALTER TABLE storage.objects ADD COLUMN archived_at timestamptz, ADD COLUMN is_delete_marker boolean DEFAULT false; INSERT INTO storage.buckets(id,name,public) VALUES('audio_cache','audio_cache',true)")
    const beforeFunctions = await fnState(), beforeContent = await state(), beforeProgress = await progress()
    const oldErrors = []
    for (const [message, code] of [['invalid_input', '22023'], ['test_pool_invalid', '23514'], ['not_authorized', '42501'], ['unknown internal detail', 'XX000']]) {
      oldErrors.push((await db.query('SELECT path_private.error($1,$2) result', [message, code])).rows[0].result)
    }
    for (const name of migrations) await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
    assert.deepEqual(await fnState(), beforeFunctions, 'all public and private OIDs, ACLs, security modes and volatility retained')
    assert.deepEqual(await state(), beforeContent)
    assert.deepEqual(await progress(), beforeProgress)

    await t.test('authorization precedes audio proof in both RPCs and the private writer stays closed', async () => {
      await actor(db, student)
      await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)")
      assert.equal((await call('import_learning_path', fresh)).error, 'not_authorized')
      await assert.rejects(call('import_learning_path_seed', [fresh]), error => error.code === '42501')
      await assert.rejects(db.query('SELECT path_private.import_path_catalog($1,$2)', [JSON.stringify(fresh), student]), error => error.code === '42501')
      await actor(db, null, 'anon')
      await assert.rejects(call('import_learning_path', fresh), error => error.code === '42501')
      await db.exec('RESET ROLE')
      await db.exec('GRANT EXECUTE ON FUNCTION public.import_learning_path_seed(jsonb) TO authenticated')
      await actor(db, teacher)
      await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)")
      assert.equal((await call('import_learning_path_seed', [fresh])).error, 'not_authorized', 'actual SQL role is authoritative even with an accidental EXECUTE grant')
      await db.exec('RESET ROLE')
      await db.exec('REVOKE EXECUTE ON FUNCTION public.import_learning_path_seed(jsonb) FROM authenticated')
      assert.deepEqual(await state(), beforeContent)
    })

    await t.test('missing answer or full sentence rejects staff writes without touching catalog/progress', async () => {
      await actor(db, teacher)
      const response = await call('import_learning_path', fresh)
      assert.equal(response.error, 'prepared_audio_required')
      assert.equal(response.sqlstate, '22023')
      assert.match(response.message, /locally.*import.*retrying/)
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), beforeContent)
      await put('bin')
      await actor(db, teacher)
      assert.equal((await call('import_learning_path', fresh)).error, 'prepared_audio_required', 'the gap answer alone does not prepare its full sentence')
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), beforeContent)
      assert.deepEqual(await progress(), beforeProgress)
    })

    await t.test('prepared staff reimports retain IDs/counts, recordings and learned progress', async () => {
      await prepareCommon()
      await actor(db, teacher)
      const imported = await call('import_learning_path', original)
      assert.deepEqual(imported, { unit_id: prior.unit_id, node_count: 3, exercise_count: 5 })
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT solution_audio_url FROM learning_exercises WHERE id=$1', [original.nodes[0].exercises[0].id])).rows[0].solution_audio_url, 'https://recordings.example.test/path-teacher.mp3')
      assert.deepEqual(await progress(), beforeProgress)
      assert.equal((await db.query('SELECT count(*)::int n FROM storage.objects WHERE name=$1', [pathFor('Ein unvertonter Satz.')])).rows[0].n, 0, 'sentence-building has no current audio control and requires no invented proof')
    })

    await t.test('one missing text in a later service path rolls back the complete batch before legacy archival', async () => {
      const batch = [structuredClone(original), structuredClone(fresh)]
      batch[0].title = 'Nicht gespeicherte Änderung'
      const target = batch[1].nodes[0].exercises[0]
      target.content = { ...target.content, correct_answer: 'wohne', accepted_answers: ['wohne'], target_form: ['wohnen'] }
      await db.exec('RESET ROLE')
      const snapshot = await state()
      await actor(db, null, 'service_role')
      assert.equal((await call('import_learning_path_seed', batch)).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), snapshot)
      assert.deepEqual(await progress(), beforeProgress)
      await put('wohne')
      await put('Ich wohne hier.')
      await actor(db, null, 'service_role')
      const imported = await call('import_learning_path_seed', batch)
      assert.ok(!imported.error, JSON.stringify(imported))
      assert.deepEqual({ paths: imported.path_count, nodes: imported.node_count, exercises: imported.exercise_count, objectives: imported.objective_count }, { paths: 2, nodes: 6, exercises: 10, objectives: 2 })
      assert.equal(imported.paths[0].unit_id, prior.unit_id)
      await db.exec('RESET ROLE')
      assert.deepEqual(await progress(), beforeProgress)
    })

    await t.test('wrong male identity is rejected and retained rows consumed by ExerciseClient also require proof', async () => {
      await put('bin', { voice: 'female' })
      await actor(db, teacher)
      assert.equal((await call('import_learning_path', original)).error, 'prepared_audio_required')
      const omitted = structuredClone(original)
      omitted.nodes[0].exercises.shift() // Keep the valid sentence-building practice.
      assert.equal((await call('import_learning_path', omitted)).error, 'prepared_audio_required', 'archived path rows still appear in the existing grammar-player query')
      await db.exec('RESET ROLE')
      assert.deepEqual(await progress(), beforeProgress)
      await put('bin')
    })

    await t.test('inactive drafts can import but activation is atomic until their actual audio is prepared', async () => {
      const draft = fixture(3)
      draft.is_active = false
      const target = draft.nodes[0].exercises[0]
      target.content = { ...target.content, correct_answer: 'arbeite', accepted_answers: ['arbeite'], target_form: ['arbeiten'] }
      await actor(db, teacher)
      const stored = await call('import_learning_path', draft)
      assert.ok(stored.unit_id, JSON.stringify(stored))
      assert.equal((await call('import_learning_path', { ...draft, is_active: true })).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [stored.unit_id])).rows[0].is_active, false)
      await put('arbeite')
      await put('Ich arbeite hier.')
      await actor(db, teacher)
      assert.equal((await call('import_learning_path', { ...draft, is_active: true })).unit_id, stored.unit_id)
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [stored.unit_id])).rows[0].is_active, true)
      assert.deepEqual(await progress(), beforeProgress)
    })

    await t.test('quality/pool errors retain prior codes and never expose internal database details', async () => {
      let index = 0
      for (const [message, code] of [['invalid_input', '22023'], ['test_pool_invalid', '23514'], ['not_authorized', '42501'], ['unknown internal detail', 'XX000']]) {
        assert.deepEqual((await db.query('SELECT path_private.error($1,$2) result', [message, code])).rows[0].result, oldErrors[index++])
      }
      const invalid = fixture(4)
      invalid.nodes[2].test_size = 2
      await actor(db, teacher)
      assert.equal((await call('import_learning_path', invalid)).error, 'test_pool_invalid', 'pool validation precedes any missing-audio error')
      const malformed = structuredClone(invalid)
      delete malformed.nodes[0].merkkarte.translations.uk
      assert.equal((await call('import_learning_path', malformed)).error, 'invalid_input')
      await db.exec('RESET ROLE')
      assert.deepEqual(await progress(), beforeProgress)
    })

    await t.test('additive migration replay preserves definitions, ACLs, content and all progress', async () => {
      const snapshot = await state(), learned = await progress(), functions = await fnState()
      const definitions = (await db.query('SELECT oid,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY oid', [signatures])).rows
      await db.exec(await readFile(new URL(`../migrations/${migrations[2]}`, import.meta.url), 'utf8'))
      assert.deepEqual(await fnState(), functions)
      assert.deepEqual((await db.query('SELECT oid,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY oid', [signatures])).rows, definitions)
      assert.deepEqual(await state(), snapshot)
      assert.deepEqual(await progress(), learned)
    })
  } finally { await db.close() }
})
