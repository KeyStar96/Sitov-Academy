import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import SitovPretestDraftEditor from '@/components/admin/SitovPretestDraftEditor'
import { saveSitovPronunciationPretestDraft } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPretestAuthorDefinitionSchema } from '@/lib/sitov-pronunciation-pretest-author-contract'
import { sitovPretestEditorCopy } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'
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
  const toggle = screen.getByRole('button', { name: sitovTrainerHelpCopy(lang).label })
  expect(toggle).toHaveAttribute('aria-expanded', 'false'); expect(toggle).toHaveAttribute('type', 'button')
  fireEvent.click(toggle)
  const panel = screen.getByRole('region', { name: sitovTrainerHelpCopy(lang).label })
  expect(within(panel).getByRole('heading', { name: copy.help })).toBeInTheDocument()
  expect(panel).toHaveTextContent(copy.helpBody)
  expect(toggle).toHaveAttribute('aria-controls', panel.id)
  fireEvent.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(panel).toHaveAttribute('aria-hidden', 'true')
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
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


// Component/action-port acceptance only: fixtures stay local and inactive.
const sitovCompleteMatrix = { ...definition, omittedCategories: [] }
function sitovAbsentNominalMatrix() {
  const removed = definition.competencies.find(core => core.category === 'nominal_forms')!
  const tasks = definition.tasks.filter(task => task.competencyId !== removed.id)
  const ids = new Set(tasks.map(task => task.id))
  return { ...definition, competencies: definition.competencies.filter(core => core.id !== removed.id), tasks,
    reviewForms: definition.reviewForms.map(form => ({ ...form, questionIds: form.questionIds.filter(id => ids.has(id)) })), omittedCategories: [] as typeof definition.omittedCategories }
}
function sitovImport(raw: unknown, lang = 'en') {
  const copy = sitovPretestEditorCopy(lang), summary = screen.getByText(copy.advanced)
  fireEvent.click(summary)
  expect(summary.closest('details')).toHaveAttribute('open')
  const json = screen.getByLabelText(copy.json)
  expect(json).toHaveAttribute('lang', 'de'); expect(json).toHaveAttribute('translate', 'no')
  fireEvent.change(json, { target: { value: JSON.stringify(raw) } })
  expect(screen.getByRole('button', { name: copy.save })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: copy.import }))
}
it.each(['de', 'en', 'ru', 'uk', 'tr'])('imports a complete four-category matrix with no invented omission and saves once in %s', async lang => {
  const copy = sitovPretestEditorCopy(lang)
  render(<SitovPretestDraftEditor {...props} definition={undefined} lang={lang} />)
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
  sitovImport(sitovCompleteMatrix, lang)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getAllByLabelText(copy.prompt)[0]).toHaveAttribute('lang', 'de')
  expect(screen.getAllByLabelText(copy.prompt)[0]).toHaveAttribute('translate', 'no')
  expect(screen.getByRole('button', { name: copy.save })).toBeEnabled()
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: copy.save }))
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1))
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledTimes(1)
  const input = jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[0][0]
  expect(input).toEqual({ textId: props.textId, textVersion: props.textVersion, baseDefinitionId: base, definition: sitovCompleteMatrix, requestId: expect.any(String) })
  expect(props.onSaved).toHaveBeenCalledWith(ack(input).data)
  expect(ack(input).data.active).toBe(false)
})
it.each([
  { label: 'no reason', omissions: [] },
  { label: 'short', omissions: [{ category: 'nominal_forms', reasonDe: 'Kurz.' }] },
  { label: 'padded', omissions: [{ category: 'nominal_forms', reasonDe: '                  Kurz.                  ' }] },
  { label: 'ten Unicode code points', omissions: [{ category: 'nominal_forms', reasonDe: '🙂'.repeat(10) }] },
])('rejects absent nominal forms with $label through JSON import without a save call', ({ omissions }) => {
  render(<SitovPretestDraftEditor {...props} definition={undefined} />)
  sitovImport({ ...sitovAbsentNominalMatrix(), omittedCategories: omissions })
  expect(screen.getByRole('alert')).toHaveTextContent(sitovPretestEditorCopy('en').invalid)
  const save = screen.getByRole('button', { name: sitovPretestEditorCopy('en').save })
  expect(save).toBeDisabled(); fireEvent.click(save)
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
  expect(props.onSaved).not.toHaveBeenCalled()
})
it('imports a substantively justified absence with balanced remaining forms and saves the exact definition', async () => {
  const absent = { ...sitovAbsentNominalMatrix(), omittedCategories: [{ category: 'nominal_forms', reasonDe: 'Diese Kategorie fehlt in diesem synthetischen Test der Importoberfläche ausdrücklich.' }] }
  render(<SitovPretestDraftEditor {...props} definition={undefined} />)
  sitovImport(absent)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  const save = screen.getByRole('button', { name: sitovPretestEditorCopy('en').save })
  expect(save).toBeEnabled(); fireEvent.click(save)
  await waitFor(() => expect(props.onSaved).toHaveBeenCalledTimes(1))
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledTimes(1)
  expect(jest.mocked(saveSitovPronunciationPretestDraft).mock.calls[0][0].definition).toEqual(absent)
})
it.each(['text', 'source', 'definition'] as const)('does not accept a strict inactive ack with a foreign %s', async mismatch => {
  jest.mocked(saveSitovPronunciationPretestDraft).mockImplementationOnce(async input => {
    const response = ack(input)
    if (mismatch === 'text') response.data.text_id = saved
    if (mismatch === 'source') response.data.text_version = 'b'.repeat(64)
    if (mismatch === 'definition') response.data.definition = { ...input.definition, omittedCategories: [{ category: 'additional', reasonDe: 'Diese zusätzliche Begründung war nicht Teil des gesendeten Entwurfs.' }] }
    return response
  })
  render(<SitovPretestDraftEditor {...props} definition={undefined} />)
  sitovImport(sitovCompleteMatrix)
  fireEvent.click(screen.getByRole('button', { name: sitovPretestEditorCopy('en').save }))
  await screen.findByRole('button', { name: sitovPretestEditorCopy('en').retry })
  expect(screen.getByRole('alert')).toHaveFocus()
  expect(props.onSaved).not.toHaveBeenCalled()
  expect(saveSitovPronunciationPretestDraft).toHaveBeenCalledTimes(1)
})
