import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { main, planSitovBakeryAudio } from './sitov-deutschreise-audio.mjs'
import { sitovAudioProfileFingerprint, sitovGermanAudioProfile } from './path-listening-audio.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const assetsPath = resolve(root, 'docs/design/deutschreise-assets.json')
const hash = value => createHash('sha256').update(value).digest('hex')

test('bakery planning preserves all existing transcripts and cannot escape the staging directory', async () => {
  const assets = JSON.parse(await readFile(assetsPath, 'utf8'))
  const before = JSON.stringify(assets.audio.texts)
  const jobs = planSitovBakeryAudio(assets.audio.texts, '/tmp/sitov-bakery-stage')
  assert.equal(jobs.length, 7)
  assert.deepEqual(jobs.map(job => [job.filename, job.text]), Object.entries(assets.audio.texts))
  assert.equal(JSON.stringify(assets.audio.texts), before)
  const unsafe = Object.fromEntries(Object.entries(assets.audio.texts).map(([name, text], index) => [index === 0 ? '../sitov-intro.mp3' : name, text]))
  assert.throws(() => planSitovBakeryAudio(unsafe, '/tmp/sitov-bakery-stage'), /Invalid/)
})

test('one stale provider file prevents replacement of the complete public bakery bundle', async t => {
  const output = await mkdtemp(resolve(tmpdir(), 'sitov-bakery-audio-'))
  t.after(() => rm(output, { recursive: true, force: true }))
  const originalAssets = await readFile(assetsPath)
  const assets = JSON.parse(originalAssets)
  const jobs = planSitovBakeryAudio(assets.audio.texts, output)
  const originals = await Promise.all(jobs.map(job => readFile(resolve(root, 'public/Bilder/deutschreise/audio', job.filename))))
  for (const [index, job] of jobs.entries()) {
    const bytes = Buffer.alloc(200); bytes.write('ID3')
    await writeFile(job.output, bytes)
    await writeFile(job.metadata, JSON.stringify({
      engine: index === jobs.length - 1 ? 'piper-local-v2' : sitovGermanAudioProfile.engine,
      voice: sitovGermanAudioProfile.voice, revision: sitovGermanAudioProfile.revision,
      profileFingerprint: sitovAudioProfileFingerprint(), textSha256: hash(job.text), audioSha256: hash(bytes),
      modelRevision: sitovGermanAudioProfile.tts.mlxRevision,
      referenceSha256: sitovGermanAudioProfile.reference.audioSha256,
      sampleRate: sitovGermanAudioProfile.output.sampleRate,
      bitrate: sitovGermanAudioProfile.output.bitRate,
      channels: sitovGermanAudioProfile.output.channels,
    }))
  }
  await assert.rejects(main(['--install', '--output', output]), /canonical German male Qwen/)
  assert.deepEqual(await readFile(assetsPath), originalAssets)
  for (const [index, job] of jobs.entries()) {
    assert.deepEqual(await readFile(resolve(root, 'public/Bilder/deutschreise/audio', job.filename)), originals[index])
  }
})
