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
  const toggle = within(selected).getByRole('switch', { name: 'Lektion „Lektion 1“ im Lernkasten' })
  expect(toggle).toBeChecked()
  // Der Zustand steht als Text am Schalter — nicht nur als Farbe und Knopfposition.
  expect(toggle).toHaveTextContent(de.vocabulary.lernkasten_in_box)
  expect(toggle).toHaveTextContent(de.vocabulary.lernkasten_tap_to_remove)

  const open = setCard('Lektion 2')
  expect(open).toHaveAttribute('data-selected', 'false')
  const off = within(open).getByRole('switch')
  expect(off).not.toBeChecked()
  expect(off).toHaveTextContent(de.vocabulary.lernkasten_not_in_box)
  expect(off).toHaveTextContent(de.vocabulary.lernkasten_tap_to_add)
})

it('schaltet die Auswahl mitsamt Kartenzustand und Startknopf um', () => {
  mount()
  const hero = screen.getByLabelText(de.vocabulary.lernkasten_title)
  expect(hero).toHaveTextContent('2')
  expect(screen.getByRole('button', { name: 'Jetzt 2 Vokabeln üben' })).toBeEnabled()

  fireEvent.click(within(setCard('Lektion 1')).getByRole('switch', { checked: true }))
  expect(setCard('Lektion 1')).toHaveAttribute('data-selected', 'false')
  expect(within(setCard('Lektion 1')).getByRole('switch')).not.toBeChecked()
  // Ohne Auswahl gibt es keinen ausgegrauten Knopf, sondern eine klare Auskunft
  // mit dem nächsten Schritt.
  expect(screen.queryByRole('button', { name: /^Jetzt .* üben$/ })).not.toBeInTheDocument()
  expect(hero).toHaveTextContent(de.vocabulary.all_done)
  expect(within(hero).getByRole('status')).toHaveTextContent(de.vocabulary.lernkasten_due_elsewhere.replace('{count}', '2'))

  fireEvent.click(within(hero).getByRole('button', { name: de.vocabulary.lernkasten_select_all }))
  expect(within(setCard('Lektion 1')).getByRole('switch')).toBeChecked()
  expect(screen.getByRole('button', { name: 'Jetzt 2 Vokabeln üben' })).toBeInTheDocument()
})

it('zeigt bei nichts Fälligem den Weg zu den Lektionen', () => {
  mount([])
  const hero = screen.getByLabelText(de.vocabulary.lernkasten_title)
  expect(within(hero).getByRole('heading', { name: de.vocabulary.all_done })).toBeInTheDocument()
  expect(within(hero).getByRole('status')).toHaveTextContent(de.vocabulary.lernkasten_all_done_hint)
  HTMLElement.prototype.scrollIntoView = jest.fn()
  fireEvent.click(within(hero).getByRole('button', { name: de.vocabulary.lernkasten_choose_lessons }))
  expect(screen.getByRole('heading', { name: de.vocabulary.lessons_title })).toHaveFocus()
})

it('zeigt fällige Aufgaben und gelernten Anteil je Set', () => {
  mount()
  const selected = within(setCard('Lektion 1'))
  expect(selected.getByText('2')).toBeInTheDocument()
  expect(selected.getByText(de.vocabulary.set_words_total.replace('{count}', '84'))).toBeInTheDocument()
  // 21 von 84 gelernt = 25 %.
  expect(selected.getByText(de.vocabulary.set_learned_share.replace('{percent}', '25'))).toBeInTheDocument()

  const open = within(setCard('Lektion 2'))
  expect(open.getByText(new RegExp(de.vocabulary.lernkasten_no_due_badge))).toBeInTheDocument()
})

it('führt eine unberührte Lektion zuerst in die Einstufung statt sie still aufzunehmen', () => {
  mount()
  fireEvent.click(within(setCard('Lektion 2')).getByRole('switch'))
  expect(screen.getByRole('heading', { name: de.vocabulary.onboarding_choice_title })).toBeInTheDocument()
  expect(initializeLesson).not.toHaveBeenCalled()
})

it('startet die Session mit den ausgewählten Karten', () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Jetzt 2 Vokabeln üben' }))
  expect(screen.getByText('session')).toBeInTheDocument()
})
