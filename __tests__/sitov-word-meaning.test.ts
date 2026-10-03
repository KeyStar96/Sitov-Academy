jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/app/actions/pronunciation', () => ({ getPronunciationPrompts: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('@/lib/learning-catalog', () => ({ vocabularyQuery: jest.fn() }))

import { getSitovWordMeaning } from '@/app/actions/sitov-word-meaning'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { createClient } from '@/utils/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { vocabularyQuery } from '@/lib/learning-catalog'
import { sitovLocalWordMeaning, sitovLookupWord } from '@/lib/sitov-word-meaning'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

const promptId = 'fd1297a1-999f-5759-b0d9-1f77c381d114'
const input = { promptId, level: 'A1.1', word: 'Bäume.', locale: 'uk' }
let getUser: jest.Mock
let query: { or: jest.Mock; eq: jest.Mock; limit: jest.Mock }
beforeEach(() => {
  jest.clearAllMocks()
  getUser = jest.fn().mockResolvedValue({ data: { user: { id: 'student' } }, error: null })
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser } } as unknown as Awaited<ReturnType<typeof createClient>>)
  jest.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 119, limit: 120, reset: 0 })
  jest.mocked(getPronunciationPrompts).mockResolvedValue([{ id: promptId, sentenceDe: 'Ich gehe in den Park. Dort sind Bäume.' } as PronunciationPrompt])
  query = { or: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue({ data: [{ word_de: 'Baum', article: 'der', plural: 'Bäume', translations: [{ locale: 'en', translation: 'tree' }, { locale: 'uk', translation: 'дерево' }] }], error: null }) }
  jest.mocked(vocabularyQuery).mockReturnValue(query as unknown as ReturnType<typeof vocabularyQuery>)
})

it('resolves an authored plural in the interface language using the authenticated client', async () => {
  expect(await getSitovWordMeaning(input)).toEqual({ ok: true, meaning: { word: 'Bäume.', base: 'Baum', translation: 'дерево', locale: 'uk' } })
  expect(vocabularyQuery).toHaveBeenCalledWith(await createClient())
  expect(query.or).toHaveBeenCalledWith(expect.stringContaining('plural.ilike.bäume'))
  expect(query.limit).toHaveBeenCalledWith(12)
})

it('never substitutes another interface language when a translation is absent', async () => {
  expect(await getSitovWordMeaning({ ...input, locale: 'tr' })).toEqual({ ok: true, meaning: null })
})

it.each([
  { ...input, word: 'Bäume%,word_de.neq.secret' },
  { ...input, locale: 'fr' }, { ...input, promptId: 'invalid' },
])('rejects invalid lookup/filter input before authentication', async value => {
  expect(await getSitovWordMeaning(value)).toEqual({ ok: false })
  expect(createClient).not.toHaveBeenCalled()
})

it('requires valid authentication before looking up even a public function word', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await getSitovWordMeaning({ ...input, word: 'Ich' })).toEqual({ ok: false })
  expect(getPronunciationPrompts).not.toHaveBeenCalled()
})

it('does not expose meanings for locked readings or words outside the text', async () => {
  expect(await getSitovWordMeaning({ ...input, word: 'Haus' })).toEqual({ ok: false })
  jest.mocked(getPronunciationPrompts).mockResolvedValue([])
  expect(await getSitovWordMeaning({ ...input, word: 'Ich' })).toEqual({ ok: false })
  expect(vocabularyQuery).not.toHaveBeenCalled()
})

it('uses reviewed forms for conjugated verbs and preserves German explanations', () => {
  expect(sitovLookupWord('„Bäume!“')).toBe('bäume')
  expect(sitovLocalWordMeaning('gehe', 'en')).toMatchObject({ base: 'gehen', translation: 'go' })
  expect(sitovLocalWordMeaning('meinen', 'ru')).toMatchObject({ base: 'mein', translation: 'мой' })
  expect(sitovLocalWordMeaning('im', 'de')).toMatchObject({ translation: 'in dem' })
})
