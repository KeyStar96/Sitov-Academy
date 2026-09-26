#!/usr/bin/env node
/** Offline authoring command. Never imported by learner routes or called at runtime. */
import { createHash, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO_LIMIT = 2 * 1024 * 1024
const BUCKET = 'path-audio'
const REFERENCE_PREFIX = `/storage/v1/object/authenticated/${BUCKET}/`
const engine = 'piper-local-v1:de:ffmpeg-atempo-0.8:mp3-48k'
const hash = value => createHash('sha256').update(value).digest('hex')

export function localEndpoint(value) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash) throw new Error('Only local loopback service endpoints are allowed.')
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
  return url
}

export function audioObjectKey(reference) {
  if (typeof reference !== 'string' || !reference.startsWith(REFERENCE_PREFIX)) {
    throw new Error(`Listening audio references must start with ${REFERENCE_PREFIX}`)
  }
  const key = reference.slice(REFERENCE_PREFIX.length)
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\.mp3$/.test(key) || key.length > 500) {
    throw new Error('Audio object keys need safe ASCII folders and an .mp3 extension.')
  }
  return key
}

/** The caller validates the full seed first. Identical object references may be reused. */
export function planListeningAudio(paths) {
  const files = new Map()
  let exercises = 0
  for (const path of paths) for (const node of path.nodes) for (const exercise of node.exercises) {
    if (exercise.exercise_type !== 'listening') continue
    exercises++
    const text = exercise.content.transcript.normalize('NFC').trim()
    if (!text || [...text].length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
      throw new Error('Piper transcripts must contain 1–3000 characters without control characters.')
    }
    for (const speed of ['normal', 'slow']) {
      const reference = exercise.content.audio[speed]
      const key = audioObjectKey(reference)
      const fingerprint = hash(`${engine}\0${speed}\0${text}`)
      if (files.has(key) && files.get(key).fingerprint !== fingerprint) {
        throw new Error('One audio object reference is assigned to different transcripts or speeds.')
      }
      files.set(key, { key, reference, speed, text, fingerprint, filename: `${hash(key)}.mp3` })
    }
  }
  return { exercises, files: [...files.values()] }
}

export function validateMp3(bytes) {
  const signature = bytes.subarray(0, 3).toString('ascii') === 'ID3'
    || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  if (!signature || bytes.length < 100 || bytes.length > AUDIO_LIMIT) throw new Error('Invalid or oversized MP3 audio.')
  return bytes
}

async function boundedAudio(response) {
  if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('audio/mpeg')) {
    throw new Error(`Local audio request failed (HTTP ${response.status}).`)
  }
  if (Number(response.headers.get('content-length')) > AUDIO_LIMIT) {
    await response.body.cancel(); throw new Error('Local audio exceeded the file limit.')
  }
  const chunks = []; let size = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > AUDIO_LIMIT) { await reader.cancel(); throw new Error('Local audio exceeded the file limit.') }
      chunks.push(Buffer.from(value))
    }
  } finally { reader.releaseLock() }
  return validateMp3(Buffer.concat(chunks, size))
}

async function normalAudio(text, endpoint, token) {
  return boundedAudio(await fetch(new URL('synthesize', endpoint), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(80_000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text, language: 'de' }),
  }))
}

export function slowAudioArguments(normalPath) {
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1',
    '-i', normalPath, '-vn', '-af', 'atempo=0.8', '-ac', '1', '-ar', '24000',
    '-codec:a', 'libmp3lame', '-b:a', '48k', '-f', 'mp3', 'pipe:1']
}

async function atomicWrite(filename, bytes) {
  const temporary = `${filename}.${randomUUID()}.tmp`
  await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' })
  await rename(temporary, filename)
}

