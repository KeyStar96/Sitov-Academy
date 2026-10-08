jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/audio/sitov-foreign-language-tts', () => ({ synthesizeNeuralSpeech: jest.fn() }))

import { createAdminClient } from '@/utils/supabase/admin'
import { synthesizeNeuralSpeech } from '@/lib/audio/sitov-foreign-language-tts'
import { findCachedAudio, generateCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { AUDIO_CACHE_BUCKET, NEURAL_VOICES, normalizeAudioText, vocabularyAudioText } from '@/lib/audio/neural-config'
import { createHash } from 'node:crypto'
import { AUDIO_CACHE_VERSION, AUDIO_FORMAT, AUDIO_RATE, SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS } from '@/lib/audio/neural-config'

const internalAudioUrl = 'http://127.0.0.1:9080/storage/v1/object/public/audio_cache/cached.mp3'
const privateReference = (path: string) => `storage://audio_cache/${path}`
function storageClient() {
  const storage = {
    info: jest.fn().mockResolvedValue({ data: { id: 'object', metadata: undefined as unknown }, error: null }),
    upload: jest.fn().mockResolvedValue({ data: { path: 'cached.mp3' }, error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: internalAudioUrl } }),
  }
  const from = jest.fn().mockReturnValue(storage)
  jest.mocked(createAdminClient).mockReturnValue({ storage: { from } } as unknown as ReturnType<typeof createAdminClient>)
  jest.mocked(synthesizeNeuralSpeech).mockResolvedValue({ audio: Buffer.from('test audio') })
  return { storage, from }
}
const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const previousInternalUrl = process.env.SUPABASE_INTERNAL_URL
beforeEach(() => {
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://217.154.228.254/supabase'
  process.env.SUPABASE_INTERNAL_URL = 'http://127.0.0.1:9080'
})
afterAll(() => {
  if (previousPublicUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousPublicUrl
  if (previousInternalUrl === undefined) delete process.env.SUPABASE_INTERNAL_URL; else process.env.SUPABASE_INTERNAL_URL = previousInternalUrl
})

describe('neural speech language and content keys', () => {
  it.each([
    ['de', 'sitov-qwen-male-de-v1', 'de-DE'], ['ru', 'ru_RU-denis-medium', 'ru-RU'],
    ['uk', 'uk_UA-ukrainian_tts-medium-speaker2', 'uk-UA'], ['en', 'en_US-ljspeech-high', 'en-US'], ['tr', 'espeak-ng-tr', 'tr-TR'],
  ] as const)('uses the configured %s local voice and locale', (language, voice, locale) => {
    expect(NEURAL_VOICES[language]).toEqual({ voice, locale })
    expect(neuralAudioPath('Guten Tag.', language)).toMatch(new RegExp(`^${language === 'de' ? AUDIO_CACHE_VERSION : 'piper-local-v2'}/${language}/[a-f0-9]{64}\\.mp3$`))
  })
  it('shares keys for Unicode/whitespace equivalents while preserving text and language distinctions', () => {
    expect(neuralAudioPath('  Ich öffne\n die Tür. ', 'de')).toBe(neuralAudioPath('Ich öffne die Tür.'.normalize('NFD'), 'de'))
    expect(neuralAudioPath('Tür', 'de')).not.toBe(neuralAudioPath('Tür', 'tr'))
    expect(neuralAudioPath('Tür', 'de')).not.toBe(neuralAudioPath('Tür?', 'de'))
    expect(neuralAudioPath('Tür', 'de')).not.toBe(neuralAudioPath('tür', 'de'))
  })
  it('creates canonical headwords without a synthetic none article', () => {
    expect(vocabularyAudioText({ article: 'die', word_de: ' Tür ' })).toBe('die Tür')
    expect(vocabularyAudioText({ article: 'none', word_de: 'lernen' })).toBe('lernen')
    expect(vocabularyAudioText({ article: null, word_de: 'lernen' })).toBe('lernen')
    expect(normalizeAudioText('öffnen'.normalize('NFD'))).toBe('öffnen')
  })
})

describe('immutable Storage cache', () => {
  it('looks up the dedicated bucket without generating on a hit', async () => {
    const { storage, from } = storageClient()
    expect(await findCachedAudio('piper-local-v2/en/hash.mp3')).toEqual({ audioUrl: privateReference('piper-local-v2/en/hash.mp3') })
    expect(from).toHaveBeenCalledWith(AUDIO_CACHE_BUCKET)
    expect(storage.info).toHaveBeenCalledWith('piper-local-v2/en/hash.mp3')
    expect(storage.getPublicUrl).not.toHaveBeenCalled()
    expect(synthesizeNeuralSpeech).not.toHaveBeenCalled()
  })
  it('rejects stored legacy German assets before looking up or synthesizing a fallback', async () => {
    const { storage } = storageClient()
    expect(await findCachedAudio('piper-local-v2/de/hash.mp3', 'Guten Tag.')).toBeNull()
    expect(storage.info).not.toHaveBeenCalled()
    expect(synthesizeNeuralSpeech).not.toHaveBeenCalled()
  })
  it.each(['400', '404', 404])('treats missing object status %s as a miss', async statusCode => {
    const { storage } = storageClient()
    storage.info.mockResolvedValue({ data: null, error: { statusCode } })
    expect(await findCachedAudio('missing.mp3')).toBeNull()
  })
  it('propagates storage authorization/provider errors without attempting synthesis', async () => {
    const { storage } = storageClient()
    const error = { statusCode: '403', message: 'Not authorized' }
    storage.info.mockResolvedValue({ data: null, error })
    await expect(findCachedAudio('private.mp3')).rejects.toBe(error)
    expect(synthesizeNeuralSpeech).not.toHaveBeenCalled()
  })
  it('uploads MP3 immutably with a long cache lifetime', async () => {
    const { storage } = storageClient()
    const data = Buffer.from('mp3 bytes')
    jest.mocked(synthesizeNeuralSpeech).mockResolvedValue({ audio: data })
    expect(await generateCachedAudio('Guten Tag.', 'en', 'generated.mp3')).toEqual({ audioUrl: privateReference('generated.mp3') })
    expect(synthesizeNeuralSpeech).toHaveBeenCalledWith('Guten Tag.', 'en')
    expect(storage.upload).toHaveBeenCalledWith('generated.mp3', data, {
      contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false,
    })
  })
  it('deduplicates simultaneous requests and releases the in-flight entry afterward', async () => {
    const { storage } = storageClient()
    let finish: (audio: Buffer) => void = () => undefined
    jest.mocked(synthesizeNeuralSpeech).mockReturnValueOnce(new Promise(resolve => { finish = audio => resolve({ audio }) }))
    const first = generateCachedAudio('Hallo', 'en', 'parallel.mp3')
    const second = generateCachedAudio('Hallo', 'en', 'parallel.mp3')
    expect(first).toBe(second)
    expect(synthesizeNeuralSpeech).toHaveBeenCalledTimes(1)
    finish(Buffer.from('audio'))
    await expect(Promise.all([first, second])).resolves.toEqual([{ audioUrl: privateReference('parallel.mp3') }, { audioUrl: privateReference('parallel.mp3') }])
    expect(storage.upload).toHaveBeenCalledTimes(1)
    await generateCachedAudio('Hallo', 'en', 'parallel.mp3')
    expect(synthesizeNeuralSpeech).toHaveBeenCalledTimes(2)
  })
  it('uses another worker’s winning upload without overwriting it', async () => {
    const { storage } = storageClient()
    storage.upload.mockResolvedValue({ data: null, error: { statusCode: '409' } })
    expect(await generateCachedAudio('Hallo', 'en', 'race.mp3')).toEqual({ audioUrl: privateReference('race.mp3') })
    expect(storage.info).toHaveBeenCalledWith('race.mp3')
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })
  it('fails when an upload failed and no winner exists, then permits a clean retry', async () => {
    const { storage } = storageClient()
    const error = { statusCode: '500' }
    storage.upload.mockResolvedValueOnce({ data: null, error })
    storage.info.mockResolvedValue({ data: null, error: { statusCode: '404' } })
    await expect(generateCachedAudio('Hallo', 'en', 'retry.mp3')).rejects.toBe(error)
    await expect(generateCachedAudio('Hallo', 'en', 'retry.mp3')).resolves.toEqual({ audioUrl: privateReference('retry.mp3') })
    expect(synthesizeNeuralSpeech).toHaveBeenCalledTimes(2)
  })
})

it('uses only validated precomputed Qwen assets with real word timings', async () => {
  const { SITOV_QWEN_PROFILE_FINGERPRINT } = await import('@/lib/audio/neural-identity')
  const { storage } = storageClient()
  const path = neuralAudioPath('die Tür', 'de')
  const wordTimings = [{ start: 0.35, end: 0.6 }, { start: 0.7, end: 1.4 }]
  expect(await findCachedAudio(path)).toBeNull()
  storage.info.mockResolvedValue({ data: { id: 'object', metadata: { wordTimings, engine: 'qwen3-tts', profileFingerprint: 'wrong' } }, error: null })
  expect(await findCachedAudio(path)).toBeNull()
  storage.info.mockResolvedValue({ data: { id: 'object', metadata: { wordTimings, engine: 'qwen3-tts', voice: 'sitov-qwen-male-de-v1', revision: 'sitov-qwen-base-bf16-v1', textSha256: createHash('sha256').update('die Tür').digest('hex'), profileFingerprint: SITOV_QWEN_PROFILE_FINGERPRINT } }, error: null })
  expect(await findCachedAudio(path, 'die Tür')).toEqual({ audioUrl: privateReference(path), wordTimings })
  expect(await findCachedAudio(path, 'falscher Text')).toBeNull()
  expect(synthesizeNeuralSpeech).not.toHaveBeenCalled()
})

it('versions the model, reference and alignment profile while sharing one male voice', () => {
  const { SITOV_QWEN_PROFILE_FINGERPRINT } = require('@/lib/audio/neural-identity')
  const hash = createHash('sha256').update(JSON.stringify({ text: 'die Tür', voice: 'sitov-qwen-male-de-v1', rate: AUDIO_RATE, format: AUDIO_FORMAT, leadIn: SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS, profile: SITOV_QWEN_PROFILE_FINGERPRINT })).digest('hex')
  expect(neuralAudioPath('die Tür', 'de')).toBe(`${AUDIO_CACHE_VERSION}/de/${hash}.mp3`)
  expect(neuralAudioPath('die Tür', 'de', 'male')).toBe(neuralAudioPath('die Tür', 'de'))
  expect(neuralAudioPath('die Tür', 'de')).not.toContain('piper-local-v2')
})

it('prevents German cache misses from starting inference through any shared caller', async () => {
  const { storage } = storageClient()
  await expect(generateCachedAudio('Hallo', 'de', neuralAudioPath('Hallo', 'de'))).rejects.toThrow('requires local preparation')
  expect(synthesizeNeuralSpeech).not.toHaveBeenCalled()
  expect(storage.upload).not.toHaveBeenCalled()
})
