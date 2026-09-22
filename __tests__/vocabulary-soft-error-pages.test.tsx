import { render, screen, fireEvent } from '@testing-library/react'
import VocabularyPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/page'
import TrainPage from '@/app/[lang]/dashboard/level/[level]/vocabulary/train/page'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { getVocabularySession, getVocabularyOverview } from '@/app/actions/vocabulary'
import { getDictionary } from '@/lib/dictionary'
import ru from '@/dictionaries/ru.json'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import { summarizeBox } from '@/lib/vocabulary-box'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({ getVocabularySession: jest.fn(), getVocabularyOverview: jest.fn(), getPhaseCards: jest.fn(), initializeLesson: jest.fn() }))
jest.mock('@/lib/dictionary', () => ({ getDictionary: jest.fn() }))
jest.mock('@/components/vocabulary/VocabCardSession', () => ({ __esModule: true, default: jest.fn(() => null) }))
jest.mock('@/components/vocabulary/LessonCardsModal', () => ({ __esModule: true, default: () => null }))

const card: DueVocabularyCard = {
  progressId: 'progress-1', direction: 'native_to_de', format: 'word', prompt: 'дом', promptLanguage: 'ru',
  contextSentence: null, solution: null, box: 1, phase: 1, mode: 'typed', translation: 'дом', isHardForNativeLanguage: false,
  card: { id: 'card-1', lesson: 'Lektion 1', level: 'A1.1', word_de: 'Haus', article: 'das', plural: 'Häuser', image_url: null, audio_url: null },
}
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(getDictionary).mockResolvedValue(ru)
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId: 'learner', cards: [card], deferredCount: 0, previousCardId: null })
  jest.mocked(getVocabularyOverview).mockResolvedValue({ stats: [], box: summarizeBox([]) })
})
it('passes the selected dictionary through the overview and session start', async () => {
  const page = await VocabularyPage({ params: Promise.resolve({ lang: 'ru', level: 'A1.1' }) })
  expect(page.type).toBe(VocabTrainerPageClient)
  render(page)
  fireEvent.click(screen.getByRole('button', { name: ru.vocabulary.lernkasten_start_count_one }))
  expect(jest.mocked(VocabCardSession).mock.calls[0][0]).toMatchObject({ softErrorTranslations: ru.exercises.soft_error, uiLanguage: 'ru' })
})
it('passes the selected dictionary to the direct training route', async () => {
  render(await TrainPage({ params: Promise.resolve({ lang: 'ru', level: 'A1.1' }), searchParams: Promise.resolve({}) }))
  expect(jest.mocked(VocabCardSession).mock.calls[0][0]).toMatchObject({ softErrorTranslations: ru.exercises.soft_error, uiLanguage: 'ru' })
})
