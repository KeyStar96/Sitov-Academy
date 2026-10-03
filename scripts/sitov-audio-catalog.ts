/** Authoring CLI. Production never imports this file or loads a speech model. */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, statSync, lstatSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { neuralAudioPath, SITOV_QWEN_PROFILE_FINGERPRINT } from '../lib/audio/neural-identity'
import { SITOV_QWEN_PROFILE, normalizeAudioText, vocabularyAudioText, AUDIO_MAX_TEXT_LENGTH, AUDIO_MAX_BYTES, AUDIO_CACHE_BUCKET } from '../lib/audio/neural-config'
import { validWordTimings } from '../lib/audio/playback-settings'
import { learningPathSeedSchema } from '../lib/learning-path-schema'

type Row = { id: string; text: string; cachePath: string; sources: string[] }
type Source = Record<string, any>
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

/** These are the exact strings played by the grammar components. */
export function sitovExerciseAudioTexts(type: string, content: Source): string[] {
  const answer = content?.correct_answer
  if (typeof answer !== 'string') return []
  if (type === 'fill_in_blank') return [answer, `${content.text_before ?? ''}${answer}${content.text_after ?? ''}`]
  if (type === 'multiple_choice' && typeof content.question === 'string') return [content.question.includes('___')
    ? content.question.replace('___', answer) : `${content.question} ${answer}`]
  return type === 'sentence_building' ? [answer] : []
}

export function collectSitovAudioCatalog(source: Source, staticTexts: Record<string, string> = {}, authoredTexts: Record<string, string> = {}, pathSeed?: unknown) {
  const rows = new Map<string, Row>()
  function add(input: unknown, origin: string) {
    if (typeof input !== 'string') return
    const text = normalizeAudioText(input)
    if (!text) return
    if (text.length > AUDIO_MAX_TEXT_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new Error(`Invalid authoring text: ${origin}`)
    if (/\{\{[^}]+\}\}|\[\[(?:nom|acc)[^\]]*\]\]/u.test(text)) throw new Error(`Unrendered authoring text: ${origin}`)
    const cachePath = neuralAudioPath(text, 'de')
    const row = rows.get(cachePath) ?? { id: cachePath.split('/').pop()!.replace('.mp3', ''), text, cachePath, sources: [] }
    if (!row.sources.includes(origin)) row.sources.push(origin)
    rows.set(cachePath, row)
  }
  function audioFields(value: unknown, origin: string) {
    if (Array.isArray(value)) value.forEach((entry, index) => audioFields(entry, `${origin}/${index}`))
    else if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) {
      if (key === 'audioText') add(entry, origin)
      else audioFields(entry, `${origin}/${key}`)
    }
  }
  for (const card of source.learning_vocabulary_cards ?? []) add(vocabularyAudioText(card), `vocabulary:${card.id}:word`)
  for (const entry of source.vocabulary_translations ?? []) if (entry.locale === 'de') add(entry.context_sentence, `vocabulary:${entry.card_id}:sentence`)
  for (const reading of source.learning_reading_texts ?? []) add(reading.sentence_de, `pronunciation:${reading.id}`)
  for (const exercise of source.learning_exercises ?? []) sitovExerciseAudioTexts(exercise.type, exercise.content).forEach((text, index) => add(text, `grammar:${exercise.id}:${index}`))
  for (const quest of source.daily_quests ?? []) audioFields(quest.content, `daily-quest:${quest.id}`)
  for (const text of source.daily_quest_assignment_audio_texts ?? []) add(text, 'daily-quest:frozen-snapshot')
  for (const job of source.pending_audio_preparations ?? []) add(job.text, 'requested:local-preparation')
  for (const [filename, text] of Object.entries(staticTexts)) add(text, `deutschreise:${filename}`)
  for (const [id, text] of Object.entries(authoredTexts)) add(text, `authored:${id}`)
  if (pathSeed !== undefined) {
    const parsed = learningPathSeedSchema.safeParse(pathSeed)
    if (!parsed.success) throw new Error(`Invalid prospective learning-path seed (${parsed.error.issues.length} schema issues)`)
    for (const path of parsed.data) if (path.is_active !== false) {
      // The existing ExerciseClient/getExercises controls do not filter node
      // activity. The inner importer writes these rows even for inactive nodes.
      for (const node of path.nodes) {
        for (const exercise of node.exercises) if (exercise.exercise_type === 'fill_in_blank' || exercise.exercise_type === 'multiple_choice') {
          sitovExerciseAudioTexts(exercise.exercise_type, exercise.content as Source)
            .forEach((text, index) => add(text, `path-seed:${exercise.id}:${index}`))
        }
      }
    }
  }
  return { schemaVersion: 1, preparationScope: 'full' as const, brand: 'Sitov Academy', engine: SITOV_QWEN_PROFILE.engine,
    voice: SITOV_QWEN_PROFILE.voice, revision: SITOV_QWEN_PROFILE.revision, profileFingerprint: SITOV_QWEN_PROFILE_FINGERPRINT,
    sourceCounts: source.counts, rows: [...rows.values()].sort((a, b) => a.cachePath.localeCompare(b.cachePath)) }
}

