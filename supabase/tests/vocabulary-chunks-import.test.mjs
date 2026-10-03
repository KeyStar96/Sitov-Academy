import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createPhase1Database, actor, id, student, teacher, vocabularyUnit, result } from './helpers/phase1-db.mjs'

const fingerprint = '96db5949cf9ba060eb5fbeeec3b472d232d55e0b22dc2512cf65dc53c8c47df5'
const sha = value => createHash('sha256').update(value).digest('hex')
const normalized = value => value.normalize('NFC').trim().replace(/\s+/gu, ' ')
const pathFor = text => `sitov-qwen-v1/de/${sha(JSON.stringify({ text: normalized(text), voice: 'sitov-qwen-male-de-v1', rate: 'qwen-native-1-lufs-18-aligned-v1', format: 'audio-24khz-48kbitrate-mono-mp3', leadIn: 0.35, profile: fingerprint }))}.mp3`
const metadataFor = text => ({ engine: 'qwen3-tts', voice: 'sitov-qwen-male-de-v1', revision: 'sitov-qwen-base-bf16-v1', profileFingerprint: fingerprint,
  textSha256: sha(normalized(text)), audioSha256: 'a'.repeat(64), wordTimings: normalized(text).split(' ').map((_, i) => ({ start: i + 0.35, end: i + 1 })) })
const translated = (translation, context, chunk) => ({ translation, context_sentence: context, chunk_translation: chunk })
const card = (number, changes = {}) => ({ id: id(number), source_id: `sitov-A1.1-L01-${number}`, content_kind: 'vocabulary', word_de: 'Termin', article: 'der', plural: 'Termine',
  sentence_practice: false, alternative_answers_de: [], target_form: null, chunk_de: 'einen Termin vereinbaren',
  translations: { de: { context_sentence: 'Jan vereinbart einen Termin.' }, en: translated('appointment', 'Jan makes an appointment.', 'make an appointment'),
    ru: translated('встреча', 'Ян договаривается о встрече.', 'договориться о встрече'), uk: translated('зустріч', 'Ян домовляється про зустріч.', 'домовитися про зустріч'),
    tr: translated('randevu', 'Jan bir randevu alıyor.', 'randevu almak') }, ...changes })
const unit = (cards, changes = {}) => ({ id: vocabularyUnit, level: 'A1.1', label: 'Lektion 1', sort_order: 1, cards, ...changes })
const seed = units => ({ version: 1, units })
const migrationUrl = new URL('../migrations/20261003205747_sitov_vocabulary_chunks_import.sql', import.meta.url)
const call = async (db, payload, publish = true) => {
  await actor(db, null, 'service_role')
  return result(db, 'SELECT public.sitov_import_vocabulary_seed($1,$2) result', [JSON.stringify(payload), publish])
}
async function put(db, text, changes = {}) {
  await db.exec('RESET ROLE')
  await db.query('INSERT INTO storage.objects(bucket_id,name,metadata,user_metadata) VALUES($1,$2,$3,$4) ON CONFLICT(bucket_id,name) DO UPDATE SET user_metadata=excluded.user_metadata',
    ['audio_cache', pathFor(text), JSON.stringify({ mimetype: 'audio/mpeg', size: 4096 }), JSON.stringify({ ...metadataFor(text), ...changes })])
}
async function setup() {
  const db = await createPhase1Database()
  await db.exec("ALTER TABLE storage.objects ADD COLUMN archived_at timestamptz,ADD COLUMN is_delete_marker boolean DEFAULT false; INSERT INTO storage.buckets(id,name,public) VALUES('audio_cache','audio_cache',true)")
  for (const name of ['31_vocabulary_target_forms.sql', '70_sitov_prepared_own_vocabulary.sql', '71_sitov_prepared_learning_publication.sql', '74_sitov_vocabulary_chunks_import.sql']) {
    await db.exec('BEGIN;' + await readFile(new URL(`../vps/${name}`, import.meta.url), 'utf8') + 'COMMIT;')
  }
  return db
}
const contents = async db => {
  await db.exec('RESET ROLE')
  return {
    units: (await db.query('SELECT * FROM learning_units ORDER BY id')).rows,
    cards: (await db.query('SELECT * FROM learning_vocabulary_cards ORDER BY id')).rows,
    translations: (await db.query('SELECT * FROM vocabulary_translations ORDER BY card_id,locale')).rows,
    origins: (await db.query('SELECT * FROM vocabulary_private.sitov_seed_card_origins ORDER BY card_id')).rows,
    revisions: (await db.query('SELECT * FROM vocabulary_private.sitov_legacy_card_revisions ORDER BY card_id')).rows,
    progress: (await db.query('SELECT * FROM vocabulary_direction_progress ORDER BY id')).rows,
    receipts: (await db.query('SELECT * FROM vocabulary_private.answer_receipts ORDER BY request_id')).rows,
  }
}

