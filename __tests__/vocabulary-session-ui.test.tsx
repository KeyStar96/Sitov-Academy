import React from 'react'
import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { checkVocabularyRetry, finishVocabularySession, submitVocabularyAnswer, submitVocabularySelfRating } from '@/app/actions/vocabulary'
import type { DueVocabularyCard, SubmitVocabularyAnswerResult } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'
import ru from '@/dictionaries/ru.json'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ submitVocabularyAnswer: jest.fn(), submitVocabularySelfRating: jest.fn(), checkVocabularyRetry: jest.fn(), finishVocabularySession: jest.fn().mockResolvedValue({ success: true }) }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: ({ label }: { label: string }) => <button>{label}</button> }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: jest.fn().mockReturnValue(jest.fn()) }))
const learnerId = '00000000-0000-4000-8000-000000000001'
const word: DueVocabularyCard = {
  progressId: 'progress-1', box: 1, phase: 1, mode: 'typed', promptLanguage: 'ru', direction: 'native_to_de', format: 'word', prompt: 'дом',
  contextSentence: 'Wir wohnen in einem Haus mit Garten.', solution: null, translation: 'дом', isHardForNativeLanguage: false,
  card: { id: 'word-1', word_de: 'Haus', article: 'das', plural: 'Häuser', level: 'A1.1', lesson: 'Lektion 1', image_url: null, audio_url: null },
}
const second: DueVocabularyCard = { ...word, progressId: 'progress-2', prompt: 'учиться', card: { ...word.card, id: 'word-2', word_de: 'lernen', article: null } }
const sentence: DueVocabularyCard = { ...word, format: 'sentence', prompt: 'Я учу немецкий.', contextSentence: null }
const reverse: DueVocabularyCard = { ...word, progressId: 'reverse', direction: 'de_to_native', promptLanguage: 'de', prompt: 'Haus' }
function result(overrides: Partial<SubmitVocabularyAnswerResult> = {}): SubmitVocabularyAnswerResult {
  return { success: true, isCorrect: true, correctAnswer: 'das Haus', isAlternative: false, softError: null,
    previousPhase: 1, newPhase: 2, becameLearned: false, movedBack: false, intervalInDays: 1, ...overrides }
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(submitVocabularyAnswer).mockReset().mockResolvedValue(result())
  jest.mocked(submitVocabularySelfRating).mockReset().mockResolvedValue(result())
  jest.mocked(checkVocabularyRetry).mockReset().mockResolvedValue({ success: true, isCorrect: true, correctAnswer: 'das Haus', isAlternative: false, softError: null })
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
})
function mount(cards: DueVocabularyCard[]) { return render(<VocabCardSession learnerId={learnerId} cards={cards} translations={de.vocabulary} uiLanguage="ru" overviewHref="/ru/dashboard" />) }
function deferred() {
  let resolve!: (value: SubmitVocabularyAnswerResult) => void
  const promise = new Promise<SubmitVocabularyAnswerResult>(done => { resolve = done })
  return { promise, resolve }
}
function typeAnswer(value = 'das Haus') {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence }))
}
async function submit(value = 'das Haus') { await act(async () => typeAnswer(value)) }
function next() { fireEvent.click(screen.getByRole('button', { name: de.vocabulary.next_card })) }

