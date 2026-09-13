jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/audio/edge-tts', () => ({ synthesizeNeuralAudio: jest.fn() }))

import { createAdminClient } from '@/utils/supabase/admin'
import { synthesizeNeuralAudio } from '@/lib/audio/edge-tts'
import { findCachedAudio, generateCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { AUDIO_CACHE_BUCKET, NEURAL_VOICES, normalizeAudioText, vocabularyAudioText } from '@/lib/audio/neural-config'

const internalAudioUrl = 'http://127.0.0.1:9080/storage/v1/object/public/audio_cache/cached.mp3'
const audioUrl = 'https://217.154.228.254/supabase/storage/v1/object/public/audio_cache/cached.mp3'
function storageClient() {
  const storage = {
    info: jest.fn().mockResolvedValue({ data: { id: 'object' }, error: null }),
    upload: jest.fn().mockResolvedValue({ data: { path: 'cached.mp3' }, error: null }),
    getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: internalAudioUrl } }),
  }
  const from = jest.fn().mockReturnValue(storage)
  jest.mocked(createAdminClient).mockReturnValue({ storage: { from } } as unknown as ReturnType<typeof createAdminClient>)
  jest.mocked(synthesizeNeuralAudio).mockResolvedValue(Buffer.from('test audio'))
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
    expect(neuralAudioPath('Guten Tag.', language)).toMatch(new RegExp(`^piper-local-v1/${language}/[a-f0-9]{64}\\.mp3$`))
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
    expect(await findCachedAudio('piper-local-v1/de/hash.mp3')).toBe(audioUrl)
    expect(from).toHaveBeenCalledWith(AUDIO_CACHE_BUCKET)
    expect(storage.info).toHaveBeenCalledWith('piper-local-v1/de/hash.mp3')
    expect(synthesizeNeuralAudio).not.toHaveBeenCalled()
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
    expect(synthesizeNeuralAudio).not.toHaveBeenCalled()
  })
  it('uploads MP3 immutably with a long cache lifetime', async () => {
    const { storage } = storageClient()
    const data = Buffer.from('mp3 bytes')
    jest.mocked(synthesizeNeuralAudio).mockResolvedValue(data)
    expect(await generateCachedAudio('Guten Tag.', 'de', 'generated.mp3')).toBe(audioUrl)
    expect(synthesizeNeuralAudio).toHaveBeenCalledWith('Guten Tag.', 'de')
    expect(storage.upload).toHaveBeenCalledWith('generated.mp3', data, {
      contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false,
    })
  })
  it('deduplicates simultaneous requests and releases the in-flight entry afterward', async () => {
    const { storage } = storageClient()
    let finish: (audio: Buffer) => void = () => undefined
    jest.mocked(synthesizeNeuralAudio).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const first = generateCachedAudio('Hallo', 'de', 'parallel.mp3')
    const second = generateCachedAudio('Hallo', 'de', 'parallel.mp3')
    expect(first).toBe(second)
    expect(synthesizeNeuralAudio).toHaveBeenCalledTimes(1)
    finish(Buffer.from('audio'))
    await expect(Promise.all([first, second])).resolves.toEqual([audioUrl, audioUrl])
    expect(storage.upload).toHaveBeenCalledTimes(1)
    await generateCachedAudio('Hallo', 'de', 'parallel.mp3')
    expect(synthesizeNeuralAudio).toHaveBeenCalledTimes(2)
  })
  it('uses another worker’s winning upload without overwriting it', async () => {
    const { storage } = storageClient()
    storage.upload.mockResolvedValue({ data: null, error: { statusCode: '409' } })
    expect(await generateCachedAudio('Hallo', 'de', 'race.mp3')).toBe(audioUrl)
    expect(storage.info).toHaveBeenCalledWith('race.mp3')
    expect(storage.upload).toHaveBeenCalledTimes(1)
  })
  it('fails when an upload failed and no winner exists, then permits a clean retry', async () => {
    const { storage } = storageClient()
    const error = { statusCode: '500' }
    storage.upload.mockResolvedValueOnce({ data: null, error })
    storage.info.mockResolvedValue({ data: null, error: { statusCode: '404' } })
    await expect(generateCachedAudio('Hallo', 'de', 'retry.mp3')).rejects.toBe(error)
    await expect(generateCachedAudio('Hallo', 'de', 'retry.mp3')).resolves.toBe(audioUrl)
    expect(synthesizeNeuralAudio).toHaveBeenCalledTimes(2)
  })
})
