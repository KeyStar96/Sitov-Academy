import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VocabCMS from '@/components/admin/VocabCMS'
import { AdminI18nProvider } from '@/components/admin/AdminI18nProvider'
import { addVocab, updateVocab, deleteVocab } from '@/app/actions/cms'
import { emptyVocabForm, type VocabSaveResult } from '@/lib/types/vocabulary-admin'
import type { VocabularyCardRow } from '@/lib/types/vocabulary'
import de from '@/dictionaries/de.json'

jest.unmock('lucide-react')
jest.mock('@/app/actions/cms', () => ({ addVocab: jest.fn(), updateVocab: jest.fn(), deleteVocab: jest.fn() }))
const item: VocabularyCardRow = { ...emptyVocabForm(), id: '00000000-0000-4000-8000-000000000001', word_de: 'lernen', lesson: 'Lektion 1', article: null, audio_url: null, image_url: null, is_hard_for_ru: false, is_hard_for_tr: false, created_at: null }

beforeEach(() => {
  jest.clearAllMocks()
  Element.prototype.scrollIntoView = jest.fn()
})
function renderEditor() { return render(<AdminI18nProvider translations={de.admin}><VocabCMS initialData={[item]} /></AdminI18nProvider>) }

it('updates the vocabulary row immediately and rolls back a failed save while preserving the form', async () => {
  let resolveSave!: (result: VocabSaveResult) => void
  jest.mocked(updateVocab).mockImplementation(() => new Promise(resolve => { resolveSave = resolve }))
  renderEditor()
  fireEvent.click(screen.getByRole('button', { name: de.admin.cms_edit }))
  fireEvent.change(screen.getByLabelText(de.admin.cms_word_de), { target: { value: 'sprechen' } })
  fireEvent.click(screen.getByRole('button', { name: de.admin.cms_save }))
  expect(screen.getByText('sprechen')).toBeInTheDocument()
  expect(screen.queryByText('lernen')).not.toBeInTheDocument()
  await act(async () => resolveSave({ success: false, error: 'save_failed' }))
  expect(screen.getByText('lernen')).toBeInTheDocument()
  expect(screen.getByLabelText(de.admin.cms_word_de)).toHaveValue('sprechen')
  expect(screen.getByText(de.admin.cms_save_failed)).toBeInTheDocument()
})

it('requires explicit row confirmation before deletion and restores a failed deletion', async () => {
  jest.mocked(deleteVocab).mockResolvedValue({ success: false, error: 'delete_failed' })
  renderEditor()
  fireEvent.click(screen.getByRole('button', { name: de.admin.cms_delete }))
  expect(deleteVocab).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: de.admin.cms_delete_final }))
  await waitFor(() => expect(screen.getByText(de.admin.cms_delete_failed)).toBeInTheDocument())
  expect(screen.getByText('lernen')).toBeInTheDocument()
})

it('validates all sentence languages before calling a save action', async () => {
  renderEditor()
  fireEvent.click(screen.getByRole('button', { name: de.admin.cms_edit }))
  fireEvent.click(screen.getByRole('checkbox', { name: de.admin.cms_sentence_practice }))
  fireEvent.change(screen.getByLabelText(de.admin.cms_context_sentence_de), { target: { value: 'Ich lerne Deutsch.' } })
  fireEvent.click(screen.getByRole('button', { name: de.admin.cms_save }))
  expect(screen.getByText(de.admin.cms_invalid)).toBeInTheDocument()
  expect(updateVocab).not.toHaveBeenCalled()
  expect(addVocab).not.toHaveBeenCalled()
})
