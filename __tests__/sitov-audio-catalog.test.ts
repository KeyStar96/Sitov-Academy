/** @jest-environment node */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { bundleSitovAudio, collectSitovAudioCatalog, missingSitovAudioCatalog, sitovExerciseAudioTexts } from '../scripts/sitov-audio-catalog'
import { neuralAudioPath, SITOV_QWEN_PROFILE_FINGERPRINT } from '../lib/audio/neural-identity'
import { SITOV_QWEN_PROFILE, vocabularyAudioText } from '../lib/audio/neural-config'
import { preparedLearningAudioTexts } from '../lib/audio/prepared-content'

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

test.each([
  ['e42167d3-36c4-5270-a696-406897292843', 'gleich', 'Es ist 8:59. Oleh sagt: „Es ist gleich neun.“'],
  ['c0ae363d-6c1f-58a7-a381-b7e206815e1f', 'kein', 'Oleh fährt immer Bus. Er hat kein Fahrrad.'],
  ['c0be9a3b-01ed-5a00-a717-c8dc3c6e188a', 'Ihr', 'Herr Lindner fragt Herrn Demir: „Wie heißt Ihr Sohn?“'],
])('keeps the reviewed source sentence filled identically for authoring and publication: %s', (id, answer, spoken) => {
  const paths = JSON.parse(readFileSync(join(__dirname, '../supabase/seeds/path-a1.1.json'), 'utf8')) as {
    nodes: { exercises: { id: string; exercise_type: string; content: Record<string, unknown> }[] }[]
  }[]
  const exercise = paths.flatMap(path => path.nodes.flatMap(node => node.exercises)).find(row => row.id === id)
  expect(exercise).toBeDefined()
  expect(exercise!.content.correct_answer).toBe(answer)
  expect(exercise!.content.accepted_answers).toEqual([answer])
  expect(sitovExerciseAudioTexts(exercise!.exercise_type, exercise!.content)).toEqual([spoken])
  expect(preparedLearningAudioTexts('exercises', { type: exercise!.exercise_type, content: exercise!.content })).toEqual([spoken])
})
const temporary: string[] = []
const directory = () => { const path = mkdtempSync(join(tmpdir(), 'sitov-catalog-test-')); temporary.push(path); return path }
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }) })

function prepared(texts = ['Guten Morgen.', 'Einen Kaffee bitte.']) {
  const stage = directory()
  const catalog = collectSitovAudioCatalog({ daily_quest_assignment_audio_texts: texts })
  const entries: Record<string, any> = {}
  for (const row of catalog.rows) {
    const bytes = Buffer.alloc(200, 1); bytes.write('ID3')
    const output = join(stage, `${row.id}.mp3`)
    const metadata = `${output}.json`
    writeFileSync(output, bytes)
    writeFileSync(metadata, JSON.stringify({
      engine: SITOV_QWEN_PROFILE.engine, voice: SITOV_QWEN_PROFILE.voice,
      revision: SITOV_QWEN_PROFILE.revision, profileFingerprint: SITOV_QWEN_PROFILE_FINGERPRINT,
      modelRevision: SITOV_QWEN_PROFILE.tts.mlxRevision, referenceSha256: SITOV_QWEN_PROFILE.reference.audioSha256,
      sampleRate: 24000, bitrate: '48k', channels: 1, rate: 1,
      audioSha256: hash(bytes), textSha256: hash(row.text),
      wordTimings: row.text.split(/\s+/u).map((_, index) => ({ start: 0.35 + index, end: 0.8 + index })),
    }))
    entries[row.id] = { ...row, status: 'complete', rate: 1, output, metadata }
  }
  return { catalog, manifest: { profileFingerprint: SITOV_QWEN_PROFILE_FINGERPRINT, entries }, stage }
}

