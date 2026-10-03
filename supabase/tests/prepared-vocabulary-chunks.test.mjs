import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createCurrentDatabase, actor, id, student, teacher, vocabularyUnit, result } from './helpers/current-db.mjs'

const migrations = [
  '20261003192958_sitov_prepared_own_vocabulary.sql',
  '20261003195521_sitov_prepared_learning_publication.sql',
  '20261003205747_sitov_vocabulary_chunks_import.sql',
]
const fingerprint = '96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const normalize = text => text.normalize('NFC').trim().replace(/\s+/gu, ' ')
const sha = text => createHash('sha256').update(text).digest('hex')
const pathFor = text => `sitov-qwen-v1/de/${sha(JSON.stringify({ text: normalize(text), voice: 'sitov-qwen-male-de-v1', rate: 'qwen-native-1-lufs-18-aligned-v1', format: 'audio-24khz-48kbitrate-mono-mp3', leadIn: 0.35, profile: fingerprint }))}.mp3`
const urlFor = text => `/supabase/storage/v1/object/public/audio_cache/${pathFor(text)}`
const metadataFor = text => ({ engine: 'qwen3-tts', voice: 'sitov-qwen-male-de-v1', revision: 'sitov-qwen-base-bf16-v1', profileFingerprint: fingerprint,
  textSha256: sha(normalize(text)), audioSha256: 'a'.repeat(64), wordTimings: normalize(text).split(' ').map((_, index) => ({ start: index + 0.35, end: index + 1 })) })