async function generateAudio(plan, output, endpoint) {
  await mkdir(output, { recursive: true, mode: 0o700 })
  const manifest = { version: 1, engine, files: [] }
  // Group by transcript; one existing Piper worker request, then one bounded
  // ffmpeg process. No parallel model loading or new background service.
  const texts = new Map()
  for (const file of plan.files) {
    const group = texts.get(file.text) ?? []
    group.push(file); texts.set(file.text, group)
  }
  for (const [text, files] of texts) {
    const normal = await normalAudio(text, endpoint, process.env.LOCAL_TTS_TOKEN)
    const normalFile = files.find(file => file.speed === 'normal')
    if (!normalFile) throw new Error('A listening transcript needs a normal audio reference.')
    const normalPath = resolve(output, normalFile.filename)
    await atomicWrite(normalPath, normal)
    // execFile passes literal arguments. No transcript or filename enters a shell.
    const slow = validateMp3((await run(process.env.PATH_AUDIO_FFMPEG || 'ffmpeg', slowAudioArguments(normalPath), {
      encoding: 'buffer', maxBuffer: AUDIO_LIMIT, timeout: 30_000,
      env: { ...process.env, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1' },
    })).stdout)
    for (const file of files) {
      const bytes = file.speed === 'normal' ? normal : slow
      await atomicWrite(resolve(output, file.filename), bytes)
      manifest.files.push({ key: file.key, reference: file.reference, speed: file.speed,
        fingerprint: file.fingerprint, filename: file.filename, sha256: hash(bytes) })
    }
  }
  await atomicWrite(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

async function readAudio(filename) {
  if ((await stat(filename)).size > AUDIO_LIMIT) throw new Error('Local audio exceeded the file limit.')
  return validateMp3(await readFile(filename))
}

function uploadConfiguration() {
  const endpoint = process.env.PATH_AUDIO_SUPABASE_URL
  const token = process.env.PATH_AUDIO_SERVICE_ROLE_KEY || process.env.PATH_AUDIO_STAFF_ACCESS_TOKEN
  const key = process.env.PATH_AUDIO_SERVICE_ROLE_KEY || process.env.PATH_AUDIO_ANON_KEY
  if (!endpoint || !token || !key) {
    throw new Error('Upload needs PATH_AUDIO_SUPABASE_URL and either PATH_AUDIO_SERVICE_ROLE_KEY or PATH_AUDIO_ANON_KEY plus PATH_AUDIO_STAFF_ACCESS_TOKEN.')
  }
  return { endpoint: localEndpoint(endpoint), headers: { apikey: key, Authorization: `Bearer ${token}` } }
}

async function uploadAudio(plan, output, config) {
  const manifest = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'))
  if (manifest.version !== 1 || manifest.engine !== engine || !Array.isArray(manifest.files)) throw new Error('Generate the matching audio manifest before upload.')
  // Validate every file before the first write. Private bucket creation belongs
  // to the migration, not this command; never change a bucket to public here.
  for (const file of plan.files) {
    const entry = manifest.files.find(row => row.key === file.key && row.fingerprint === file.fingerprint && row.filename === file.filename)
    if (!entry || hash(await readAudio(resolve(output, file.filename))) !== entry.sha256) throw new Error('Audio files do not match the validated seed and manifest.')
  }
  const bucket = await fetch(new URL(`storage/v1/bucket/${BUCKET}`, config.endpoint), {
    headers: config.headers, redirect: 'error', signal: AbortSignal.timeout(30_000),
  })
  const details = await bucket.json().catch(() => null)
  if (!bucket.ok || !details || details.public !== false) throw new Error('The private path-audio Storage bucket is unavailable.')
  for (const file of plan.files) {
    const bytes = await readAudio(resolve(output, file.filename))
    const response = await fetch(new URL(`storage/v1/object/${BUCKET}/${file.key}`, config.endpoint), {
      method: 'POST', headers: { ...config.headers, 'Content-Type': 'audio/mpeg', 'x-upsert': 'false' },
      body: bytes, redirect: 'error', signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      // Existing immutable objects are successful retries only if byte-identical.
      const diagnostic = await response.json().catch(() => null)
      if (response.status !== 409 && diagnostic?.error !== 'Duplicate' && String(diagnostic?.statusCode) !== '409') {
        throw new Error(`Audio upload failed (HTTP ${response.status}).`)
      }
      const existing = await boundedAudio(await fetch(new URL(`storage/v1/object/authenticated/${BUCKET}/${file.key}`, config.endpoint), {
        headers: config.headers, redirect: 'error', signal: AbortSignal.timeout(30_000),
      }))
      if (hash(existing) !== hash(bytes)) throw new Error('An audio object already exists with different content; author a new object reference.')
    }
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('Usage: node scripts/path-listening-audio.mjs [seed.json] [--generate] [--upload] [--output directory]')
    console.log('Default: validate and dry-run only. --generate uses LOCAL_TTS_URL/token and local ffmpeg. --upload sends verified existing files to private local Storage.')
    console.log('Writing requires --output. Generate and upload are separate opt-ins; the seed is never modified.')
    return
  }
  let filename; let output; let generate = false; let upload = false
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--generate' && !generate) generate = true
    else if (arg === '--upload' && !upload) upload = true
    else if (arg === '--output' && !output && args[i + 1] && !args[i + 1].startsWith('--')) output = resolve(args[++i])
    else if (!arg.startsWith('--') && !filename) filename = arg
    else throw new Error('Invalid arguments. Use --help for supported options.')
  }
  if ((generate || upload) && !output) throw new Error('--generate and --upload require an explicit --output directory.')
  const require = createRequire(import.meta.url)
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } })
  const { learningPathSeedSchema } = require('../lib/learning-path-schema.ts')
  const parsed = learningPathSeedSchema.safeParse(JSON.parse(await readFile(resolve(root, filename ?? 'supabase/seeds/path-a1.1.json'), 'utf8')))
  if (!parsed.success) throw new Error(`Seed validation failed (${parsed.error.issues.length} issues).`)
  const plan = planListeningAudio(parsed.data)
  console.log(`Valid: ${plan.exercises} listening exercises, ${plan.files.length} audio files.${!generate && !upload ? ' Dry run only.' : ''}`)
  if (!plan.files.length || (!generate && !upload)) return
  const uploadConfig = upload ? uploadConfiguration() : null
  const tts = generate ? localEndpoint(process.env.LOCAL_TTS_URL || 'http://127.0.0.1:9070') : null
  if (tts && tts.pathname !== '/') throw new Error('The local Piper endpoint must have no path prefix.')
  if (generate) { await generateAudio(plan, output, tts); console.log(`Generated ${plan.files.length} audio files and manifest.json.`) }
  if (upload) { await uploadAudio(plan, output, uploadConfig); console.log(`Uploaded ${plan.files.length} private audio files.`) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Listening audio command failed.'); process.exitCode = 1 })
}
