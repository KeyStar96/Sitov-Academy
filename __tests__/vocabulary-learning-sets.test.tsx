jest.mock('@/app/actions/learning-checkpoints', () => ({
  loadLearningCheckpoint: jest.fn().mockResolvedValue({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: null }),
  saveLearningCheckpoint: jest.fn(async (_kind, _level, state, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
  clearLearningCheckpoint: jest.fn(async (_kind, _level, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state: {}, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
}))
import { fireEvent, render, screen, within } from '@testing-library/react'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { summarizeBox, type WordBoxState } from '@/lib/vocabulary-box'
import type { DueVocabularyCard, VocabularySession } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { beginVocabularyLevel, getVocabularySession } from '@/app/actions/vocabulary'
import { sitovTrainerHeroCopy } from '@/lib/sitov-trainer-hero-i18n'
import { sitovTrainerUiCopy } from '@/lib/sitov-trainer-ui-i18n'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ getPhaseCards: jest.fn(), beginVocabularyLevel: jest.fn(), getVocabularySession: jest.fn() }))
jest.mock('@/components/vocabulary/VocabCardSession', () => ({ __esModule: true, default: jest.fn(() => <p>session</p>) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

const learnerId = '00000000-0000-4000-8000-000000000001'
const s = studentTranslator('ru')
const heroCopy = sitovTrainerHeroCopy('ru')
const copy = sitovTrainerUiCopy('ru')

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(beginVocabularyLevel).mockResolvedValue({ success: true, carryover: { targetLevel: 'A1.1', enabled: false, decidedAt: '2026-09-26', startedAt: '2026-09-26', promptRequired: false, total: 0, byLevel: [] } })
})

function card(lesson: string, progressId: string): DueVocabularyCard {
  return {
    progressId, box: 1, phase: 1, mode: 'learner_choice', promptLanguage: 'ru',
    direction: 'native_to_de', format: 'word', prompt: 'дом', contextSentence: null, solution: null,
    translation: 'дом', isHardForNativeLanguage: false,
    card: { id: progressId, word_de: 'Haus', article: 'das', plural: null, level: 'A1.1', lesson, image_url: null, audio_url: null },
  }
}

/** Ein Wort in Phase 2, das heute nicht fällig ist — die Box ist also nicht leer. */
const resting: WordBoxState = {
  phase: 2, isLearned: false, isHalfKnown: false, isDue: false, nextReviewDate: null,
  directions: {
    de_to_native: { phase: 2, isLearned: false, isDue: false, nextReviewDate: null },
    native_to_de: { phase: 2, isLearned: false, isDue: false, nextReviewDate: null },
  },
} as unknown as WordBoxState

function mount(cards: DueVocabularyCard[], box = summarizeBox([resting])) {
  return render(<VocabTrainerPageClient learnerId={learnerId} initialCards={cards} boxSummary={box}
    translations={de.vocabulary} lang="ru" level="A1.1" />)
}

it('starts the safe session from one separate hero action before the learning box', async () => {
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId, cards: [card('Lektion 1', 'p-1')], deferredCount: 0, previousCardId: null })
  const { container } = mount([card('Lektion 1', 'p-1'), card('Lektion 1', 'p-2')])
  const hero = screen.getByRole('region', { name: heroCopy.vocabularyTitle })
  const box = container.querySelector<HTMLElement>('[data-sitov-learning-box]')!
  expect(hero.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(hero).getByRole('button', { name: copy.practice })).toBeInTheDocument()
  expect(within(box).queryByRole('button', { name: copy.practice })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Lektion 1' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: de.vocabulary.own_words_title })).not.toBeInTheDocument()
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  expect(screen.queryByText(de.vocabulary.method_title)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: copy.practice }))
  expect(await screen.findByText('session')).toBeInTheDocument()
})

it('führt ohne fällige Karten zu den Lektionen', () => {
  mount([])
  expect(screen.getByRole('status')).toHaveTextContent(de.vocabulary.all_done)
  expect(screen.queryByRole('button', { name: copy.practice })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: s('areas_to_lessons') })).toHaveAttribute('href', '/ru/dashboard/level/A1.1/vocabulary/lessons')
})

it('shows one short empty state in the hero and leads to lessons', () => {
  mount([], summarizeBox([]))
  expect(screen.getByRole('heading', { name: heroCopy.vocabularyTitle })).toBeInTheDocument()
  expect(screen.getByText(heroCopy.vocabularyEmpty)).toBeInTheDocument()
  expect(screen.queryByText(s('box_empty_text'))).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: copy.practice })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: s('areas_to_lessons') })).toHaveAttribute('href', '/ru/dashboard/level/A1.1/vocabulary/lessons')
  expect(screen.queryByText(de.vocabulary.lernkasten_all_done_hint)).not.toBeInTheDocument()
})

it('keeps the saved round size, account, level and refreshed checkpoint when starting from the hero', async () => {
  localStorage.setItem('sitov_vocab_round_size', '40')
  const initial = [card('Lektion 1', 'p-1')]
  const refreshed = [card('Lektion 2', 'p-2')]
  const checkpoint: VocabularySession['checkpoint'] = { revision: 7, cards: refreshed, state: {
    version: 1, language: 'ru', lesson: null, plan: [refreshed[0].progressId], deferredCount: 3, size: 40,
    round: { number: 1, start: 0, length: 1 }, queue: [[0, 1, false]], index: 0, retryCount: 0,
    moves: [], roundMovesFrom: 0, lastAnswered: 'previous-card', answer: '', feedback: null, pending: null,
  } }
  jest.mocked(getVocabularySession).mockResolvedValue({ learnerId, cards: refreshed, deferredCount: 3, previousCardId: 'previous-card', checkpoint, checkpointRevision: 7 })
  mount(initial)
  expect(beginVocabularyLevel).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: copy.practice }))
  await screen.findByText('session')
  expect(beginVocabularyLevel).toHaveBeenCalledWith('A1.1', learnerId)
  expect(getVocabularySession).toHaveBeenCalledWith('A1.1', 'ru', undefined)
  expect(jest.mocked(VocabCardSession).mock.calls.at(-1)?.[0]).toMatchObject({
    learnerId, level: 'A1.1', cards: refreshed, roundSize: 40, checkpoint, checkpointRevision: 7,
    initialDeferredCount: 3, previousCardId: 'previous-card',
  })
})

it('marks decorative German article content without translating it', () => {
  const { container } = mount([card('Lektion 1', 'p-1')])
  const articleLabels = screen.getByTestId('sitov-vocabulary-hero').querySelectorAll('b[lang="de"][translate="no"]')
  expect(Array.from(articleLabels, label => label.textContent)).toEqual(['der', 'die', 'das'])
  expect(container.querySelector('.lb-hero')).not.toBeInTheDocument()
})