it('prepares headword audio but hides the solution and self-rating controls until server grading', () => {
  mount([word, second])
  expect(prefetchNeuralAudio).toHaveBeenCalledWith([
    { text: 'das Haus', language: 'de', cardId: word.card.id, audioUrl: null },
    { text: 'lernen', language: 'de', cardId: second.card.id, audioUrl: null },
  ])
  expect(screen.queryByText('das Haus')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: de.vocabulary.reveal_solution })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Wusste ich/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: de.vocabulary.listen_word })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox')).toHaveAttribute('lang', 'de')
})
it.each([word, sentence])('waits for server authority for $format cards and sends typed bytes unchanged', async card => {
  const reply = deferred()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(reply.promise)
  mount([card, second])
  typeAnswer(' das Haus \n')
  expect(submitVocabularyAnswer).toHaveBeenCalledWith({ progressId: card.progressId, typedAnswer: ' das Haus \n', expectedLearnerId: learnerId, uiLanguage: 'ru', requestId: expect.any(String) })
  expect(screen.getByRole('heading', { name: card.prompt })).toBeVisible()
  expect(screen.getByRole('textbox')).toBeDisabled()
  expect(screen.queryByRole('button', { name: de.vocabulary.next_card })).not.toBeInTheDocument()
  expect(screen.queryByText('das Haus', { selector: 'p' })).not.toBeInTheDocument()
  await act(async () => reply.resolve(result({ isCorrect: false })))
  expect(screen.getByText(card.format === 'sentence' ? de.vocabulary.sentence_incorrect : de.vocabulary.answer_incorrect)).toBeVisible()
  expect(screen.getByRole('button', { name: de.vocabulary.next_card })).toBeEnabled()
})
it('keeps an exact-looking answer incorrect when the server rejects it', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ isCorrect: false }))
  mount([word])
  await submit()
  expect(screen.getByText(de.vocabulary.answer_incorrect)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.answer_correct)).not.toBeInTheDocument()
})
it('shows a Russian umlaut soft-error badge without red error styling', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ softError: 'umlaut' }))
  const { container } = render(<VocabCardSession learnerId={learnerId} cards={[word]} translations={ru.vocabulary}
    softErrorTranslations={ru.exercises.soft_error} uiLanguage="ru" overviewHref="/ru/dashboard" />)
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'das Haeus' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: ru.vocabulary.check_sentence })))
  expect(screen.getByText(ru.exercises.soft_error.umlaut)).toBeVisible()
  expect(container.querySelector('.learning-solution')).toHaveTextContent('das Haus')
  expect(container.querySelector('[class*=warning]')).not.toBeNull()
  expect(container.querySelector('.learning-error, [class*=danger]')).toBeNull()
})
it.each(['umlaut', 'typo'] as const)('preserves the server soft-error reason %s', async reason => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ softError: reason }))
  render(<VocabCardSession learnerId={learnerId} cards={[word]} translations={de.vocabulary}
    softErrorTranslations={{ [reason]: `Hinweis ${reason}` }} uiLanguage="ru" overviewHref="/ru/dashboard" />)
  await submit('das Haus')
  expect(screen.getByText(`Hinweis ${reason}`)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.answer_incorrect)).not.toBeInTheDocument()
})
it('rejects whitespace-only answers without calling the server', () => {
  mount([word])
  typeAnswer(' \n ')
  expect(screen.getByRole('button', { name: de.vocabulary.check_sentence })).toBeDisabled()
  expect(submitVocabularyAnswer).not.toHaveBeenCalled()
})
it.each([word, sentence])('accepts only one $format submission until the response arrives', async card => {
  const reply = deferred()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(reply.promise)
  mount([card])
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'das Haus' } })
  const button = screen.getByRole('button', { name: de.vocabulary.check_sentence })
  act(() => { fireEvent.click(button); fireEvent.click(button) })
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
  await act(async () => reply.resolve(result()))
})
it('retains the failed answer and retries the identical request without revealing a solution', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce({ success: false }).mockResolvedValueOnce(result())
  mount([word, second])
  await submit('das Haus ')
  const original = jest.mocked(submitVocabularyAnswer).mock.calls[0][0]
  expect(screen.getByText(de.vocabulary.save_failed)).toBeVisible()
  expect(screen.queryByText('das Haus')).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.error_retry })))
  expect(jest.mocked(submitVocabularyAnswer).mock.calls[1][0]).toEqual(original)
  expect(screen.getByText(de.vocabulary.answer_correct)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.save_failed)).not.toBeInTheDocument()
  next()
  expect(screen.getByRole('heading', { name: second.prompt })).toBeVisible()
})
it('treats an incomplete successful response as unacknowledged', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce({ success: true })
  mount([word])
  await submit()
  expect(screen.getByText(de.vocabulary.save_failed)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.session_done_title)).not.toBeInTheDocument()
})
it('never resubmits a committed earlier card when the next card fails', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result()).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(result({ correctAnswer: 'lernen' }))
  mount([word, second])
  await submit(); next(); await submit('lernen')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.error_retry })))
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.progressId)).toEqual([word.progressId, second.progressId, second.progressId])
  expect(finishVocabularySession).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.finish_session }))
  expect(finishVocabularySession).toHaveBeenCalledTimes(1)
})
it('waits for a pending answer before leaving and reports the acknowledged card', async () => {
  const reply = deferred()
  const back = jest.fn()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(reply.promise)
  render(<VocabCardSession learnerId={learnerId} cards={[word]} translations={de.vocabulary} overviewHref="/ru/dashboard" onBackToLernkasten={back} />)
  typeAnswer()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.exit_learning }))
  expect(back).not.toHaveBeenCalled()
  await act(async () => reply.resolve(result()))
  expect(back).toHaveBeenCalledWith(word.card.id)
})
it('finishes an in-flight answer after unmount without late navigation', async () => {
  const reply = deferred()
  const back = jest.fn()
  jest.mocked(submitVocabularyAnswer).mockReturnValueOnce(reply.promise)
  const { unmount } = render(<VocabCardSession learnerId={learnerId} cards={[word]} translations={de.vocabulary} overviewHref="/ru/dashboard" onBackToLernkasten={back} />)
  typeAnswer()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.exit_learning }))
  unmount()
  await act(async () => reply.resolve(result()))
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
  expect(back).not.toHaveBeenCalled()
})
it('defers the opposite direction when no separating word exists', async () => {
  mount([word, reverse])
  await submit()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.finish_session }))
  expect(screen.getByText(de.vocabulary.repetition_gap_hint)).toBeVisible()
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
})
it('respects the persisted previous word when rebuilding a filtered session', async () => {
  render(<VocabCardSession learnerId={learnerId} cards={[word, second, reverse]} previousCardId={word.card.id} translations={de.vocabulary} overviewHref="/ru/dashboard" />)
  await waitFor(() => expect(screen.getByRole('heading', { name: second.prompt })).toBeVisible())
  expect(screen.queryByRole('heading', { name: word.prompt })).not.toBeInTheDocument()
})
it('tests both typed word directions with their target languages and only server-returned solutions', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result()).mockResolvedValueOnce(result({ correctAnswer: 'lernen' })).mockResolvedValueOnce(result({ correctAnswer: 'дом' }))
  mount([word, reverse, second])
  expect(screen.getByRole('heading', { name: word.prompt })).toHaveAttribute('lang', 'ru')
  expect(screen.getByRole('textbox')).toHaveAttribute('lang', 'de')
  await submit(); next(); await submit('lernen'); next()
  expect(screen.getByRole('heading', { name: 'das Haus' })).toHaveAttribute('lang', 'de')
  expect(screen.getByRole('textbox')).toHaveAttribute('lang', 'ru')
  expect(screen.queryByText('дом')).not.toBeInTheDocument()
  await submit('дом')
  expect(screen.getByText('дом')).toHaveAttribute('lang', 'ru')
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.progressId)).toEqual([word.progressId, second.progressId, reverse.progressId])
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.every(([input]) => !('isCorrect' in input))).toBe(true)
})
it('binds reviews to the initial learner even when incoming props change', async () => {
  const { rerender } = mount([word, second])
  await submit()
  rerender(<VocabCardSession learnerId="00000000-0000-4000-8000-000000000002" cards={[word, second]} translations={de.vocabulary} overviewHref="/ru/dashboard" />)
  next(); await submit('lernen')
  expect(jest.mocked(submitVocabularyAnswer).mock.calls.map(([input]) => input.expectedLearnerId)).toEqual([learnerId, learnerId])
})
it('keeps an acknowledged session complete when cache finalization fails', async () => {
  jest.mocked(finishVocabularySession).mockRejectedValueOnce(new Error('offline'))
  mount([word])
  await submit()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: de.vocabulary.finish_session })))
  expect(screen.getByText(de.vocabulary.session_done_title)).toBeVisible()
  expect(screen.queryByText(de.vocabulary.save_failed)).not.toBeInTheDocument()
  expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
})
it('shows an incorrect answer before the correction with only changed letters red', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ isCorrect: false, correctAnswer: 'Ich lerne Deutsch.' }))
  const { container } = mount([sentence])
  await submit('ich lerne Deutsch.')
  const original = screen.getByText('ich lerne Deutsch.')
  const corrected = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'Ich lerne Deutsch.')
  expect(original.compareDocumentPosition(corrected) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(corrected.querySelector('span')).toHaveClass('text-[var(--danger)]')
  expect(corrected.querySelectorAll('[class*=danger]')).toHaveLength(1)
  expect(container.querySelector('del, s, .line-through')).toBeNull()
})
it('accepts an alternative without presenting it as a spelling error', async () => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ isAlternative: true, correctAnswer: 'Ich lerne Deutsch.' }))
  const { container } = mount([sentence])
  await submit('Deutsch lerne ich.')
  expect(screen.getByText(de.vocabulary.sentence_correct)).toBeVisible()
  expect(screen.getByText(de.vocabulary.alternative_answer_hint)).toBeVisible()
  expect(screen.getAllByText('Ich lerne Deutsch.')).toHaveLength(1)
  expect(container.querySelector('[class*=danger]')).toBeNull()
})

