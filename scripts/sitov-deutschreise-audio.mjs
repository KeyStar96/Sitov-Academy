#!/usr/bin/env node
/** Local authoring for the archived bakery references; never imported by learner routes. */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertSitovQwenMetadata, runSitovQwenBatch, sitovAudioProfileFingerprint, sitovGermanAudioProfile, validateMp3 } from './path-listening-audio.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(root, 'docs/design/deutschreise-assets.json')
const targetDirectory = resolve(root, 'public/Bilder/deutschreise/audio')
const hash = value => createHash('sha256').update(value).digest('hex')

export function planSitovBakeryAudio(texts, output) {
  if (!texts || typeof texts !== 'object' || Array.isArray(texts) || Object.keys(texts).length !== 7) {
    throw new Error('The bakery reference must contain its seven existing transcripts.')
  }
  return Object.entries(texts).map(([filename, text]) => {
    if (!/^sitov-[a-z]+\.mp3$/.test(filename) || typeof text !== 'string' || !text.trim() || text.length > 3000) {
      throw new Error('Invalid bakery audio reference.')
    }
    return { id: filename.slice(0, -4), filename, text, output: resolve(output, filename),
      metadata: resolve(output, `${filename}.json`), rate: 1 }
  })
}

async function atomicWrite(path, bytes, mode = 0o600) {
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, bytes, { mode, flag: 'wx' })
  await rename(temporary, path)
}

export async function validateSitovBakeryBatch(jobs) {
  const files = []
  for (const job of jobs) {
    const bytes = validateMp3(await readFile(job.output))
    const metadata = JSON.parse(await readFile(job.metadata, 'utf8'))
    assertSitovQwenMetadata(metadata, job.text, bytes)
    files.push({ filename: job.filename, text: job.text, sha256: hash(bytes), metadata, bytes })
  }
  return files
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('Usage: node scripts/sitov-deutschreise-audio.mjs [--generate] [--install] [--output directory]')
    console.log('Default is a dry run. Generation uses the local canonical Qwen batch CLI, with the same SITOV_QWEN_* environment as path-listening-audio.mjs.')
    console.log('Install validates all seven generated files and matching provider metadata before replacing the existing static references. Transcripts and URLs stay intact.')
    return
  }
  let output; let generate = false; let install = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--generate' && !generate) generate = true
    else if (args[i] === '--install' && !install) install = true
    else if (args[i] === '--output' && !output && args[i + 1] && !args[i + 1].startsWith('--')) output = resolve(args[++i])
    else throw new Error('Invalid authoring arguments.')
  }
  if ((generate || install) && !output) throw new Error('Writing needs an explicit output directory.')
  const assets = JSON.parse(await readFile(sourcePath, 'utf8'))
  const jobs = planSitovBakeryAudio(assets.audio.texts, output ?? targetDirectory)
  if (!generate && !install) {
    console.log(`Valid: ${jobs.length} existing bakery transcripts. Dry run only.`)
    return
  }
  await mkdir(output, { recursive: true, mode: 0o700 })
  if (generate) await runSitovQwenBatch(jobs, output)
  const files = await validateSitovBakeryBatch(jobs)
  const manifest = { version: 1, product: 'Sitov Academy', engine: sitovGermanAudioProfile.engine,
    voice: sitovGermanAudioProfile.voice, revision: sitovGermanAudioProfile.revision,
    profileFingerprint: sitovAudioProfileFingerprint(),
    files: files.map(({ filename, text, sha256, metadata }) => ({ filename, text, sha256, metadata })) }
  await atomicWrite(resolve(output, 'sitov-deutschreise-audio-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  if (install) {
    await mkdir(targetDirectory, { recursive: true })
    for (const file of files) await atomicWrite(resolve(targetDirectory, file.filename), file.bytes, 0o644)
    assets.audio.mode = 'Locally precomputed Qwen3-TTS with the canonical German male Sitov Academy reference; no runtime model dependency'
    assets.audio.voice = sitovGermanAudioProfile.voice
    assets.audio.engine = sitovGermanAudioProfile.engine
    assets.audio.revision = sitovGermanAudioProfile.revision
    assets.audio.profile = 'lib/audio/models/sitov-qwen-male-de/config.json'
    assets.audio.profileFingerprint = sitovAudioProfileFingerprint()
    assets.audio.reference = { speaker: 'Thorsten Müller', license: sitovGermanAudioProfile.reference.license,
      audioSha256: sitovGermanAudioProfile.reference.audioSha256, source: sitovGermanAudioProfile.reference.source }
    assets.audio.generatedFiles = Object.fromEntries(files.map(file => [file.filename, {
      sha256: file.sha256, textSha256: file.metadata.textSha256, provider: file.metadata.engine,
      modelRevision: sitovGermanAudioProfile.tts.mlxRevision,
    }]))
    await atomicWrite(sourcePath, `${JSON.stringify(assets, null, 2)}\n`, 0o644)
    console.log(`Installed ${files.length} canonical male Qwen references at the existing URLs.`)
  } else console.log(`Verified ${files.length} canonical male Qwen references in the local output directory.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Bakery audio authoring failed. Check arguments, local Qwen configuration and matching generated metadata; no internal diagnostics were printed.')
    process.exitCode = 1
  })
}