test('catalog uses the exact grammar control strings and canonical headwords', () => {
  expect(sitovExerciseAudioTexts('fill_in_blank', { text_before: 'Ich ', correct_answer: 'möchte', text_after: ' einen Kaffee.' }))
    .toEqual(['möchte', 'Ich möchte einen Kaffee.'])
  expect(sitovExerciseAudioTexts('multiple_choice', { question: 'Das ist ___ Brot.', correct_answer: 'ein' })).toEqual(['Das ist ein Brot.'])
  expect(sitovExerciseAudioTexts('multiple_choice', { question: 'Was möchten Sie?', correct_answer: 'Einen Kaffee.' })).toEqual(['Was möchten Sie? Einen Kaffee.'])
  expect(sitovExerciseAudioTexts('sentence_building', { correct_answer: 'Ich lerne Deutsch.' })).toEqual(['Ich lerne Deutsch.'])
  expect(sitovExerciseAudioTexts('unrecognized', { correct_answer: 'unused' })).toEqual([])
  const card = { id: 'unchanged-card-id', article: 'der', word_de: '  Kaffee  ' }
  const source = { learning_vocabulary_cards: [card], learning_exercises: [{ id: 'unchanged-exercise-id', type: 'fill_in_blank', content: { text_before: 'Ich  ', correct_answer: 'möchte', text_after: '\n einen Kaffee.' } }] }
  const before = JSON.stringify(source)
  expect(collectSitovAudioCatalog(source).rows.map(row => row.text).sort()).toEqual(['Ich möchte einen Kaffee.', 'der Kaffee', 'möchte'].sort())
  expect(vocabularyAudioText(card)).toBe('der Kaffee')
  expect(JSON.stringify(source)).toBe(before)
})

test('rendered quests, frozen snapshots and static references deduplicate NFC text with source provenance', () => {
  const catalog = collectSitovAudioCatalog({
    learning_reading_texts: [{ id: 'reading', sentence_de: '  Das Brötchen.  ' }],
    daily_quests: [{ id: 'quest', content: { scene: { audioText: 'Das Bro\u0308tchen.' }, steps: [{ words: [{ audioText: '\nDas Brötchen.' }] }] } }],
    daily_quest_assignment_audio_texts: ['Das Brötchen.'],
  }, { 'sitov-broetchen.mp3': 'Das Brötchen.' })
  expect(catalog.rows).toHaveLength(1)
  expect(catalog.rows[0].sources).toHaveLength(5)
  expect(catalog.rows[0].cachePath).toBe(neuralAudioPath('Das Brötchen.', 'de', 'male'))
  expect(catalog.voice).toBe('sitov-qwen-male-de-v1')
  expect(catalog.profileFingerprint).toBe(SITOV_QWEN_PROFILE_FINGERPRINT)
})

test('German canonical identity is shared by every UI locale and distinct from translation audio', () => {
  const german = neuralAudioPath('Guten Tag.', 'de')
  expect(neuralAudioPath('  Guten\nTag. ', 'de', 'male')).toBe(german)
  for (const language of ['ru', 'uk', 'en', 'tr'] as const) expect(neuralAudioPath('Guten Tag.', language)).not.toBe(german)
  expect(() => neuralAudioPath('Guten Tag.', 'de', 'female' as any)).toThrow()
  expect(() => neuralAudioPath('Guten Tag.', 'en', 'male')).toThrow()
})

test('a fresh follow-up export includes queued unpublished text without learner metadata', () => {
  const first = collectSitovAudioCatalog({ pending_audio_preparations: [] })
  expect(first.rows).toEqual([])
  const followUp = collectSitovAudioCatalog({ pending_audio_preparations: [
    { text: '  die Tu\u0308r\n', cache_path: neuralAudioPath('die Tür', 'de'), profile_fingerprint: SITOV_QWEN_PROFILE_FINGERPRINT, owner: 'must-not-be-exported' },
    { text: 'die Tür', cache_path: neuralAudioPath('die Tür', 'de') },
  ] })
  expect(followUp.rows).toEqual([{ id: neuralAudioPath('die Tür', 'de').split('/').pop()!.replace('.mp3', ''), text: 'die Tür', cachePath: neuralAudioPath('die Tür', 'de'), sources: ['requested:local-preparation'] }])
  expect(JSON.stringify(followUp)).not.toContain('must-not-be-exported')
})

test('catalog rejects unresolved placeholders and invalid input before audio authoring', () => {
  for (const text of ['x'.repeat(3001), 'Bad\u0001text', 'Ich möchte {{slot}}.', 'Ich möchte [[acc:food]].']) {
    expect(() => collectSitovAudioCatalog({ daily_quest_assignment_audio_texts: [text] })).toThrow()
  }
  const catalog = collectSitovAudioCatalog({ vocabulary_translations: [
    { card_id: 'card', locale: 'de', context_sentence: 'Ich trinke Kaffee.' },
    { card_id: 'card', locale: 'ru', context_sentence: 'Я пью кофе.' },
  ] })
  expect(catalog.rows.map(row => row.text)).toEqual(['Ich trinke Kaffee.'])
})