test('word/chunk imports enforce audio, retain identity/progress and use existing both-direction grading', async t => {
  const db = await setup()
  try {
    const wordCard = card(901)
    const chunkCard = card(902, { content_kind: 'chunk', word_de: 'Alles klar!', article: null, plural: null, chunk_de: null,
      translations: { de: { context_sentence: 'Paul sagt: Alles klar!' }, en: translated('All right!', 'Paul says: All right!', null), ru: translated('Всё понятно!', 'Пауль говорит: Всё понятно!', null),
        uk: translated('Усе зрозуміло!', 'Пауль каже: Усе зрозуміло!', null), tr: translated('Tamam!', 'Paul diyor: Tamam!', null) } })
    const payload = seed([unit([wordCard, chunkCard])])
    await t.test('active publication is atomic and checks embedded chunks plus full timings', async () => {
      const before = await contents(db)
      assert.equal((await call(db, payload)).error, 'prepared_audio_required')
      assert.deepEqual(await contents(db), before)
      for (const text of ['der Termin', 'Jan vereinbart einen Termin.', 'Alles klar!', 'Paul sagt: Alles klar!']) await put(db, text)
      assert.equal((await call(db, payload)).error, 'prepared_audio_required', 'headwords/examples alone are insufficient')
      await put(db, 'einen Termin vereinbaren', { wordTimings: [{ start: 0.35, end: 1 }] })
      assert.equal((await call(db, payload)).error, 'prepared_audio_required')
      await put(db, 'einen Termin vereinbaren')
      const saved = await call(db, payload)
      assert.equal(saved.card_count, 2, JSON.stringify(saved))
      assert.equal(saved.vocabulary_count, 1); assert.equal(saved.chunk_count, 1)
      assert.equal(saved.units[0].cards[0].card_id, wordCard.id)
      await db.exec('RESET ROLE')
      const actual = (await db.query('SELECT content_kind,chunk_de,audio_url FROM learning_vocabulary_cards WHERE id=$1', [wordCard.id])).rows[0]
      assert.deepEqual(actual, { content_kind: 'vocabulary', chunk_de: wordCard.chunk_de, audio_url: `/supabase/storage/v1/object/public/audio_cache/${pathFor('der Termin')}` })
    })
    await t.test('a standalone chunk initializes and grades in both directions without another scheduler', async () => {
      await actor(db, student)
      const initialized = await result(db, 'SELECT initialize_vocabulary_cards($1) result', [JSON.stringify([{ cardId: chunkCard.id, alreadyKnown: false }, { cardId: wordCard.id, alreadyKnown: false }])])
      assert.equal(initialized.addedNew, 2)
      await db.exec('RESET ROLE')
      const progress = (await db.query('SELECT * FROM vocabulary_direction_progress WHERE card_id=$1 ORDER BY direction', [chunkCard.id])).rows
      assert.equal(progress.length, 2)
      for (const [index, row] of progress.entries()) {
        await actor(db, student)
        if (index === 1) {
          const spacer = (await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='de_to_native'", [wordCard.id])).rows[0].id
          assert.equal((await result(db, 'SELECT submit_vocabulary_answer($1,$2,$3,$4) result', [spacer, false, 'встреча', 'ru'])).isCorrect, true)
        }
        const response = await result(db, 'SELECT submit_vocabulary_answer($1,$2,$3,$4) result', [row.id, false, row.direction === 'native_to_de' ? 'Alles klar!' : 'Всё понятно!', 'ru'])
        assert.equal(response.isCorrect, true, JSON.stringify(response))
        assert.equal(response.newPhase, 2)
      }
    })
    await t.test('rerun updates only seed-owned content, retains IDs, existing answer arrays and all progress', async () => {
      const before = await contents(db)
      const changed = structuredClone(payload)
      changed.units[0].cards[0].word_de = 'Arzttermin'; changed.units[0].cards[0].alternative_answers_de = ['a new alternative']
      changed.units[0].cards[0].translations.de.context_sentence = 'Jan vereinbart einen Arzttermin.'
      await put(db, 'der Arzttermin'); await put(db, 'Jan vereinbart einen Arzttermin.')
      const saved = await call(db, changed)
      assert.equal(saved.reused_count, 2, JSON.stringify(saved))
      const after = await contents(db)
      assert.deepEqual(after.progress, before.progress)
      assert.equal(after.cards.find(c => c.id === wordCard.id).word_de, 'Arzttermin')
      assert.deepEqual(after.cards.find(c => c.id === wordCard.id).alternative_answers_de, [])
      assert.equal(after.cards.length, 2)
    })
    await t.test('legacy matches keep original cards, recordings, answers and core translations on repeated imports', async () => {
      const legacyId = id(904), plannedId = id(905), teacherUrl = 'https://recordings.example.test/teacher.mp3'
      await db.exec('RESET ROLE')
      await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,audio_url,alternative_answers_de) VALUES($1,$2,'Brot','das',$3,ARRAY['Brötchen'])", [legacyId, vocabularyUnit, teacherUrl])
      await db.query("INSERT INTO vocabulary_translations(card_id,locale,translation,context_sentence) VALUES($1,'de',NULL,'Paul kauft Brot.'),($1,'ru','хлеб','Пауль покупает хлеб.')", [legacyId])
      const source = card(905, { word_de: 'Brot', article: 'das', chunk_de: 'Brot kaufen' })
      for (const text of ['das Brot', 'Brot kaufen', 'Paul kauft Brot.']) await put(db, text)
      const saved = await call(db, seed([unit([source])]))
      assert.equal(saved.units[0].cards[0].card_id, legacyId, JSON.stringify(saved))
      assert.notEqual(saved.units[0].cards[0].card_id, plannedId)
      source.translations.ru.translation = 'would overwrite legacy'; source.translations.de.context_sentence = 'would overwrite legacy'
      assert.equal((await call(db, seed([unit([source])]))).card_count, 1)
      await db.exec('RESET ROLE')
      const actual = (await db.query('SELECT audio_url,alternative_answers_de,source_id FROM learning_vocabulary_cards WHERE id=$1', [legacyId])).rows[0]
      assert.deepEqual(actual, { audio_url: teacherUrl, alternative_answers_de: ['Brötchen'], source_id: source.source_id })
      assert.deepEqual((await db.query("SELECT translation,context_sentence FROM vocabulary_translations WHERE card_id=$1 AND locale='ru'", [legacyId])).rows[0], { translation: 'хлеб', context_sentence: 'Пауль покупает хлеб.' })
    })
    await t.test('explicit baseline-checked male-character revisions retain historic word/sentence answers and progress', async () => {
      const legacyWordId = id(930), legacySentenceId = id(931), teacherUrl = 'https://recordings.example.test/legacy-teacher.mp3'
      await db.exec('RESET ROLE')
      await db.query("INSERT INTO learning_vocabulary_cards(id,unit_id,word_de,article,plural,sentence_practice,audio_url,alternative_answers_de) VALUES($1,$3,'Lehrerin','die','Lehrerinnen',false,$4,ARRAY['existing word metadata']),($2,$3,'Nachbarin','die','Nachbarinnen',true,$4,ARRAY['Meine Nachbarin kommt heute.'])", [legacyWordId, legacySentenceId, vocabularyUnit, teacherUrl])
      await db.query("UPDATE learning_vocabulary_cards SET target_form=ARRAY['meine','Nachbarin'] WHERE id=$1", [legacySentenceId])
      for (const [cardId, context] of [[legacyWordId, 'Die Lehrerin arbeitet hier.'], [legacySentenceId, 'Ich besuche meine Nachbarin.']]) {
        for (const locale of ['de', 'en', 'ru', 'uk', 'tr']) await db.query('INSERT INTO vocabulary_translations(card_id,locale,translation,context_sentence) VALUES($1,$2,$3,$4)', [cardId, locale, locale === 'de' ? null : 'legacy translation', locale === 'de' ? context : 'legacy context'])
      }
      await actor(db, student)
      await result(db, 'SELECT initialize_vocabulary_cards($1) result', [JSON.stringify([{ cardId: legacyWordId, alreadyKnown: false }, { cardId: legacySentenceId, alreadyKnown: false }])])
      const historicProgress = (await db.query("SELECT card_id,id FROM vocabulary_direction_progress WHERE card_id=ANY($1) AND direction='native_to_de' ORDER BY card_id", [[legacyWordId, legacySentenceId]])).rows
      const historicResponses = []
      for (const [index, row] of historicProgress.entries()) {
        const answer = row.card_id === legacyWordId ? 'die Lehrerin' : 'Ich besuche meine Nachbarin.'
        const saved = await result(db, 'SELECT submit_vocabulary_answer_once($1,$2,$3,$4,$5) result', [id(2930 + index), row.id, false, answer, 'ru'])
        assert.equal(saved.isCorrect, true, JSON.stringify(saved))
        historicResponses.push({ request: id(2930 + index), progress: row.id, answer, saved })
      }
      const before = await contents(db)
      const revisedWord = card(930, { word_de: 'Lehrer', article: 'der', plural: 'Lehrer', chunk_de: null,
        legacy_revision: { word_de: 'Lehrerin', article: 'die', context_sentence_de: 'Die Lehrerin arbeitet hier.' },
        translations: { ...wordCard.translations, de: { context_sentence: 'Der Lehrer arbeitet hier.' } } })
      const revisedSentence = card(931, { word_de: 'Nachbar', article: 'der', plural: 'Nachbarn', sentence_practice: true, chunk_de: null, target_form: ['meinen', 'Nachbarn'],
        legacy_revision: { word_de: 'Nachbarin', article: 'die', context_sentence_de: 'Ich besuche meine Nachbarin.' },
        translations: { ...wordCard.translations, de: { context_sentence: 'Ich besuche meinen Nachbarn.' } } })
      const revised = seed([unit([revisedWord, revisedSentence])])
      assert.equal((await call(db, revised)).error, 'prepared_audio_required')
      assert.deepEqual(await contents(db), before, 'failed publication also rolls back private historic-answer capture')
      // Old variants are accepted answers only; they need no new spoken source.
      for (const text of ['der Lehrer', 'Der Lehrer arbeitet hier.', 'der Nachbar', 'Ich besuche meinen Nachbarn.']) await put(db, text)
      const saved = await call(db, revised)
      assert.equal(saved.card_count, 2, JSON.stringify(saved))
      assert.equal(saved.units[0].cards[0].card_id, legacyWordId)
      const after = await contents(db)
      assert.deepEqual(after.progress, before.progress)
      assert.deepEqual(after.cards.find(c => c.id === legacyWordId).alternative_answers_de, ['existing word metadata'])
      assert.deepEqual(after.cards.find(c => c.id === legacySentenceId).alternative_answers_de, ['Meine Nachbarin kommt heute.'])
      assert.equal(after.cards.find(c => c.id === legacyWordId).audio_url, teacherUrl)
      assert.deepEqual(after.cards.find(c => c.id === legacySentenceId).target_form, ['meinen', 'Nachbarn'], 'current displayed target form uses male revised content')
      assert.equal(after.revisions.length, 2)
      assert.deepEqual(after.receipts, before.receipts, 'historic committed response/answer receipts stay unchanged')
      await actor(db, student)
      for (const row of historicResponses) assert.deepEqual(await result(db, 'SELECT submit_vocabulary_answer_once($1,$2,$3,$4,$5) result', [row.request, row.progress, false, row.answer, 'ru']), row.saved, 'old answer receipt still replays exactly')
      assert.equal((await call(db, revised)).card_count, 2, 'identical baseline/replacement replay is idempotent')
      const replay = await contents(db)
      assert.deepEqual(replay.progress, before.progress); assert.deepEqual(replay.revisions, after.revisions)
      const check = async (cardId, answer) => {
        await actor(db, student)
        const progressId = (await db.query("SELECT id FROM vocabulary_direction_progress WHERE card_id=$1 AND direction='native_to_de'", [cardId])).rows[0].id
        const response = await result(db, 'SELECT check_vocabulary_retry($1,$2,$3) result', [progressId, answer, 'ru'])
        assert.equal(response.success, true, JSON.stringify(response))
        return response
      }
      for (const answer of ['der Lehrer', 'die Lehrerin', 'die Lehrerinnen', 'die Lehrerin / die Lehrerinnen']) assert.equal((await check(legacyWordId, answer)).isCorrect, true, answer)
      for (const answer of ['Ich besuche meinen Nachbarn.', 'Ich besuche meine Nachbarin.', 'Meine Nachbarin kommt heute.']) assert.equal((await check(legacySentenceId, answer)).isCorrect, true, answer)
      assert.equal((await check(legacyWordId, 'das Lehrer')).isCorrect, false, 'new canonical article checks remain strict')
      assert.equal((await check(legacyWordId, 'Lehrerinnen')).isCorrect, false, 'historical nouns retain mandatory articles for plural answers')
      const stale = structuredClone(revised)
      stale.units[0].cards[0].legacy_revision.word_de = 'another historical headword'
      const stableBefore = await contents(db)
      assert.equal((await call(db, stale)).error, 'invalid_vocabulary_seed')
      assert.deepEqual(await contents(db), stableBefore, 'stale baseline rejects the whole batch atomically')
    })
    await t.test('drafts are private to staff and cannot bypass an existing active target', async () => {
      const draft = seed([unit([card(910, { word_de: 'Entwurf', chunk_de: null })], { id: id(911), label: 'Neuer Entwurf' })])
      const saved = await call(db, draft, false)
      assert.equal(saved.card_count, 1, JSON.stringify(saved))
      await db.exec('RESET ROLE')
      assert.equal((await db.query('SELECT is_active FROM learning_units WHERE id=$1', [id(911)])).rows[0].is_active, false)
      await actor(db, student)
      assert.equal((await db.query('SELECT * FROM learning_vocabulary_cards WHERE id=$1', [id(910)])).rows.length, 0)
      const before = await contents(db)
      assert.equal((await call(db, draft, true)).error, 'prepared_audio_required')
      assert.deepEqual(await contents(db), before)
      const active = seed([unit([card(912, { word_de: 'Ohne Aufnahme', chunk_de: null })])])
      assert.equal((await call(db, active, false)).error, 'prepared_audio_required')
    })
    await t.test('a duplicate logical card or stolen identity rolls back the whole batch', async () => {
      const before = await contents(db)
      const stolen = seed([unit([card(901)], { id: id(920), label: 'Identity collision' })])
      assert.equal((await call(db, stolen)).error, 'invalid_vocabulary_seed')
      assert.deepEqual(await contents(db), before)
      const repeated = seed([unit([card(925), card(925)])])
      assert.equal((await call(db, repeated)).error, 'invalid_vocabulary_seed')
      assert.deepEqual(await contents(db), before)
    })
    await t.test('students, teachers and forged JWT service-role claims cannot import', async () => {
      for (const person of [student, teacher]) {
        await actor(db, person)
        await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)")
        await assert.rejects(result(db, 'SELECT public.sitov_import_vocabulary_seed($1,true) result', [JSON.stringify(payload)]), /permission denied/)
        await assert.rejects(db.query('SELECT * FROM vocabulary_private.sitov_seed_card_origins'), /permission denied/)
      }
    })
    await t.test('standard CMS retains chunks and publication guard rejects unprepared changed chunks', async () => {
      await put(db, 'einen Arzttermin vereinbaren')
      await actor(db, teacher)
      const fields = { chunk_de: 'einen Arzttermin vereinbaren', content_kind: 'vocabulary' }
      const translations = Object.entries(wordCard.translations).map(([locale, value]) => ({ locale, ...value }))
      const saved = await result(db, 'SELECT save_learning_content($1,$2,$3) result', ['vocabulary', JSON.stringify({ unit: { level: 'A1.1', label: 'Lektion 1' }, fields, translations }), wordCard.id])
      assert.equal(saved.id, wordCard.id, JSON.stringify(saved))
      assert.equal((await db.query('SELECT chunk_de FROM learning_vocabulary_cards WHERE id=$1', [wordCard.id])).rows[0].chunk_de, fields.chunk_de)
      const omittedChunks = translations.map(value => { const copy = { ...value }; delete copy.chunk_translation; return copy })
      assert.equal((await result(db, 'SELECT save_learning_content($1,$2,$3) result', ['vocabulary', JSON.stringify({ unit: { level: 'A1.1', label: 'Lektion 1' }, fields: { plural: 'Termine' }, translations: omittedChunks }), wordCard.id])).id, wordCard.id)
      assert.equal((await db.query("SELECT chunk_translation FROM vocabulary_translations WHERE card_id=$1 AND locale='ru'", [wordCard.id])).rows[0].chunk_translation, wordCard.translations.ru.chunk_translation, 'older CMS callers preserve omitted localized chunks')
      assert.equal((await db.query('SELECT chunk_de FROM learning_vocabulary_cards WHERE id=$1', [wordCard.id])).rows[0].chunk_de, fields.chunk_de)
      const before = await contents(db)
      await actor(db, teacher)
      assert.equal((await result(db, 'SELECT save_learning_content($1,$2,$3) result', ['vocabulary', JSON.stringify({ unit: { level: 'A1.1', label: 'Lektion 1' }, fields: { content_kind: 'chunk', article: 'die' }, translations }), wordCard.id])).error, 'invalid_input', 'direct CMS RPC cannot give an explicit chunk a grammatical article field')
      assert.equal((await result(db, 'SELECT save_learning_content($1,$2,$3) result', ['vocabulary', JSON.stringify({ unit: { level: 'A1.1', label: 'Lektion 1' }, fields: { chunk_de: 'Ein unvorbereiteter Chunk' }, translations }), wordCard.id])).error, 'prepared_audio_required')
      assert.deepEqual(await contents(db), before)
    })
    await t.test('reapplying the migration retains rows, private ownership and function ACLs', async () => {
      const before = await contents(db)
      await db.exec(await readFile(migrationUrl, 'utf8'))
      assert.deepEqual(await contents(db), before)
      const acl = (await db.query("SELECT prosecdef,has_function_privilege('authenticated',oid,'EXECUTE') authenticated,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('service_role',oid,'EXECUTE') service FROM pg_proc WHERE oid='public.sitov_import_vocabulary_seed(jsonb,boolean)'::regprocedure")).rows[0]
      assert.deepEqual(acl, { prosecdef: false, authenticated: false, anon: false, service: true })
    })
  } finally { await db.close() }
})
