import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SitovPronunciationPretestStaff from '@/components/admin/SitovPronunciationPretestStaff'
import { getSitovPronunciationPretestStaff, saveSitovPronunciationPretestDraft, getSitovPronunciationPretestPublication, publishSitovPronunciationPretest } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPretestStaffCopy, sitovPretestEditorCopy } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
import type { SitovPronunciationPretestCompletedAttempt } from '@/lib/sitov-pronunciation-pretest-contract'
jest.unmock('framer-motion')
jest.unmock('lucide-react')
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ getSitovPronunciationPretestStaff: jest.fn(), saveSitovPronunciationPretestDraft: jest.fn(), getSitovPronunciationPretestPublication: jest.fn(), publishSitovPronunciationPretest: jest.fn() }))
const id = '00000000-0000-4000-8000-000000000001', second = '00000000-0000-4000-8000-000000000002', actor = '00000000-0000-4000-8000-000000000003'
const version = 'a'.repeat(64), testVersion = 'b'.repeat(64), time = '2026-10-08T22:00:00Z'
function task(index: number) { return { id: `sitov.q${index}`, competencyId: 'sitov.words', kind: 'single_choice' as const, promptDe: `Was passt zu Satz ${index + 1}?`, fragmentDe: 'Paul trinkt Wasser.', options: [{ id: 'sitov.a', textDe: 'Er trinkt.' }, { id: 'sitov.b', textDe: 'Er trinken.' }, { id: 'sitov.c', textDe: 'Er trinkst.' }], correctOptionId: 'sitov.a', privateEvidence: 'PRIVATE_EVIDENCE_DO_NOT_RENDER' } }
function definition(textId = id) { return { id: second, text_id: textId, text_version: version, test_version: testVersion, active: true, created_at: time,
  definition: { policyId: 'sitov-pronunciation-language-prerequisites-v1', competencies: [{ id: 'sitov.words', itemsPerAttempt: 3 }], tasks: [0, 1, 2, 3, 4, 5].map(task), rawSecret: 'UNKNOWN_SECRET_DO_NOT_RENDER' } } }
