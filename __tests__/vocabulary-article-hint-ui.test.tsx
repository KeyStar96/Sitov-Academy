import { saveStudyMode } from '@/lib/vocabulary-lernkasten'
jest.mock('@/app/actions/learning-checkpoints', () => ({
  loadLearningCheckpoint: jest.fn().mockResolvedValue({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: null }),
  saveLearningCheckpoint: jest.fn(async (_kind, _level, state, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
  clearLearningCheckpoint: jest.fn(async (_kind, _level, revision) => ({ ok: true, learnerId: '00000000-0000-4000-8000-000000000001', checkpoint: { state: {}, revision: revision + 1, updatedAt: '2026-10-03T09:00:00Z' } })),
}))
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { randomUUID } from 'node:crypto'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { submitVocabularyAnswer } from '@/app/actions/vocabulary'
import { learningFeedback } from '@/lib/learning-feedback-i18n'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/vocabulary', () => ({
  submitVocabularyAnswer: jest.fn(), submitVocabularySelfRating: jest.fn(),
  checkVocabularyRetry: jest.fn(), finishVocabularySession: jest.fn(),
}))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: jest.fn().mockReturnValue(jest.fn()) }))

const noun: DueVocabularyCard = {
  progressId: 'progress-noun', box: 1, phase: 1, mode: 'typed', direction: 'native_to_de', format: 'word',
  promptLanguage: 'ru', prompt: 'дом', translation: 'дом', contextSentence: null, solution: null,
  isHardForNativeLanguage: false,
  card: { id: 'word-noun', word_de: 'Haus', article: 'das', plural: 'Häuser', level: 'A1.1',
    lesson: 'Lektion 1', image_url: null, audio_url: null },
}

function mount(card = noun, lang = 'de') {
  return render(<VocabCardSession learnerId="00000000-0000-4000-8000-000000000001" cards={[card]}
    translations={de.vocabulary} uiLanguage={lang} overviewHref={`/${lang}/dashboard`} />)
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
})
afterEach(() => localStorage.clear())

it.each(['de', 'en', 'ru', 'uk', 'tr'])('associates the localized noun reminder with the answer in %s without revealing the solution', lang => {
  mount(noun, lang)
  const answer = screen.getByRole('textbox')
  expect(answer).toHaveAttribute('aria-describedby', screen.getByRole('note').id)
  expect(answer).toHaveAccessibleDescription(new RegExp(learningFeedback(lang).article))
  expect(answer).toHaveAccessibleDescription(/der\s*,\s*die.*das/)
  expect(screen.getByRole('note')).toHaveTextContent(learningFeedback(lang).article)
  expect(screen.getByRole('note')).toHaveTextContent('der, die')
  expect(screen.getByRole('note')).toHaveTextContent('das')
  expect(screen.queryByText('das Haus')).not.toBeInTheDocument()
})

it.each([
  ['verb', { ...noun, card: { ...noun.card, word_de: 'lernen', article: null } }],
  ['article-free word', { ...noun, card: { ...noun.card, article: 'none' } }],
  ['translation into the native language', { ...noun, direction: 'de_to_native' as const }],
  ['sentence', { ...noun, format: 'sentence' as const }],
  ['flashcard', { ...noun, mode: 'flashcard' as const }],
] as const)('omits the noun reminder for a %s', (_label, card) => {
  mount(card)
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  const answer = screen.queryByRole('textbox')
  if (answer) expect(answer).not.toHaveAttribute('aria-describedby')
})

it('shows and associates the reminder when the learner switches to writing', () => {
  mount({ ...noun, mode: 'learner_choice' })
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  act(() => saveStudyMode('typed'))
  expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', screen.getByRole('note').id)
  expect(screen.getByRole('textbox')).toHaveAccessibleDescription(/Schreib den Artikel mit/)
})

it('removes the pre-answer reminder once the server has checked the answer', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce({
    success: true, isCorrect: true, correctAnswer: 'das Haus', isAlternative: false, softError: null,
  })
  mount()
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'das Haus' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence })))
  expect(screen.getByText(de.vocabulary.answer_correct)).toBeVisible()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText(learningFeedback('de').article)).not.toBeInTheDocument()
})
