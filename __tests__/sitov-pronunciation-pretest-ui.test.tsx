import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { randomUUID } from 'crypto'
import SitovPronunciationPretest, { type SitovPronunciationPretestProps } from '@/components/audio/SitovPronunciationPretest'
import LernkastenGuide from '@/components/vocabulary/LernkastenGuide'
import { createVocabularyTranslator } from '@/lib/vocabulary-i18n'
import { sitovPronunciationPretestCopy } from '@/lib/sitov-pronunciation-pretest-i18n'
import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'
import type { SitovPronunciationPretestAttemptWithTasks } from '@/lib/sitov-pronunciation-pretest-contract'

jest.unmock('lucide-react')
jest.unmock('framer-motion')
beforeAll(() => { Object.defineProperty(global.crypto, 'randomUUID', { value: randomUUID, configurable: true }) })
const textId = '00000000-0000-4000-8000-000000000001'
const attemptId = '00000000-0000-4000-8000-000000000002'
const version = 'a'.repeat(64), testVersion = 'b'.repeat(64)
function data(): SitovPronunciationPretestAttemptWithTasks {
  return { attempt: { id: attemptId, textId, textVersion: version, testVersion, status: 'in_progress', revision: 0,
    startedAt: '2026-10-08T21:00:00Z', updatedAt: '2026-10-08T21:00:00Z', questionIds: [0, 1, 2].map(i => `sitov.q${i}`), answers: {}, answeredCount: 0, totalCount: 3 },
  tasks: [0, 1, 2].map(i => ({ id: `sitov.q${i}`, competencyId: 'sitov.words', kind: 'single_choice', promptDe: `Wähle Antwort ${i + 1}.`, fragmentDe: null,
    options: [0, 1, 2].map(n => ({ id: `sitov.o${n}`, textDe: `Antwort ${n + 1}` })) })) }
}
function props(): SitovPronunciationPretestProps {
  return { lang: 'en', entry: { textId, unitId: textId, level: 'A1.1', title: 'Mein Frühstück', focus: null, kind: 'regular', textVersion: version, testVersion,
    status: 'available', lockedReason: null, attempt: null, proof: null, target: 'pretest' },
    onStart: jest.fn().mockResolvedValue({ ok: true, data: data() }), onResume: jest.fn().mockResolvedValue({ ok: true, data: data() }),
    onSave: jest.fn().mockImplementation(async input => ({ ok: true, data: { ...data().attempt, answers: input.answers, answeredCount: Object.keys(input.answers).length, revision: input.revision + 1 } })),
    onSubmit: jest.fn(), onOpenText: jest.fn(), onRefresh: jest.fn() }
}
it.each(['de', 'en', 'ru', 'uk', 'tr'])('keeps %s UI separate from German content and Help initially closed', lang => {
  const p = props(); render(<SitovPronunciationPretest {...p} lang={lang} />)
  const copy = sitovPronunciationPretestCopy(lang)
  expect(screen.getByRole('button', { name: copy.start })).toBeEnabled()
  expect(screen.getByRole('heading', { name: 'Mein Frühstück' })).toHaveAttribute('lang', 'de')
  expect(screen.getByRole('button', { name: copy.help })).toHaveAttribute('aria-expanded', 'false')
  expect(screen.queryByRole('button', { name: copy.open })).not.toBeInTheDocument()
})
it('saves selected IDs/revision and keeps the next question hidden until the server acknowledges', async () => {
  const p = props(); render(<SitovPronunciationPretest {...p} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start pretest' }))
  await screen.findByText('Wähle Antwort 1.')
  expect(screen.getByRole('button', { name: 'Save and continue' })).toBeDisabled()
  fireEvent.click(screen.getByRole('radio', { name: 'Antwort 2' }))
  expect(screen.getByText('Selection not saved yet')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
  await screen.findByText('Wähle Antwort 2.')
  expect(p.onSave).toHaveBeenCalledWith(expect.objectContaining({ attemptId, revision: 0, answers: { 'sitov.q0': 'sitov.o1' } }))
  expect(p.onSubmit).not.toHaveBeenCalled(); expect(p.onOpenText).not.toHaveBeenCalled()
})
it('retries a lost start response with the exact same idempotency request', async () => {
  const p = props(); (p.onStart as jest.Mock).mockRejectedValueOnce(new Error('offline'))
  render(<SitovPronunciationPretest {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Start pretest' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  await screen.findByText('Wähle Antwort 1.')
  expect((p.onStart as jest.Mock).mock.calls[0][0]).toEqual((p.onStart as jest.Mock).mock.calls[1][0])
})
it('retains unsaved selection on a lost save and retries the same payload before advancing', async () => {
  const p = props(); (p.onSave as jest.Mock).mockRejectedValueOnce(new Error('offline'))
  render(<SitovPronunciationPretest {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Start pretest' }))
  await screen.findByText('Wähle Antwort 1.'); fireEvent.click(screen.getByRole('radio', { name: 'Antwort 3' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
  await screen.findByText('Wähle Antwort 2.')
  expect((p.onSave as jest.Mock).mock.calls[0][0]).toEqual((p.onSave as jest.Mock).mock.calls[1][0])
  expect(p.onOpenText).not.toHaveBeenCalled()
})
it('resumes saved answers at the first unanswered question', async () => {
  const p = props(); const resumed = data(); resumed.attempt.answers = { 'sitov.q0': 'sitov.o2' }; resumed.attempt.answeredCount = 1
  p.entry = { ...p.entry, status: 'in_progress', target: 'resume_pretest', attempt: resumed.attempt }
  ;(p.onResume as jest.Mock).mockResolvedValue({ ok: true, data: resumed })
  render(<SitovPronunciationPretest {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Resume pretest' }))
  await screen.findByText('Wähle Antwort 2.'); expect(p.onResume).toHaveBeenCalledWith(attemptId)
})
it('rejects a different text version without rendering tasks or opening a text', async () => {
  const p = props(); const stale = data(); stale.attempt.textVersion = 'c'.repeat(64)
  ;(p.onStart as jest.Mock).mockResolvedValue({ ok: true, data: stale })
  render(<SitovPronunciationPretest {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Start pretest' }))
  await screen.findByRole('button', { name: 'Reload text list' })
  expect(screen.queryByRole('radio')).not.toBeInTheDocument(); expect(p.onOpenText).not.toHaveBeenCalled()
})
it('keeps authoring-locked metadata findable without a start action', () => {
  const p = props(); p.entry = { ...p.entry, status: 'locked', lockedReason: 'authoring_not_ready', target: null, testVersion: null }
  render(<SitovPronunciationPretest {...p} />)
  expect(screen.getByText('Mein Frühstück')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Start pretest' })).not.toBeInTheDocument()
})
it.each([true, false])('renders only the server terminal result (passed=%s)', async passed => {
  const p = props(); const open = data(); const answers = Object.fromEntries(open.attempt.questionIds.map(id => [id, 'sitov.o0']))
  const done = { ...open.attempt, status: passed ? 'passed' : 'failed', answers, answeredCount: 3 }
  const proof = { id: textId, textId, textVersion: version, testVersion, passedAttemptId: attemptId, passedAt: '2026-10-08T21:00:00Z', compatibilityId: null }
  const result = { attemptId, textId, textVersion: version, testVersion, passed, correct: passed ? 3 : 1, total: 3,
    competencies: [{ id: 'sitov.words', correct: passed ? 3 : 1, total: 3, required: 2, met: passed }], failedCompetencyIds: passed ? [] : ['sitov.words'],
    learningLinks: passed ? [] : [{ kind: 'vocabulary', level: 'A1.1', targetId: 'sitov.words', href: '/de/dashboard/level/A1.1/vocabulary' }], proof: passed ? proof : null }
  p.entry = { ...p.entry, status: 'in_progress', target: 'resume_pretest', attempt: open.attempt }
  ;(p.onResume as jest.Mock).mockResolvedValue({ ok: true, data: { attempt: done, result } })
  render(<SitovPronunciationPretest {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Resume pretest' }))
  await screen.findByRole('heading', { name: passed ? 'Pretest passed' : 'Not passed yet' })
  if (passed) expect(screen.getByRole('button', { name: 'Open speaking text' })).toBeEnabled()
  else { expect(screen.getByRole('link', { name: 'Practise words' })).toHaveAttribute('href', '/en/dashboard/level/A1.1/vocabulary'); expect(screen.queryByRole('button', { name: 'Open speaking text' })).not.toBeInTheDocument() }
  expect(p.onOpenText).not.toHaveBeenCalled()
})
it('submits the resumed revision and waits for the persisted pass before offering the exact text', async () => {
  const p = props(); const resumed = data()
  resumed.attempt.answers = Object.fromEntries(resumed.attempt.questionIds.map(id => [id, 'sitov.o0']))
  resumed.attempt.answeredCount = 3; resumed.attempt.revision = 4
  p.entry = { ...p.entry, status: 'in_progress', target: 'resume_pretest', attempt: resumed.attempt }
  ;(p.onResume as jest.Mock).mockResolvedValue({ ok: true, data: resumed })
  ;(p.onSubmit as jest.Mock).mockResolvedValue({ ok: true, data: {
    attempt: { ...resumed.attempt, status: 'passed', revision: 5 },
    result: { attemptId, textId, textVersion: version, testVersion, passed: true, correct: 3, total: 3,
      competencies: [{ id: 'sitov.words', correct: 3, total: 3, required: 2, met: true }], failedCompetencyIds: [], learningLinks: [],
      proof: { id: textId, textId, textVersion: version, testVersion, passedAttemptId: attemptId, passedAt: '2026-10-08T21:00:00Z', compatibilityId: null } },
  } })
  render(<SitovPronunciationPretest {...p} />); fireEvent.click(screen.getByRole('button', { name: 'Resume pretest' }))
  await screen.findByText('Wähle Antwort 3.')
  expect(screen.queryByRole('button', { name: 'Open speaking text' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
  await screen.findByRole('button', { name: 'Open speaking text' })
  expect(p.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ attemptId, revision: 4, answers: resumed.attempt.answers }))
  ;(p.onOpenText as jest.Mock).mockResolvedValue({ ok: true, data: null })
  fireEvent.click(screen.getByRole('button', { name: 'Open speaking text' }))
  await waitFor(() => expect(p.onOpenText).toHaveBeenCalledWith(textId))
})
it('opens short vocabulary Help with its topic and retains the original learning rules', async () => {
  render(<LernkastenGuide t={createVocabularyTranslator({ box_guide_title: 'How does your learning box work?' })} />)
  fireEvent.click(screen.getByRole('button', { name: sitovTrainerHelpCopy('en').label }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Your vocabulary learning box' })).toBeInTheDocument())
})
