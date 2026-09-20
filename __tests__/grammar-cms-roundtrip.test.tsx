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
  content: { target_form: ['bestimmter Artikel'], text_before: '', text_after: ' Tisch ist groß.', correct_answer: 'Der', options: ['Der', 'Die', 'Das'], accepted_answers: ['Der', 'Dieser'], smart_hint: { de: 'Erklärung', en: 'Explanation', ru: 'Объяснение', uk: 'Пояснення', tr: 'Açıklama' } },
  translation_prompt: { ru: 'Этот стол большой.', uk: 'Цей стіл великий.' },
  hint: { en: 'Contrastive English', ru: 'Vergleich Russisch', tr: 'Vergleich Türkisch', uk: 'Contrastive Ukrainian' },
  solution_audio_url: null, created_at: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  HTMLElement.prototype.scrollIntoView = jest.fn()
  jest.mocked(saveGrammarExercise).mockResolvedValue({ success: true, data: row })
})

it('opening the editor does not steal focus after the teacher has entered another field', () => {
  let deferredFocus: FrameRequestCallback | undefined
  const animation = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    deferredFocus = callback
    return 1
  })
  try {
    render(<ExerciseCMS initialData={[row]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
    const topic = screen.getByLabelText('Thema')
    topic.focus()
    fireEvent.change(topic, { target: { value: 'Neue Frage' } })
    act(() => deferredFocus?.(0))
    expect(topic).toHaveFocus()
    expect(topic).toHaveValue('Neue Frage')
    expect(screen.getByLabelText('Lektion')).toHaveValue(row.lesson)
  } finally { animation.mockRestore() }
})

it('editing a topic preserves all translations, separate contrastive metadata and alternative answers', async () => {
  render(<ExerciseCMS initialData={[row]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  expect(screen.getByLabelText('Hinweis auf Russisch (optional)')).toHaveValue('Vergleich Russisch')
  expect(screen.getByLabelText('Erklärung / hilfreicher Tipp')).toHaveValue('Erklärung')
  expect(screen.getByLabelText('Zielwerte – eine Grundform pro Zeile (Pflichtfeld)')).toHaveValue('bestimmter Artikel')
  expect(screen.getByLabelText('Übersetzungsaufgabe (RU, optional)')).toHaveValue('Этот стол большой.')
  fireEvent.change(screen.getByLabelText('Thema'), { target: { value: 'Artikel im Alltag' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({
    topic: 'Artikel im Alltag', hint: row.hint, translation_prompt: row.translation_prompt,
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

it('legacy content remains editable but needs explicitly entered target forms before saving', async () => {
  const legacy = { ...row, hint: null, content: { text_before: 'Das ', text_after: ' ist schön.', correct_answer: 'Haus', options: ['Haus', 'Baum'], smart_hint: 'Ein Gebäude.' } }
  render(<ExerciseCMS initialData={[legacy]} />)
  expect(screen.getByText('Unvollständig')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  expect(screen.getByLabelText('Zielwerte – eine Grundform pro Zeile (Pflichtfeld)')).toHaveValue('')
  await act(async () => fireEvent.submit(screen.getByRole('button', { name: 'Übung speichern' }).closest('form')!))
  expect(saveGrammarExercise).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Zielwerte – eine Grundform pro Zeile (Pflichtfeld)'), { target: { value: 'Haus' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({ hint: null, content: expect.objectContaining({ target_form: ['Haus'], smart_hint: { de: 'Ein Gebäude.' } }) }), row.id)
})

it('preserves other translation prompts when one locale is edited or cleared', async () => {
  render(<ExerciseCMS initialData={[row]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Artikel' }))
  fireEvent.change(screen.getByLabelText('Übersetzungsaufgabe (RU, optional)'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Übersetzungsaufgabe (EN, optional)'), { target: { value: 'This table is big.' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Übung speichern' })))
  expect(saveGrammarExercise).toHaveBeenCalledWith(expect.objectContaining({ translation_prompt: { uk: 'Цей стіл великий.', en: 'This table is big.' } }), row.id)
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