test('stored vocabulary chunks compose with the existing atomic publication bridge', async t => {
  const db = await createCurrentDatabase()
  const priorCard = id(96001), teacherUrl = 'https://recordings.example.test/chunk-teacher.mp3'
  const signatures = ['public.save_learning_content(text,jsonb,uuid)', 'learning_private.sitov_learning_audio_texts(text,jsonb,jsonb)', 'learning_private.sitov_require_prepared_learning_audio(text,jsonb,jsonb,uuid)']
  const functions = async () => (await db.query('SELECT oid,proacl::text acl,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=ANY($1::regprocedure[]) ORDER BY oid', [signatures])).rows
  const progress = async () => (await db.query('SELECT * FROM public.vocabulary_direction_progress ORDER BY id')).rows
  const state = async () => ({
    units: (await db.query('SELECT * FROM public.learning_units ORDER BY id')).rows,
    cards: (await db.query('SELECT * FROM public.learning_vocabulary_cards ORDER BY id')).rows,
    translations: (await db.query('SELECT * FROM public.vocabulary_translations ORDER BY card_id,locale')).rows,
    origins: (await db.query('SELECT * FROM vocabulary_private.sitov_seed_card_origins ORDER BY card_id')).rows,
  })
  const save = (fields, { target = null, label = 'Chunk CMS', translations = [], active } = {}) => result(db,
    'SELECT public.save_learning_content($1,$2,$3) result', ['vocabulary', JSON.stringify({ unit: { level: 'A1.1', label, ...(active === undefined ? {} : { is_active: active }) }, fields, translations }), target])
  const put = async (text, changes = {}) => {
    await db.exec('RESET ROLE')
    await db.query('INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES($1,$2,$3,$4) ON CONFLICT(bucket_id,name) DO UPDATE SET user_metadata=excluded.user_metadata',
      ['audio_cache', pathFor(text), '{"mimetype":"audio/mpeg","size":4096}', JSON.stringify({ ...metadataFor(text), ...changes })])
    await actor(db, teacher)
  }
  let beforeFunctions, beforeProgress, readyCard, readyUnit
  try {
    await db.query('INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,audio_url) VALUES($1,$2,$3,$4,$5)', [priorCard, vocabularyUnit, 'Brot', 'das', teacherUrl])
    await db.query('INSERT INTO vocabulary_translations(card_id,locale,translation,context_sentence) VALUES($1,$2,$3,$4)', [priorCard, 'de', null, 'Das Brot ist frisch.'])
    await db.query('INSERT INTO vocabulary_translations(card_id,locale,translation) VALUES($1,$2,$3)', [priorCard, 'ru', 'хлеб'])
    await actor(db, student)
    await result(db, 'SELECT initialize_vocabulary_cards($1) result', [JSON.stringify([{ cardId: priorCard, alreadyKnown: false }])])
    await db.exec('RESET ROLE')
    await db.query('UPDATE vocabulary_direction_progress SET box_number=3 WHERE card_id=$1', [priorCard])
    beforeProgress = await progress()
    await db.exec("ALTER TABLE storage.objects ADD COLUMN archived_at timestamptz, ADD COLUMN is_delete_marker boolean DEFAULT false; INSERT INTO storage.buckets(id,name,public) VALUES('audio_cache','audio_cache',true)")
    for (const name of migrations.slice(0, 2)) await db.exec(await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
    beforeFunctions = await functions()
    const migration74 = await readFile(new URL(`../migrations/${migrations[2]}`, import.meta.url), 'utf8')
    await db.exec(migration74)
    assert.deepEqual(await functions(), beforeFunctions, '74 preserves the public RPC and closed helper OIDs/ACLs/security modes')
    assert.deepEqual(await progress(), beforeProgress, 'adding chunk columns and proof changes no learner progress')
    const bridge = (await db.query("SELECT pg_get_functiondef('learning_private.sitov_require_prepared_learning_audio(text,jsonb,jsonb,uuid)'::regprocedure) definition")).rows[0].definition
    assert.match(bridge, /SELECT to_jsonb\(c\) INTO stored_fields/)
    assert.match(bridge, /sitov_learning_audio_texts\(p_trainer,stored_fields,stored_translations\)/)

    await t.test('the extended extractor requires word, normalized German chunk and actual German context only', async () => {
      const fields = { word_de: ' Tür ', article: 'die', content_kind: 'vocabulary', chunk_de: ' die\u00a0Tu\u0308r öffnen ' }
      const translations = [{ locale: 'de', context_sentence: 'Ich öffne die Tür.', chunk_translation: 'Not another utterance' }, { locale: 'en', context_sentence: 'I open the door.', chunk_translation: 'Open the door' }]
      const texts = (await db.query('SELECT learning_private.sitov_learning_audio_texts($1,$2,$3) texts', ['vocabulary', JSON.stringify(fields), JSON.stringify(translations)])).rows[0].texts
      assert.deepEqual([...texts].sort(), ['die Tür', 'die Tür öffnen', 'Ich öffne die Tür.'].sort())
    })

    await t.test('a missing chunk rolls back every new/changed card, translation, unit and audio reference', async () => {
      await put('die Tür'); await put('Ich öffne die Tür.')
      await db.exec('RESET ROLE')
      const before = await state()
      await actor(db, teacher)
      const response = await save({ word_de: 'Tür', article: 'die', chunk_de: 'die Tür öffnen', content_kind: 'vocabulary' }, { label: 'Missing new chunk', translations: [{ locale: 'de', context_sentence: 'Ich öffne die Tür.' }] })
      assert.equal(response.error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), before)
      await put('das Brot'); await put('Das Brot ist frisch.')
      assert.equal((await save({ chunk_de: 'frisches Brot kaufen', audio_url: null }, { target: priorCard, label: 'Lektion 1', translations: [{ locale: 'de', context_sentence: 'Das Brot ist frisch.' }] })).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), before, 'updating an existing learned card fails atomically too')
      assert.deepEqual(await progress(), beforeProgress)
    })

    await t.test('prepared chunks publish on the same card and retain canonical headword/teacher links and progress', async () => {
      await put('die Tür öffnen')
      const saved = await save({ word_de: 'Tür', article: 'die', chunk_de: 'die Tür öffnen', content_kind: 'vocabulary' }, { label: 'Prepared chunk', translations: [{ locale: 'de', context_sentence: 'Ich öffne die Tür.' }, { locale: 'en', chunk_translation: 'Open the door' }] })
      assert.ok(saved.id, JSON.stringify(saved))
      readyCard = saved.id
      const row = (await db.query('SELECT id,unit_id,chunk_de,content_kind,audio_url FROM learning_vocabulary_cards WHERE id=$1', [readyCard])).rows[0]
      readyUnit = row.unit_id
      assert.deepEqual(row, { id: readyCard, unit_id: readyUnit, chunk_de: 'die Tür öffnen', content_kind: 'vocabulary', audio_url: urlFor('die Tür') })
      assert.equal((await db.query('SELECT count(*)::int n FROM learning_vocabulary_cards WHERE unit_id=$1', [readyUnit])).rows[0].n, 1, 'an embedded chunk creates no extra card')
      await put('frisches Brot kaufen')
      assert.deepEqual(await save({ chunk_de: 'frisches Brot kaufen' }, { target: priorCard, label: 'Lektion 1', translations: [{ locale: 'de', context_sentence: 'Das Brot ist frisch.' }, { locale: 'ru', translation: 'хлеб', chunk_translation: 'купить свежий хлеб' }] }), { id: priorCard })
      assert.deepEqual((await db.query('SELECT id,audio_url,chunk_de FROM learning_vocabulary_cards WHERE id=$1', [priorCard])).rows[0], { id: priorCard, audio_url: teacherUrl, chunk_de: 'frisches Brot kaufen' })
      await db.exec('RESET ROLE')
      assert.deepEqual(await progress(), beforeProgress)
    })

    await t.test('the bridge uses the stored chunk and unit, even when payload chunk text is forged or omitted', async () => {
      await actor(db, teacher)
      await db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', JSON.stringify({ id: readyCard, chunk_de: 'Unprepared fake payload' }), '[]', readyUnit])
      await assert.rejects(db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', JSON.stringify({ id: readyCard, chunk_de: null }), '[]', vocabularyUnit]), error => error.code === '23514')
      await db.exec('RESET ROLE')
      await db.query('DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2', ['audio_cache', pathFor('die Tür öffnen')])
      const before = await state()
      await actor(db, teacher)
      await assert.rejects(db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', JSON.stringify({ id: readyCard, word_de: 'Brot', article: 'das', chunk_de: null }), '[{"locale":"de","context_sentence":"Das Brot ist frisch."}]', readyUnit]), error => error.code === '22023' && error.message === 'prepared_audio_required')
      assert.equal((await save({}, { target: readyCard, label: 'Prepared chunk', translations: [{ locale: 'de', context_sentence: 'Ich öffne die Tür.' }] })).error, 'prepared_audio_required', 'a partial save cannot omit the real stored chunk from proof')
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), before)
      assert.deepEqual(await progress(), beforeProgress)
      await put('die Tür öffnen')
    })

    await t.test('draft seed activation and false publish flags use actual unit state and fully roll back on a missing chunk', async () => {
      const cardId = id(96002), unitId = id(96003), word = 'Fenster', chunk = 'das Fenster schließen', context = 'Ich schließe das Fenster.'
      const translations = Object.fromEntries(['de', 'en', 'ru', 'uk', 'tr'].map(locale => [locale, { translation: locale === 'de' ? null : 'window', context_sentence: context, chunk_translation: locale === 'de' ? null : 'close the window' }]))
      const seed = { version: 1, units: [{ id: unitId, level: 'A1.1', label: 'Draft chunk seed', sort_order: 90, cards: [{ id: cardId, source_id: 'sitov-chunk-test-window', word_de: word, article: 'das', content_kind: 'vocabulary', chunk_de: chunk, sentence_practice: false, alternative_answers_de: [], target_form: null, translations }] }] }
      const seedCall = publish => result(db, 'SELECT public.sitov_import_vocabulary_seed($1,$2) result', [JSON.stringify(seed), publish])
      await actor(db, null, 'service_role')
      assert.equal((await seedCall(false)).card_count, 1)
      await db.exec('RESET ROLE')
      const draft = await state()
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [unitId])).rows[0].is_active, false)
      assert.equal((await db.query('SELECT audio_url FROM learning_vocabulary_cards WHERE id=$1', [cardId])).rows[0].audio_url, null)
      await put('das Fenster'); await put(context)
      await actor(db, null, 'service_role')
      assert.equal((await seedCall(true)).error, 'prepared_audio_required')
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), draft, 'failed activation retains the inactive unit and original card')
      await put(chunk)
      await actor(db, null, 'service_role')
      assert.equal((await seedCall(true)).card_count, 1)
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [unitId])).rows[0].is_active, true)
      assert.deepEqual((await db.query('SELECT id,unit_id,audio_url FROM learning_vocabulary_cards WHERE id=$1', [cardId])).rows[0], { id: cardId, unit_id: unitId, audio_url: urlFor('das Fenster') })
      const active = await state()
      seed.units[0].cards[0].chunk_de = 'das Fenster leise schließen'
      await actor(db, null, 'service_role')
      assert.equal((await seedCall(false)).error, 'prepared_audio_required', 'false publish never disables the existing active target to skip its proof')
      await db.exec('RESET ROLE')
      assert.deepEqual(await state(), active)
      assert.deepEqual(await progress(), beforeProgress)
    })

    await t.test('authorization and helper ACLs remain closed, and replay preserves function identities and learner state', async () => {
      await actor(db, student)
      await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)")
      await assert.rejects(db.query('SELECT learning_private.sitov_require_prepared_learning_audio($1,$2,$3,$4)', ['vocabulary', JSON.stringify({ id: readyCard }), '[]', readyUnit]), error => error.code === '42501' && error.message === 'Staff required')
      await assert.rejects(db.query('SELECT learning_private.sitov_learning_audio_texts($1,$2,$3)', ['vocabulary', '{}', '[]']), /permission denied/)
      await assert.rejects(db.query('SELECT public.sitov_import_vocabulary_seed($1,$2)', ['{}', false]), /permission denied/)
      await db.exec('RESET ROLE')
      assert.deepEqual(await functions(), beforeFunctions)
      const before = await state()
      await db.exec(migration74)
      assert.deepEqual(await functions(), beforeFunctions)
      assert.deepEqual(await state(), before)
      assert.deepEqual(await progress(), beforeProgress)
    })
  } finally { await db.close() }
})