test('bundle preserves portable direct Storage metadata and complete aligned word coverage', () => {
  const { catalog, manifest } = prepared()
  const destination = directory()
  const bundle = bundleSitovAudio(catalog, manifest, destination)
  expect(bundle.rows).toHaveLength(2)
  for (const row of bundle.rows) {
    const metadata = JSON.parse(readFileSync(join(destination, `${row.cachePath}.json`), 'utf8'))
    expect(metadata.voice).toBe(SITOV_QWEN_PROFILE.voice)
    expect(metadata.profileFingerprint).toBe(SITOV_QWEN_PROFILE_FINGERPRINT)
    expect(metadata.wordTimings).toHaveLength(row.text.split(/\s+/u).length)
    expect(metadata.audioSha256).toBe(hash(readFileSync(join(destination, row.cachePath))))
    expect(JSON.stringify(metadata)).not.toContain(manifest.entries[row.id].output)
  }
})

test('catalog path traversal and mismatched content addresses are rejected before bundle writes', () => {
  for (const kind of ['relative', 'absolute', 'identity']) {
    const owner = directory()
    const destination = join(owner, 'bundle'); mkdirSync(destination)
    const path = kind === 'relative' ? '../escaped.mp3' : kind === 'absolute' ? join(owner, 'escaped.mp3')
      : 'sitov-qwen-v1/de/' + '0'.repeat(64) + '.mp3'
    const { catalog, manifest } = prepared(['Guten Morgen.'])
    const row = catalog.rows[0]
    row.cachePath = path
    manifest.entries[row.id].cachePath = path
    expect(() => bundleSitovAudio(catalog, manifest, destination)).toThrow()
    expect(existsSync(join(destination, 'sitov-audio-bundle.json'))).toBe(false)
  }
})

test('one bad later audio entry rejects the complete bundle before any copies', () => {
  for (const failure of ['missing', 'corrupt', 'voice', 'alignment', 'prepared-rate', 'metadata-rate'] as const) {
    const { catalog, manifest } = prepared()
    const broken = manifest.entries[catalog.rows[1].id]
    if (failure === 'missing') rmSync(broken.output)
    else if (failure === 'corrupt') writeFileSync(broken.output, Buffer.alloc(200))
    else if (failure === 'prepared-rate') broken.rate = .5
    else {
      const metadata = JSON.parse(readFileSync(broken.metadata, 'utf8'))
      if (failure === 'voice') metadata.voice = 'female'
      else if (failure === 'metadata-rate') metadata.rate = .5
      else metadata.wordTimings.pop()
      writeFileSync(broken.metadata, JSON.stringify(metadata))
    }
    const destination = directory()
    expect(() => bundleSitovAudio(catalog, manifest, destination)).toThrow()
    expect(existsSync(join(destination, catalog.rows[0].cachePath))).toBe(false)
    expect(existsSync(join(destination, 'sitov-audio-bundle.json'))).toBe(false)
  }
})

function inventoryFor(catalog: ReturnType<typeof collectSitovAudioCatalog>) {
  return catalog.rows.map(row => ({ bucket_id: 'audio_cache', name: row.cachePath,
    archived_at: null, is_delete_marker: false, metadata: { mimetype: 'audio/mpeg', size: 200 },
    user_metadata: { engine: SITOV_QWEN_PROFILE.engine, voice: SITOV_QWEN_PROFILE.voice,
      revision: SITOV_QWEN_PROFILE.revision, profileFingerprint: SITOV_QWEN_PROFILE_FINGERPRINT,
      textSha256: hash(row.text), audioSha256: 'a'.repeat(64),
      wordTimings: row.text.split(/\s+/u).map((_, index) => ({ start: .35 + index, end: .8 + index })) } }))
}

test('a different Mac plans only missing current-profile Storage assets and preserves the complete catalog', () => {
  const catalog = collectSitovAudioCatalog({ daily_quest_assignment_audio_texts: ['Ein Brot.', 'Der Kaffee.'] })
  const before = JSON.stringify(catalog)
  const missing = missingSitovAudioCatalog(catalog, inventoryFor(catalog).slice(0, 1))
  expect(missing.rows).toEqual(catalog.rows.slice(1))
  expect(missing.reusedStorageRows).toEqual([{ id: catalog.rows[0].id, cachePath: catalog.rows[0].cachePath, audioSha256: 'a'.repeat(64), bytes: 200 }])
  expect(missing.inventoryCoverage).toMatchObject({ fullCatalogRows: 2, reusedRows: 1, missingRows: 1 })
  expect(JSON.stringify(catalog)).toBe(before)
  expect(() => missingSitovAudioCatalog(catalog, undefined)).toThrow('fresh storage_audio_inventory')
})

