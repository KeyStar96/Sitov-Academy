jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('@/lib/audio/neural-cache', () => ({ findCachedAudio: jest.fn(), generateCachedAudio: jest.fn(), neuralAudioPath: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'
import { findCachedAudio, generateCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { generateAudio } from '@/app/actions/generate-audio'
import type { GenerateAudioInput } from '@/lib/types/audio'
import { AUDIO_MAX_TEXT_LENGTH } from '@/lib/audio/neural-config'

const userId = '00000000-0000-4000-8000-000000000001'
const cardId = '10000000-0000-4000-8000-000000000001'
const audioUrl = 'https://project.supabase.co/storage/v1/object/public/audio_cache/audio.mp3'
const baseCard = { id: cardId, article: 'die', word_de: 'Tür', unit: { level: 'A1.1' }, audio_url: null as string | null }
const input: GenerateAudioInput = { text: 'die Tür', language: 'de', cardId }
const allowed = { success: true, remaining: 100, limit: 120, reset: 0 }

function session(options: {
  signedIn?: boolean; authError?: boolean; role?: string | null; levels?: string[];
  profileMissing?: boolean; card?: typeof baseCard | null; cardError?: boolean
} = {}) {
  const profile = options.profileMissing ? null : { role: options.role === undefined ? 'student' : options.role, level_access: (options.levels ?? ['A1.1']).map(level => ({ level })) }
  const profileChain = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: profile, error: null }),
  }
  const cardChain = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: options.card === undefined ? baseCard : options.card, error: options.cardError ? { message: 'hidden' } : null }),
  }
  const rulesResult = Promise.resolve({ data: [], error: null })
  const rules = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: rulesResult.then.bind(rulesResult) }
  const from = jest.fn((table: string) => table === 'profiles' ? profileChain : table === 'learning_trainer_grants' ? rules : cardChain)
  const client = {
    from, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: options.signedIn === false ? null : { id: userId } }, error: options.authError ? new Error('Expired') : null }) },
  }
  jest.mocked(createClient).mockResolvedValue(client as unknown as Awaited<ReturnType<typeof createClient>>)
  const updateResult = { error: null as unknown }
  const update = {
    update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockReturnThis(),
    then: (resolve: (value: typeof updateResult) => unknown) => Promise.resolve(updateResult).then(resolve),
  }
  const adminFrom = jest.fn().mockReturnValue(update)
  jest.mocked(createAdminClient).mockReturnValue({ from: adminFrom } as unknown as ReturnType<typeof createAdminClient>)
  jest.mocked(rateLimit).mockResolvedValue(allowed)
  jest.mocked(neuralAudioPath).mockReturnValue('cache-key.mp3')
  jest.mocked(findCachedAudio).mockResolvedValue(audioUrl)
  jest.mocked(generateCachedAudio).mockResolvedValue(audioUrl)
  return { from, profileChain, cardChain, update, adminFrom, updateResult }
}
beforeEach(() => jest.clearAllMocks())

