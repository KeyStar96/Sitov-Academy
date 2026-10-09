import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { randomUUID } from 'node:crypto'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import LessonCardsModal from '@/components/vocabulary/LessonCardsModal'
import { addCardsToTrainer, getLessonCards, submitVocabularyAnswer, submitVocabularySelfRating } from '@/app/actions/vocabulary'
import { saveLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'
import type { DueVocabularyCard, LessonCardView } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({
  submitVocabularyAnswer: jest.fn(), submitVocabularySelfRating: jest.fn(), checkVocabularyRetry: jest.fn(),
  finishVocabularySession: jest.fn().mockResolvedValue({ success: true }),
  addCardsToTrainer: jest.fn(), getLessonCards: jest.fn(), addOwnWord: jest.fn(), deleteOwnWord: jest.fn(), resetLessonProgress: jest.fn(),
}))
jest.mock('@/app/actions/learning-checkpoints', () => ({
  saveLearningCheckpoint: jest.fn(async (_kind, _level, state, revision) => ({ ok: true, checkpoint: { state, revision: revision + 1, updatedAt: '2026-10-09T05:00:00Z' } })),
  clearLearningCheckpoint: jest.fn().mockResolvedValue({ ok: true }),
}))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: ({ label }: { label: string }) => <button>{label}</button> }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: jest.fn().mockReturnValue(jest.fn()) }))

const learnerId = '00000000-0000-4000-8000-000000000001'
const word: DueVocabularyCard = {
  progressId: 'progress-1', box: 1, phase: 1, mode: 'flashcard', promptLanguage: 'ru', direction: 'native_to_de', format: 'word', prompt: 'дом',
  contextSentence: null, solution: null, translation: 'дом', isHardForNativeLanguage: false,
  card: { id: 'word-1', word_de: 'Haus', article: 'das', plural: 'Häuser', level: 'A1.1', lesson: 'Lektion 1', image_url: null, audio_url: null },
}
const lessonCard: LessonCardView = { id: 'word-1', word_de: 'Haus', article: 'das', plural: null, translation: 'house', image_url: null, audio_url: null, phase: null, isLearned: false }
const locales = ['de', 'en', 'ru', 'uk', 'tr'] as const
const labels = { de: 'Hilfe', en: 'Help', ru: 'Помощь', uk: 'Допомога', tr: 'Yardım' }

beforeAll(() => { window.PointerEvent = MouseEvent as typeof PointerEvent })
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
  jest.mocked(getLessonCards).mockResolvedValue([lessonCard])
  jest.mocked(addCardsToTrainer).mockResolvedValue({ success: true, added: 1 })
  jest.mocked(submitVocabularySelfRating).mockResolvedValue({ success: true, isCorrect: true, correctAnswer: 'das Haus', isAlternative: false, softError: null, previousPhase: 1, newPhase: 2, becameLearned: false, movedBack: false, intervalInDays: 1 })
})

it.each(locales)('opens round Help by keyboard in %s without revealing or writing', async lang => {
  const user = userEvent.setup()
  const help = sitovTrainerHelpCopy(lang)
  expect(help.label).toBe(labels[lang])
  render(<VocabCardSession learnerId={learnerId} level="A1.1" cards={[word]} translations={de.vocabulary} uiLanguage={lang} learningSourceLanguage="ru" overviewHref={`/${lang}/dashboard`} roundSize={10} />)
  const toggle = screen.getByRole('button', { name: help.label })
  expect(screen.getAllByRole('button', { name: help.label })).toHaveLength(1)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByText(help.vocabularyRoundBody)).not.toBeInTheDocument()
  const audioCount = jest.mocked(prefetchNeuralAudio).mock.calls.length
  const checkpointCount = jest.mocked(saveLearningCheckpoint).mock.calls.length
  toggle.focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('region', { name: help.label })).toHaveTextContent(help.vocabularyRoundBody)
  expect(toggle.closest('section')).toHaveAttribute('lang', lang)
  expect(screen.queryByText('das Haus')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: de.vocabulary.reveal_solution })).toBeVisible()
  await user.keyboard(' ')
  expect(screen.queryByRole('region', { name: help.label })).not.toBeInTheDocument()
  expect(toggle).toHaveFocus()
  expect(submitVocabularyAnswer).not.toHaveBeenCalled()
  expect(submitVocabularySelfRating).not.toHaveBeenCalled()
  expect(prefetchNeuralAudio).toHaveBeenCalledTimes(audioCount)
  expect(saveLearningCheckpoint).toHaveBeenCalledTimes(checkpointCount)
})