test('inventory never skips wrong identity, text, hashes, timing counts, MIME, or size', () => {
  const catalog = collectSitovAudioCatalog({ daily_quest_assignment_audio_texts: ['Ein Brot.'] })
  for (const failure of ['engine', 'voice', 'revision', 'profileFingerprint', 'textSha256', 'audioSha256', 'wordTimings', 'timing-overlap', 'timing-nan', 'timing-bound', 'mime', 'size-string', 'size-range']) {
    const inventory = inventoryFor(catalog)
    const object: any = inventory[0]
    if (failure === 'wordTimings') object.user_metadata.wordTimings.pop()
    else if (failure === 'timing-overlap') object.user_metadata.wordTimings[1].start = 0
    else if (failure === 'timing-nan') object.user_metadata.wordTimings[0].end = NaN
    else if (failure === 'timing-bound') object.user_metadata.wordTimings[1].end = 1201
    else if (failure === 'mime') object.metadata.mimetype = 'application/octet-stream'
    else if (failure === 'size-string') object.metadata.size = '200'
    else if (failure === 'size-range') object.metadata.size = 2097153
    else object.user_metadata[failure] = 'wrong'
    const missing = missingSitovAudioCatalog(catalog, inventory)
    expect(missing.rows).toEqual(catalog.rows)
    expect(missing.inventoryCoverage.invalidExistingPaths).toEqual([catalog.rows[0].cachePath])
  }
})

test('archived objects/delete markers cannot establish coverage and duplicate active versions are refused', () => {
  const catalog = collectSitovAudioCatalog({ daily_quest_assignment_audio_texts: ['Ein Brot.'] })
  for (const failure of ['archived', 'deleted', 'other-bucket']) {
    const object: any = inventoryFor(catalog)[0]
    if (failure === 'archived') object.archived_at = '2026-10-03T00:00:00Z'
    else if (failure === 'deleted') object.is_delete_marker = true
    else object.bucket_id = 'other'
    expect(missingSitovAudioCatalog(catalog, [object]).rows).toEqual(catalog.rows)
  }
  const object = inventoryFor(catalog)[0]
  expect(() => missingSitovAudioCatalog(catalog, [object, object])).toThrow('Ambiguous active Storage object')
})

function prospectiveSeed() {
  const titles = Object.fromEntries(['en', 'ru', 'uk', 'tr'].map(locale => [locale, { title: 'Title' }]))
  const rules = Object.fromEntries(['en', 'ru', 'uk', 'tr'].map(locale => [locale, { rule: 'Rule' }]))
  const translations = Object.fromEntries(['en', 'ru', 'uk', 'tr'].map(locale => [locale, { instruction: 'Instruction', hint: 'Hint', explanation: 'Explanation' }]))
  const exercise = (index: number, exercise_type: string, content: any) => ({
    id: `00000000-0000-5000-8000-${String(index).padStart(12, '0')}`, ref: `ref-${index}`, goal: 'goal',
    exercise_type, content, hint: 'Hinweis', explanation: 'Erklärung', explanation_card: 'card', translations,
  })
  const fill = { target_form: ['Verb'], text_before: 'Der Zug ', text_after: '.', correct_answer: 'kommt', accepted_answers: ['kommt'] }
  const choice = { target_form: ['Artikel'], question: 'Das ist ___ Brot.', options: ['ein', 'einen'], correct_answer: 'ein', accepted_answers: ['ein'] }
  const choice2 = { target_form: ['Bestellung'], question: 'Was möchten Sie?', options: ['Einen Kaffee.', 'Ein Brot.'], correct_answer: 'Einen Kaffee.', accepted_answers: ['Einen Kaffee.'] }
  return [{ id: 'path', level: 'A1.1', path: 1, slug: 'sitov-test-path', title: 'Lernpfad', translations: titles, is_active: true,
    unit: { level: 'A1.1', trainer: 'exercises', label: 'Lernpfad', sort_order: 1 },
    objectives: [{ id: 'goal', area: 'grammar', description: 'Artikel verwenden' }],
    nodes: [
      { id: 'practice', kind: 'practice', sort_order: 1, topic: 'Artikel', title: 'Übung', translations: titles, goals: ['goal'],
        merkkarte: { card: 'card', rule: 'Der Zug kommt.', examples: ['Der Zug kommt.'], highlight: 'verb', translations: rules }, exercises: [exercise(1, 'fill_in_blank', fill)] },
      { id: 'review', kind: 'review', sort_order: 2, topic: 'Artikel', title: 'Wiederholung', translations: titles, goals: ['goal'], exercises: [exercise(2, 'multiple_choice', choice)] },
      { id: 'test', kind: 'test', sort_order: 3, test_size: 1, topic: 'Artikel', title: 'Test', translations: titles, goals: ['goal'], exercises: [
        exercise(3, 'sentence_building', { target_form: ['Satz'], parts: ['Ungehörter', 'Satz.'], correct_answer: 'Ungehörter Satz.', accepted_answers: ['Ungehörter Satz.'] }), exercise(4, 'multiple_choice', choice2)] },
      { id: 'inactive', kind: 'special', anchor_node_id: 'practice', is_active: false, sort_order: 4, topic: 'Artikel', title: 'Entwurf', translations: titles, goals: ['goal'], exercises: [exercise(5, 'fill_in_blank', { ...fill, correct_answer: 'wartet', accepted_answers: ['wartet'] })] },
    ] }]
}

