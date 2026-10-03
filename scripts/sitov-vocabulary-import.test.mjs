import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { vocabularySeedSchema, germanAudioTexts, parseArguments, localEndpoint, runImportCommand } from './sitov-vocabulary-import.mjs'

const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const fixture = () => ({ version: 1, units: [{ id: id(1), level: 'A1.2', label: 'Lektion 1 · Termine', sort_order: 1, source_lesson: 1, cards: [{
  id: id(2), source_id: 'sitov-A1.2-L01-V001', content_kind: 'vocabulary', word_de: 'Termin', article: 'der', plural: 'Termine', sentence_practice: false,
  chunk_de: 'einen Termin vereinbaren', translations: Object.fromEntries(['de', 'en', 'ru', 'uk', 'tr'].map(locale => [locale, locale === 'de'
    ? { context_sentence: 'Jan vereinbart einen Termin.' } : { translation: 'appointment', context_sentence: 'Jan makes an appointment.', chunk_translation: 'make an appointment' }]))
}] }] })
const responseFor = (seed, publish = true) => ({ unit_count: 1, card_count: 1, vocabulary_count: 1, chunk_count: 0, reused_count: 0, published: publish,
  units: [{ unit_id: id(9), level: seed.units[0].level, label: seed.units[0].label, cards: [{ source_id: seed.units[0].cards[0].source_id, card_id: id(8) }] }] })
const configured = { SITOV_VOCABULARY_SUPABASE_URL: 'http://127.0.0.1:8000', SITOV_VOCABULARY_SERVICE_ROLE_KEY: 'sb_secret_test' }
async function temporary(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'sitov-vocabulary-import-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const filename = resolve(root, 'seed.json')
  await writeFile(filename, JSON.stringify(fixture()))
  return { root, filename }
}
async function backup(root, name = 'backup') {
  const directory = resolve(root, name)
  await mkdir(directory, { mode: 0o700 })
  const dump = 'Test database backup'
  await writeFile(resolve(directory, 'postgres.dump'), dump)
  await writeFile(resolve(directory, 'sha256.json'), JSON.stringify({ 'postgres.dump': createHash('sha256').update(dump).digest('hex') }))
  await writeFile(resolve(directory, 'COMPLETE'), 'verified')
  return directory
}

test('seed validation keeps one word card per teacher object and extracts every German audio source', () => {
  const raw = fixture(); raw.units[0].cards[0].word_de = 'Te\u0308rmin  '; raw.units[0].cards[0].chunk_de = ' einen\u00a0Termin\nvereinbaren '
  const parsed = vocabularySeedSchema.parse(raw)
  assert.equal(parsed.units[0].cards.length, 1)
  assert.equal(parsed.units[0].cards[0].word_de, 'Tërmin')
  assert.deepEqual(germanAudioTexts(parsed), ['der Tërmin', 'einen Termin vereinbaren', 'Jan vereinbart einen Termin.'])
  const duplicated = fixture(); duplicated.units[0].cards.push(structuredClone(duplicated.units[0].cards[0]))
  assert.equal(vocabularySeedSchema.safeParse(duplicated).success, false)
  const missing = fixture(); delete missing.units[0].cards[0].translations.tr.chunk_translation
  assert.equal(vocabularySeedSchema.safeParse(missing).success, false)
  const chunk = fixture(); chunk.units[0].cards[0].content_kind = 'chunk'
  assert.equal(vocabularySeedSchema.safeParse(chunk).success, false, 'separate chunks carry no noun article')
  const german = fixture(); german.units[0].cards[0].chunk_de = 'перевод'
  assert.equal(vocabularySeedSchema.safeParse(german).success, false)
  const revision = fixture(); revision.units[0].cards[0].legacy_revision = { word_de: 'old word', article: 'none', context_sentence_de: null }
  assert.equal(vocabularySeedSchema.parse(revision).units[0].cards[0].legacy_revision.article, null)
  delete revision.units[0].cards[0].legacy_revision.context_sentence_de
  assert.equal(vocabularySeedSchema.safeParse(revision).success, false, 'guarded revisions require every exact baseline field')
})
test('import options and origins exclude accidental publication or remote secret requests', () => {
  for (const args of [[], ['seed.json', '--publish'], ['seed.json', '--import'], ['seed.json', '--backup-dir', '/tmp'], ['seed.json', '--import', '--import']]) assert.throws(() => parseArguments(args))
  for (const origin of ['https://example.com', 'http://localhost/path', 'http://user:pass@localhost', 'http://127.0.0.1/?key=secret']) assert.throws(() => localEndpoint(origin))
  assert.equal(localEndpoint('http://127.0.0.1:8000').hostname, '127.0.0.1')
})
test('validation and prospective audio export make no network call', async t => {
  const { root, filename } = await temporary(t), output = resolve(root, 'texts.json')
  const result = await runImportCommand([filename, '--audio-texts-output', output], { log: () => {}, fetch: () => { throw new Error('Network forbidden') } })
  assert.equal(result.validated, true); assert.equal(result.imported, undefined)
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')).texts, germanAudioTexts(vocabularySeedSchema.parse(fixture())))
})
test('a verified local import uses the service-only atomic RPC and accepts preserved record identities', async t => {
  const { root, filename } = await temporary(t), directory = await backup(root), seed = vocabularySeedSchema.parse(fixture())
  let called = false
  const result = await runImportCommand([filename, '--import', '--publish', '--backup-dir', directory], { env: configured, log: () => {}, fetch: async (url, options) => {
    called = true
    assert.equal(String(url), 'http://127.0.0.1:8000/rest/v1/rpc/sitov_import_vocabulary_seed')
    assert.equal(options.redirect, 'error')
    const body = JSON.parse(options.body)
    assert.equal(body.p_publish, true); assert.deepEqual(body.p_seed, seed)
    return new Response(JSON.stringify(responseFor(seed)), { status: 200 })
  } })
  assert.equal(called, true); assert.equal(result.imported, true)
  assert.equal(JSON.parse(await readFile(resolve(directory, 'sitov-vocabulary-import.json'), 'utf8')).status, 'complete')
  await assert.rejects(runImportCommand([filename, '--import', '--publish', '--backup-dir', directory], { env: configured, log: () => {}, fetch: async () => { throw new Error('Forbidden replay') } }), error => error.category === 'backup')
})
test('missing German audio reports an atomic rejection and never completes the backup receipt', async t => {
  const { root, filename } = await temporary(t), directory = await backup(root)
  await assert.rejects(runImportCommand([filename, '--import', '--publish', '--backup-dir', directory], { env: configured, log: () => {}, fetch: async () => new Response(JSON.stringify({ error: 'prepared_audio_required' })) }), error => error.category === 'prepared_audio')
  assert.equal(JSON.parse(await readFile(resolve(directory, 'sitov-vocabulary-import.json'), 'utf8')).status, 'started')
})
test('backup checksum corruption and invalid seeds fail before contacting the database', async t => {
  const { root, filename } = await temporary(t), directory = await backup(root)
  await writeFile(resolve(directory, 'postgres.dump'), 'Corrupted')
  const noFetch = { env: configured, log: () => {}, fetch: async () => { throw new Error('No request should be made') } }
  await assert.rejects(runImportCommand([filename, '--import', '--backup-dir', directory], noFetch), error => error.category === 'backup')
  await writeFile(filename, '{invalid')
  await assert.rejects(runImportCommand([filename, '--import', '--backup-dir', directory], noFetch), error => error.category === 'seed')
})
