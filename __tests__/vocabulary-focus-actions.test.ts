/** @jest-environment node */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { getVocabularyFocus, submitVocabularyFocusAnswer } from '@/app/actions/vocabulary-focus'

const rpc = jest.fn()
const card = '00000000-0000-4000-8000-000000000001', request = '00000000-0000-4000-8000-000000000002'
beforeEach(() => { jest.clearAllMocks(); jest.mocked(createClient).mockResolvedValue({ rpc } as never); jest.spyOn(console, 'error').mockImplementation(() => {}) })
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