it('preserves the explicit reveal and exact self-rating after opening Help', async () => {
  render(<VocabCardSession learnerId={learnerId} level="A1.1" cards={[word]} translations={de.vocabulary} uiLanguage="ru" learningSourceLanguage="ru" overviewHref="/ru/dashboard" roundSize={10} />)
  fireEvent.click(screen.getByRole('button', { name: 'Помощь' }))
  expect(screen.queryByRole('button', { name: de.vocabulary.knew_it })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByText('das Haus')).toBeInTheDocument()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: de.vocabulary.knew_it })) })
  expect(submitVocabularySelfRating).toHaveBeenCalledTimes(1)
  expect(submitVocabularySelfRating).toHaveBeenCalledWith(expect.objectContaining({ progressId: word.progressId, expectedLearnerId: learnerId, known: true, targetLevel: 'A1.1', learningSourceLanguage: 'ru' }))
})

it.each(locales)('keeps modal Help and lesson actions independent in %s', async lang => {
  const user = userEvent.setup()
  const help = sitovTrainerHelpCopy(lang)
  const onClose = jest.fn(), onCardAdded = jest.fn()
  render(<LessonCardsModal lesson="Lektion 1" level="A1.1" translations={de.vocabulary} uiLanguage={lang} onClose={onClose} onCardAdded={onCardAdded} />)
  const word = await screen.findByText('das Haus')
  expect(word).toHaveAttribute('lang', 'de')
  expect(word).toHaveAttribute('translate', 'no')
  const toggle = screen.getByRole('button', { name: help.label })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  toggle.focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('region', { name: help.label })).toHaveTextContent(help.lessonCardsBody)
  expect(toggle.closest('section')).toHaveAttribute('lang', lang)
  await user.keyboard(' ')
  expect(screen.queryByRole('region', { name: help.label })).not.toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
  expect(onCardAdded).not.toHaveBeenCalled()
  expect(addCardsToTrainer).not.toHaveBeenCalled()
  expect(getLessonCards).toHaveBeenCalledTimes(1)
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Haus.*Karteikasten/ })) })
  expect(addCardsToTrainer).toHaveBeenCalledWith(['word-1'])
  expect(onCardAdded).toHaveBeenCalledTimes(1)
})

it('preserves modal tab navigation, focus wrapping, Escape and focus restoration with Help', async () => {
  const onClose = jest.fn()
  const opener = document.createElement('button')
  document.body.appendChild(opener)
  opener.focus()
  const view = render(<LessonCardsModal lesson="Lektion 1" level="A1.1" translations={de.vocabulary} onClose={onClose} onCardAdded={jest.fn()} />)
  await screen.findByText('das Haus')
  const words = screen.getAllByRole('tab')[0]
  words.focus()
  fireEvent.keyDown(words, { key: 'ArrowRight' })
  expect(screen.getAllByRole('tab')[1]).toHaveFocus()
  expect(screen.getAllByRole('button', { name: 'Hilfe' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Hilfe' }))
  expect(screen.getByRole('region', { name: 'Hilfe' })).toBeInTheDocument()
  const close = screen.getByRole('button', { name: de.vocabulary.close_cards })
  close.focus()
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
  expect(screen.getByRole('tabpanel')).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('tabpanel'), { key: 'Tab' })
  expect(close).toHaveFocus()
  fireEvent.keyDown(close, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(opener).toHaveFocus()
  opener.remove()
})
