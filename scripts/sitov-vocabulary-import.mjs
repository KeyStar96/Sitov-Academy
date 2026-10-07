#!/usr/bin/env node
/** Validated, atomic Sitov Academy vocabulary/chunk import. No .env loading. */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { z } from 'zod'

const normalize = value => value.normalize('NFC').trim().replace(/\s+/gu, ' ')
const text = (max = 1000) => z.string().transform(normalize).pipe(z.string().min(1).max(max))
const nullableText = max => text(max).nullable().optional().transform(value => value ?? null)
const localized = z.object({ translation: text(500), context_sentence: text(1000), chunk_translation: nullableText(500) }).passthrough()
const cardSchema = z.object({
  id: z.uuid(), source_id: text(160), content_kind: z.enum(['vocabulary', 'chunk']), word_de: text(500),
  article: z.enum(['der', 'die', 'das', 'none']).nullable().optional().transform(value => value === 'none' ? null : value ?? null),
  plural: nullableText(200), chunk_de: nullableText(500), sentence_practice: z.boolean(),
  alternative_answers_de: z.array(text(1000)).max(20).optional().default([]),
  target_form: z.array(text(120)).max(12).nullable().optional().transform(value => value ?? null),
  legacy_revision: z.object({ word_de: z.string().min(1).max(500), article: z.enum(['der', 'die', 'das', 'none']).nullable().transform(value => value === 'none' ? null : value), context_sentence_de: z.string().max(1000).nullable() }).strict().optional(),
  translations: z.object({ de: z.object({ context_sentence: text(1000) }).passthrough(), en: localized, ru: localized, uk: localized, tr: localized }),
}).passthrough().superRefine((card, ctx) => {
  if (card.content_kind === 'chunk' && card.article !== null) ctx.addIssue({ code: 'custom', path: ['article'], message: 'Chunk cards have no article.' })
  if (card.chunk_de) for (const locale of ['en', 'ru', 'uk', 'tr']) {
    if (!card.translations[locale].chunk_translation) ctx.addIssue({ code: 'custom', path: ['translations', locale, 'chunk_translation'], message: 'Embedded chunk translation required.' })
  }
  for (const [path, value] of [[['word_de'], card.word_de], [['chunk_de'], card.chunk_de], [['translations', 'de', 'context_sentence'], card.translations.de.context_sentence]]) {
    if (value && /[\u0400-\u052f\u1c80-\u1c8f\u1d2b\u1d78\u2de0-\u2dff\ua640-\ua69f\u{1e030}-\u{1e08f}ığşİĞŞ]/u.test(value)) ctx.addIssue({ code: 'custom', path, message: 'German text required.' })
  }
})
export const vocabularySeedSchema = z.object({ version: z.literal(1), units: z.array(z.object({
  id: z.uuid(), level: z.enum(['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2', 'B2.1', 'B2.2', 'C1.1', 'C1.2']), label: text(200),
  sort_order: z.number().int().min(0).max(1000000), cards: z.array(cardSchema).min(1).max(1000),
}).passthrough()).min(1).max(100) }).passthrough().superRefine((seed, ctx) => {
  const units = new Set(), unitIds = new Set(), sources = new Set(), cardIds = new Set()
  let count = 0
  seed.units.forEach((unit, index) => {
    const key = `${unit.level}\0${unit.label}`
    if (units.has(key) || unitIds.has(unit.id) || unit.label === 'Eigene Wörter') ctx.addIssue({ code: 'custom', path: ['units', index], message: 'Duplicate or reserved unit identity.' })
    units.add(key); unitIds.add(unit.id)
    unit.cards.forEach((card, cardIndex) => {
      count++
      if (sources.has(card.source_id) || cardIds.has(card.id)) ctx.addIssue({ code: 'custom', path: ['units', index, 'cards', cardIndex], message: 'Duplicate card identity.' })
      sources.add(card.source_id); cardIds.add(card.id)
    })
  })
  if (count > 10000) ctx.addIssue({ code: 'custom', path: ['units'], message: 'Too many cards.' })
})
export const germanAudioTexts = seed => [...new Set(seed.units.flatMap(unit => unit.cards.flatMap(card => [
  normalize(`${card.article ?? ''} ${card.word_de}`), card.chunk_de, card.translations.de.context_sentence,
])).filter(Boolean))]
export const summarize = seed => ({ unit_count: seed.units.length, card_count: seed.units.reduce((n, u) => n + u.cards.length, 0),
  vocabulary_count: seed.units.flatMap(u => u.cards).filter(c => c.content_kind === 'vocabulary').length,
  chunk_count: seed.units.flatMap(u => u.cards).filter(c => c.content_kind === 'chunk').length })

