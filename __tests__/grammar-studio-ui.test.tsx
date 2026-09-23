import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ExerciseClient from '@/components/exercises/ExerciseClient'
import ExerciseCMS from '@/components/admin/ExerciseCMS'
import { recordExerciseAttempt, finishExerciseSession } from '@/app/actions/exercises'
import { saveGrammarExercise, removeGrammarExercise } from '@/app/actions/grammar-cms'
import type { RecordExerciseAttemptResult, StudentExercise } from '@/lib/types/exercise'
import type { GrammarExerciseRow } from '@/lib/grammar-validation'
import russian from '@/dictionaries/ru.json'

jest.unmock('lucide-react')
// Ganze Lernabläufe mit simuliertem Tippen dauern unter Last länger als 5 s.
jest.setTimeout(20000)
jest.mock('@/components/exercises/GrammarStudio.module.css', () => ({}))
jest.mock('@/app/actions/exercises', () => ({ recordExerciseAttempt: jest.fn(), finishExerciseSession: jest.fn() }))
jest.mock('@/app/actions/grammar-cms', () => ({ saveGrammarExercise: jest.fn(), removeGrammarExercise: jest.fn() }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: () => null }))
const item: StudentExercise = {
  id: 'a611d604-4b69-4040-a12c-451f8c5e1651', level: 'A1.1', lesson: '01', topic: 'Artikel',
  type: 'multiple_choice', content: { target_form: ['bestimmter Artikel'], question: '___ Tisch ist frei.', options: ['Der', 'Die', 'Das'], correct_answer: 'Der', explanation: 'Tisch ist maskulin.' },
  hint: null, completed: false, attempts: 0, score: 0,
}
const fill: StudentExercise = {
  ...item, id: 'a611d604-4b69-4040-a12c-451f8c5e1652', type: 'fill_in_blank',
  content: { target_form: ['Tisch'], text_before: 'Das ist ', text_after: '.', correct_answer: 'ein Tisch' },
  chips: ['ein Tisch', 'eine Tisch'], solutionArticle: 'der', solutionAudioUrl: null,
}
const authored: GrammarExerciseRow = {
  unit_id: '00000000-0000-4000-8000-000000000099',
  id: item.id, level: 'A1.1', lesson: '01', topic: 'Artikel', type: 'multiple_choice',
  content: { ...item.content, instruction: 'Wähle den Artikel.' }, created_at: '2026-09-10T00:00:00Z',
  hint: null, solution_audio_url: null,
}
beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  jest.mocked(recordExerciseAttempt).mockReset().mockImplementation(async input => ({
    success: true, attempts: 1, isCorrect: true, status: 'EXACT', reason: null, matched: input.answer, score: 100,
  }))
  jest.mocked(finishExerciseSession).mockResolvedValue({ success: true })
  HTMLElement.prototype.scrollIntoView = jest.fn()
  // Die meisten Fälle tippen; die Kärtchen haben einen eigenen Test.
  window.localStorage.setItem('sitov:grammar-input', 'typing')
})
it('runs the session in the focused learning screen and moves focus to every new exercise', async () => {
  const user = userEvent.setup()
  render(<ExerciseClient exercises={[fill, item]} lang="de" level="A1.1" />)
  expect(screen.queryByRole('region', { name: 'Grammatik' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' }))
  expect(screen.getByRole('region', { name: 'Grammatik' })).toBeInTheDocument()
  const firstHeading = screen.getByRole('heading', { name: 'Artikel', level: 2 })
  expect(firstHeading).toHaveFocus()

  await user.type(screen.getByRole('textbox', { name: 'Lücke' }), 'ein Tisch')
  await user.click(screen.getByRole('button', { name: 'Antwort prüfen' }))
  expect(screen.queryByRole('textbox', { name: 'Lücke' })).not.toBeInTheDocument()

  const next = screen.getByRole('button', { name: 'Nächste Übung' })
  expect(next).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('heading', { name: 'Artikel', level: 2 })).toHaveFocus()
  expect(screen.getByRole('button', { name: 'Antwort prüfen' })).toBeDisabled()
  expect(screen.queryByText('Richtig! Gut gemacht.')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Wort .Der. auswählen/ }))
  await user.click(screen.getByRole('button', { name: 'Antwort prüfen' }))
  await user.click(screen.getByRole('button', { name: 'Lerneinheit abschließen' }))
  expect(screen.getByRole('heading', { name: 'Ein guter Schritt nach vorn.' })).toHaveFocus()
}, 20000)
it('offers word cards by default: tapping fills the gap in order and the answer is checked by the server', async () => {
  const user = userEvent.setup()
  window.localStorage.removeItem('sitov:grammar-input')
  render(<ExerciseClient exercises={[fill]} lang="de" level="A1.1" />)
  await user.click(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' }))
  expect(screen.getByRole('button', { name: 'Kärtchen' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('textbox', { name: 'Lücke' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Antwort prüfen' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: '„ein" einsetzen' }))
  await user.click(screen.getByRole('button', { name: '„Tisch" einsetzen' }))
  expect(within(screen.getByRole('group', { name: 'Lücke' })).getAllByRole('button').map(button => button.textContent)).toEqual(['ein', 'Tisch'])
  await user.click(screen.getByRole('button', { name: '„ein" wieder herausnehmen' }))
  await user.click(screen.getByRole('button', { name: '„ein" einsetzen' }))
  expect(within(screen.getByRole('group', { name: 'Lücke' })).getAllByRole('button').map(button => button.textContent)).toEqual(['Tisch', 'ein'])
  await user.click(screen.getByRole('button', { name: 'Neu beginnen' }))
  await user.click(screen.getByRole('button', { name: '„ein" einsetzen' }))
  await user.click(screen.getByRole('button', { name: '„Tisch" einsetzen' }))
  await user.click(screen.getByRole('button', { name: 'Antwort prüfen' }))
  expect(recordExerciseAttempt).toHaveBeenCalledWith({ exerciseId: fill.id, answer: 'ein Tisch', hintShown: false })
  await user.click(screen.getByRole('button', { name: 'Lerneinheit abschließen' }))
  expect(screen.getByRole('heading', { name: 'Ein guter Schritt nach vorn.' })).toBeInTheDocument()
}, 20000)
it('remembers typing as the preferred input and shows the article colours and the endings table where they help', async () => {
  const user = userEvent.setup()
  window.localStorage.removeItem('sitov:grammar-input')
  const verbs: StudentExercise = { ...fill, id: 'a611d604-4b69-4040-a12c-451f8c5e1653', topic: 'Verben im Präsens',
    content: { target_form: ['lernen'], text_before: 'Du ', text_after: ' Deutsch.', correct_answer: 'lernst' }, chips: ['lernst', 'lernt'] }
  render(<ExerciseClient exercises={[item, verbs]} lang="de" level="A1.1" />)
  await user.click(screen.getByRole('button', { name: 'Artikel: Thema üben' }))
  expect(screen.getByRole('note', { name: 'Artikel-Farben' })).toHaveTextContent('der')
  await user.click(screen.getByRole('button', { name: 'Zurück' }))
  await user.click(screen.getByRole('button', { name: 'Verben im Präsens: Thema üben' }))
  expect(screen.queryByRole('note', { name: 'Artikel-Farben' })).not.toBeInTheDocument()
  expect(screen.getByText('Endungen im Präsens').closest('details')).toHaveAttribute('open')
  expect(screen.getByRole('rowheader', { name: 'du' }).closest('tr')).toHaveAttribute('data-active', 'true')
  await user.click(screen.getByRole('button', { name: 'Tippen' }))
  expect(window.localStorage.getItem('sitov:grammar-input')).toBe('typing')
  expect(screen.getByRole('textbox', { name: 'Lücke' })).toBeInTheDocument()
})
it.each([
  { name: 'fill-in-blank', exercise: fill, wrong: 'eine Tisch', answer: 'ein Tisch', reduced: false },
  { name: 'multiple-choice', exercise: item, wrong: 'Die', answer: 'Der', reduced: true },
])('reveals the next $name action only after solving, including reduced motion', async ({ exercise, wrong, answer, reduced }) => {
  const user = userEvent.setup()
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  jest.spyOn(window, 'matchMedia').mockReturnValue({ ...media, matches: reduced })
  jest.mocked(recordExerciseAttempt).mockResolvedValueOnce({ success: true, attempts: 1, isCorrect: false, status: 'INCORRECT', reason: null, matched: null, score: 0 })
  render(<ExerciseClient exercises={[exercise]} lang="de" level="A1.1" />)
  await user.click(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' }))
  if (exercise.type === 'fill_in_blank') await user.type(screen.getByRole('textbox', { name: 'Lücke' }), wrong)
  else await user.click(screen.getByRole('button', { name: new RegExp(`Wort .${wrong}. auswählen`) }))
  await user.click(screen.getByRole('button', { name: 'Antwort prüfen' }))
  expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()

  if (exercise.type === 'fill_in_blank') {
    await user.clear(screen.getByRole('textbox', { name: 'Lücke' }))
    await user.type(screen.getByRole('textbox', { name: 'Lücke' }), answer)
  } else await user.click(screen.getByRole('button', { name: new RegExp(`Wort .${answer}. auswählen`) }))
  await user.click(screen.getByRole('button', { name: 'Antwort prüfen' }))
  const next = screen.getByRole('button', { name: 'Lerneinheit abschließen' })
  expect(next).toHaveFocus()
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledTimes(1)
  expect(jest.mocked(HTMLElement.prototype.scrollIntoView).mock.contexts[0]).toBe(next)
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
    block: 'nearest', inline: 'nearest', behavior: reduced ? 'instant' : 'smooth',
  })
})
it('submits the chosen answer and exposes solved-topic review after completion', async () => {
  render(<ExerciseClient exercises={[item]} lang="de" level="A1.1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' }))
  fireEvent.click(screen.getByRole('button', { name: /Wort .Der. auswählen/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Antwort prüfen' })))
  expect(recordExerciseAttempt).toHaveBeenCalledWith({ exerciseId: item.id, answer: 'Der', hintShown: false })
  expect(screen.getByText('Tisch ist maskulin.')).toBeVisible()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Lerneinheit abschließen' })))
  fireEvent.click(screen.getByRole('button', { name: 'Zur Themenübersicht' }))
  expect(screen.getByRole('button', { name: 'Gelöste Aufgaben wiederholen' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Artikel: Thema wiederholen' })).toBeVisible()
})
it('a failed save remains retryable and does not count as persisted completion', async () => {
  jest.mocked(recordExerciseAttempt).mockResolvedValueOnce({ success: false, attempts: 0 })
  render(<ExerciseClient exercises={[item]} lang="de" level="A1.1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' }))
  fireEvent.click(screen.getByRole('button', { name: /Wort .Der. auswählen/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Antwort prüfen' })))
  expect(screen.getByText('Dein Fortschritt konnte nicht gespeichert werden. Bitte versuche es erneut.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Lerneinheit abschließen' })).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' })))
  expect(recordExerciseAttempt).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Dein Fortschritt konnte nicht gespeichert werden. Bitte versuche es erneut.')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Lerneinheit abschließen' })).toBeVisible()
})

it.each([
  { name: 'fill-in-blank', exercise: fill, answer: 'ein Tisch' },
  { name: 'multiple-choice', exercise: item, answer: 'Der' },
])('waits for the server and respects rejection of a locally correct $name answer', async ({ exercise, answer }) => {
  let finish!: (result: RecordExerciseAttemptResult) => void
  jest.mocked(recordExerciseAttempt).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  render(<ExerciseClient exercises={[exercise]} lang="de" level="A1.1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' }))
  if (exercise.type === 'fill_in_blank') fireEvent.change(screen.getByRole('textbox', { name: 'Lücke' }), { target: { value: answer } })
  else fireEvent.click(screen.getByRole('button', { name: /Wort .Der. auswählen/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Antwort prüfen' }))
  expect(screen.getByRole('button', { name: 'Antwort prüfen' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Lerneinheit abschließen' })).not.toBeInTheDocument()
  expect(screen.queryByText('Richtig! Gut gemacht.')).not.toBeInTheDocument()
  await act(async () => finish({ success: true, attempts: 1, isCorrect: false, status: 'INCORRECT', matched: null, reason: null, score: 0 }))
  expect(screen.queryByRole('button', { name: 'Lerneinheit abschließen' })).not.toBeInTheDocument()
  expect(screen.getByText('Fast! Versuche es noch einmal.')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Zurück' }))
  expect(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' })).toBeVisible()
})

it('renders the confirmed soft-error reason in Russian', async () => {
  jest.mocked(recordExerciseAttempt).mockResolvedValueOnce({
    success: true, attempts: 1, isCorrect: true, status: 'SOFT_ERROR', matched: 'ein Tisch', reason: 'typo', score: 90,
  })
  render(<ExerciseClient exercises={[fill]} lang="ru" level="A1.1" translations={russian.exercises} />)
  fireEvent.click(screen.getByRole('button', { name: 'Начать нерешённые задания' }))
  fireEvent.change(screen.getByRole('textbox', { name: russian.exercises.blank_label }), { target: { value: 'ein Tish' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: russian.exercises.check_answer })))
  expect(screen.getByText(russian.exercises.soft_error.typo)).toBeVisible()
  expect(screen.queryByText('Fast richtig!')).not.toBeInTheDocument()
  expect(screen.getByText(russian.exercises.soft_error.typo).closest('p')).toHaveClass('bg-[var(--warning)]')
  expect(screen.getByRole('button', { name: 'Завершить занятие' })).toBeVisible()
})

it('shows the translated prompt with the authored German base form before answering', () => {
  const translated: StudentExercise = { ...fill, translationPrompt: 'Как вас зовут?', promptLanguage: 'ru',
    content: { target_form: ['heißen'], text_before: '', text_after: '', correct_answer: 'Wie heißen Sie?' } }
  render(<ExerciseClient exercises={[translated]} lang="ru" level="A1.1" translations={russian.exercises} />)
  fireEvent.click(screen.getByRole('button', { name: 'Начать нерешённые задания' }))
  expect(screen.getByText('Как вас зовут?')).toHaveAttribute('lang', 'ru')
  expect(screen.getByText('[heißen]')).toHaveAttribute('lang', 'de')
  expect(screen.getByText('Как вас зовут?').closest('p')).toHaveTextContent('Как вас зовут? [heißen]')
  expect(screen.queryByText('Wie heißen Sie?')).not.toBeInTheDocument()
  expect(recordExerciseAttempt).not.toHaveBeenCalled()
})

it('also presents the authored target for multiple-choice grammar', () => {
  render(<ExerciseClient exercises={[item]} lang="de" level="A1.1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Mit offenen Aufgaben starten' }))
  expect(screen.getByRole('heading', { name: '___ Tisch ist frei. [bestimmter Artikel]' })).toBeVisible()
})
it('allows teachers to edit existing exercises while preserving authored instructions', async () => {
  jest.mocked(saveGrammarExercise).mockResolvedValue({ success: true, data: { ...authored, topic: 'Artikel im Alltag' } })
  render(<ExerciseCMS initialData={[authored]} lang="de" />)
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  expect(screen.getByLabelText('Arbeitsauftrag (optional)')).toHaveValue('Wähle den Artikel.')
  fireEvent.change(screen.getByLabelText('Thema'), { target: { value: 'Artikel im Alltag' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Artikel im Alltag', content: expect.objectContaining({ instruction: 'Wähle den Artikel.', correct_answer: 'Der' }) }), item.id)
  expect(screen.getByText('Die Übung wurde gespeichert.')).toBeVisible()
})
it('requires explicit confirmation before deleting an exercise and its progress', async () => {
  jest.mocked(removeGrammarExercise).mockResolvedValue({ success: true })
  render(<ExerciseCMS initialData={[authored]} lang="de" />)
  fireEvent.click(screen.getByRole('button', { name: 'Löschen: Artikel' }))
  expect(removeGrammarExercise).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('zugehörigen Übungsfortschritt')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Ja, Übung löschen' })))
  expect(removeGrammarExercise).toHaveBeenCalledWith(item.id)
  expect(screen.getByText('Noch keine Aufgaben vorhanden.')).toBeVisible()
})
