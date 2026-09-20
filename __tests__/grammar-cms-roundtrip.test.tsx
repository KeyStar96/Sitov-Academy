import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import ExerciseCMS from '@/components/admin/ExerciseCMS'
import { saveGrammarExercise } from '@/app/actions/grammar-cms'
import type { GrammarExerciseRow } from '@/lib/grammar-validation'

jest.unmock('lucide-react')
jest.mock('@/components/exercises/GrammarStudio.module.css', () => new Proxy({}, { get: (_target, name) => String(name) }))
jest.mock('@/app/actions/grammar-cms', () => ({ saveGrammarExercise: jest.fn(), removeGrammarExercise: jest.fn() }))

const row: GrammarExerciseRow = {
  unit_id: '00000000-0000-4000-8000-000000000099', id: '00000000-0000-4000-8000-000000000001', level: 'A1.1', lesson: 'A1.1 · 01', topic: 'Artikel', type: 'fill_in_blank',
  content: { text_before: '', text_after: ' Tisch ist groß.', correct_answer: 'Der', options: ['Der', 'Die', 'Das'], accepted_answers: ['Der', 'Dieser'], smart_hint: { de: 'Erklärung', en: 'Explanation', ru: 'Объяснение', uk: 'Пояснення', tr: 'Açıklama' } },
  hint: { en: 'Contrastive English', ru: 'Vergleich Russisch', tr: 'Vergleich Türkisch', uk: 'Contrastive Ukrainian' },
  solution_audio_url: null, created_at: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  HTMLElement.prototype.scrollIntoView = jest.fn()
  jest.mocked(saveGrammarExercise).mockResolvedValue({ success: true, data: row })
})

it('editing a topic preserves all translations, separate contrastive metadata and alternative answers', async () => {
  render(<ExerciseCMS initialData={[row]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  expect(screen.getByLabelText('Hinweis auf Russisch (optional)')).toHaveValue('Vergleich Russisch')
  expect(screen.getByLabelText('Erklärung / hilfreicher Tipp')).toHaveValue('Erklärung')
  fireEvent.change(screen.getByLabelText('Thema'), { target: { value: 'Artikel im Alltag' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({
    topic: 'Artikel im Alltag', hint: row.hint,
    content: expect.objectContaining({ accepted_answers: ['Der', 'Dieser'], smart_hint: { de: 'Erklärung', en: 'Explanation', ru: 'Объяснение', uk: 'Пояснення', tr: 'Açıklama' } }),
  }), row.id)
})

it('clearing one metadata hint does not delete another language or replace the content explanation', async () => {
  render(<ExerciseCMS initialData={[row]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  fireEvent.change(screen.getByLabelText('Hinweis auf Russisch (optional)'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Erklärung / hilfreicher Tipp'), { target: { value: 'Neue Erklärung' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({
    hint: { en: 'Contrastive English', tr: 'Vergleich Türkisch', uk: 'Contrastive Ukrainian' },
    content: expect.objectContaining({ smart_hint: { de: 'Neue Erklärung', en: 'Explanation', ru: 'Объяснение', uk: 'Пояснення', tr: 'Açıklama' } }),
  }), row.id)
})

it('legacy single-language hints and blank optional fields can be saved', async () => {
  const legacy = { ...row, hint: null, content: { text_before: 'Das ', text_after: ' ist schön.', correct_answer: 'Haus', options: ['Haus', 'Baum'], smart_hint: 'Ein Gebäude.' } }
  render(<ExerciseCMS initialData={[legacy]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({ hint: null, content: expect.objectContaining({ smart_hint: { de: 'Ein Gebäude.' } }) }), row.id)
})

it('teachers can extend accepted answers, and invalid duplicate answers do not save', async () => {
  render(<ExerciseCMS initialData={[row]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  const alternatives = screen.getByLabelText('Alternative richtige Antworten – eine pro Zeile (optional)')
  fireEvent.change(alternatives, { target: { value: 'Der' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toBeVisible()
  fireEvent.change(alternatives, { target: { value: 'Dieser\nJener' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ accepted_answers: ['Der', 'Dieser', 'Jener'] }) }), row.id)
})
