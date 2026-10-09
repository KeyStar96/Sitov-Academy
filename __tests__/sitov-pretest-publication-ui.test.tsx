import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'
import { randomUUID } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import SitovPretestPublication from '@/components/admin/SitovPretestPublication'
import SitovPronunciationPretestStaff from '@/components/admin/SitovPronunciationPretestStaff'
import { getSitovPronunciationPretestPublication, publishSitovPronunciationPretest, getSitovPronunciationPretestStaff } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPretestPublicationCopy } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
jest.unmock('lucide-react')
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ getSitovPronunciationPretestPublication: jest.fn(), publishSitovPronunciationPretest: jest.fn(), getSitovPronunciationPretestStaff: jest.fn(), saveSitovPronunciationPretestDraft: jest.fn() }))
beforeAll(() => { Object.defineProperty(global.crypto, 'randomUUID', { value: randomUUID, configurable: true }) })
const textId = '00000000-0000-4000-8000-000000000001', definitionId = '00000000-0000-4000-8000-000000000002', base = '00000000-0000-4000-8000-000000000003'
const textVersion = 'a'.repeat(64), testVersion = 'b'.repeat(64)
const identity = { textId, definitionId, textVersion, testVersion }
const input = { ...identity, baseActiveDefinitionId: base }
const ready = { ...identity, activeDefinitionId: base, ready: true }
const published = { ...identity, activeDefinitionId: definitionId, active: true as const }
const props = { scopeKey: 'accountA:studentA', textId, textVersion, definition: { id: definitionId, text_version: textVersion, test_version: testVersion, active: false }, latestDefinitionId: definitionId, baseActiveDefinitionId: base, lang: 'en', onPublished: jest.fn(), onReload: jest.fn() }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getSitovPronunciationPretestPublication).mockResolvedValue({ ok: true, data: ready }); jest.mocked(publishSitovPronunciationPretest).mockResolvedValue({ ok: true, data: published }) })
async function readyButton() { const button = screen.getByRole('button', { name: 'Publish this pretest' }); await waitFor(() => expect(button).toBeEnabled()); return button }
it.each(['de', 'en', 'ru', 'uk', 'tr'])('honestly disables publication on missing proof with %s UI and no opening writes', async lang => {
  jest.mocked(getSitovPronunciationPretestPublication).mockResolvedValue({ ok: true, data: { ...ready, ready: false } })
  render(<SitovPretestPublication {...props} lang={lang} />)
  const copy = sitovPretestPublicationCopy(lang)
  expect(await screen.findByText(copy.missing)).toBeInTheDocument(); expect(screen.getByRole('button', { name: copy.publish })).toBeDisabled()
  expect(getSitovPronunciationPretestPublication).toHaveBeenCalledWith(input); expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: sitovTrainerHelpCopy(lang).label })).toHaveAttribute('aria-expanded', 'false')
})
it('uses exact source/test/base-active CAS and validates the actual active acknowledgment', async () => {
  render(<SitovPretestPublication {...props} />); fireEvent.click(await readyButton())
  await waitFor(() => expect(props.onPublished).toHaveBeenCalledWith(published))
  expect(publishSitovPronunciationPretest).toHaveBeenCalledWith({ ...input, requestId: expect.any(String) })
  expect(screen.getByText(sitovPretestPublicationCopy('en').published)).toHaveFocus()
})
it('retries the same publish request without probing newly stale readiness after an uncertain commit', async () => {
  let finish!: (value: Awaited<ReturnType<typeof publishSitovPronunciationPretest>>) => void
  jest.mocked(publishSitovPronunciationPretest).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  render(<SitovPretestPublication {...props} />)
  const button = await readyButton(); fireEvent.click(button); fireEvent.click(button)
  expect(publishSitovPronunciationPretest).toHaveBeenCalledTimes(1)
  await act(async () => { finish({ ok: false, error: 'retryable_failure', retryable: true }) })
  jest.mocked(getSitovPronunciationPretestPublication).mockResolvedValue({ ok: false, error: 'version_conflict', retryable: false })
  expect(screen.getByRole('alert')).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Check publication again' }))
  await waitFor(() => expect(props.onPublished).toHaveBeenCalledWith(published))
  expect(jest.mocked(publishSitovPronunciationPretest).mock.calls[1][0]).toBe(jest.mocked(publishSitovPronunciationPretest).mock.calls[0][0])
  expect(getSitovPronunciationPretestPublication).toHaveBeenCalledTimes(1)
})
it('retains the receipt after transport rejection without displaying private errors', async () => {
  jest.mocked(publishSitovPronunciationPretest).mockRejectedValueOnce(new Error('PRIVATE_STACK'))
  const { container } = render(<SitovPretestPublication {...props} />); fireEvent.click(await readyButton())
  fireEvent.click(await screen.findByRole('button', { name: 'Check publication again' }))
  await waitFor(() => expect(props.onPublished).toHaveBeenCalled())
  expect(jest.mocked(publishSitovPronunciationPretest).mock.calls[1][0]).toBe(jest.mocked(publishSitovPronunciationPretest).mock.calls[0][0]); expect(container.textContent).not.toContain('PRIVATE_STACK')
})
it.each([{ definition: undefined }, { definition: { ...props.definition, active: true } }, { definition: { ...props.definition, text_version: 'c'.repeat(64) } }, { latestDefinitionId: base }])('does not probe or publish an ineligible selection %s', async patch => {
  render(<SitovPretestPublication {...props} {...patch} />)
  expect(screen.getByRole('button', { name: 'Publish this pretest' })).toBeDisabled(); expect(getSitovPronunciationPretestPublication).not.toHaveBeenCalled(); expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
})
it.each([{ ...ready, definitionId: base }, { ...ready, activeDefinitionId: definitionId }, { ...ready, testVersion: 'c'.repeat(64) }])('rejects foreign readiness %s', async data => {
  jest.mocked(getSitovPronunciationPretestPublication).mockResolvedValue({ ok: true, data })
  render(<SitovPretestPublication {...props} />)
  await screen.findByText(sitovPretestPublicationCopy('en').readFailed); expect(screen.getByRole('button', { name: 'Publish this pretest' })).toBeDisabled(); expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
})
it.each([{ ...published, textId: base }, { ...published, testVersion: 'c'.repeat(64) }, { ...published, activeDefinitionId: base }])('does not accept a foreign publication acknowledgment %s', async data => {
  jest.mocked(publishSitovPronunciationPretest).mockResolvedValue({ ok: true, data })
  render(<SitovPretestPublication {...props} />); fireEvent.click(await readyButton())
  await screen.findByRole('button', { name: 'Check publication again' }); expect(props.onPublished).not.toHaveBeenCalled()
})
it.each(['version_conflict', 'request_conflict'] as const)('requires reload after %s', async error => {
  jest.mocked(publishSitovPronunciationPretest).mockResolvedValue({ ok: false, error, retryable: false })
  render(<SitovPretestPublication {...props} />); fireEvent.click(await readyButton())
  fireEvent.click(await screen.findByRole('button', { name: 'Reload current state' }))
  expect(props.onReload).toHaveBeenCalled(); expect(props.onPublished).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Check publication again' })).not.toBeInTheDocument()
})
it('revoked authority cannot be presented as successful publication', async () => {
  jest.mocked(publishSitovPronunciationPretest).mockResolvedValue({ ok: false, error: 'not_found', retryable: false })
  render(<SitovPretestPublication {...props} />); fireEvent.click(await readyButton())
  await screen.findByText(sitovPretestPublicationCopy('en').unavailable); expect(props.onPublished).not.toHaveBeenCalled()
})
it.each([{ scopeKey: 'accountB:studentB' }, { lang: 'uk' }, { textId: base }, { definition: { ...props.definition, id: base }, latestDefinitionId: base }])('retires a late publish response on ownership/selection change %s', async patch => {
  let finish!: (value: Awaited<ReturnType<typeof publishSitovPronunciationPretest>>) => void
  jest.mocked(publishSitovPronunciationPretest).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = render(<SitovPretestPublication {...props} />); fireEvent.click(await readyButton())
  view.rerender(<SitovPretestPublication {...props} {...patch} />)
  await act(async () => { finish({ ok: true, data: published }) }); expect(props.onPublished).not.toHaveBeenCalled()
})
it('retires late readiness after switching selection', async () => {
  let finish!: (value: Awaited<ReturnType<typeof getSitovPronunciationPretestPublication>>) => void
  jest.mocked(getSitovPronunciationPretestPublication).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const view = render(<SitovPretestPublication {...props} />)
  view.rerender(<SitovPretestPublication {...props} definition={{ ...props.definition, active: true }} />)
  await act(async () => { finish({ ok: true, data: ready }) }); expect(screen.getByRole('button', { name: 'Publish this pretest' })).toBeDisabled(); expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
})
it('refreshes actual staff history after exact success and uses the active predecessor across text versions', async () => {
  const source = JSON.parse(readFileSync('supabase/seeds/sitov-pronunciation-pretests-2026-10-08.json', 'utf8')).drafts[0]
  const old = { id: base, text_id: textId, text_version: 'c'.repeat(64), test_version: 'd'.repeat(64), active: true, definition: source.definition, created_at: '2026-10-09T00:00:00Z' }
  const latest = { ...old, id: definitionId, text_version: textVersion, test_version: testVersion, active: false, created_at: '2026-10-09T01:00:00Z' }
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValueOnce({ ok: true, data: { definitions: [old, latest], attempts: [] } }).mockResolvedValue({ ok: true, data: { definitions: [{ ...old, active: false }, { ...latest, active: true }], attempts: [] } })
  render(<SitovPronunciationPretestStaff accountId={textId} lang="en" levels={['A1.1']} targets={[{ textId, textVersion, level: 'A1.1', title: 'Mein Tag' }]} />)
  await screen.findByRole('heading', { name: 'Mein Tag' }); fireEvent.click(await readyButton())
  await waitFor(() => expect(getSitovPronunciationPretestStaff).toHaveBeenCalledTimes(2))
  await screen.findByRole('option', { name: /Current version/ })
  expect(getSitovPronunciationPretestPublication).toHaveBeenCalledWith(input); expect(screen.getByLabelText('Test definition')).toHaveValue(definitionId)
  expect(screen.getByLabelText('Test definition').querySelectorAll('option')).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Publish this pretest' })).toBeDisabled(); expect(screen.getByText('No saved attempts yet.')).toBeInTheDocument()
})

it('uses null CAS when no predecessor exists and rejects proof revoked since the read', async () => {
  jest.mocked(getSitovPronunciationPretestPublication).mockResolvedValueOnce({ ok: true, data: { ...ready, activeDefinitionId: null } })
  jest.mocked(publishSitovPronunciationPretest).mockResolvedValueOnce({ ok: false, error: 'authoring_not_ready', retryable: false })
  render(<SitovPretestPublication {...props} baseActiveDefinitionId={null} />); fireEvent.click(await readyButton())
  await screen.findByText(sitovPretestPublicationCopy('en').missing)
  expect(publishSitovPronunciationPretest).toHaveBeenCalledWith({ ...input, baseActiveDefinitionId: null, requestId: expect.any(String) })
  expect(props.onPublished).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Publish this pretest' })).toBeDisabled()
})
