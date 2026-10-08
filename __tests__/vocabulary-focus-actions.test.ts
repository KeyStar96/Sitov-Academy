/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { getVocabularyFocus, submitVocabularyFocusAnswer } from '@/app/actions/vocabulary-focus'

const rpc = jest.fn()
const card = '00000000-0000-4000-8000-000000000001', request = '00000000-0000-4000-8000-000000000002'
function sourceSession(native = 'de') {
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { role: 'student', native_language: native, ui_language: 'de', level_access: [{ level: 'A1.1' }] }, error: null }) }
  const response = Promise.resolve({ data: [], error: null })
  const rules = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: response.then.bind(response) }
  jest.mocked(createClient).mockResolvedValue({ from: (name: string) => name === 'profiles' ? profile : rules,
    auth: { getUser: async () => ({ data: { user: { id: card } }, error: null }) },
    rpc: (name: string, args: unknown) => name === 'get_sitov_access_context' ? Promise.resolve({ data: { vip_enabled: false, trial: { version: 1, rules: [] }, purchased_levels: [], revision: 0 }, error: null }) : rpc(name, args),
  } as never)
}
beforeEach(() => { jest.clearAllMocks(); sourceSession(); jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => jest.restoreAllMocks())
const summary = { active: 0, due: 0, mastered: 0, articleWords: 0, nextDueAt: null }

it('loads one level in a trainer language and maps database refusals', async () => {
  expect(await getVocabularyFocus('A1.1', 'de')).toEqual({ success: false, error: 'language' })
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: { success: true, level: 'A1.1', summary, words: [], items: [] }, error: null })
  expect(await getVocabularyFocus('A1.1', 'ru')).toEqual({ success: true, data: { level: 'A1.1', summary, words: [], items: [] } })
  expect(rpc).toHaveBeenCalledWith('get_vocabulary_focus', { p_level: 'A1.1', p_ui_language: 'ru' })
  rpc.mockResolvedValue({ data: { error: 'invalid_learning_language', message: 'x' }, error: null })
  expect(await getVocabularyFocus('A1.1', 'ru')).toEqual({ success: false, error: 'language' })
  rpc.mockResolvedValue({ data: { success: true, level: 'A1.1', summary, words: [], items: [{ format: 'unknown' }] }, error: null })
  expect(await getVocabularyFocus('A1.1', 'ru')).toEqual({ success: false, error: 'failed' })
})

it('sends only validated answers and never trusts a client grade', async () => {
  expect(await submitVocabularyFocusAnswer({ requestId: request, cardId: card, format: 'article', answer: 'der', lang: 'ru', correct: true })).toEqual({ success: false, error: 'failed' })
  expect(await submitVocabularyFocusAnswer({ requestId: request, cardId: card, format: 'article', answer: '   ', lang: 'ru' })).toEqual({ success: false, error: 'failed' })
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: { success: true, correct: true, format: 'article', stage: 1, status: 'active', dueAt: '2026-10-01T22:00:00+00:00', solution: { display: 'der Tisch', word: 'Tisch', article: 'der' }, softError: null, feedback: null }, error: null })
  const result = await submitVocabularyFocusAnswer({ requestId: request, cardId: card, format: 'article', answer: ' der ', lang: 'ru' })
  expect(result.success && result.data.stage).toBe(1)
  expect(rpc).toHaveBeenCalledWith('submit_vocabulary_focus_answer', { p_request_id: request, p_card_id: card, p_format: 'article', p_answer: 'der', p_ui_language: 'ru' })
  for (const [code, mapped] of [['review_not_due', 'not_due'], ['conflict', 'not_due'], ['trainer_access_denied', 'not_found'], ['request_failed', 'failed']] as const) {
    rpc.mockResolvedValue({ data: { error: code, message: 'x' }, error: null })
    expect(await submitVocabularyFocusAnswer({ requestId: request, cardId: card, format: 'type', answer: 'der Tisch', lang: 'ru' })).toEqual({ success: false, error: mapped })
  }
})

it('rejects an old device answer after the signed-in account changes', async () => {
  jest.mocked(createClient).mockResolvedValue({ rpc, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000099' } }, error: null }) } } as never)
  expect(await submitVocabularyFocusAnswer({ requestId: request, cardId: card, format: 'article', answer: 'der', lang: 'ru', expectedLearnerId: card })).toEqual({ success: false, error: 'not_authenticated' })
  expect(rpc).not.toHaveBeenCalled()
})

it('uses the stored supported source in German UI without changing the interface or defaulting to English', async () => {
  sourceSession('ru')
  rpc.mockResolvedValue({ data: { success: true, level: 'A1.1', summary, words: [], items: [] }, error: null })
  expect(await getVocabularyFocus('A1.1', 'de')).toEqual({ success: true, data: { level: 'A1.1', summary, words: [], items: [], learningSourceLanguage: 'ru' } })
  expect(rpc).toHaveBeenCalledWith('get_vocabulary_focus', { p_level: 'A1.1', p_ui_language: 'ru' })
})

it('grades a German-interface round only in its current stored source and rejects stale or missing source assertions', async () => {
  sourceSession('ru')
  const input = { requestId: request, cardId: card, format: 'article', answer: 'der', lang: 'de', expectedLearnerId: card }
  expect(await submitVocabularyFocusAnswer(input)).toEqual({ success: false, error: 'language' })
  expect(await submitVocabularyFocusAnswer({ ...input, learningSourceLanguage: 'en' })).toEqual({ success: false, error: 'language' })
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: { correct: true, format: 'article', stage: 1, status: 'active', dueAt: null, solution: { display: 'der Tisch', word: 'Tisch', article: 'der' } }, error: null })
  expect((await submitVocabularyFocusAnswer({ ...input, learningSourceLanguage: 'ru' })).success).toBe(true)
  expect(rpc).toHaveBeenCalledWith('submit_vocabulary_focus_answer', { p_request_id: request, p_card_id: card, p_format: 'article', p_answer: 'der', p_ui_language: 'ru' })
  rpc.mockClear()
  sourceSession('uk')
  expect(await submitVocabularyFocusAnswer({ ...input, learningSourceLanguage: 'ru' })).toEqual({ success: false, error: 'language' })
  expect(rpc).not.toHaveBeenCalled()
})
