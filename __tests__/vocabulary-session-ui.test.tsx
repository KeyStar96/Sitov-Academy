import React from 'react'
import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { finishVocabularySession, submitVocabularyAnswer } from '@/app/actions/vocabulary'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ submitVocabularyAnswer: jest.fn(), finishVocabularySession: jest.fn().mockResolvedValue({ success: true }) }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: ({ label }: { label: string }) => <button>{label}</button> }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: jest.fn().mockReturnValue(jest.fn()) }))
const learnerId = '00000000-0000-4000-8000-000000000001'
const word: DueVocabularyCard = {
  progressId: 'progress-1', box: 1, phase: 1, promptLanguage: 'ru', direction: 'native_to_de', format: 'word', prompt: 'дом',
  contextSentence: 'Wir wohnen in einem Haus mit Garten.', translation: 'дом', isHardForNativeLanguage: false,
  card: { id: 'word-1', word_de: 'Haus', article: 'das', plural: 'Häuser', level: 'A1.1', lesson: 'Lektion 1', image_url: null, audio_url: null },
}
const second: DueVocabularyCard = { ...word, progressId: 'progress-2', prompt: 'учиться', card: { ...word.card, id: 'word-2', word_de: 'lernen', article: null } }
const sentence: DueVocabularyCard = { ...word, format: 'sentence', prompt: 'Я учу немецкий.', contextSentence: null }
beforeEach(() => { jest.clearAllMocks(); Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID }) })
function mount(cards: DueVocabularyCard[]) { return render(<VocabCardSession learnerId={learnerId} cards={cards} translations={de.vocabulary} overviewHref="/de/dashboard" />) }
it('prepares the current and next headwords before revealing either solution', () => {
  mount([word, second, { ...word, progressId: 'third', card: { ...word.card, id: 'word-3', word_de: 'Katze', article: 'die' } }])
  expect(prefetchNeuralAudio).toHaveBeenCalledWith([
    { text: 'das Haus', language: 'de', cardId: word.card.id, audioUrl: null },
    { text: 'lernen', language: 'de', cardId: second.card.id, audioUrl: null },
  ])
  expect(screen.queryByRole('button', { name: de.vocabulary.listen_word })).not.toBeInTheDocument()
})
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
  expect(submitVocabularyAnswer).toHaveBeenCalledWith(expect.objectContaining({ progressId: 'progress-1', typedAnswer: 'ich lerne Deutsch.', uiLanguage: 'de', requestId: expect.any(String) }))
  await waitFor(() => expect(screen.getByText(de.vocabulary.sentence_incorrect)).toBeVisible())
  expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Ich lerne Deutsch.')).toBeVisible()
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
  render(<VocabCardSession learnerId={learnerId} cards={[word, second, { ...word, progressId: 'reverse' }]} previousCardId={word.card.id} translations={de.vocabulary} overviewHref="/de/dashboard" />)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'учиться' })).toBeVisible())
  expect(screen.queryByRole('heading', { name: 'дом' })).not.toBeInTheDocument()
})