export class ImportFailure extends Error {
  constructor(category, message) { super(message); this.category = category }
}
const fail = (category, message) => { throw new ImportFailure(category, message) }
const HELP = `Usage: node scripts/sitov-vocabulary-import.mjs seed.json [--audio-texts-output FILE] [--import --backup-dir DIR [--publish]]
Default: validate the local seed; no database request. --audio-texts-output exports all prospective German word/chunk/example texts.
--import stores drafts. --publish activates units only after authoritative Qwen audio and full word timings are verified.
Existing active units remain active and require audio even without --publish. IDs, answers and progress survive reruns.
Writing requires an unused verified migrate-local.py backup, at most one hour old, private mode 0700.
Set SITOV_VOCABULARY_SUPABASE_URL to a loopback origin and SITOV_VOCABULARY_SERVICE_ROLE_KEY to its server-only key.
No .env files are loaded. Run on the VPS against internal Supabase, after the audio import/audit.
`
export function parseArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true }
  const result = { import: false, publish: false }, seen = new Set()
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (seen.has(arg) && arg.startsWith('--')) fail('arguments', 'Duplicate option.')
    seen.add(arg)
    if (arg === '--import' || arg === '--publish') result[arg.slice(2)] = true
    else if (arg === '--backup-dir' || arg === '--audio-texts-output') {
      const value = args[++i]
      if (!value || value.startsWith('--')) fail('arguments', 'Option value required.')
      result[arg === '--backup-dir' ? 'backupDir' : 'audioOutput'] = resolve(value)
    } else if (!arg.startsWith('-') && !result.filename) result.filename = resolve(arg)
    else fail('arguments', 'Invalid option.')
  }
  if (!result.filename || result.import !== Boolean(result.backupDir) || result.publish && !result.import) fail('arguments', 'Use --help.')
  return result
}
export function localEndpoint(value) {
  let endpoint
  try { endpoint = new URL(value) } catch { fail('configuration', 'Local Supabase origin required.') }
  if (!['http:', 'https:'].includes(endpoint.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') fail('configuration', 'Loopback origin required.')
  return endpoint
}
function serviceKey(value) {
  if (!value || value.trim() !== value || /\s/u.test(value)) fail('configuration', 'Server-only service key required.')
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(value)) return value
  try {
    const parts = value.split('.')
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error()
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (claims.role !== 'service_role' || claims.exp !== undefined && (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now())) throw new Error()
    return value
  } catch { fail('configuration', 'Server-only service key required.') }
}
export async function readSeed(filename) {
  let bytes, seed
  try {
    const info = await stat(filename)
    if (!info.isFile() || info.size > 64 * 1024 * 1024) fail('seed', 'Invalid seed file.')
    bytes = await readFile(filename)
    seed = vocabularySeedSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))
  } catch { fail('seed', 'Seed failed UTF-8 JSON/schema validation.') }
  return { seed, sha256: createHash('sha256').update(bytes).digest('hex') }
}
async function digest(filename) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(filename)) hash.update(bytes)
  return hash.digest('hex')
}
async function reserveBackup(directory, seedHash, origin) {
  try {
    const root = await realpath(directory), info = await stat(root), complete = await stat(resolve(root, 'COMPLETE'))
    const age = Date.now() - complete.mtimeMs
    if (!info.isDirectory() || info.mode & 0o077 || !complete.isFile() || age < -60000 || age > 3600000 || !(await readFile(resolve(root, 'COMPLETE'), 'utf8')).trim()) throw new Error()
    const checksums = z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)).parse(JSON.parse(await readFile(resolve(root, 'sha256.json'), 'utf8')))
    if (!checksums['postgres.dump']) throw new Error()
    for (const [name, expected] of Object.entries(checksums)) {
      if (!name || isAbsolute(name) || name.split(/[\\/]/).some(part => !part || part === '..')) throw new Error()
      const file = await realpath(resolve(root, name)), child = relative(root, file), fileInfo = await stat(file)
      if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child) || !fileInfo.isFile() || name === 'postgres.dump' && fileInfo.size === 0 || await digest(file) !== expected) throw new Error()
    }
    const receipt = resolve(root, 'sitov-vocabulary-import.json')
    await writeFile(receipt, JSON.stringify({ status: 'started', started_at: new Date().toISOString(), seed_sha256: seedHash, supabase_origin: origin }) + '\n', { flag: 'wx', mode: 0o600 })
    return receipt
  } catch { fail('backup', 'Fresh unused private verified backup required.') }
}
export function verifyResult(result, seed, publish) {
  const totals = summarize(seed)
  if (!result || typeof result !== 'object' || Object.entries(totals).some(([k, v]) => result[k] !== v)
    || !Number.isInteger(result.reused_count) || result.reused_count < 0 || result.reused_count > totals.card_count
    || result.published !== publish || !Array.isArray(result.units) || result.units.length !== seed.units.length) fail('unverified', 'Import result does not match the seed.')
  const ids = new Set()
  for (const [index, expected] of seed.units.entries()) {
    const actual = result.units[index]
    if (!actual || !z.uuid().safeParse(actual.unit_id).success || actual.level !== expected.level || actual.label !== expected.label
      || !Array.isArray(actual.cards) || actual.cards.length !== expected.cards.length) fail('unverified', 'Import identities do not match the seed.')
    for (const [cardIndex, card] of expected.cards.entries()) {
      const saved = actual.cards[cardIndex]
      if (!saved || saved.source_id !== card.source_id || !z.uuid().safeParse(saved.card_id).success || ids.has(saved.card_id)) fail('unverified', 'Import identities do not match the seed.')
      ids.add(saved.card_id)
    }
  }
  return result
}
export async function runImportCommand(args, dependencies = {}) {
  const options = parseArguments(args), log = dependencies.log ?? console.log
  if (options.help) { log(HELP); return }
  const { seed, sha256 } = await readSeed(options.filename), totals = summarize(seed), audioTexts = germanAudioTexts(seed)
  log(`Validated: ${totals.unit_count} lessons, ${totals.vocabulary_count} vocabulary cards, ${totals.chunk_count} chunk cards; ${audioTexts.length} German audio texts. SHA256 ${sha256}`)
  if (options.audioOutput) await writeFile(options.audioOutput, JSON.stringify({ version: 1, vocabulary_seed_sha256: sha256, texts: audioTexts }, null, 2) + '\n', { mode: 0o600 })
  if (!options.import) return { validated: true, ...totals, sha256 }
  const env = dependencies.env ?? process.env, endpoint = localEndpoint(env.SITOV_VOCABULARY_SUPABASE_URL), key = serviceKey(env.SITOV_VOCABULARY_SERVICE_ROLE_KEY)
  const receipt = await reserveBackup(options.backupDir, sha256, endpoint.origin)
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 180000)
  try {
    const response = await (dependencies.fetch ?? fetch)(new URL('/rest/v1/rpc/sitov_import_vocabulary_seed', endpoint), {
      method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_seed: seed, p_publish: options.publish }),
    })
    if (!response.ok) fail('unverified', 'Import HTTP response failed.')
    const payload = await response.json()
    if (payload?.error) fail(payload.error === 'prepared_audio_required' ? 'prepared_audio' : 'database', 'Database rejected the batch.')
    const result = verifyResult(payload, seed, options.publish)
    await writeFile(receipt, JSON.stringify({ status: 'complete', completed_at: new Date().toISOString(), seed_sha256: sha256, result }, null, 2) + '\n', { mode: 0o600 })
    log(`Imported and verified: ${result.card_count} cards in ${result.unit_count} lessons; ${result.reused_count} identities preserved; ${options.publish ? 'published with prepared audio' : 'drafts saved'}.`)
    return { validated: true, imported: true, ...result, sha256 }
  } catch (error) {
    if (error instanceof ImportFailure) throw error
    fail('unverified', 'Import commit status unknown; inspect the database and use a fresh backup before repeating.')
  } finally { clearTimeout(timer) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runImportCommand(process.argv.slice(2)).catch(error => {
  console.error('sitov_vocabulary_import_failed')
  // Only allowlisted, static CLI diagnostics reach stderr. Never print the
  // exception object/message, a seed value, an HTTP body or a credential.
  switch (error instanceof ImportFailure ? error.category : undefined) {
    case 'arguments': process.stderr.write('Invalid arguments. Use --help.\n'); break
    case 'seed': process.stderr.write('Seed failed UTF-8 JSON/schema validation; no database request was made.\n'); break
    case 'configuration': process.stderr.write('Invalid loopback origin or service-role key; no database request was made.\n'); break
    case 'backup': process.stderr.write('Fresh unused private verified backup required; no database request was made.\n'); break
    case 'prepared_audio': process.stderr.write('prepared_audio_required: Batch rolled back. Prepare all German word/chunk/example audio on the Mac, import and audit it, then use a fresh backup.\n'); break
    case 'database': process.stderr.write('Database rejected and rolled back the batch. Inspect protected logs before retrying.\n'); break
    case 'unverified': process.stderr.write('Import commit status unverified. Inspect the database and use a fresh backup before repeating.\n'); break
    default: process.stderr.write('Vocabulary import failed; no internal error details were logged.\n')
  }
  process.exitCode = 1
})
