import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { finishVocabularySession, submitVocabularyAnswer } from '@/app/actions/vocabulary'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ submitVocabularyAnswer: jest.fn(), finishVocabularySession: jest.fn().mockResolvedValue({ success: true }) }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: ({ label }: { label: string }) => <button>{label}</button> }))
const word: DueVocabularyCard = {
  progressId: 'progress-1', box: 1, phase: 1, direction: 'native_to_de', format: 'word', prompt: 'дом',
  contextSentence: 'Wir wohnen in einem Haus mit Garten.', translation: 'дом', isHardForNativeLanguage: false,
  card: { id: 'word-1', word_de: 'Haus', article: 'das', plural: 'Häuser', level: 'A1.1', lesson: 'Lektion 1', image_url: null, audio_url: null },
}
const second: DueVocabularyCard = { ...word, progressId: 'progress-2', prompt: 'учиться', card: { ...word.card, id: 'word-2', word_de: 'lernen', article: null } }
const sentence: DueVocabularyCard = { ...word, format: 'sentence', prompt: 'Я учу немецкий.', contextSentence: null }
beforeEach(() => { jest.clearAllMocks() })
function mount(cards: DueVocabularyCard[]) { return render(<VocabCardSession cards={cards} translations={de.vocabulary} overviewHref="/de/dashboard" />) }
it('rolls a failed optimistic answer back to the same revealed card', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValue({ success: false })
  mount([word, second])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Wusste ich Eine Phase weiter/ })))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'дом' })).toBeVisible())
  expect(screen.getByText('das Haus')).toBeVisible()
  expect(screen.getByText(de.vocabulary.save_failed)).toBeVisible()
})
it('sends typed spelling unchanged and waits for the server result', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValue({ success: true, isCorrect: false, correctAnswer: 'Ich lerne Deutsch.' })
  mount([sentence])
  expect(screen.queryByText('Ich lerne Deutsch.')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(de.vocabulary.type_german), { target: { value: 'ich lerne Deutsch.' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence })))
  expect(submitVocabularyAnswer).toHaveBeenCalledWith({ progressId: 'progress-1', typedAnswer: 'ich lerne Deutsch.', uiLanguage: 'de' })
  await waitFor(() => expect(screen.getByText(de.vocabulary.sentence_incorrect)).toBeVisible())
  expect(screen.getByText('Ich lerne Deutsch.')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Wusste ich/ })).not.toBeInTheDocument()
})
it('does not present the opposite direction as the next card when no separator exists', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValue({ success: true })
  mount([word, { ...word, progressId: 'reverse', direction: 'de_to_native', prompt: 'das Haus' }])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Wusste ich Eine Phase weiter/ })))
  expect(screen.getByText(de.vocabulary.repetition_gap_hint)).toBeVisible()
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
})
it('keeps a committed answer complete when cache finalization fails', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValue({ success: true })
  jest.mocked(finishVocabularySession).mockRejectedValueOnce(new Error('offline'))
  mount([word])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Wusste ich Eine Phase weiter/ })))
  expect(screen.getByText(de.vocabulary.session_done_title)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.save_failed)).not.toBeInTheDocument()
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
})
it('respects the persisted previous word when rebuilding a filtered session', async () => {
  render(<VocabCardSession cards={[word, second, { ...word, progressId: 'reverse' }]} previousCardId={word.card.id} translations={de.vocabulary} overviewHref="/de/dashboard" />)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'учиться' })).toBeVisible())
  expect(screen.queryByRole('heading', { name: 'дом' })).not.toBeInTheDocument()
})
