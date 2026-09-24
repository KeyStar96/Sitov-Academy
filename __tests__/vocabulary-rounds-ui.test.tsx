import React from 'react'
import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabCardSession from '@/components/vocabulary/VocabCardSession'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import { submitVocabularySelfRating } from '@/app/actions/vocabulary'
import { summarizeBox, type WordBoxState } from '@/lib/vocabulary-box'
import { STUDENT_MESSAGES } from '@/lib/student-ui-i18n'
import type { DueVocabularyCard, SubmitVocabularyAnswerResult } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ submitVocabularyAnswer: jest.fn(), submitVocabularySelfRating: jest.fn(), checkVocabularyRetry: jest.fn(), finishVocabularySession: jest.fn().mockResolvedValue({ success: true }), getPhaseCards: jest.fn() }))
jest.mock('@/components/layout/ThemeToggle', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: jest.fn().mockReturnValue(jest.fn()) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }))

const learnerId = '00000000-0000-4000-8000-000000000001'
const r = STUDENT_MESSAGES.de
const v = de.vocabulary
const card = (n: number): DueVocabularyCard => ({
  progressId: `progress-${n}`, box: 1, phase: 1, mode: 'flashcard', promptLanguage: 'ru', direction: 'native_to_de', format: 'word', prompt: `слово ${n}`,
  contextSentence: null, solution: null, translation: `слово ${n}`, isHardForNativeLanguage: false,
  card: { id: `word-${n}`, word_de: `Wort ${n}`, article: null, plural: null, level: 'A1.1', lesson: 'Lektion 1', image_url: null, audio_url: null },
})
const deck = (count: number) => Array.from({ length: count }, (_, index) => card(index + 1))
function result(overrides: Partial<SubmitVocabularyAnswerResult> = {}): SubmitVocabularyAnswerResult {
  return { success: true, isCorrect: true, correctAnswer: 'x', isAlternative: false, softError: null, previousPhase: 1, newPhase: 2, becameLearned: false, movedBack: false, intervalInDays: 1, ...overrides }
}
beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  jest.mocked(submitVocabularySelfRating).mockReset().mockResolvedValue(result())
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: randomUUID })
})
async function rate(known: boolean) {
  fireEvent.click(screen.getByRole('button', { name: v.reveal_solution }))
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: known ? v.knew_it : v.didnt_know })) })
}
const prompt = () => screen.getAllByRole('heading', { level: 2 })[0].textContent

it('repeats an unknown word inside its round and pauses after each round until the day is done', async () => {
  jest.mocked(submitVocabularySelfRating).mockResolvedValueOnce(result({ isCorrect: false, newPhase: 1 }))
  const back = jest.fn()
  render(<VocabCardSession learnerId={learnerId} cards={deck(12)} translations={v} overviewHref="/ru/dashboard" roundSize={10} onBackToLernkasten={back} />)
  expect(screen.getByText('Runde 1 von 2, Karte 1 von 10, Phase 1 von 6')).toBeInTheDocument()

  await rate(false)
  for (let i = 0; i < 9; i++) await rate(true)
  // Das unbekannte Wort kommt noch in derselben Runde wieder — nicht erst nach allen 12 Karten.
  expect(prompt()).toBe('слово 1')
  expect(screen.getByText(v.retry_label)).toBeInTheDocument()
  await rate(true)

  expect(await screen.findByRole('heading', { name: 'Runde 1 geschafft!' })).toBeInTheDocument()
  expect(screen.getByText('Für heute warten noch 2 Karten.')).toBeInTheDocument()
  expect(screen.getByText(r.round_pause_hint)).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: r.round_progress_aria })).toHaveAttribute('aria-valuetext', 'Heute geschafft: 10 von 12 Karten')
  expect(submitVocabularySelfRating).toHaveBeenCalledTimes(10)

  fireEvent.click(screen.getByRole('button', { name: 'Weiter mit den nächsten 2 Karten' }))
  expect(screen.getByText('Runde 2 von 2, Karte 1 von 2, Phase 1 von 6')).toBeInTheDocument()
  expect(prompt()).toBe('слово 11')
  await rate(true)
  await rate(true)

  expect(await screen.findByText('Alle 12 Karten für heute geschafft – in 2 Runden.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Weiter mit/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: v.lernkasten_back }))
  expect(back).toHaveBeenCalledWith('word-12')
}, 20000)

