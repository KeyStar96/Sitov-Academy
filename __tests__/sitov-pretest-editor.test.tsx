import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import SitovPretestDraftEditor from '@/components/admin/SitovPretestDraftEditor'
import { saveSitovPronunciationPretestDraft } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPretestAuthorDefinitionSchema } from '@/lib/sitov-pronunciation-pretest-author-contract'
import { sitovPretestEditorCopy } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
jest.unmock('lucide-react')
beforeAll(() => { Object.defineProperty(global.crypto, 'randomUUID', { value: randomUUID, configurable: true }) })
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ saveSitovPronunciationPretestDraft: jest.fn() }))
const source = JSON.parse(readFileSync('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json', 'utf8')).drafts[0]
const definition = sitovPretestAuthorDefinitionSchema.parse(source.definition)
const base = '00000000-0000-4000-8000-000000000001', saved = '00000000-0000-4000-8000-000000000002'
const props = { textId: source.textId, textVersion: source.textVersion, sourceVersion: source.textVersion, definition, baseDefinitionId: base, lang: 'en', onSaved: jest.fn(), onReload: jest.fn() }
function ack(input: unknown) { const value = input as { definition: typeof definition }; return { ok: true as const, data: { id: saved, text_id: props.textId, text_version: props.textVersion, test_version: 'a'.repeat(64), definition: value.definition, active: false as const, created_at: '2026-10-09T00:00:00Z' } } }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(saveSitovPronunciationPretestDraft).mockImplementation(async input => ack(input)) })
it.each(['de', 'en', 'ru', 'uk', 'tr'])('has localized fields and German content, with no opening writes: %s', lang => {
  const copy = sitovPretestEditorCopy(lang); render(<SitovPretestDraftEditor {...props} lang={lang} />)
  expect(screen.getByRole('button', { name: copy.save })).toBeEnabled()
  expect(screen.getAllByLabelText(copy.prompt)[0]).toHaveAttribute('lang', 'de'); expect(screen.getAllByLabelText(copy.rationale)[0]).toHaveAttribute('translate', 'no')
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: copy.help })).toHaveAttribute('aria-expanded', 'false')
})
it('edits fields, preserves exact keys/source metadata, and uses exact inactive ack', async () => {
  render(<SitovPretestDraftEditor {...props} />)
  fireEvent.change(screen.getAllByLabelText('Question prompt')[0], { target: { value: 'Welche Antwort passt jetzt?' } })
  fireEvent.change(screen.getAllByLabelText('Correct answer')[0], { target: { value: definition.tasks[0].options[1].id } })
  fireEvent.click(screen.getByRole('button', { name: 'Save as a new inactive draft' }))
  await waitFor(() => expect(props.onSaved).toHaveBeenCalled())
  const input = jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[0][0] as { definition: typeof definition; textVersion: string; baseDefinitionId: string; requestId: string }
  expect(input).toMatchObject({ textVersion: props.textVersion, baseDefinitionId: base, requestId: expect.any(String) })
  expect(input.definition.tasks[0]).toMatchObject({ promptDe: 'Welche Antwort passt jetzt?', correctOptionId: definition.tasks[0].options[1].id, sourceSpans: definition.tasks[0].sourceSpans, equivalenceKey: definition.tasks[0].equivalenceKey })
  expect(props.onSaved).toHaveBeenCalledWith(ack(input).data)
})
it('guards double activation and reuses identical payload and UUID after uncertain response', async () => {
  let finish!: (value: Awaited<ReturnType<typeof saveSitovPronunciationPretestDraft>>) => void
  jest.mocked(saveSitovPronunciationPretestDraft).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  render(<SitovPretestDraftEditor {...props} />)
  const button = screen.getByRole('button', { name: 'Save as a new inactive draft' }); fireEvent.click(button); fireEvent.click(button)
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledTimes(1)
  await act(async () => { finish({ ok: false, error: 'retryable_failure', retryable: true }) })
  expect(screen.getAllByLabelText('Question prompt')[0]).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Check save again' }))
  await waitFor(() => expect(props.onSaved).toHaveBeenCalled())
  expect(jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[1][0]).toBe(jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[0][0])
})
it('blocks old text version and conflicts require an actual reload', async () => {
  const view = render(<SitovPretestDraftEditor {...props} sourceVersion={'b'.repeat(64)} />)
  expect(screen.getByRole('button', { name: 'Save as a new inactive draft' })).toBeDisabled(); expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Reload current state' })); expect(props.onReload).toHaveBeenCalled()
  view.unmount(); jest.mocked(saveSitovPronunciationPretestDraft).mockResolvedValueOnce({ ok: false, error: 'version_conflict', retryable: false })
  render(<SitovPretestDraftEditor {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Save as a new inactive draft' }))
  await screen.findByText(sitovPretestEditorCopy('en').conflict); expect(props.onSaved).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Save as a new inactive draft' })).toBeDisabled()
})
it('ignores late save after parent scope remount', async () => {
  let finish!: (value: Awaited<ReturnType<typeof saveSitovPronunciationPretestDraft>>) => void
  jest.mocked(saveSitovPronunciationPretestDraft).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = render(<SitovPretestDraftEditor key="accountA:de:textA" {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save as a new inactive draft' }))
  view.rerender(<SitovPretestDraftEditor key="accountB:uk:textB" {...props} lang="uk" textId={saved} />)
  await act(async () => { finish(ack({ definition })) }); expect(props.onSaved).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: sitovPretestEditorCopy('uk').save })).toBeEnabled()
})
it('invalid rationale and unimported JSON cannot silently save', () => {
  render(<SitovPretestDraftEditor {...props} />)
  fireEvent.change(screen.getAllByLabelText('Solution rationale')[0], { target: { value: 'Kurz.' } })
  expect(screen.getByRole('button', { name: 'Save as a new inactive draft' })).toBeDisabled(); expect(screen.getByRole('alert')).toHaveTextContent(sitovPretestEditorCopy('en').invalid)
  fireEvent.change(screen.getByLabelText('Complete test definition (JSON)'), { target: { value: JSON.stringify(definition) } })
  expect(screen.getByRole('button', { name: 'Save as a new inactive draft' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Use this definition' })); expect(screen.getByRole('button', { name: 'Save as a new inactive draft' })).toBeEnabled()
})
it('malformed or active acknowledgements stay uncertain without accepting an invented draft', async () => {
  jest.mocked(saveSitovPronunciationPretestDraft).mockResolvedValueOnce({ ...ack({ definition }), data: { ...ack({ definition }).data, active: true } } as unknown as Awaited<ReturnType<typeof saveSitovPronunciationPretestDraft>>)
  render(<SitovPretestDraftEditor {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Save as a new inactive draft' }))
  await screen.findByRole('button', { name: 'Check save again' }); expect(props.onSaved).not.toHaveBeenCalled()
})
it('retains the exact request after transport rejection and never exposes raw errors', async () => {
  jest.mocked(saveSitovPronunciationPretestDraft).mockRejectedValueOnce(new Error('PRIVATE_STACK'))
  const { container } = render(<SitovPretestDraftEditor {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save as a new inactive draft' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Check save again' }))
  await waitFor(() => expect(props.onSaved).toHaveBeenCalled())
  expect(jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[1][0]).toBe(jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[0][0])
  expect(container.textContent).not.toContain('PRIVATE_STACK')
})
it('denial stops editing and only offers reload instead of claiming a save', async () => {
  jest.mocked(saveSitovPronunciationPretestDraft).mockResolvedValueOnce({ ok: false, error: 'not_found', retryable: false })
  render(<SitovPretestDraftEditor {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Save as a new inactive draft' }))
  await screen.findByText(sitovPretestEditorCopy('en').failed)
  expect(props.onSaved).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Check save again' })).not.toBeInTheDocument()
  expect(screen.getAllByLabelText('Question prompt')[0]).toBeDisabled()
})