test('prospective seed includes inactive-node Fill/MC reachable through existing controls and preserves the seed', () => {
  const seed = prospectiveSeed()
  const before = JSON.stringify(seed)
  const catalog = collectSitovAudioCatalog({}, {}, {}, seed)
  expect(catalog.rows.map(row => row.text).sort()).toEqual(['kommt', 'Der Zug kommt.', 'Das ist ein Brot.', 'Was möchten Sie? Einen Kaffee.', 'wartet', 'Der Zug wartet.'].sort())
  expect(catalog.rows.every(row => row.sources.every(source => source.startsWith('path-seed:')))).toBe(true)
  expect(JSON.stringify(seed)).toBe(before)
  seed[0].is_active = false
  expect(collectSitovAudioCatalog({}, {}, {}, seed).rows).toEqual([])
  expect(() => collectSitovAudioCatalog({}, {}, {}, [{ id: 'invalid' }])).toThrow('Invalid prospective learning-path seed')
})

test('bundle refuses an open recovery marker even after all prepared manifest entries are complete', () => {
  for (const explicitManifestDirectory of [true, false]) {
    const { catalog, manifest, stage } = prepared()
    const destination = directory()
    writeFileSync(join(stage, '.sitov-qwen-reuse-transaction.json'), JSON.stringify({ phase: 'manifest-already-replaced' }))
    expect(() => bundleSitovAudio(catalog, manifest, destination, explicitManifestDirectory ? stage : undefined)).toThrow('--recover')
    expect(existsSync(join(destination, 'sitov-audio-bundle.json'))).toBe(false)
    expect(existsSync(join(destination, catalog.rows[0].cachePath))).toBe(false)
  }
})

test('explicit source manifest directory blocks recovery before output metadata reads in another directory', () => {
  const { catalog, manifest } = prepared()
  const sourceDirectory = directory()
  const destination = directory()
  writeFileSync(join(sourceDirectory, '.sitov-qwen-reuse-transaction.json'), '{}')
  // A supplied manifest directory remains authoritative even with custom paths.
  rmSync(manifest.entries[catalog.rows[0].id].metadata)
  expect(() => bundleSitovAudio(catalog, manifest, destination, sourceDirectory)).toThrow('--recover')
  expect(existsSync(join(destination, 'sitov-audio-bundle.json'))).toBe(false)
})

function prospectiveVocabularySeed() {
  const translations = Object.fromEntries(['de', 'en', 'ru', 'uk', 'tr'].map(locale => [locale, {
    translation: locale === 'de' ? null : 'Coffee', chunk_translation: locale === 'de' ? null : 'order a coffee',
    context_sentence: locale === 'de' ? 'Ich bestelle einen Kaffee.' : 'I order a coffee.',
  }]))
  return { version: 1, units: [{ id: '00000000-0000-5000-8000-000000000100', level: 'A1.2', label: 'Lektion 1 · Im Café', sort_order: 1,
    cards: [{ id: '00000000-0000-5000-8000-000000000101', source_id: 'sitov-vocabulary-coffee', content_kind: 'vocabulary',
      word_de: ' Kaffee ', article: 'der', plural: 'die Kaffees', chunk_de: 'einen Kaffee bestellen', sentence_practice: false,
      sentence_de: 'Dieser Teacher-Quellsatz wird nicht importiert.', target_form: ['Akkusativ'], alternative_answers_de: ['Kaffee bestellen'], translations }] }] }
}

test('exported word cards include same-card chunks and German contexts without creating audio for other card fields', () => {
  const catalog = collectSitovAudioCatalog({
    learning_vocabulary_cards: [{ id: 'same-card', word_de: 'Kaffee', article: 'der', chunk_de: 'einen Kaffee bestellen', plural: 'die Kaffees', alternative_answers_de: ['Ersatz'], target_form: ['Akkusativ'] }],
    vocabulary_translations: [{ card_id: 'same-card', locale: 'de', context_sentence: 'Ich bestelle einen Kaffee.' }, { card_id: 'same-card', locale: 'en', context_sentence: 'I order a coffee.' }],
  })
  expect(catalog.rows.map(row => row.text).sort()).toEqual(['der Kaffee', 'einen Kaffee bestellen', 'Ich bestelle einen Kaffee.'].sort())
  expect(catalog.rows.find(row => row.text === 'einen Kaffee bestellen')?.sources).toEqual(['vocabulary:same-card:chunk'])
})