it('lets the learner pause between rounds without losing the remaining cards', async () => {
  const back = jest.fn()
  render(<VocabCardSession learnerId={learnerId} cards={deck(3)} translations={v} overviewHref="/ru/dashboard" roundSize={10} onBackToLernkasten={back} />)
  // Passt alles in eine Runde, gibt es keine Rundenanzeige und keine Pause.
  expect(screen.getByText('Karte 1 von 3, Phase 1 von 6')).toBeInTheDocument()
  await rate(true); await rate(true); await rate(true)
  expect(await screen.findByRole('button', { name: v.lernkasten_back })).toBeInTheDocument()
  expect(screen.queryByText(/Runde/)).not.toBeInTheDocument()
}, 20000)

it('offers a break with a way back to the learning box', async () => {
  const back = jest.fn()
  render(<VocabCardSession learnerId={learnerId} cards={deck(11)} translations={v} overviewHref="/ru/dashboard" roundSize={10} onBackToLernkasten={back} />)
  for (let i = 0; i < 10; i++) await rate(true)
  fireEvent.click(await screen.findByRole('button', { name: r.round_pause }))
  expect(back).toHaveBeenCalledWith('word-10')
  expect(screen.getByRole('button', { name: 'Weiter mit der letzten Karte' })).toBeInTheDocument()
}, 20000)

it('uses the round size saved on this device when none is passed', () => {
  localStorage.setItem('sitov_vocab_round_size', '10')
  render(<VocabCardSession learnerId={learnerId} cards={deck(25)} translations={v} overviewHref="/ru/dashboard" />)
  expect(screen.getByText('Runde 1 von 3, Karte 1 von 10, Phase 1 von 6')).toBeInTheDocument()
})

describe('Karten pro Runde in der Lernbox', () => {
  const resting = { phase: 2, isLearned: false, isHalfKnown: false, isDue: false, nextReviewDate: null,
    directions: { de_to_native: { phase: 2, isLearned: false, isDue: false, nextReviewDate: null }, native_to_de: { phase: 2, isLearned: false, isDue: false, nextReviewDate: null } } } as unknown as WordBoxState
  const mount = (count: number) => render(<VocabTrainerPageClient learnerId={learnerId} initialCards={deck(count)} boxSummary={summarizeBox([resting])} translations={v} lang="de" level="A1.1" />)

  it('explains the choice, remembers it and starts the first round with that many cards', async () => {
    mount(300)
    expect(screen.getByRole('heading', { name: r.round_picker_title })).toBeInTheDocument()
    expect(screen.getByText(r.round_picker_hint)).toBeInTheDocument()
    expect(await screen.findByRole('radio', { name: '20 Karten pro Runde' })).toBeChecked()
    expect(screen.getByText('300 Karten heute – 15 Runden mit je bis zu 20 Karten')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jetzt 20 Vokabeln üben' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: '50 Karten pro Runde' }))
    expect(localStorage.getItem('sitov_vocab_round_size')).toBe('50')
    expect(screen.getByText('300 Karten heute – 6 Runden mit je bis zu 50 Karten')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: r.round_option_all_aria }))
    expect(screen.getByText('Alle 300 Karten in einer Runde')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jetzt 300 Vokabeln üben' })).toBeInTheDocument()
  })

  it('stays out of the way when only a few cards are due', () => {
    mount(8)
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jetzt 8 Vokabeln üben' })).toBeInTheDocument()
  })
})