/** A fresh service-owned SQL inventory avoids new stochastic takes on another Mac. */
export function missingSitovAudioCatalog(catalog: ReturnType<typeof collectSitovAudioCatalog>, inventory: unknown) {
  if (catalog.profileFingerprint !== SITOV_QWEN_PROFILE_FINGERPRINT || !Array.isArray(inventory)) {
    throw new Error('Missing-only preparation requires the current profile and a fresh storage_audio_inventory export')
  }
  const active = new Map<string, Source>()
  for (const object of inventory) {
    if (!object || object.bucket_id !== AUDIO_CACHE_BUCKET || object.archived_at != null
      || (object.is_delete_marker != null && object.is_delete_marker !== false)
      || typeof object.name !== 'string' || !/^sitov-qwen-v1\/de\/[a-f0-9]{64}\.mp3$/.test(object.name)) continue
    if (active.has(object.name)) throw new Error(`Ambiguous active Storage object: ${object.name}`)
    active.set(object.name, object)
  }
  const reusedStorageRows: { id: string; cachePath: string; audioSha256: string; bytes: number }[] = []
  const invalidExistingPaths: string[] = []
  const rows = catalog.rows.filter(row => {
    if (row.cachePath !== neuralAudioPath(row.text, 'de')) throw new Error(`Invalid catalog address: ${row.id}`)
    const object = active.get(row.cachePath)
    if (!object) return true
    const authored = object.user_metadata
    const system = object.metadata
    const valid = authored && system && typeof authored === 'object' && !Array.isArray(authored)
      && typeof system === 'object' && !Array.isArray(system)
      && authored.engine === SITOV_QWEN_PROFILE.engine && authored.voice === SITOV_QWEN_PROFILE.voice
      && authored.revision === SITOV_QWEN_PROFILE.revision && authored.profileFingerprint === SITOV_QWEN_PROFILE_FINGERPRINT
      && authored.textSha256 === sha256(row.text) && typeof authored.audioSha256 === 'string' && /^[a-f0-9]{64}$/.test(authored.audioSha256)
      && !!validWordTimings(authored.wordTimings, row.text)
      && system.mimetype === 'audio/mpeg' && Number.isSafeInteger(system.size) && system.size >= 1 && system.size <= AUDIO_MAX_BYTES
    if (!valid) { invalidExistingPaths.push(row.cachePath); return true }
    reusedStorageRows.push({ id: row.id, cachePath: row.cachePath, audioSha256: authored.audioSha256, bytes: system.size })
    return false
  })
  return { ...catalog, preparationScope: 'missing-only' as const, rows, reusedStorageRows,
    inventoryCoverage: { fullCatalogRows: catalog.rows.length, inventoryRecords: inventory.length,
      reusedRows: reusedStorageRows.length, missingRows: rows.length, invalidExistingPaths } }
}

