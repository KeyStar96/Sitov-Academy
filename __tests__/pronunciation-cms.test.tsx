import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PronunciationCMS from '@/components/admin/PronunciationCMS'
import { savePronunciationPrompt } from '@/app/actions/pronunciation'
import { getPronunciationTranslations } from '@/lib/pronunciation-i18n'
import pronunciationUpdates from '@/lib/pronunciation-translations.json'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

jest.mock('@/app/actions/pronunciation', () => ({ savePronunciationPrompt: jest.fn() }))
jest.unmock('lucide-react')
const de = pronunciationUpdates.de
const prompt = (id: number, overrides: Partial<PronunciationPrompt>): PronunciationPrompt => ({
  id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, unitId: `unit-${id}`, cefrLevel: 'A1', level: 'A1.1', lesson: '', focus: null, audioUrl: null, sortOrder: id, isActive: true,
  title: `Text ${id}`, sentenceDe: 'Ich bin im Laden. Ich brauche Milch.', ...overrides,
})
const prompts = [
  prompt(1, { title: 'Im kleinen Laden', focus: 'ä und ch' }),
  prompt(2, { title: 'Ich habe zwei Brüder.', sentenceDe: 'Ich habe zwei Brüder.', isActive: false }),
  prompt(3, { title: 'Unser Kursraum', isActive: false }),
  prompt(4, { title: 'Die These ist neu.', sentenceDe: 'Die These ist neu.', level: 'C1', cefrLevel: 'C1', isActive: false }),
]
const renderCms = (initialLevel?: string) => render(<PronunciationCMS prompts={prompts} translations={getPronunciationTranslations('de')} lang="de" initialLevel={initialLevel} />)
beforeEach(() => jest.clearAllMocks())

it('names the pronunciation trainer and links to the other trainers', () => {
  renderCms()
  expect(screen.getByText(de.cms_trainer_badge)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: de.cms_scope_vocabulary })).toHaveAttribute('href', '/de/admin/content/vocabulary')
  expect(screen.getByRole('link', { name: de.cms_scope_grammar })).toHaveAttribute('href', '/de/admin/content/exercises')
})

it('shows only what students see by default and keeps archived single sentences apart', async () => {
  const user = userEvent.setup()
  renderCms()
  expect(screen.getByRole('button', { name: /Im Trainer sichtbar \(1\)/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('heading', { name: /^Lesetexte \(/ })).toBeInTheDocument()
  expect(screen.getByText('Im kleinen Laden')).toBeInTheDocument()
  expect(screen.getByText('Schwerpunkt: ä und ch')).toBeInTheDocument()
  expect(screen.queryByText('Ich habe zwei Brüder.')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Archiviert \(2\)/ }))
  const sentences = screen.getByRole('heading', { name: /^Einzelsätze \(/ }).closest('section')!
  expect(within(sentences).getByText('Ich habe zwei Brüder.')).toBeInTheDocument()
  expect(within(sentences).getByText(de.cms_kind_sentence)).toBeInTheDocument()
  expect(within(sentences).getByText(de.cms_status_archived)).toBeInTheDocument()
  const texts = screen.getByRole('heading', { name: /^Lesetexte \(/ }).closest('section')!
  expect(within(texts).getByText('Unser Kursraum')).toBeInTheDocument()
  expect(screen.queryByText('Im kleinen Laden')).not.toBeInTheDocument()
})

it('archives and republishes a text directly from its card', async () => {
  const user = userEvent.setup()
  jest.mocked(savePronunciationPrompt).mockResolvedValue({ success: true, id: prompts[0].id })
  renderCms()
  await user.click(screen.getByRole('button', { name: `${de.cms_archive}: Im kleinen Laden` }))
  await waitFor(() => expect(savePronunciationPrompt).toHaveBeenCalledWith({
    id: prompts[0].id, level: 'A1.1', title: 'Im kleinen Laden', text: prompts[0].sentenceDe, focus: 'ä und ch', isActive: false,
  }))
  expect(await screen.findByRole('status')).toHaveTextContent(de.cms_saved)
  await user.click(screen.getByRole('button', { name: /Archiviert \(2\)/ }))
  await user.click(screen.getByRole('button', { name: `${de.cms_restore}: Unser Kursraum` }))
  await waitFor(() => expect(savePronunciationPrompt).toHaveBeenLastCalledWith(expect.objectContaining({ id: prompts[2].id, isActive: true })))
})

it('opens the level passed from the content hub and never offers publishing for unbookable levels', async () => {
  const user = userEvent.setup()
  renderCms('C1')
  expect(screen.getByRole('combobox', { name: de.cms_level_label })).toHaveValue('C1')
  await user.click(screen.getByRole('button', { name: /Archiviert \(1\)/ }))
  expect(screen.getByText(de.cms_not_publishable)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: `${de.cms_restore}: Die These ist neu.` })).not.toBeInTheDocument()
})
