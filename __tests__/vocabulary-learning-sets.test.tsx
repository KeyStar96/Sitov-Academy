import { act, fireEvent, render, screen, within } from '@testing-library/react'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import { initializeLesson } from '@/app/actions/vocabulary'
import { summarizeBox } from '@/lib/vocabulary-box'
import type { DueVocabularyCard, LessonStat } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'
import { studentTranslator } from '@/lib/student-ui-i18n'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
jest.mock('@/app/actions/vocabulary', () => ({ initializeLesson: jest.fn(), getPhaseCards: jest.fn() }))
jest.mock('@/components/vocabulary/LessonCardsModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/vocabulary/VocabCardSession', () => ({ __esModule: true, default: () => <p>session</p> }))

const learnerId = '00000000-0000-4000-8000-000000000001'

/** Angefangene Lektion mit fälligen Aufgaben — sie darf ausgewählt werden. */
const started: LessonStat = { lesson: 'Lektion 1', total: 84, active: 60, learned: 21, untouched: 3, due: 74 }
/** Noch nicht aufgenommene Lektion — sie führt zuerst in die Einstufung. */
const untouched: LessonStat = { lesson: 'Lektion 2', total: 85, active: 0, learned: 0, untouched: 85, due: 0 }

function card(lesson: string, progressId: string): DueVocabularyCard {
  return {
    progressId, box: 1, phase: 1, mode: 'learner_choice', promptLanguage: 'ru',
    direction: 'native_to_de', format: 'word', prompt: 'дом', contextSentence: null, solution: null,
    translation: 'дом', isHardForNativeLanguage: false,
    card: { id: progressId, word_de: 'Haus', article: 'das', plural: null, level: 'A1.1', lesson, image_url: null, audio_url: null },
  }
}

function mount(cards: DueVocabularyCard[] = [card('Lektion 1', 'p-1'), card('Lektion 1', 'p-2')]) {
  return render(<VocabTrainerPageClient learnerId={learnerId} initialCards={cards} lessonStats={[started, untouched]}
    boxSummary={summarizeBox([])} translations={de.vocabulary} lang="ru" level="A1.1" />)
}

function setCard(lesson: string): HTMLElement {
  return screen.getByRole('heading', { name: lesson }).closest('article')!
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  // jsdom kennt <dialog>.showModal() nicht. Der Stub setzt `open`, damit der
  // Inhalt wie im Browser im Accessibility-Baum landet.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.open = true }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.open = false }
})

it('übt alles Fällige aus den aufgenommenen Lektionen und listet keine Kurs-Lektionen mehr', () => {
  mount()
  // Lektionen starten und ansehen geht auf dem Lernweg; hier bleibt nur „Eigene Wörter".
  expect(screen.queryByRole('heading', { name: 'Lektion 1' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Lektion 2' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: de.vocabulary.own_words_title })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt 2 Vokabeln üben' }))
  expect(screen.getByText('session')).toBeInTheDocument()
})

it('führt ohne fällige Karten zum Lernweg', () => {
  mount([])
  expect(screen.getByRole('link', { name: studentTranslator('ru')('areas_to_path') })).toHaveAttribute('href', '/ru/dashboard/level/A1.1')
})

describe('Lektion „Eigene Wörter"', () => {
  const ownTitle = de.vocabulary.own_words_title

  it('steht auch ohne Wort in der Liste: Schalter gesperrt, Einladung zum ersten Eintrag', () => {
    mount()
    const own = setCard(ownTitle)
    const toggle = within(own).getByRole('switch')
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveTextContent(de.vocabulary.own_words_switch_disabled)
    expect(within(own).getByRole('button', { name: de.vocabulary.own_words_add_first })).toBeInTheDocument()
    expect(within(own).queryByRole('link', { name: de.vocabulary.assess_set })).not.toBeInTheDocument()
  })

  it('legt beim Einschalten alle Wörter ohne Einstufung in Phase 1', async () => {
    jest.mocked(initializeLesson).mockResolvedValue({ success: true, added: 3 })
    const ownStat: LessonStat = { lesson: 'Eigene Wörter', total: 3, active: 0, learned: 0, untouched: 3, due: 0 }
    render(<VocabTrainerPageClient learnerId={learnerId} initialCards={[]} lessonStats={[started, ownStat]}
      boxSummary={summarizeBox([])} translations={de.vocabulary} lang="ru" level="A1.1" />)
    const own = setCard(ownTitle)
    await act(async () => { fireEvent.click(within(own).getByRole('switch')) })
    expect(initializeLesson).toHaveBeenCalledWith('Eigene Wörter', 'A1.1', learnerId)
    expect(screen.queryByText(de.vocabulary.onboarding_choice_title)).not.toBeInTheDocument()
    expect(setCard(ownTitle)).toHaveAttribute('data-selected', 'true')
    expect(within(setCard(ownTitle)).getByRole('button', { name: de.vocabulary.own_words_manage })).toBeInTheDocument()
  })

  it('nimmt die Auswahl zurück, wenn das Einschalten scheitert', async () => {
    jest.mocked(initializeLesson).mockResolvedValue({ success: false, added: 0 })
    const ownStat: LessonStat = { lesson: 'Eigene Wörter', total: 2, active: 0, learned: 0, untouched: 2, due: 0 }
    render(<VocabTrainerPageClient learnerId={learnerId} initialCards={[]} lessonStats={[ownStat]}
      boxSummary={summarizeBox([])} translations={de.vocabulary} lang="ru" level="A1.1" />)
    await act(async () => { fireEvent.click(within(setCard(ownTitle)).getByRole('switch')) })
    expect(setCard(ownTitle)).toHaveAttribute('data-selected', 'false')
    expect(within(setCard(ownTitle)).getByRole('alert')).toHaveTextContent(de.vocabulary.own_words_activate_failed)
  })
})