const flashcard: DueVocabularyCard = { ...word, mode: 'flashcard', progressId: 'flash-1' }

it('reicht eine Karteikarte über Aufdecken und Selbsteinschätzung an den Server – keine getippte Bewertung', async () => {
  mount([flashcard])
  // Vor dem Aufdecken: weder Textfeld noch Lösung.
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByText('das Haus')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: de.vocabulary.knew_it })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByText('das Haus')).toBeInTheDocument()

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: de.vocabulary.knew_it })) })

  expect(submitVocabularySelfRating).toHaveBeenCalledWith(
    expect.objectContaining({ progressId: 'flash-1', known: true, expectedLearnerId: learnerId, requestId: expect.any(String) }),
  )
  expect(submitVocabularyAnswer).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.getByRole('button', { name: de.vocabulary.lernkasten_back })).toBeInTheDocument())
})

it('dreht die Karteikarte um und haelt immer nur die sichtbare Seite bedienbar', async () => {
  const { container } = mount([flashcard, { ...second, mode: 'flashcard', progressId: 'flash-2' }])
  const scene = container.querySelector('.learning-card-flip')!
  const front = container.querySelector('.learning-flip-front')!
  const back = container.querySelector('.learning-flip-back')!
  // Vorderseite zeigt die Frage, die Rueckseite ist fuer Tastatur und Screenreader zu.
  expect(scene).not.toHaveClass('is-revealed')
  expect(front).not.toHaveAttribute('inert')
  expect(back).toHaveAttribute('inert')
  expect(back).toHaveAttribute('aria-hidden', 'true')

  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))

  // Nach der Drehung tauschen die Seiten ihre Rollen.
  expect(scene).toHaveClass('is-revealed')
  expect(front).toHaveAttribute('inert')
  expect(front).toHaveAttribute('aria-hidden', 'true')
  expect(back).not.toHaveAttribute('inert')
  // Die Rueckseite traegt Frage, Loesung und Kontextsatz.
  expect(back).toHaveTextContent('дом')
  expect(back).toHaveTextContent('das Haus')
  expect(back).toHaveTextContent(flashcard.contextSentence!)

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: de.vocabulary.knew_it })) })
  // Die naechste Karte startet wieder auf der Vorderseite, ohne zurueckzudrehen.
  await waitFor(() => expect(container.querySelector('.learning-card-flip')).not.toHaveClass('is-revealed'))
  expect(screen.getByRole('button', { name: de.vocabulary.reveal_solution })).toBeInTheDocument()
})