function deferred<Result>() {
  let resolve!: (result: Result) => void
  const promise = new Promise<Result>(done => { resolve = done })
  return { promise, resolve }
}
function answerKnown() {
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  fireEvent.click(screen.getByRole('button', { name: /Wusste ich Eine Phase weiter/ }))
}
it('keeps next-word controls responsive while ordered background writes are slow', async () => {
  const first = deferred<{ success: boolean }>()
  const last = deferred<{ success: boolean }>()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise)
  const back = jest.fn()
  render(<VocabCardSession learnerId={learnerId} cards={[word, second]} translations={de.vocabulary} overviewHref="/de/dashboard" onBackToLernkasten={back} />)
  answerKnown()
  expect(screen.getByRole('heading', { name: second.prompt })).toBeVisible()
  expect(screen.getByRole('button', { name: de.vocabulary.reveal_solution })).toBeEnabled()
  answerKnown()
  expect(screen.getByText(de.vocabulary.session_done_title)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.saving_progress)).not.toBeInTheDocument()
  expect(screen.queryByText(de.vocabulary.assessment_auto_save)).not.toBeInTheDocument()
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
  expect(finishVocabularySession).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.lernkasten_back }))
  expect(back).not.toHaveBeenCalled()
  await act(async () => first.resolve({ success: true }))
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(2)
  expect(back).not.toHaveBeenCalled()
  await act(async () => last.resolve({ success: true }))
  expect(back).toHaveBeenCalledWith(second.card.id)
  expect(finishVocabularySession).toHaveBeenCalledTimes(1)
})
it('retains later rapid decisions behind a failed write and retries with the same request id', async () => {
  const first = deferred<{ success: boolean }>()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: true })
  mount([word, second])
  answerKnown(); answerKnown()
  const original = jest.mocked(submitVocabularyAnswer).mock.calls[0][0]
  await act(async () => first.resolve({ success: false }))
  expect(screen.getByRole('heading', { name: word.prompt })).toBeVisible()
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.error_retry })))
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.progressId)).toEqual([word.progressId, word.progressId, second.progressId])
  expect(jest.mocked(submitVocabularyAnswer).mock.calls[1][0]).toEqual(original)
  expect(screen.getByText(de.vocabulary.session_done_title)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.save_failed)).not.toBeInTheDocument()
})
it('preserves queued sentence spelling when an earlier word fails and never guesses its result', async () => {
  const first = deferred<{ success: boolean }>()
  const typed = { ...sentence, progressId: 'typed', card: { ...second.card } }
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(first.promise).mockResolvedValueOnce({ success: true })
    .mockResolvedValueOnce({ success: true, isCorrect: false, correctAnswer: 'Ich lerne Deutsch.' })
  mount([word, typed])
  answerKnown()
  fireEvent.change(screen.getByLabelText(de.vocabulary.type_german), { target: { value: 'ich lerne Deutsch.' } })
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence }))
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Ich lerne Deutsch.')).not.toBeInTheDocument()
  await act(async () => first.resolve({ success: false }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.error_retry })))
  expect(jest.mocked(submitVocabularyAnswer).mock.calls[2][0]).toEqual(expect.objectContaining({ progressId: 'typed', typedAnswer: 'ich lerne Deutsch.' }))
  expect(screen.getByText(de.vocabulary.sentence_incorrect)).toBeVisible()
  expect(screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Ich lerne Deutsch.')).toBeVisible()
})
it('restores only an unacknowledged last card and never repeats committed decisions', async () => {
  const last = deferred<{ success: boolean }>()
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce({ success: true }).mockReturnValueOnce(last.promise).mockResolvedValueOnce({ success: true })
  mount([word, second])
  answerKnown()
  await act(async () => undefined)
  answerKnown()
  expect(finishVocabularySession).not.toHaveBeenCalled()
  await act(async () => last.resolve({ success: false }))
  expect(screen.getByRole('heading', { name: second.prompt })).toBeVisible()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.error_retry })))
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.progressId)).toEqual([word.progressId, second.progressId, second.progressId])
  expect(finishVocabularySession).toHaveBeenCalledTimes(1)
})
it('flushes already queued decisions after unmount without late navigation', async () => {
  const first = deferred<{ success: boolean }>()
  const last = deferred<{ success: boolean }>()
  const back = jest.fn()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise)
  const { unmount } = render(<VocabCardSession learnerId={learnerId} cards={[word, second]} translations={de.vocabulary} overviewHref="/de/dashboard" onBackToLernkasten={back} />)
  answerKnown(); answerKnown()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.lernkasten_back }))
  unmount()
  await act(async () => first.resolve({ success: true }))
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(2)
  await act(async () => last.resolve({ success: true }))
  expect(back).not.toHaveBeenCalled()
})
it('keeps sibling directions separated when retrying a failed separator word', async () => {
  const middle = deferred<{ success: boolean }>()
  const reverse: DueVocabularyCard = { ...word, progressId: 'reverse', direction: 'de_to_native', promptLanguage: 'de', prompt: 'Haus' }
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce({ success: true }).mockReturnValueOnce(middle.promise)
    .mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: true })
  mount([word, reverse, second])
  answerKnown(); await act(async () => undefined)
  answerKnown(); answerKnown()
  await act(async () => middle.resolve({ success: false }))
  expect(screen.getByRole('heading', { name: second.prompt })).toBeVisible()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.error_retry })))
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.progressId)).toEqual([word.progressId, second.progressId, second.progressId, reverse.progressId])
  expect(screen.getByText(de.vocabulary.session_done_title)).toBeVisible()
})
it('accepts at most one sentence submission before the first server reply', async () => {
  const reply = deferred<{ success: boolean; isCorrect: boolean; correctAnswer: string }>()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(reply.promise)
  mount([sentence])
  fireEvent.change(screen.getByLabelText(de.vocabulary.type_german), { target: { value: 'Ich lerne Deutsch.' } })
  const submit = screen.getByRole('button', { name: de.vocabulary.check_sentence })
  act(() => { fireEvent.click(submit); fireEvent.click(submit) })
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
  await act(async () => reply.resolve({ success: true, isCorrect: true, correctAnswer: 'Ich lerne Deutsch.' }))
  expect(screen.getByText(de.vocabulary.sentence_correct)).toBeVisible()
})
it('binds every queued review to the initial learner even if incoming props change', async () => {
  const first = deferred<{ success: boolean }>()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(first.promise).mockResolvedValueOnce({ success: true })
  const { rerender } = render(<VocabCardSession learnerId={learnerId} cards={[word, second]} translations={de.vocabulary} overviewHref="/de/dashboard" />)
  answerKnown()
  rerender(<VocabCardSession learnerId="00000000-0000-4000-8000-000000000002" cards={[word, second]} translations={de.vocabulary} overviewHref="/de/dashboard" />)
  answerKnown()
  await act(async () => first.resolve({ success: true }))
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.expectedLearnerId)).toEqual([learnerId, learnerId])
})