function completed(old = false): SitovPronunciationPretestCompletedAttempt {
  const textVersion = old ? 'c'.repeat(64) : version
  return { attempt: { id: actor, textId: id, textVersion, testVersion, status: 'passed', revision: 1, startedAt: time, updatedAt: time, questionIds: ['sitov.q0', 'sitov.q1', 'sitov.q2'], answers: { 'sitov.q0': 'sitov.a', 'sitov.q1': 'sitov.a', 'sitov.q2': 'sitov.a' }, answeredCount: 3, totalCount: 3 },
    result: { attemptId: actor, textId: id, textVersion, testVersion, passed: true, correct: 3, total: 3, competencies: [{ id: 'sitov.words', correct: 3, total: 3, required: 2, met: true }], failedCompetencyIds: [], learningLinks: [], proof: { id, textId: id, textVersion, testVersion, passedAttemptId: actor, passedAt: time, compatibilityId: null } } }
}
function props(lang = 'en') { return { lang, studentId: second, accountId: actor, levels: ['A1.1'], targets: [{ textId: id, level: 'A1.1', title: 'Mein Frühstück', textVersion: version }] } }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(getSitovPronunciationPretestPublication).mockResolvedValue({ ok: false, error: 'authoring_not_ready', retryable: false }); jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [definition()], attempts: [] } }) })
it.each(['de', 'en', 'ru', 'uk', 'tr'])('uses %s UI, German task content and closed named Help without intervention actions', async lang => {
  const copy = sitovPretestStaffCopy(lang); const { container } = render(<SitovPronunciationPretestStaff {...props(lang)} />)
  expect(screen.getByText(copy.loading)).toBeInTheDocument()
  await screen.findByRole('heading', { name: 'Mein Frühstück' })
  screen.getAllByRole('button', { name: copy.help }).forEach(help => expect(help).toHaveAttribute('aria-expanded', 'false'))
  expect(screen.getByLabelText(copy.level)).toHaveValue('A1.1')
  const prompt = screen.getByText('Was passt zu Satz 1?'); expect(prompt).toHaveAttribute('lang', 'de'); expect(prompt).toHaveAttribute('translate', 'no')
  expect(container.textContent).not.toContain('PRIVATE_EVIDENCE_DO_NOT_RENDER'); expect(container.textContent).not.toContain('UNKNOWN_SECRET_DO_NOT_RENDER')
  expect(container.textContent).not.toContain('correctOptionId'); expect(container.textContent).not.toMatch(/hard|Readiness|Override/)
  expect(screen.getByText(copy.readonly)).toBeInTheDocument()
})
it('loads results for only the requested student and distinguishes a persisted pass from an earlier version', async () => {
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [definition()], attempts: [completed(true)] } })
  render(<SitovPronunciationPretestStaff {...props()} />)
  await screen.findByText('3 of 3 correct')
  expect(screen.getByText('Passed')).toBeInTheDocument(); expect(screen.getByText('Earlier version')).toBeInTheDocument()
  expect(getSitovPronunciationPretestStaff).toHaveBeenCalledWith({ textId: id, studentId: second })
})
it('keeps invalid definition data out of the preview while preserving valid stored results', async () => {
  const bad = definition(); bad.definition.tasks[0].correctOptionId = 'sitov.missing'
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [bad], attempts: [completed()] } })
  render(<SitovPronunciationPretestStaff {...props()} />)
  await screen.findByText(sitovPretestStaffCopy('en').invalid)
  expect(screen.queryByText('Was passt zu Satz 1?')).not.toBeInTheDocument(); expect(screen.getByText('3 of 3 correct')).toBeInTheDocument()
})
it('shows honest empty definitions and attempts without a fake publish action', async () => {
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [], attempts: [] } })
  render(<SitovPronunciationPretestStaff {...props()} />)
  await screen.findByText(sitovPretestStaffCopy('en').noDefinitions)
  expect(screen.getByText(sitovPretestStaffCopy('en').noResults)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: sitovPretestEditorCopy('en').save })).toBeDisabled()
  expect(screen.getByLabelText(sitovPretestEditorCopy('en').json)).toHaveValue('')
  expect(screen.getByRole('button', { name: sitovPretestEditorCopy('en').import })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Publish this pretest' })).toBeDisabled()
  expect(publishSitovPronunciationPretest).not.toHaveBeenCalled()
  expect(getSitovPronunciationPretestPublication).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /activate|approve/i })).not.toBeInTheDocument()
  expect(saveSitovPronunciationPretestDraft).not.toHaveBeenCalled()
})
it('shows no fabricated score for a saved in-progress attempt', async () => {
  const { correctOptionId: ignoredKey, privateEvidence: ignoredEvidence, ...firstTask } = task(0)
  void ignoredKey; void ignoredEvidence
  const ongoing = { ...completed().attempt, status: 'in_progress' as const, answers: { 'sitov.q0': 'sitov.a' }, answeredCount: 1 }
  const tasks = [firstTask, { ...firstTask, id: 'sitov.q1' }, { ...firstTask, id: 'sitov.q2' }]
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [definition()], attempts: [{ attempt: ongoing, tasks }] } })
  render(<SitovPronunciationPretestStaff {...props()} />)
  await screen.findByText('1 of 3 answered')
  expect(screen.getByText('In progress')).toBeInTheDocument(); expect(screen.queryByText(/of 3 correct/)).not.toBeInTheDocument()
})
it('makes an empty level selection truthful without requesting arbitrary text IDs', () => {
  render(<SitovPronunciationPretestStaff {...props()} targets={[]} />)
  expect(screen.getByText('No texts in this selection.')).toBeInTheDocument()
  expect(getSitovPronunciationPretestStaff).not.toHaveBeenCalled()
})
it('offers Retry after a connection failure and never displays raw exceptions', async () => {
  jest.mocked(getSitovPronunciationPretestStaff).mockRejectedValueOnce(new Error('PRIVATE_STACK'))
  const { container } = render(<SitovPronunciationPretestStaff {...props()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Reload' }))
  await screen.findByRole('heading', { name: 'Mein Frühstück' })
  expect(container.textContent).not.toContain('PRIVATE_STACK'); expect(getSitovPronunciationPretestStaff).toHaveBeenCalledTimes(2)
})
it('discards a late response after rapid target selection', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof getSitovPronunciationPretestStaff>>) => void
  jest.mocked(getSitovPronunciationPretestStaff).mockReturnValueOnce(new Promise(callback => { resolve = callback }))
  jest.mocked(getSitovPronunciationPretestStaff).mockResolvedValue({ ok: true, data: { definitions: [definition(second)], attempts: [] } })
  render(<SitovPronunciationPretestStaff {...props()} targets={[...props().targets, { textId: second, level: 'A1.1', title: 'Am Abend', textVersion: version }]} />)
  fireEvent.change(screen.getByLabelText('Text'), { target: { value: second } })
  await screen.findByRole('heading', { name: 'Am Abend' })
  await act(async () => { resolve({ ok: true, data: { definitions: [definition()], attempts: [completed()] } }) })
  expect(screen.queryByText('3 of 3 correct')).not.toBeInTheDocument(); expect(screen.getByText('No saved attempts yet.')).toBeInTheDocument()
})
it('retires the previous student and account request on prop scope change', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof getSitovPronunciationPretestStaff>>) => void
  jest.mocked(getSitovPronunciationPretestStaff).mockReturnValueOnce(new Promise(callback => { resolve = callback }))
  const view = render(<SitovPronunciationPretestStaff {...props()} />)
  view.rerender(<SitovPronunciationPretestStaff {...props()} studentId={actor} accountId={id} />)
  await screen.findByRole('heading', { name: 'Mein Frühstück' })
  await act(async () => { resolve({ ok: true, data: { definitions: [definition()], attempts: [completed()] } }) })
  expect(screen.queryByText('3 of 3 correct')).not.toBeInTheDocument()
  expect(getSitovPronunciationPretestStaff).toHaveBeenLastCalledWith({ textId: id, studentId: actor })
})
it('opens Help with Enter and preserves native preview disclosures under Reduced Motion', async () => {
  const media = jest.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: true, media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn() }))
  try {
    const user = userEvent.setup(); render(<SitovPronunciationPretestStaff {...props()} />)
    await screen.findByRole('heading', { name: 'Mein Frühstück' })
    const help = screen.getAllByRole('button', { name: 'Help' })[0]; help.focus(); await user.keyboard('{Enter}')
    expect(help).toHaveAttribute('aria-expanded', 'true'); expect(screen.getByRole('region', { name: 'Help' })).toBeInTheDocument()
    const summary = screen.getByText('Was passt zu Satz 1?').closest('summary')!
    fireEvent.click(summary)
    await waitFor(() => expect(summary.parentElement).toHaveAttribute('open'))
  } finally { media.mockRestore() }
})