test('named authored records combine repeatedly with NFC deduplication, canonical paths and filename/audio-ID provenance', () => {
  const input = { authoredTextFiles: [
    { name: '/private/sitov-first.json', value: { 'sitov-audio-1': '  Das Bro\u0308tchen.\n' } },
    { name: '/private/sitov-second.json', value: { 'sitov-audio-2': 'Das Brötchen.', 'sitov-audio-3': 'Ein neues Hörbeispiel.' } },
  ] }
  const before = JSON.stringify(input)
  const catalog = collectSitovAudioCatalog({}, {}, {}, undefined, input)
  expect(catalog.rows).toHaveLength(2)
  const shared = catalog.rows.find(row => row.text === 'Das Brötchen.')!
  expect(shared.cachePath).toBe(neuralAudioPath('Das Brötchen.', 'de'))
  expect(shared.sources).toEqual(['authored-file:sitov-first.json:sitov-audio-1', 'authored-file:sitov-second.json:sitov-audio-2'])
  expect(JSON.stringify(catalog)).not.toContain('/private/')
  expect(JSON.stringify(input)).toBe(before)
  for (const value of [null, [], {}, { id: 3 }, { id: '' }, { id: '{{unrendered}}' }]) {
    expect(() => collectSitovAudioCatalog({}, {}, {}, undefined, { authoredTextFiles: [{ name: 'invalid.json', value }] })).toThrow()
  }
})

test('all eleven frozen B1 texts use canonical proof paths without modifying their manifest', () => {
  const filename = resolve(__dirname, '../scripts/sitov-exam-audio-manifest.json')
  const before = readFileSync(filename)
  const texts: Record<string, string> = JSON.parse(before.toString())
  const catalog = collectSitovAudioCatalog({}, {}, {}, undefined, { authoredTextFiles: [{ name: filename, value: texts }] })
  expect(Object.keys(texts)).toHaveLength(11)
  expect(catalog.rows).toHaveLength(11)
  expect(Object.values(texts).reduce((count, text) => count + text.length, 0)).toBe(5371)
  for (const [id, text] of Object.entries(texts)) {
    const row = catalog.rows.find(item => item.cachePath === neuralAudioPath(text, 'de'))!
    expect(row.text).toBe(text.normalize('NFC').trim().replace(/\s+/gu, ' '))
    expect(row.sources).toEqual([`authored-file:sitov-exam-audio-manifest.json:${id}`])
  }
  expect(readFileSync(filename)).toEqual(before)
})

test('prospective vocabulary extraction follows importable version/units and authoritative de translations with one card identity', () => {
  const seed = prospectiveVocabularySeed()
  const before = JSON.stringify(seed)
  const catalog = collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: '/private/importable-vocabulary.json', value: seed } })
  expect(catalog.rows.map(row => row.text).sort()).toEqual(['der Kaffee', 'einen Kaffee bestellen', 'Ich bestelle einen Kaffee.'].sort())
  expect(catalog.rows.every(row => row.sources.length === 1 && row.sources[0].startsWith('vocabulary-seed:importable-vocabulary.json:sitov-vocabulary-coffee:'))).toBe(true)
  expect(JSON.stringify(seed)).toBe(before)
  const card: any = seed.units[0].cards[0]
  card.content_kind = 'chunk'; card.article = 'none'; card.word_de = 'Alles klar!'; card.chunk_de = null
  const chunk = collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: 'chunk-seed.json', value: seed } })
  expect(chunk.rows.map(row => row.text).sort()).toEqual(['Alles klar!', 'Ich bestelle einen Kaffee.'].sort())
})

test('unimportable vocabulary stages, duplicate identities and invalid authoritative audio fields fail before preparation', () => {
  const failures: unknown[] = [
    { schema_version: 1, locales: ['de'], levels: [] },
    { version: 1, units: [] },
  ]
  for (const kind of ['duplicate-source', 'duplicate-id', 'teacher-stage', 'de-context', 'word', 'chunk', 'article', 'translations-array']) {
    const seed = prospectiveVocabularySeed()
    const card: any = seed.units[0].cards[0]
    if (kind === 'duplicate-source') seed.units[0].cards.push(structuredClone(card))
    else if (kind === 'duplicate-id') seed.units[0].cards.push({ ...structuredClone(card), source_id: 'sitov-other-source' })
    else if (kind === 'teacher-stage') delete card.translations
    else if (kind === 'de-context') card.translations.de.context_sentence = ''
    else if (kind === 'word') card.word_de = 42
    else if (kind === 'chunk') card.chunk_de = '{{slot}}'
    else if (kind === 'article') { card.content_kind = 'chunk'; card.article = 'der' }
    else card.translations = Object.entries(card.translations).map(([locale, value]) => ({ locale, ...(value as object) }))
    failures.push(seed)
  }
  for (const value of failures) expect(() => collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: 'invalid-seed.json', value } })).toThrow()
})

