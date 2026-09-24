import React from 'react'
import { randomUUID } from 'node:crypto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import { finishVocabularySession, submitVocabularyAnswer, submitVocabularySelfRating } from '@/app/actions/vocabulary'
import type { DueVocabularyCard, SubmitVocabularyAnswerResult } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({
  submitVocabularyAnswer: jest.fn(), submitVocabularySelfRating: jest.fn(),
  finishVocabularySession: jest.fn().mockResolvedValue({ success: true }),
}))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: ({ label }: { label: string }) => <button>{label}</button> }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: jest.fn().mockReturnValue(jest.fn()) }))

const learnerId = '00000000-0000-4000-8000-000000000001'

/** Eigene Sprache → Deutsch, Wortkarte: die einzige Karte mit freier Wahl. */
const choice: DueVocabularyCard = {
  progressId: 'progress-1', box: 4, phase: 4, mode: 'learner_choice', promptLanguage: 'ru',
  direction: 'native_to_de', format: 'word', prompt: 'дом', contextSentence: null, solution: null,
  translation: 'дом', isHardForNativeLanguage: false,
  card: { id: 'word-1', word_de: 'Haus', article: 'das', plural: 'Häuser', level: 'A1.1', lesson: 'Lektion 1', image_url: null, audio_url: null },
}
const reverse: DueVocabularyCard = { ...choice, progressId: 'reverse', mode: 'flashcard', direction: 'de_to_native', promptLanguage: 'de', prompt: 'Haus' }
// Sätze werden seit Phase 5.9 wie Vokabeln behandelt: learner_choice, und die
// deutsche Musterlösung reist für die Karteikarten-Rückseite in `solution` mit.
const sentence: DueVocabularyCard = { ...choice, progressId: 'sentence', mode: 'learner_choice', format: 'sentence', prompt: 'Я учу немецкий.', solution: 'Ich lerne Deutsch.' }

function result(overrides: Partial<SubmitVocabularyAnswerResult> = {}): SubmitVocabularyAnswerResult {
  return { success: true, isCorrect: true, correctAnswer: 'das Haus', isAlternative: false, softError: null,
    previousPhase: 4, newPhase: 5, becameLearned: false, movedBack: false, intervalInDays: 29, ...overrides }
}

function mount(cards: DueVocabularyCard[]) {
  return render(<VocabCardSession learnerId={learnerId} cards={cards} translations={de.vocabulary} uiLanguage="ru" overviewHref="/ru/dashboard" />)
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(submitVocabularyAnswer).mockReset().mockResolvedValue(result())
  jest.mocked(submitVocabularySelfRating).mockReset().mockResolvedValue(result())
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
})

it('startet in Phase 4 als Karteikarte, sobald der Lernende die Wahl hat', () => {
  // Früher entschied das Fach: ab Phase 3 wurde getippt. Jetzt entscheidet der
  // Umschalter, und der steht standardmäßig auf Karteikarte.
  mount([choice])
  expect(screen.getByRole('radio', { name: /Karteikarte/ })).toHaveAttribute('aria-checked', 'true')
  expect(screen.getByRole('button', { name: de.vocabulary.reveal_solution })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

it('wechselt auf Ausschreiben und merkt sich die Wahl fürs nächste Mal', async () => {
  const view = mount([choice])
  fireEvent.click(screen.getByRole('radio', { name: /Ausschreiben/ }))
  const field = await screen.findByRole('textbox')
  expect(field).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: de.vocabulary.reveal_solution })).not.toBeInTheDocument()
  expect(localStorage.getItem('sitov_vocab_study_mode')).toBe('typed')

  view.unmount()
  mount([choice])
  await waitFor(() => expect(screen.getByRole('radio', { name: /Ausschreiben/ })).toHaveAttribute('aria-checked', 'true'))
})

