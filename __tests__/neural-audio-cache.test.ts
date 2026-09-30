jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/audio/edge-tts', () => ({ synthesizeNeuralSpeech: jest.fn() }))

import { createAdminClient } from '@/utils/supabase/admin'
import { synthesizeNeuralSpeech } from '@/lib/audio/edge-tts'
import { findCachedAudio, generateCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { AUDIO_CACHE_BUCKET, NEURAL_VOICES, normalizeAudioText, vocabularyAudioText } from '@/lib/audio/neural-config'
import { createHash } from 'node:crypto'
import { AUDIO_CACHE_VERSION, AUDIO_FORMAT, AUDIO_RATE } from '@/lib/audio/neural-config'

const internalAudioUrl = 'http://127.0.0.1:9080/storage/v1/object/public/audio_cache/cached.mp3'
const audioUrl = 'https://217.154.228.254/supabase/storage/v1/object/public/audio_cache/cached.mp3'
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
    ['de', 'de_DE-thorsten-high', 'de-DE'], ['ru', 'ru_RU-denis-medium', 'ru-RU'],
    ['uk', 'uk_UA-ukrainian_tts-medium-speaker2', 'uk-UA'], ['en', 'en_US-ljspeech-high', 'en-US'], ['tr', 'espeak-ng-tr', 'tr-TR'],
  ] as const)('uses the configured %s local voice and locale', (language, voice, locale) => {
    expect(NEURAL_VOICES[language]).toEqual({ voice, locale })
    expect(neuralAudioPath('Guten Tag.', language)).toMatch(new RegExp(`^piper-local-v2/${language}/[a-f0-9]{64}\\.mp3$`))
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
    expect(await findCachedAudio('piper-local-v2/de/hash.mp3')).toEqual({ audioUrl })
    expect(from).toHaveBeenCalledWith(AUDIO_CACHE_BUCKET)
    expect(storage.info).toHaveBeenCalledWith('piper-local-v2/de/hash.mp3')
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
    expect(await generateCachedAudio('Guten Tag.', 'de', 'generated.mp3')).toEqual({ audioUrl })
    expect(synthesizeNeuralSpeech).toHaveBeenCalledWith('Guten Tag.', 'de')
    expect(storage.upload).toHaveBeenCalledWith('generated.mp3', data, {
      contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false,
    })
  })
  it('deduplicates simultaneous requests and releases the in-flight entry afterward', async () => {
    const { storage } = storageClient()
    let finish: (audio: Buffer) => void = () => undefined
    jest.mocked(synthesizeNeuralSpeech).mockReturnValueOnce(new Promise(resolve => { finish = audio => resolve({ audio }) }))
    const first = generateCachedAudio('Hallo', 'de', 'parallel.mp3')
    const second = generateCachedAudio('Hallo', 'de', 'parallel.mp3')
    expect(first).toBe(second)
    expect(synthesizeNeuralSpeech).toHaveBeenCalledTimes(1)
    finish(Buffer.from('audio'))
    await expect(Promise.all([first, second])).resolves.toEqual([{ audioUrl }, { audioUrl }])
    expect(storage.upload).toHaveBeenCalledTimes(1)
    await generateCachedAudio('Hallo', 'de', 'parallel.mp3')
    expect(synthesizeNeuralSpeech).toHaveBeenCalledTimes(2)
  })
  it('uses another worker’s winning upload without overwriting it', async () => {
    const { storage } = storageClient()
    storage.upload.mockResolvedValue({ data: null, error: { statusCode: '409' } })
    expect(await generateCachedAudio('Hallo', 'de', 'race.mp3')).toEqual({ audioUrl })
    expect(storage.info).toHaveBeenCalledWith('race.mp3')
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })
  it('fails when an upload failed and no winner exists, then permits a clean retry', async () => {
    const { storage } = storageClient()
    const error = { statusCode: '500' }
    storage.upload.mockResolvedValueOnce({ data: null, error })
    storage.info.mockResolvedValue({ data: null, error: { statusCode: '404' } })
    await expect(generateCachedAudio('Hallo', 'de', 'retry.mp3')).rejects.toBe(error)
    await expect(generateCachedAudio('Hallo', 'de', 'retry.mp3')).resolves.toEqual({ audioUrl })
    expect(synthesizeNeuralSpeech).toHaveBeenCalledTimes(2)
  })
})

it('uses the existing Thorsten cache key and retains exact timings with MP3', async () => {
  const { storage } = storageClient()
  const hash = createHash('sha256').update(JSON.stringify({ text: 'die Tür', voice: 'de_DE-thorsten-high', rate: AUDIO_RATE, format: AUDIO_FORMAT })).digest('hex')
  const path = `${AUDIO_CACHE_VERSION}/de/${hash}.mp3`
  expect(neuralAudioPath('die Tür', 'de')).toBe(path)
  const wordTimings = [{ start: 0.05, end: 0.3 }, { start: 0.4, end: 1.1 }]
  jest.mocked(synthesizeNeuralSpeech).mockResolvedValue({ audio: Buffer.from('mp3'), wordTimings })
  expect(await generateCachedAudio('die Tür', 'de', path)).toEqual({ audioUrl, wordTimings })
  expect(storage.upload).toHaveBeenCalledWith(path, expect.any(Buffer), expect.objectContaining({ metadata: { wordTimings }, upsert: false }))
  storage.info.mockResolvedValue({ data: { id: 'object', metadata: { wordTimings } }, error: null })
  expect(await findCachedAudio(path)).toEqual({ audioUrl, wordTimings })
})