function assertSitovAudioRecovered(directories: string[]) {
  for (const directory of new Set(directories.map(path => resolve(path)))) {
    try {
      lstatSync(resolve(directory, '.sitov-qwen-reuse-transaction.json'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    throw new Error('Incomplete audio reuse transaction: run scripts/sitov-qwen-reuse.py --recover before bundling')
  }
}

type SitovAudioCatalog = Omit<ReturnType<typeof collectSitovAudioCatalog>, 'preparationScope'> & { preparationScope?: 'full' | 'missing-only' }

export function bundleSitovAudio(catalog: SitovAudioCatalog, manifest: Source, destination: string, sourceManifestDirectory?: string) {
  const sourceDirectories = [
    ...(sourceManifestDirectory ? [sourceManifestDirectory] : []),
    ...Object.values(manifest.entries ?? {}).flatMap((entry: any) => ['output', 'metadata']
      .flatMap(key => typeof entry?.[key] === 'string' ? [dirname(resolve(entry[key]))] : [])),
  ]
  // Check before any reads and again before output writes, including when the
  // transaction already replaced its final manifest but has not cleared itself.
  assertSitovAudioRecovered(sourceDirectories)
  if (catalog.profileFingerprint !== SITOV_QWEN_PROFILE_FINGERPRINT || manifest.profileFingerprint !== SITOV_QWEN_PROFILE_FINGERPRINT) throw new Error('Qwen profile changed; prepare the current catalog again')
  const root = resolve(destination)
  const validated = catalog.rows.map(row => {
    if (row.cachePath !== neuralAudioPath(row.text, 'de') || !/^sitov-qwen-v1\/de\/[a-f0-9]{64}\.mp3$/.test(row.cachePath)) throw new Error(`Invalid catalog address: ${row.id}`)
    const prepared = manifest.entries[row.id]
    if (!prepared || prepared.status !== 'complete' || prepared.cachePath !== row.cachePath || normalizeAudioText(prepared.text) !== row.text || prepared.rate !== 1) throw new Error(`Unprepared audio: ${row.id}`)
    const bytes = readFileSync(prepared.output)
    const metadata = JSON.parse(readFileSync(prepared.metadata, 'utf8'))
    if (metadata.engine !== SITOV_QWEN_PROFILE.engine || metadata.voice !== SITOV_QWEN_PROFILE.voice || metadata.revision !== SITOV_QWEN_PROFILE.revision || metadata.profileFingerprint !== SITOV_QWEN_PROFILE_FINGERPRINT
      || metadata.rate !== 1 || metadata.audioSha256 !== sha256(bytes) || metadata.textSha256 !== sha256(row.text)
      || bytes.length < 100 || bytes.length > 2 * 1024 * 1024 || !(bytes.subarray(0, 3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224))
      || !validWordTimings(metadata.wordTimings, row.text)) throw new Error(`Invalid prepared audio: ${row.id}`)
    const audioPath = resolve(root, row.cachePath)
    return { row, bytes, metadata, audioPath }
  })
  // Validate the complete catalog before creating any output. A late failed
  // entry must not turn a partial directory into a seemingly usable bundle.
  assertSitovAudioRecovered(sourceDirectories)
  const entries = validated.map(({ row, bytes, metadata, audioPath }) => {
    mkdirSync(dirname(audioPath), { recursive: true, mode: 0o700 })
    writeFileSync(audioPath, bytes, { mode: 0o600 })
    // Keep portable provenance; Mac raw paths are not part of the uploaded asset.
    const storageMetadata = { engine: metadata.engine, voice: metadata.voice, revision: metadata.revision,
      profileFingerprint: metadata.profileFingerprint, textSha256: metadata.textSha256,
      audioSha256: metadata.audioSha256, wordTimings: metadata.wordTimings }
    writeFileSync(`${audioPath}.json`, JSON.stringify(storageMetadata), { mode: 0o600 })
    return { ...row, audioSha256: metadata.audioSha256, bytes: bytes.length }
  })
  const bundle = { ...catalog, rows: entries }
  writeFileSync(resolve(destination, 'sitov-audio-profile.json'), `${JSON.stringify(SITOV_QWEN_PROFILE, null, 2)}\n`, { mode: 0o600 })
  writeFileSync(resolve(destination, 'sitov-audio-bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600 })
  return bundle
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2)
    const value = (flag: string) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1] }
    if (args.includes('--help') || !value('--export')) {
      console.log('Plan: ts-node scripts/sitov-audio-catalog.ts --export private-export.json --output catalog.json')
      console.log('Follow-up/new Mac: add --missing-only --full-output complete-catalog.json; requires fresh Storage inventory. First activation still requires the complete catalog.')
      console.log('Before path import: add --path-seed seed.json; the existing Seed schema validates prospective active Fill/MC audio before the seed RPC.')
      console.log('Bundle: add --manifest prepared/sitov-qwen-manifest.json --bundle output-directory')
      console.log('Use ts-node --transpile-only --compiler-options \'{"module":"CommonJS","moduleResolution":"node"}\'. Export with deploy/vps/export-sitov-audio-catalog.sql; no keys belong in the catalog.')
    } else {
      const manifestDirectory = value('--manifest') ? dirname(resolve(value('--manifest')!)) : undefined
      if (manifestDirectory && value('--bundle')) assertSitovAudioRecovered([manifestDirectory])
      const raw = JSON.parse(readFileSync(resolve(value('--export')!), 'utf8'))
      const staticTexts = JSON.parse(readFileSync(resolve(__dirname, '../docs/design/deutschreise-assets.json'), 'utf8')).audio.texts
      const authoredTexts = JSON.parse(readFileSync(resolve(__dirname, '../lib/audio/sitov-authored-audio-texts.json'), 'utf8'))
      let pathSeed: unknown
      if (value('--path-seed')) {
        const filename = resolve(value('--path-seed')!)
        const info = statSync(filename)
        if (!info.isFile() || info.size > 64 * 1024 * 1024) throw new Error('Path seed must be a regular file no larger than 64 MiB')
        pathSeed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(filename)))
      }
      const fullCatalog = collectSitovAudioCatalog(raw, staticTexts, authoredTexts, pathSeed)
      const catalog = args.includes('--missing-only') ? missingSitovAudioCatalog(fullCatalog, raw.storage_audio_inventory) : fullCatalog
      if (value('--full-output')) writeFileSync(resolve(value('--full-output')!), `${JSON.stringify(fullCatalog, null, 2)}\n`, { mode: 0o600 })
      if (value('--output')) writeFileSync(resolve(value('--output')!), `${JSON.stringify(catalog, null, 2)}\n`, { mode: 0o600 })
      if (value('--manifest') && value('--bundle')) {
        if (!catalog.rows.length) throw new Error('No missing German audio: skip generation and bundle; audit the current complete Storage catalog')
        const bundle = bundleSitovAudio(catalog, JSON.parse(readFileSync(resolve(value('--manifest')!), 'utf8')), resolve(value('--bundle')!), manifestDirectory)
        console.log(JSON.stringify({ prepared: bundle.rows.length, profileFingerprint: bundle.profileFingerprint }))
      } else console.log(JSON.stringify({ texts: catalog.rows.length, characters: catalog.rows.reduce((sum, row) => sum + row.text.length, 0), profileFingerprint: catalog.profileFingerprint }))
    }
  } catch (error) {
    console.error('Audio catalog failed')
    // This local authoring CLI may show a validation reason without writing a user-data log.
    if (error instanceof Error) process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