describe('audio authorization and validation', () => {
  it.each([
    { text: '   ', language: 'de' }, { text: 'a'.repeat(AUDIO_MAX_TEXT_LENGTH + 1), language: 'de' },
    { text: 'Hallo\u0000', language: 'de' }, { text: 'Hallo', language: 'fr' },
    { text: 'Hallo', language: 'de', cardId: 'invalid' }, { text: 'Hallo', language: 'de', userId },
  ])('rejects malformed input before any auth, storage or service-role query', async candidate => {
    session()
    expect(await generateAudio(candidate as unknown as GenerateAudioInput)).toEqual({ success: false, error: 'invalid_input' })
    expect(createClient).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
    expect(findCachedAudio).not.toHaveBeenCalled()
  })
  it.each([{ signedIn: false }, { authError: true }])('rejects missing/invalid auth', async options => {
    const { from } = session(options)
    expect(await generateAudio(input)).toEqual({ success: false, error: 'unauthorized' })
    expect(from).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it.each([{ profileMissing: true }, { role: null }, { role: 'owner' }])('requires an explicitly recognized profile role', async options => {
    session(options)
    expect(await generateAudio(input)).toEqual({ success: false, error: 'forbidden' })
    expect(findCachedAudio).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it.each([{ levels: [] }, { card: null }, { cardError: true }])('denies unavailable cards and ungranted student levels', async options => {
    session(options)
    expect(await generateAudio(input)).toEqual({ success: false, error: 'forbidden' })
    expect(findCachedAudio).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it.each(['teacher', 'admin'])('allows explicitly authorized %s content access', async role => {
    const { profileChain, cardChain } = session({ role, levels: [] })
    expect(await generateAudio(input)).toMatchObject({ success: true })
    expect(profileChain.eq).toHaveBeenCalledWith('id', userId)
    expect(cardChain.eq).toHaveBeenCalledWith('id', cardId)
  })
  it('rejects arbitrary German text attached to a canonical vocabulary headword', async () => {
    session()
    expect(await generateAudio({ ...input, text: 'Ich öffne die Tür.' })).toEqual({ success: false, error: 'invalid_input' })
    expect(findCachedAudio).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})

describe('audio cache and protected recording updates', () => {
  it('returns a cache hit without spending a generation quota', async () => {
    session()
    expect(await generateAudio({ text: 'Hallo', language: 'de' })).toEqual({ success: true, audioUrl, cached: true })
    expect(generateCachedAudio).not.toHaveBeenCalled()
    expect(rateLimit).toHaveBeenCalledTimes(1)
    expect(rateLimit).toHaveBeenCalledWith(`audio-read:${userId}`, 120, '60 s')
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('normalizes speech text once and generates a cache miss under a separate quota', async () => {
    session()
    jest.mocked(findCachedAudio).mockResolvedValue(null)
    const text = '  die\n Tür '.normalize('NFD')
    expect(await generateAudio({ ...input, text })).toEqual({ success: true, audioUrl, cached: false })
    expect(neuralAudioPath).toHaveBeenCalledWith('die Tür', 'de')
    expect(generateCachedAudio).toHaveBeenCalledWith('die Tür', 'de', 'cache-key.mp3')
    expect(rateLimit).toHaveBeenCalledWith(`audio-generate:${userId}`, 20, '60 s')
  })
  it('never overwrites a teacher-provided vocabulary recording', async () => {
    session({ card: { ...baseCard, audio_url: 'https://example.org/manual.mp3' } })
    expect(await generateAudio(input)).toMatchObject({ success: true })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('writes only while the canonical word, article and empty audio URL still match', async () => {
    const { update } = session()
    await generateAudio(input)
    expect(update.update).toHaveBeenCalledWith({ audio_url: audioUrl })
    expect(update.eq).toHaveBeenCalledWith('id', cardId)
    expect(update.eq).toHaveBeenCalledWith('word_de', 'Tür')
    expect(update.eq).toHaveBeenCalledWith('article', 'die')
    expect(update.is).toHaveBeenCalledWith('audio_url', null)
  })
  it('handles article-less headwords using a SQL null guard', async () => {
    const { update } = session({ card: { ...baseCard, article: null } })
    await generateAudio({ ...input, text: 'Tür' })
    expect(update.is).toHaveBeenCalledWith('article', null)
    expect(update.is).toHaveBeenCalledWith('audio_url', null)
  })
  it.each(['ru', 'uk', 'en', 'tr'] as const)('never puts a %s translation into the German word audio column', async language => {
    session()
    expect(await generateAudio({ ...input, text: 'translation', language })).toMatchObject({ success: true })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('enforces the read quota before cache lookup', async () => {
    session()
    jest.mocked(rateLimit).mockResolvedValue({ ...allowed, success: false })
    expect(await generateAudio(input)).toEqual({ success: false, error: 'rate_limited' })
    expect(findCachedAudio).not.toHaveBeenCalled()
  })
  it('enforces the generation quota only on misses', async () => {
    session()
    jest.mocked(findCachedAudio).mockResolvedValue(null)
    jest.mocked(rateLimit).mockResolvedValueOnce(allowed).mockResolvedValueOnce({ ...allowed, success: false })
    expect(await generateAudio(input)).toEqual({ success: false, error: 'rate_limited' })
    expect(generateCachedAudio).not.toHaveBeenCalled()
    expect(createAdminClient).not.toHaveBeenCalled()
  })
  it('returns a safe error when storage or provider fails', async () => {
    session()
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.mocked(findCachedAudio).mockRejectedValue(new Error('private diagnostic'))
    expect(await generateAudio(input)).toEqual({ success: false, error: 'audio_unavailable' })
    expect(generateCachedAudio).not.toHaveBeenCalled()
    log.mockRestore()
  })
})
