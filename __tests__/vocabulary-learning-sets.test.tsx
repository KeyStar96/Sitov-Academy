import { fireEvent, render, screen, within } from '@testing-library/react'
import VocabTrainerPageClient from '@/components/vocabulary/VocabTrainerPageClient'
import { initializeLesson } from '@/app/actions/vocabulary'
import { summarizeBox } from '@/lib/vocabulary-box'
import type { DueVocabularyCard, LessonStat } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

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

it('markiert ein ausgewähltes Set an der Karte, nicht nur an einem Icon', () => {
  mount()
  // Fällige Lektionen liegen beim Erstbesuch schon im Lernkasten.
  const selected = setCard('Lektion 1')
  expect(selected).toHaveAttribute('data-selected', 'true')
  const chip = within(selected).getByRole('button', { pressed: true })
  expect(chip).toHaveAttribute('data-selected', 'true')
  // Der Zustand steht als Text an der Pille — nicht nur als Farbe und Haken.
  expect(chip).toHaveTextContent(de.vocabulary.lernkasten_in_box)

  const open = setCard('Lektion 2')
  expect(open).toHaveAttribute('data-selected', 'false')
  expect(within(open).getByRole('button', { pressed: false })).toHaveTextContent(de.vocabulary.set_add_short)
})

it('schaltet die Auswahl mitsamt Kartenzustand und Startzähler um', () => {
  mount()
  const chip = within(setCard('Lektion 1')).getByRole('button', { pressed: true })
  expect(screen.getByLabelText(de.vocabulary.lernkasten_title)).toHaveTextContent('2')

  fireEvent.click(chip)
  expect(setCard('Lektion 1')).toHaveAttribute('data-selected', 'false')
  expect(within(setCard('Lektion 1')).getByRole('button', { pressed: false })).toHaveTextContent(de.vocabulary.set_add_short)
  // Ohne Auswahl ist nichts mehr fällig, und der Start ist gesperrt.
  expect(screen.getByRole('button', { name: de.vocabulary.lernkasten_start })).toBeDisabled()
})

it('zeigt fällige Aufgaben und gelernten Anteil je Set', () => {
  mount()
  const selected = within(setCard('Lektion 1'))
  expect(selected.getByText('2')).toBeInTheDocument()
  expect(selected.getByText(new RegExp(de.vocabulary.set_words_total.replace('{count}', '84')))).toBeInTheDocument()
  // 21 von 84 gelernt = 25 %.
  expect(selected.getByText(de.vocabulary.set_learned_share.replace('{percent}', '25'))).toBeInTheDocument()

  const open = within(setCard('Lektion 2'))
  expect(open.getByText(new RegExp(de.vocabulary.lernkasten_no_due_badge))).toBeInTheDocument()
})

it('führt eine unberührte Lektion zuerst in die Einstufung statt sie still aufzunehmen', () => {
  mount()
  fireEvent.click(within(setCard('Lektion 2')).getByRole('button', { pressed: false }))
  expect(screen.getByRole('heading', { name: de.vocabulary.onboarding_choice_title })).toBeInTheDocument()
  expect(initializeLesson).not.toHaveBeenCalled()
})

it('startet die Session mit den ausgewählten Karten', () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: de.vocabulary.lernkasten_start }))
  expect(screen.getByText('session')).toBeInTheDocument()
})