it('bewertet im Karteikarten-Modus per Selbsteinschätzung, im Tipp-Modus per Eingabe', async () => {
  mount([choice])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.knew_it }))
  await waitFor(() => expect(submitVocabularySelfRating).toHaveBeenCalledTimes(1))
  expect(submitVocabularyAnswer).not.toHaveBeenCalled()

  jest.clearAllMocks()
  mount([choice])
  fireEvent.click(screen.getByRole('radio', { name: /Ausschreiben/ }))
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'das Haus' } })
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence }))
  await waitFor(() => expect(submitVocabularyAnswer).toHaveBeenCalledTimes(1))
  expect(submitVocabularySelfRating).not.toHaveBeenCalled()
})

it('deckt beim Moduswechsel nichts auf', async () => {
  mount([choice])
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByRole('button', { name: de.vocabulary.knew_it })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', { name: /Ausschreiben/ }))
  await screen.findByRole('textbox')
  fireEvent.click(screen.getByRole('radio', { name: /Karteikarte/ }))
  // Zurück auf der Vorderseite: Die Lösung muss erneut aufgedeckt werden.
  expect(await screen.findByRole('button', { name: de.vocabulary.reveal_solution })).toBeInTheDocument()
})

it('bietet keinen Umschalter und keinen Erklärtext an, wo es nur einen Weg gibt', () => {
  // Deutsch → eigene Sprache wird nie ausgeschrieben. Der frühere Hinweis
  // („nur Deutsch wird ausgeschrieben") war für Lernende nur Ballast.
  mount([reverse])
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  expect(screen.queryByText(de.vocabulary.mode_locked_flashcard)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: de.vocabulary.reveal_solution })).toBeInTheDocument()
})

it('dreht die Karteikarte per Tipp irgendwo auf die Karte um — und wieder zurück', () => {
  const { container } = mount([reverse])
  const card = container.querySelector('.learning-card-flip')!
  expect(card).not.toHaveClass('is-revealed')
  fireEvent.click(screen.getByRole('heading', { name: 'das Haus' }))
  expect(card).toHaveClass('is-revealed')
  expect(screen.getByRole('button', { name: de.vocabulary.knew_it })).toBeInTheDocument()
  // Die Rückseite nennt die Lösung ohne weitere Überschrift „Wort erkennen".
  const back = container.querySelector('.learning-flip-back')!
  expect(back).not.toHaveTextContent(de.vocabulary.word_format)
  // Knöpfe auf der Karte (Vorlesen) drehen sie nicht.
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.listen_word }))
  expect(card).toHaveClass('is-revealed')
  fireEvent.click(back)
  expect(card).not.toHaveClass('is-revealed')
  expect(screen.getByRole('button', { name: de.vocabulary.reveal_solution })).toBeInTheDocument()
})

it('dreht die Karte auch mit der Tastatur um', () => {
  const { container } = mount([reverse])
  const front = container.querySelector<HTMLElement>('.learning-flip-front .learning-card-content')!
  fireEvent.keyDown(front, { key: 'Enter' })
  expect(container.querySelector('.learning-card-flip')).toHaveClass('is-revealed')
})

it('behandelt Sätze wie Vokabeln: Umschalter, und die Rückseite zeigt den deutschen Satz', () => {
  // Früher erzwangen Sätze das Ausschreiben. Jetzt bietet auch der Satz den
  // Umschalter (Standard: Karteikarte), und beim Aufdecken steht die deutsche
  // Musterlösung auf der Rückseite.
  mount([sentence])
  expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.reveal_solution }))
  expect(screen.getByText('Ich lerne Deutsch.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: de.vocabulary.knew_it })).toBeInTheDocument()
})

it('blendet den Umschalter aus, sobald die Antwort bewertet ist', async () => {
  mount([choice])
  fireEvent.click(screen.getByRole('radio', { name: /Ausschreiben/ }))
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'das Haus' } })
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.check_sentence }))
  await screen.findByText(de.vocabulary.answer_correct)
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
})
