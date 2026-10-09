import { fireEvent, render, screen } from '@testing-library/react'
import { randomUUID } from 'crypto'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { getSitovPronunciationPretests, startSitovPronunciationPretest } from '@/app/actions/sitov-pronunciation-pretest'
import type { SitovPronunciationPretestCatalogEntry as Entry } from '@/lib/sitov-pronunciation-pretest-contract'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
jest.unmock('lucide-react')
jest.unmock('framer-motion')
const refresh = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
jest.mock('@/app/actions/pronunciation', () => ({ getPronunciationPrompts: jest.fn() }))
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({ getSitovPronunciationPretests: jest.fn(), startSitovPronunciationPretest: jest.fn(), getSitovPronunciationPretestAttempt: jest.fn(), saveSitovPronunciationPretestAnswers: jest.fn(), submitSitovPronunciationPretest: jest.fn() }))
jest.mock('@/components/dashboard/useLearningNew', () => ({ useLearningNew: () => ({ mark: jest.fn(), isNew: () => false }) }))
jest.mock('@/components/audio/SitovPronunciationScene', () => ({ __esModule: true, default: () => <div aria-hidden="true" /> }))
jest.mock('@/components/audio/Mailbox', () => ({ __esModule: true, default: () => <div>Historical conversations</div> }))
jest.mock('@/components/audio/AudioRecorder', () => ({ __esModule: true, default: ({ promptId, textVersion }: { promptId: string; textVersion: string }) => <div data-testid="recorder" data-text={promptId} data-version={textVersion} /> }))
jest.mock('@/components/audio/KaraokeText', () => ({ __esModule: true, default: ({ text }: { text: string }) => <p>{text}</p> }))
jest.mock('@/components/exercises/SolutionAudioButton', () => ({ __esModule: true, default: ({ reference }: { reference: { kind: string; id: string; part: string } }) => <div data-testid="private-reference">{JSON.stringify(reference)}</div> }))
jest.mock('@/lib/audio/usePronunciationCheckpoint', () => ({ usePronunciationCheckpoint: ({ prompts }: { prompts: PronunciationPrompt[] }) => ({ reading: { promptId: prompts[0]?.id, listened: false, referencePosition: 0 }, notice: null, restoreVersion: 0, initialProgress: 0, referenceProgress: jest.fn(), select: jest.fn() }) }))
const id = '00000000-0000-4000-8000-000000000001', attemptId = '00000000-0000-4000-8000-000000000002'
const version = 'a'.repeat(64), testVersion = 'b'.repeat(64), time = '2026-10-08T21:00:00Z'
function entry(): Entry { return { textId: id, unitId: id, level: 'A1.1', title: 'Mein Frühstück', focus: null, kind: 'regular', textVersion: version, testVersion, status: 'available', lockedReason: null, attempt: null, proof: null, target: 'pretest' } }
function passed(): Entry { return { ...entry(), status: 'passed', target: 'pronunciation', attempt: { id: attemptId, textId: id, textVersion: version, testVersion, status: 'passed', revision: 1, startedAt: time, updatedAt: time, questionIds: ['sitov.q0', 'sitov.q1', 'sitov.q2'], answers: { 'sitov.q0': 'sitov.o0', 'sitov.q1': 'sitov.o0', 'sitov.q2': 'sitov.o0' }, answeredCount: 3, totalCount: 3 }, proof: { id, textId: id, textVersion: version, testVersion, passedAttemptId: attemptId, passedAt: time, compatibilityId: null } } }
const prompt: PronunciationPrompt = { id, unitId: id, title: 'Mein Frühstück', lesson: '1', cefrLevel: 'A1', sentenceDe: 'Dieser Volltext bleibt vor dem Vortest verborgen.', focus: null, audioUrl: 'storage://private/teacher-reference', sortOrder: 0 }
beforeAll(() => { window.PointerEvent = MouseEvent as typeof PointerEvent; Object.defineProperty(global.crypto, 'randomUUID', { value: randomUUID, configurable: true }) })
beforeEach(() => { jest.clearAllMocks() })