it('haelt die getippte Karte ohne Drehung im bisherigen Aufbau', async () => {
  const { container } = mount([word])
  expect(container.querySelector('.learning-card-flip')).toBeNull()
  await submit()
  expect(container.querySelector('.learning-card-flip')).toBeNull()
})

it('meldet „Wusste ich nicht" als known:false und bewertet weiterhin serverseitig', async () => {
  mount([flashcard])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: de.vocabulary.didnt_know })) })
  expect(submitVocabularySelfRating).toHaveBeenCalledWith(expect.objectContaining({ known: false }))
})

it('ordnet die Selbsteinschätzung wie beim Einstufen an: links „wusste ich nicht", rechts „wusste ich"', () => {
  mount([flashcard])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  const known = screen.getByRole('button', { name: de.vocabulary.knew_it })
  const unknown = screen.getByRole('button', { name: de.vocabulary.didnt_know })
  expect(unknown.compareDocumentPosition(known) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('zeigt den Zähler als eigene Spalte mit Kurzform und liest die Langform vor', () => {
  mount([flashcard])
  expect(screen.getByText('1/1')).toBeInTheDocument()
  expect(screen.getByText(de.vocabulary.stat_card)).toBeInTheDocument()
  expect(screen.getByText('Karte 1 von 1, Phase 1 von 6')).toHaveClass('sr-only')
})

describe('Phase-6-Runde: falsche Vokabeln werden wiederholt, bis sie einmal sitzen', () => {
  const flashTwo: DueVocabularyCard = { ...second, mode: 'flashcard', progressId: 'flash-2' }
  async function rate(known: boolean) {
    fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: known ? de.vocabulary.knew_it : de.vocabulary.didnt_know })) })
  }

  it('hängt eine falsch eingeschätzte Karteikarte als Wiederholung an und speichert sie dabei nicht erneut', async () => {
    jest.mocked(submitVocabularySelfRating).mockResolvedValueOnce(result({ isCorrect: false, newPhase: 1, movedBack: false }))
    mount([flashcard, flashTwo])
    await rate(false)
    await rate(true)
    // Beide gewerteten Versuche sind gespeichert – jetzt kommt die erste Karte noch einmal.
    expect(submitVocabularySelfRating).toHaveBeenCalledTimes(2)
    expect(screen.getByText(de.vocabulary.retry_label)).toBeInTheDocument()
    expect(screen.getByText(de.vocabulary.retry_hint)).toBeInTheDocument()
    expect(screen.getByText('Karte 3 von 3, Phase 1 von 6')).toBeInTheDocument()
    // Wieder nicht gewusst: Sie kommt noch einmal. Nichts davon geht an den Server.
    await rate(false)
    expect(screen.getByText('Karte 4 von 4, Phase 1 von 6')).toBeInTheDocument()
    await rate(true)
    expect(submitVocabularySelfRating).toHaveBeenCalledTimes(2)
    expect(screen.getByText(de.vocabulary.session_done_retry)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: de.vocabulary.lernkasten_back })).toBeInTheDocument()
  })

  it('prüft eine getippte Wiederholung serverseitig, ohne den Lernstand erneut zu setzen', async () => {
    jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ isCorrect: false, previousPhase: 4, newPhase: 3, movedBack: true }))
    jest.mocked(checkVocabularyRetry)
      .mockResolvedValueOnce({ success: true, isCorrect: false, correctAnswer: 'das Haus', isAlternative: false, softError: null })
      .mockResolvedValueOnce({ success: true, isCorrect: true, correctAnswer: 'das Haus', isAlternative: false, softError: null })
    mount([{ ...word, box: 4, phase: 4 }])
    expect(screen.getByText('Karte 1 von 1, Phase 4 von 6')).toBeInTheDocument()
    await submit('das Hauss Garten')
    expect(screen.getByText(de.vocabulary.retry_scheduled)).toBeInTheDocument()
    next()
    // Die Wiederholung beginnt leer – nicht mit der falschen Antwort von eben.
    expect(screen.getByRole('textbox')).toHaveValue('')
    expect(screen.getByText(de.vocabulary.retry_label)).toBeInTheDocument()
    // Die Wiederholung zeigt die schon zurückgestufte Phase.
    expect(screen.getByText('Karte 2 von 2, Phase 3 von 6')).toBeInTheDocument()
    await submit('die Haus')
    expect(checkVocabularyRetry).toHaveBeenCalledWith({ progressId: word.progressId, typedAnswer: 'die Haus', expectedLearnerId: learnerId, uiLanguage: 'ru' })
    expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
    expect(screen.getByText(de.vocabulary.answer_incorrect)).toBeVisible()
    next()
    await submit('das Haus')
    expect(checkVocabularyRetry).toHaveBeenCalledTimes(2)
    expect(screen.getByText(de.vocabulary.answer_correct)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: de.vocabulary.finish_session }))
    expect(screen.getByText(de.vocabulary.session_done_retry)).toBeInTheDocument()
    expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1)
  })

  it('lässt eine richtig beantwortete Karte in der Runde nicht wiederkommen', async () => {
    mount([word, second])
    await submit('das Haus')
    next()
    await submit('lernen')
    fireEvent.click(screen.getByRole('button', { name: de.vocabulary.finish_session }))
    expect(screen.queryByText(de.vocabulary.retry_label)).not.toBeInTheDocument()
    expect(screen.queryByText(de.vocabulary.session_done_retry)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: de.vocabulary.lernkasten_back })).toBeInTheDocument()
  })

  it('meldet eine gescheiterte Prüfung und lässt die Wiederholung erneut absenden', async () => {
    jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ isCorrect: false }))
    jest.mocked(checkVocabularyRetry).mockResolvedValueOnce({ success: false, error: 'check_failed' })
    mount([word])
    await submit('falsch')
    next()
    await submit('das Haus')
    expect(screen.getByText(de.vocabulary.retry_check_failed)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('das Haus')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence })) })
    expect(checkVocabularyRetry).toHaveBeenCalledTimes(2)
    expect(screen.getByText(de.vocabulary.answer_correct)).toBeVisible()
  })
})