it('shows the original answer before the correction with only the wrong letter red', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValue({ success: true, isCorrect: false, correctAnswer: 'Ich lerne Deutsch.' })
  const { container } = mount([sentence])
  const answer = 'ich lerne Deutsch.'
  fireEvent.change(screen.getByLabelText(de.vocabulary.type_german), { target: { value: answer } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence })))
  const original = screen.getByText(answer)
  const corrected = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Ich lerne Deutsch.')
  expect(original.compareDocumentPosition(corrected) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(original).not.toHaveClass('learning-error')
  expect(corrected.querySelector('span')?.textContent).toBe('I')
  expect(corrected.querySelector('span')).toHaveClass('text-[var(--danger)]')
  expect(corrected.querySelectorAll('[class*=danger]')).toHaveLength(1)
  expect(container.querySelector('del, s, .line-through')).toBeNull()
})

it('tests both word directions with the corresponding prompt and revealed solution', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValue({ success: true })
  const reverse: DueVocabularyCard = { ...word, progressId: 'reverse', direction: 'de_to_native', promptLanguage: 'de', prompt: 'Haus' }
  mount([word, second, reverse])
  expect(screen.getByRole('heading', { name: 'дом' })).toHaveAttribute('lang', 'ru')
  expect(screen.queryByText('das Haus')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByText('das Haus')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Wusste ich Eine Phase weiter/ }))
  answerKnown()
  expect(screen.getByRole('heading', { name: 'das Haus' })).toHaveAttribute('lang', 'de')
  expect(screen.queryByText('дом')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByText('дом')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Wusste ich Eine Phase weiter/ }))
  await act(async () => undefined)
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.progressId)).toEqual([word.progressId, second.progressId, reverse.progressId])
})

it('accepts a correct alternative without presenting it as a spelling error', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValue({ success: true, isCorrect: true, isAlternative: true, correctAnswer: 'Ich lerne Deutsch.' })
  const { container } = mount([sentence])
  fireEvent.change(screen.getByLabelText(de.vocabulary.type_german), { target: { value: 'Deutsch lerne ich.' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence })))
  expect(screen.getByText(de.vocabulary.sentence_correct)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.sentence_incorrect)).not.toBeInTheDocument()
  expect(screen.getAllByText('Ich lerne Deutsch.')).toHaveLength(1)
  expect(container.querySelector('.line-through')).toBeNull()
})
