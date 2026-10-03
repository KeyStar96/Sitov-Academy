/** @jest-environment node */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { bundleSitovAudio, collectSitovAudioCatalog, missingSitovAudioCatalog, sitovExerciseAudioTexts } from '../scripts/sitov-audio-catalog'
import { neuralAudioPath, SITOV_QWEN_PROFILE_FINGERPRINT } from '../lib/audio/neural-identity'
import { SITOV_QWEN_PROFILE, vocabularyAudioText } from '../lib/audio/neural-config'

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
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