test('frozen German vocabulary paths and sources remain identical when ignored foreign fields are completed', () => {
  const seed = prospectiveVocabularySeed()
  const card: any = seed.units[0].cards[0]
  const allTranslations = structuredClone(card.translations)
  card.translations = { de: allTranslations.de }
  const plan = () => collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: 'same-import-payload.json', value: seed } })
  const germanOnly = plan()
  card.translations = { ...card.translations, en: null, ru: ['still pending'], uk: 42, tr: {} }
  expect(plan()).toEqual(germanOnly)
  card.translations = allTranslations
  expect(plan()).toEqual(germanOnly)
  card.translations.de.context_sentence = 'Heute bestelle ich einen Kaffee.'
  const changed = plan()
  expect(changed.rows.find(row => row.text === 'Heute bestelle ich einen Kaffee.')?.cachePath)
    .not.toBe(germanOnly.rows.find(row => row.text === 'Ich bestelle einen Kaffee.')?.cachePath)
  expect(changed.rows.some(row => row.text === 'Ich bestelle einen Kaffee.')).toBe(false)
})

test('actual CLI repeats authored text files and combines importable vocabulary before missing-only planning', () => {
  const owner = directory()
  const file = (name: string, value: unknown) => { const path = join(owner, name); writeFileSync(path, JSON.stringify(value)); return path }
  const exported = file('export.json', { storage_audio_inventory: [] })
  const first = file('sitov-first.json', { 'sitov-one': 'Ein neues Hörbeispiel.' })
  const second = file('sitov-second.json', { 'sitov-two': 'Ein neues Hörbeispiel.', 'sitov-three': 'Noch ein neuer Text.' })
  const vocabulary = file('vocabulary.json', prospectiveVocabularySeed())
  const output = join(owner, 'missing.json'), full = join(owner, 'full.json')
  const command = resolve(__dirname, '../node_modules/.bin/ts-node')
  const argumentsBase = ['--transpile-only', '--compiler-options', '{"module":"CommonJS","moduleResolution":"node"}', resolve(__dirname, '../scripts/sitov-audio-catalog.ts'), '--export', exported]
  const result = spawnSync(command, [...argumentsBase, '--authored-texts', first, '--authored-texts', second,
    '--vocabulary-seed', vocabulary, '--missing-only', '--output', output, '--full-output', full], { encoding: 'utf8' })
  expect(result.status).toBe(0)
  const catalog = JSON.parse(readFileSync(output, 'utf8'))
  expect(catalog.preparationScope).toBe('missing-only')
  expect(JSON.parse(readFileSync(full, 'utf8')).preparationScope).toBe('full')
  expect(catalog.rows.find((row: any) => row.text === 'Ein neues Hörbeispiel.').sources).toHaveLength(2)
  expect(catalog.rows.some((row: any) => row.text === 'einen Kaffee bestellen')).toBe(true)
  const invalidOutput = join(owner, 'must-not-exist.json')
  const invalid = spawnSync(command, [...argumentsBase, '--authored-texts', '--output', invalidOutput], { encoding: 'utf8' })
  expect(invalid.status).toBe(1)
  expect(invalid.stderr).toContain('Missing --authored-texts filename')
  expect(existsSync(invalidOutput)).toBe(false)
})

