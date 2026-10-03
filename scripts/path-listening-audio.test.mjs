import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { assertSitovQwenMetadata, audioObjectKey, localEndpoint, planListeningAudio, sitovAudioProfileFingerprint, sitovGermanAudioProfile, SITOV_PATH_AUDIO_ENGINE, slowAudioArguments, validateMp3 } from './path-listening-audio.mjs'

const prefix = '/storage/v1/object/authenticated/path-audio/'
const exercise = text => ({ exercise_type: 'listening', content: { transcript: text, audio: { normal: `${prefix}example/normal.mp3`, slow: `${prefix}example/slow.mp3` } } })
const paths = exercises => [{ nodes: [{ exercises }] }]

test('audio planning is deterministic, deduplicates files and leaves authored content intact', () => {
  const input = paths([exercise('Guten Tag.'), exercise('Guten Tag.')])
  const before = JSON.stringify(input)
  const plan = planListeningAudio(input)
  assert.equal(plan.exercises, 2); assert.equal(plan.files.length, 2)
  assert.deepEqual(plan, planListeningAudio(input)); assert.equal(JSON.stringify(input), before)
  assert.ok(plan.files.every(file => /^[a-f0-9]{64}\.mp3$/.test(file.filename)))
  assert.notEqual(plan.files[0].fingerprint, plan.files[1].fingerprint)
  assert.throws(() => planListeningAudio(paths([exercise('Guten Tag.'), exercise('Guten Abend.')])) , /different transcripts/)
  assert.deepEqual(planListeningAudio(paths([{ exercise_type: 'fill_in_blank' }])), { exercises: 0, files: [] })
})

test('audio references and service URLs cannot escape local private storage', () => {
  assert.equal(audioObjectKey(`${prefix}uuid/normal.mp3`), 'uuid/normal.mp3')
  for (const ref of [`${prefix}../normal.mp3`, `${prefix}%2e%2e/a.mp3`, `${prefix}a?x.mp3`, `${prefix}a\\b.mp3`, `${prefix}a//b.mp3`, '/public/file.mp3', 'https://example.com/a.mp3']) {
    assert.throws(() => audioObjectKey(ref))
  }
  assert.equal(localEndpoint('http://127.0.0.1:8000/supabase').href, 'http://127.0.0.1:8000/supabase/')
  for (const url of ['https://example.com', 'http://127.0.0.1@evil.test', 'file:///tmp/audio', 'http://localhost?a=b', 'http://localhost/#test']) {
    assert.throws(() => localEndpoint(url))
  }
})

test('bounded Qwen text and literal ffmpeg arguments preserve resource and process limits', () => {
  assert.throws(() => planListeningAudio(paths([exercise('x'.repeat(3001))])), /3000/)
  assert.throws(() => planListeningAudio(paths([exercise('hello\u0001')])), /control characters/)
  const filename = '/tmp/literal `echo SECRET` $(echo SECRET).mp3'
  const args = slowAudioArguments(filename)
  assert.equal(args[args.indexOf('-i') + 1], filename)
  assert.equal(args[args.indexOf('-af') + 1], 'atempo=0.8')
  assert.equal(args[args.indexOf('-threads') + 1], '1')
  assert.equal(args.at(-1), 'pipe:1')
  assert.throws(() => validateMp3(Buffer.alloc(200)), /Invalid/)
  const mp3 = Buffer.alloc(200); mp3.write('ID3')
  assert.equal(validateMp3(mp3), mp3)
  assert.throws(() => validateMp3(Buffer.concat([mp3, Buffer.alloc(2 * 1024 * 1024)])), /oversized/)
})

test('model, speaker reference and generation changes invalidate authored audio fingerprints', () => {
  assert.ok(SITOV_PATH_AUDIO_ENGINE.startsWith(`qwen3-tts:${sitovGermanAudioProfile.voice}:${sitovGermanAudioProfile.revision}:`))
  const sameProfile = Object.fromEntries(Object.entries(sitovGermanAudioProfile).reverse())
  assert.equal(sitovAudioProfileFingerprint(sameProfile), sitovAudioProfileFingerprint())
  for (const change of [
    { revision: 'sitov-new-model-v2' },
    { reference: { ...sitovGermanAudioProfile.reference, audioSha256: 'a'.repeat(64) } },
    { tts: { ...sitovGermanAudioProfile.tts, seed: sitovGermanAudioProfile.tts.seed + 1 } },
  ]) {
    assert.notEqual(sitovAudioProfileFingerprint({ ...sitovGermanAudioProfile, ...change }), sitovAudioProfileFingerprint())
  }
})

test('offline authoring rejects Piper, another text and mismatched Qwen files before installation', () => {
  const text = 'Guten Tag.'
  const bytes = Buffer.from('generated MP3 bytes')
  const hash = value => createHash('sha256').update(value).digest('hex')
  const metadata = {
    engine: sitovGermanAudioProfile.engine,
    voice: sitovGermanAudioProfile.voice,
    revision: sitovGermanAudioProfile.revision,
    profileFingerprint: sitovAudioProfileFingerprint(),
    modelRevision: sitovGermanAudioProfile.tts.mlxRevision,
    referenceSha256: sitovGermanAudioProfile.reference.audioSha256,
    sampleRate: sitovGermanAudioProfile.output.sampleRate,
    bitrate: sitovGermanAudioProfile.output.bitRate,
    channels: sitovGermanAudioProfile.output.channels,
    textSha256: hash(text), audioSha256: hash(bytes),
  }
  assert.doesNotThrow(() => assertSitovQwenMetadata(metadata, text, bytes))
  for (const field of Object.keys(metadata)) {
    assert.throws(() => assertSitovQwenMetadata({ ...metadata, [field]: 'piper-local-v2' }, text, bytes), /canonical German male Qwen/)
    const missing = { ...metadata }; delete missing[field]
    assert.throws(() => assertSitovQwenMetadata(missing, text, bytes), /canonical German male Qwen/)
  }
  assert.throws(() => assertSitovQwenMetadata(metadata, 'Guten Abend.', bytes), /text and file/)
  assert.throws(() => assertSitovQwenMetadata(metadata, text, Buffer.from('another file')), /text and file/)
})