it.each(['capitalization', 'punctuation', 'capitalization_punctuation'] as const)('shows neutral spelling guidance for %s without a warning', async hint => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ hint }))
  const { container } = mount([word])
  await submit('das haus')
  expect(screen.getByText('Вот как это пишется:', { exact: false })).toBeVisible()
  expect(screen.getByText(de.vocabulary.answer_correct)).toBeVisible()
  expect(container.querySelector('[class*=warning], .learning-error')).toBeNull()
})
it('places the secondary self-rating before the filled positive action in the DOM', () => {
  const { container } = mount([{ ...word, mode: 'flashcard' }])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  const actions = container.querySelectorAll('.learning-flashcard-actions button')
  expect(actions[0]).toHaveTextContent(de.vocabulary.didnt_know)
  expect(actions[1]).toHaveTextContent(de.vocabulary.knew_it)
  expect(actions[1]).toHaveClass('learning-button-primary')
})
it('shows target forms in typing mode before the answer', () => {
  mount([{ ...sentence, card: { ...sentence.card, target_form: ['heißen'] } }])
  expect(screen.getByText('[heißen]')).toBeVisible()
  expect(screen.queryByText('Вот как это пишется:', { exact: false })).not.toBeInTheDocument()
})
it.each(['article_missing', 'article_wrong'] as const)('renders the server article feedback %s and colors the returned article', async feedback => {
  jest.mocked(submitVocabularyAnswer).mockResolvedValueOnce(result({ isCorrect: false, feedback }))
  const { container } = mount([word])
  await submit(feedback === 'article_missing' ? 'Haus' : 'der Haus')
  expect(screen.getByText(feedback === 'article_missing' ? 'Не забудь поставить артикль перед существительным.' : 'У этого существительного другой артикль.')).toBeVisible()
  expect(screen.getByText(de.vocabulary.answer_incorrect)).toBeVisible()
  expect(container.querySelector('.learning-sentence .text-green-700')).toHaveTextContent('das')
})