import { sitovLearningTargetCopy } from '@/lib/learning/sitov-learning-target-i18n'
import type { SitovPronunciationPretestActionResult } from '@/lib/sitov-pronunciation-pretest-contract'
const otherId = '00000000-0000-4000-8000-000000000003'
function view(catalog: SitovPronunciationPretestActionResult<Entry[]>, focusTextId?: string | string[], lang = 'en') {
  return render(<PronunciationStudio prompts={[prompt]} conversations={[]} level="A1.1" lang={lang} translations={{}} catalog={catalog} focusTextId={focusTextId} learnerId={id} />)
}
function expectBlocked() {
  expect(screen.queryByTestId('recorder')).not.toBeInTheDocument()
  expect(screen.queryByTestId('private-reference')).not.toBeInTheDocument()
  expect(screen.queryByText(prompt.sentenceDe)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Start pretest' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Open speaking text' })).not.toBeInTheDocument()
  expect(startSitovPronunciationPretest).not.toHaveBeenCalled()
  expect(getPronunciationPrompts).not.toHaveBeenCalled()
}
it.each(['', 'malformed', otherId, [id, otherId]])('blocks explicit invalid target %p without a fallback', raw => {
  view({ ok: true, data: [passed()] }, raw)
  expect(screen.getByRole('alert')).toHaveTextContent(sitovLearningTargetCopy('en').unavailable)
  expectBlocked()
})
it.each(['de', 'en', 'ru', 'uk', 'tr'])('uses existing target error and real refresh in %s', lang => {
  view({ ok: true, data: [passed()] }, '', lang)
  const copy = sitovLearningTargetCopy(lang)
  expect(screen.getByRole('alert')).toHaveTextContent(copy.unavailable)
  fireEvent.click(screen.getByRole('button', { name: copy.retry }))
  expect(refresh).toHaveBeenCalledTimes(1)
  expectBlocked()
})
it.each([
  { ok: true, data: [{ ...entry(), level: 'A1.2' }] },
  { ok: true, data: [] },
  { ok: true, data: [{ ...entry(), status: 'locked', target: null, lockedReason: 'authoring_not_ready' }] },
  { ok: false, error: 'not_found', retryable: false },
] as SitovPronunciationPretestActionResult<Entry[]>[])('blocks missing, foreign and denied target catalogs', catalog => {
  view(catalog, id)
  expect(screen.getByRole('alert')).toHaveTextContent(sitovLearningTargetCopy('en').unavailable)
  expectBlocked()
})
it.each([
  { ok: false, error: 'retryable_failure', retryable: true },
  { ok: true, data: [{ invalid: true }] },
])('reports defective catalog transport honestly', catalog => {
  view(catalog as SitovPronunciationPretestActionResult<Entry[]>, id)
  expect(screen.getByRole('alert')).toHaveTextContent(sitovLearningTargetCopy('en').retryable)
  expectBlocked()
  fireEvent.click(screen.getByRole('button', { name: sitovLearningTargetCopy('en').retry }))
  expect(refresh).toHaveBeenCalledTimes(1)
})
it('keeps no-target selection and historical mailbox available', () => {
  view({ ok: true, data: [entry()] })
  expect(screen.getByRole('button', { name: 'Start pretest' })).toBeEnabled()
  fireEvent.click(screen.getByRole('tab', { name: 'Mailbox' }))
  expect(screen.getByText('Historical conversations')).toBeVisible()
})
it('keeps mailbox reachable for an unavailable explicit target', () => {
  view({ ok: true, data: [passed()] }, '')
  fireEvent.click(screen.getByRole('tab', { name: 'Mailbox' }))
  expect(screen.getByText('Historical conversations')).toBeVisible()
  expectBlocked()
})
it('rechecks only the valid exact passed target before mounting its recorder', async () => {
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: true, data: [passed()] })
  jest.mocked(getPronunciationPrompts).mockResolvedValue([prompt])
  view({ ok: true, data: [passed()] }, id)
  expect(await screen.findByTestId('recorder')).toHaveAttribute('data-text', id)
  expect(getSitovPronunciationPretests).toHaveBeenCalledWith('A1.1')
  expect(getPronunciationPrompts).toHaveBeenCalledTimes(1)
  expect(startSitovPronunciationPretest).not.toHaveBeenCalled()
})
it('blocks a pass revoked during live recheck without choosing another target', async () => {
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: true, data: [{ ...entry(), textId: otherId }] })
  view({ ok: true, data: [passed()] }, id)
  expect(await screen.findByRole('alert')).toHaveTextContent(sitovLearningTargetCopy('en').unavailable)
  expectBlocked()
})
it('unmounts the exact recorder when refreshed catalog removes its target', async () => {
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: true, data: [passed()] })
  jest.mocked(getPronunciationPrompts).mockResolvedValue([prompt])
  const mounted = view({ ok: true, data: [passed()] }, id)
  await screen.findByTestId('recorder')
  mounted.rerender(<PronunciationStudio prompts={[prompt]} conversations={[]} level="A1.1" lang="en" translations={{}} catalog={{ ok: true, data: [{ ...entry(), textId: otherId }] }} focusTextId={id} learnerId={id} />)
  expect(screen.getByRole('alert')).toHaveTextContent(sitovLearningTargetCopy('en').unavailable)
  expect(screen.queryByTestId('recorder')).not.toBeInTheDocument()
})
