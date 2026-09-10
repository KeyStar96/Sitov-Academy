import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ExerciseClient from '@/components/exercises/ExerciseClient'
import ExerciseCMS from '@/components/admin/ExerciseCMS'
import { recordExerciseAttempt, finishExerciseSession } from '@/app/actions/exercises'
import { saveGrammarExercise, removeGrammarExercise } from '@/app/actions/grammar-cms'
import type { StudentExercise } from '@/lib/types/exercise'
import type { GrammarExerciseRow } from '@/lib/grammar-validation'

jest.unmock('lucide-react')
jest.mock('@/components/exercises/GrammarStudio.module.css', () => ({}))
jest.mock('@/app/actions/exercises', () => ({ recordExerciseAttempt: jest.fn(), finishExerciseSession: jest.fn() }))
jest.mock('@/app/actions/grammar-cms', () => ({ saveGrammarExercise: jest.fn(), removeGrammarExercise: jest.fn() }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: () => null }))
const item: StudentExercise = {
  id: 'a611d604-4b69-4040-a12c-451f8c5e1651', level: 'A1.1', lesson: '01', topic: 'Artikel',
  type: 'multiple_choice', content: { question: '___ Tisch ist frei.', options: ['Der', 'Die', 'Das'], correct_answer: 'Der', explanation: 'Tisch ist maskulin.' },
  hint: null, completed: false, attempts: 0, score: 0,
}
const authored: GrammarExerciseRow = {
  id: item.id, level: 'A1.1', lesson: '01', topic: 'Artikel', type: 'multiple_choice',
  content: { ...item.content, instruction: 'Wähle den Artikel.' }, created_at: '2026-09-10T00:00:00Z',
  hint_ru: null, hint_tr: null, solution_audio_url: null,
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(recordExerciseAttempt).mockResolvedValue({ success: true, attempts: 1, isCorrect: true })
  jest.mocked(finishExerciseSession).mockResolvedValue({ success: true })
  HTMLElement.prototype.scrollIntoView = jest.fn()
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
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Nochmal versuchen' })))
  expect(recordExerciseAttempt).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Dein Fortschritt konnte nicht gespeichert werden. Bitte versuche es erneut.')).not.toBeInTheDocument()
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