test('German extraction agrees with the actual vocabulary importer on normalized identities, sorting, source guards and limits', () => {
  const cases: { seed: ReturnType<typeof prospectiveVocabularySeed>; accepted: boolean }[] = []
  const variant = (accepted: boolean, change: (seed: ReturnType<typeof prospectiveVocabularySeed>, card: any) => void) => {
    const seed = prospectiveVocabularySeed(); change(seed, seed.units[0].cards[0]); cases.push({ seed, accepted })
  }
  variant(true, seed => { seed.units[0].sort_order = 0 })
  variant(true, seed => { seed.units[0].sort_order = 1000000 })
  variant(false, seed => { seed.units[0].sort_order = 1000001 })
  variant(true, (seed, card) => {
    seed.units[0].label = '  Lektion\n 1 · Café  '; card.source_id = '  sitov-cafe\u0301\n '; card.word_de = '  Bro\u0308tchen  '
  })
  variant(false, (seed, card) => { seed.units[0].cards.push({ ...structuredClone(card), id: '00000000-0000-5000-8000-000000000102', source_id: ` ${card.source_id}\n ` }) })
  variant(false, (seed, card) => {
    const unit = structuredClone(seed.units[0]); unit.id = '00000000-0000-5000-8000-000000000103'; unit.label = ` ${unit.label}\n `
    unit.cards = [{ ...structuredClone(card), id: '00000000-0000-5000-8000-000000000104', source_id: 'sitov-distinct-card' }]; seed.units.push(unit)
  })
  variant(false, seed => { seed.units[0].label = '  Eigene\n Wörter  ' })
  for (const field of ['word_de', 'chunk_de', 'context'] as const) {
    for (const text of ['Я назначаю встречу.', 'ı', 's\u0327', '\u1d2b', '\ua640']) {
      variant(false, (_, card) => { if (field === 'context') card.translations.de.context_sentence = text; else card[field] = text })
    }
  }
  for (const [field, limit] of [['word_de', 500], ['chunk_de', 500], ['context', 1000], ['source_id', 160], ['label', 200]] as const) {
    for (const accepted of [true, false]) variant(accepted, (seed, card) => {
      const text = 'a'.repeat(limit + (accepted ? 0 : 1))
      if (field === 'label') seed.units[0].label = ` ${text}\n `
      else if (field === 'context') card.translations.de.context_sentence = ` ${text}\n `
      else card[field] = ` ${text}\n `
    })
  }
  const script = `import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
    const {vocabularySeedSchema,germanAudioTexts}=await import(pathToFileURL(process.argv[2]).href);
    const cases=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify(cases.map(({seed})=>{
      const parsed=vocabularySeedSchema.safeParse(seed);return {accepted:parsed.success,texts:parsed.success?germanAudioTexts(parsed.data).sort():[]};})));`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, 'sitov-audio-contract-check', resolve(__dirname, '../scripts/sitov-vocabulary-import.mjs')], {
    input: JSON.stringify(cases), encoding: 'utf8',
  })
  expect(result.status).toBe(0)
  const imported = JSON.parse(result.stdout)
  cases.forEach(({ seed, accepted }, index) => {
    expect(imported[index].accepted).toBe(accepted)
    const extract = () => collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: 'same-contract.json', value: seed } })
    if (accepted) expect(extract().rows.map(row => row.text).sort()).toEqual(imported[index].texts)
    else expect(extract).toThrow()
  })
  const normalized = collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: 'same-contract.json', value: cases[3].seed } })
  expect(normalized.rows.some(row => row.sources.includes('vocabulary-seed:same-contract.json:sitov-café:word'))).toBe(true)
})

test('the German seed matches every currently frozen reviewed audio text and rejects database-blocked Extended-D Cyrillic', () => {
  const filename = resolve(__dirname, '../content/vocabulary/german-seed.json')
  const before = readFileSync(filename)
  const seed = JSON.parse(before.toString())
  expect(seed.units).toHaveLength(42)
  expect(seed.units.reduce((count: number, unit: any) => count + unit.cards.length, 0)).toBe(3027)
  const catalog = collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: filename, value: seed } })
  const frozen = JSON.parse(readFileSync(resolve(__dirname, '../content/vocabulary/german-audio-texts.json'), 'utf8'))
  const texts = catalog.rows.map(row => row.text).sort()
  expect(texts).toEqual(frozen.texts)
  expect(hash(JSON.stringify(texts))).toBe(frozen.sha256)
  const fields = seed.units.flatMap((unit: any) => unit.cards).map((card: any) => ({ source_id: card.source_id,
    word_de: card.word_de, article: card.article, chunk_de: card.chunk_de, context_sentence: card.translations.de.context_sentence,
  })).sort((a: any, b: any) => a.source_id.localeCompare(b.source_id))
  expect(hash(JSON.stringify(fields))).toBe(frozen.german_fields_sha256)
  expect(catalog.rows.every(row => row.cachePath === neuralAudioPath(row.text, 'de'))).toBe(true)
  expect(readFileSync(filename)).toEqual(before)
  const invalid = prospectiveVocabularySeed()
  invalid.units[0].cards[0].translations.de.context_sentence = '\u{1e030}'
  expect(() => collectSitovAudioCatalog({}, {}, {}, undefined, { vocabularySeed: { name: 'invalid.json', value: invalid } })).toThrow('German context')
})
