import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { sitovPretestAuthorDefinitionSchema } from '@/lib/sitov-pronunciation-pretest-author-contract'
import { sitovPretestEditorCopy, sitovPretestStaffCopy } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
import SitovPronunciationPretestStaff from '@/components/admin/SitovPronunciationPretestStaff'
import { getSitovPronunciationPretestStaff, saveSitovPronunciationPretestDraft, getSitovPronunciationPretestPublication, publishSitovPronunciationPretest } from '@/app/actions/sitov-pronunciation-pretest'
jest.unmock('lucide-react')
beforeAll(() => { Object.defineProperty(global.crypto, 'randomUUID', { value: randomUUID, configurable: true }) })
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ getSitovPronunciationPretestStaff: jest.fn(), saveSitovPronunciationPretestDraft: jest.fn(), getSitovPronunciationPretestPublication: jest.fn(), publishSitovPronunciationPretest: jest.fn() }))
const source = JSON.parse(readFileSync('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json', 'utf8')).drafts[0]
const low = '00000000-0000-4000-8000-000000000001', high = '00000000-0000-4000-8000-000000000009', saved = '00000000-0000-4000-8000-000000000010'
const row = { id: low, text_id: source.textId, text_version: source.textVersion, test_version: 'a'.repeat(64), created_at: '2026-10-09T00:00:00Z', definition: source.definition, active: true }
const props = { accountId: low, lang: 'en', levels: ['A1.1'], targets: [{ textId: source.textId, textVersion: source.textVersion, title: 'Mein Tag', level: 'A1.1' }] }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getSitovPronunciationPretestPublication).mockResolvedValue({ ok: false, error: 'authoring_not_ready', retryable: false }); jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [row, { ...row, id: high, active: false }], attempts: [] } }); jest.mocked(saveSitovPronunciationPretestDraft).mockImplementation(async input => ({ ok: true, data: { ...row, id: saved, active: false, definition: (input as { definition: typeof source.definition }).definition } })) })
it('uses latest ANY definition with UUID tie break while saving active preview as a new inactive draft', async () => {
  render(<SitovPronunciationPretestStaff {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Save as a new inactive draft' }))
  await screen.findByText('New inactive draft saved.')
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledWith(expect.objectContaining({ textId: source.textId, textVersion: source.textVersion, baseDefinitionId: high }))
  expect(screen.getByText('New inactive draft saved.')).toHaveFocus()
  expect(screen.getByLabelText('Test definition')).toHaveValue(saved)
  expect(screen.getByRole('option', { name: /Current version/ })).toBeInTheDocument()
  expect(screen.getByText('No saved attempts yet.')).toBeInTheDocument()
})
it('remounts editor and rereads when locale/account scope changes without writing on opening', async () => {
  const view = render(<SitovPronunciationPretestStaff {...props} />)
  await screen.findByRole('button', { name: 'Save as a new inactive draft' }); expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
  fireEvent.change(screen.getAllByLabelText('Question prompt')[0], { target: { value: 'Lokale Änderung' } })
  view.rerender(<SitovPronunciationPretestStaff {...props} lang="de" accountId={high} />)
  await waitFor(() => expect(screen.getAllByLabelText('Aufgabenstellung')[0]).toHaveValue(source.definition.tasks[0].promptDe))
  expect(getSitovPronunciationPretestStaff).toHaveBeenCalledTimes(2); expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled(); expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
})
it('does not apply a late acknowledged save to another account and locale', async () => {
  let finish!: (value: Awaited<ReturnType<typeof saveSitovPronunciationPretestDraft>>) => void
  jest.mocked(saveSitovPronunciationPretestDraft).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = render(<SitovPronunciationPretestStaff {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Save as a new inactive draft' }))
  view.rerender(<SitovPronunciationPretestStaff {...props} lang="uk" accountId={high} />)
  await screen.findByRole('button', { name: 'Зберегти нову неактивну чернетку' })
  await act(async () => { finish({ ok: true, data: { ...row, id: saved, active: false } }) })
  expect(screen.queryByText('Нову неактивну чернетку збережено.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Зміст тесту')).toHaveValue(low)
})

it('starts explicitly against the current body without copying an outdated definition', async () => {
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValueOnce({ ok: true, data: { definitions: [{ ...row, text_version: 'b'.repeat(64) }], attempts: [] } })
  render(<SitovPronunciationPretestStaff {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Start a new draft for the current text version' }))
  expect(screen.getByLabelText('Complete test definition (JSON)')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Save as a new inactive draft' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Complete test definition (JSON)'), { target: { value: JSON.stringify(source.definition) } })
  fireEvent.click(screen.getByRole('button', { name: 'Use this definition' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save as a new inactive draft' }))
  await screen.findByText('New inactive draft saved.')
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledWith(expect.objectContaining({ textVersion: source.textVersion, baseDefinitionId: low }))
})

it('preserves database timestamp precision before applying the UUID tie break', async () => {
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValueOnce({ ok: true, data: { definitions: [{ ...row, created_at: '2026-10-09T00:00:00.000002Z' }, { ...row, id: high, active: false, created_at: '2026-10-09T00:00:00.000001Z' }], attempts: [] } })
  render(<SitovPronunciationPretestStaff {...props} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Save as a new inactive draft' }))
  await screen.findByText('New inactive draft saved.')
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledWith(expect.objectContaining({ baseDefinitionId: low }))
})


it.each(['de', 'en', 'ru', 'uk', 'tr'])('selects one exact inactive ack and restores its complete JSON after mocked secured reread in %s', async lang => {
  const editor = sitovPretestEditorCopy(lang), staff = sitovPretestStaffCopy(lang)
  const complete = { ...sitovPretestAuthorDefinitionSchema.parse(source.definition), omittedCategories: [] }
  const originals = [row, { ...row, id: high, active: false }]
  const view = render(<SitovPronunciationPretestStaff {...props} lang={lang} />)
  await screen.findByRole('button', { name: editor.save })
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText(editor.advanced))
  const json = screen.getByLabelText(editor.json)
  expect(json).toHaveAttribute('lang', 'de'); expect(json).toHaveAttribute('translate', 'no')
  fireEvent.change(json, { target: { value: JSON.stringify(complete) } })
  expect(screen.getByRole('button', { name: editor.save })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: editor.import }))
  expect(screen.getByRole('button', { name: editor.save })).toBeEnabled()
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: editor.save }))
  const notice = await screen.findByText(editor.saved)
  expect(notice).toHaveFocus()
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledTimes(1)
  const input = jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[0][0]
  expect(input).toEqual({ textId: source.textId, textVersion: source.textVersion, baseDefinitionId: high, definition: complete, requestId: expect.any(String) })
  expect(screen.getByLabelText(staff.definition)).toHaveValue(saved)
  expect(screen.getAllByRole('option').filter(option => [low, high, saved].includes((option as HTMLOptionElement).value))).toHaveLength(3)
  expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
  const acknowledged = { ...row, id: saved, active: false, definition: complete, created_at: '2026-10-09T00:01:00Z' }
  view.unmount()
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [...originals, acknowledged], attempts: [] } })
  render(<SitovPronunciationPretestStaff {...props} lang={lang} />)
  await screen.findByRole('button', { name: editor.save })
  fireEvent.change(screen.getByLabelText(staff.definition), { target: { value: saved } })
  await waitFor(() => expect(screen.getByLabelText(staff.definition)).toHaveValue(saved))
  expect(JSON.parse((screen.getByLabelText(editor.json) as HTMLTextAreaElement).value)).toEqual(complete)
  expect(screen.getAllByLabelText(editor.prompt)[0]).toHaveAttribute('lang', 'de')
  expect(screen.getAllByLabelText(editor.prompt)[0]).toHaveAttribute('translate', 'no')
  expect(getSitovPronunciationPretestStaff).toHaveBeenCalledTimes(2)
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledTimes(1)
  expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
})
