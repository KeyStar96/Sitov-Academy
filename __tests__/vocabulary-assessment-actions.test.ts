jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))

import { createClient } from '@/utils/supabase/server'
import { getVocabularyAssessment, getLessonCards } from '@/app/actions/vocabulary'
import type { VocabularyCardRow } from '@/lib/types/vocabulary'
const userId = '00000000-0000-4000-8000-000000000001'
const card: VocabularyCardRow = {
  id: '30000000-0000-4000-8000-000000000001', word_de: 'Tür', lesson: 'Lektion 1', level: 'A1.1',
  article: 'die', plural: 'Türen', created_at: null, image_url: null, audio_url: null,
  is_hard_for_ru: false, is_hard_for_tr: false, sentence_practice: true, alternative_answers_de: [],
  translation_en: 'door', translation_ru: 'дверь', translation_uk: 'двері', translation_tr: 'kapı',
  context_sentence_de: 'Ich öffne die Tür.', context_sentence_en: 'I open the door.',
  context_sentence_ru: 'Я открываю дверь.', context_sentence_uk: 'Я відчиняю двері.', context_sentence_tr: 'Kapıyı açıyorum.',
}
function setup({ directions = [], language = 'ru', content = card }: { directions?: Array<'de_to_native' | 'native_to_de'>; language?: string; content?: VocabularyCardRow } = {}) {
  const response = Promise.resolve({ data: [content], error: null })
  const cards = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), then: response.then.bind(response) }
  const progress = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({
    data: directions.map(direction => ({ card_id: card.id, direction, box_number: 7, next_review_date: '2027-01-01' })), error: null,
  }) }
  const profile = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: {
    role: 'student', allowed_levels: ['A1.1'], native_language: 'Russisch', ui_language: language, student_trainer_access: [],
  }, error: null }) }
  const rulesResult = Promise.resolve({ data: [], error: null })
  const rules = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: rulesResult.then.bind(rulesResult) }
  const from = jest.fn((table: string) => table === 'profile_details' ? profile : table === 'student_trainer_access' ? rules : table === 'vocabulary_cards' ? cards : progress)
  jest.mocked(createClient).mockResolvedValue({ from, auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) } } as unknown as Awaited<ReturnType<typeof createClient>>)
  return { from, cards, progress }
}
beforeEach(() => jest.clearAllMocks())
it('returns both distinct directions, translated in the current interface language', async () => {
  setup()
  const result = await getVocabularyAssessment('Lektion 1', 'A1.1', 'en')
  expect(result).toEqual({ learnerId: userId, cards: [
    { id: card.id, word_de: 'Tür', article: 'die', translation: 'door', translationLanguage: 'en', direction: 'de_to_native' },
    { id: card.id, word_de: 'Tür', article: 'die', translation: 'door', translationLanguage: 'en', direction: 'native_to_de' },
  ] })
})
it.each(['de_to_native', 'native_to_de'] as const)('does not reassess the existing %s direction', async direction => {
  setup({ directions: [direction] })
  const result = await getVocabularyAssessment('Lektion 1', 'A1.1', 'uk')
  expect(result.cards).toHaveLength(1)
  expect(result.cards[0]).toMatchObject({ direction: direction === 'de_to_native' ? 'native_to_de' : 'de_to_native', translation: 'двері', translationLanguage: 'uk' })
})
it('returns no assessment cards once both directions exist', async () => {
  setup({ directions: ['de_to_native', 'native_to_de'] })
  expect((await getVocabularyAssessment('Lektion 1', 'A1.1', 'en')).cards).toEqual([])
})
it('does not switch to another language when the requested translation is missing', async () => {
  setup({ content: { ...card, translation_en: null } })
  expect((await getVocabularyAssessment('Lektion 1', 'A1.1', 'en')).cards).toEqual([])
})
it('blocks German interface and German profile before retrieving assessment content', async () => {
  const first = setup()
  expect((await getVocabularyAssessment('Lektion 1', 'A1.1', 'de')).cards).toEqual([])
  expect(first.cards.select).not.toHaveBeenCalled()
  const second = setup({ language: 'de' })
  expect((await getVocabularyAssessment('Lektion 1', 'A1.1', 'en')).cards).toEqual([])
  expect(second.cards.select).not.toHaveBeenCalled()
})
it('uses the selected interface locale in the lesson word list and preserves learned status', async () => {
  setup({ directions: ['de_to_native', 'native_to_de'] })
  expect((await getLessonCards('Lektion 1', 'A1.1', 'tr'))[0]).toMatchObject({ translation: 'kapı', phase: 6, isLearned: true })
  setup({ directions: ['de_to_native'] })
  expect((await getLessonCards('Lektion 1', 'A1.1', 'en'))[0]).toMatchObject({ translation: 'door', isLearned: false })
})
