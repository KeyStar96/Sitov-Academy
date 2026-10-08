import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { randomUUID } from 'crypto'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { getSitovPronunciationPretests, startSitovPronunciationPretest } from '@/app/actions/sitov-pronunciation-pretest'
import type { SitovPronunciationPretestCatalogEntry as Entry } from '@/lib/sitov-pronunciation-pretest-contract'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
jest.unmock('lucide-react')
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
beforeAll(() => { Object.defineProperty(global.crypto, 'randomUUID', { value: randomUUID, configurable: true }) })
beforeEach(() => { jest.clearAllMocks() })
function view(row: Entry, focusTextId?: string) { return render(<PronunciationStudio prompts={[prompt]} conversations={[]} level="A1.1" lang="en" translations={{}} catalog={{ ok: true, data: [row] }} focusTextId={focusTextId} learnerId={id} />) }
it('offers the first individual test before any text is passed, without target body/audio/recording', () => {
  view(entry())
  expect(screen.getByRole('button', { name: 'Start pretest' })).toBeEnabled()
  expect(screen.queryByText(prompt.sentenceDe)).not.toBeInTheDocument()
  expect(screen.queryByTestId('recorder')).not.toBeInTheDocument(); expect(screen.queryByTestId('private-reference')).not.toBeInTheDocument()
})
it('starts a validated sitov_target through the real action port rather than local unlock', async () => {
  jest.mocked(startSitovPronunciationPretest).mockResolvedValue({ ok: true, data: {
    attempt: { ...passed().attempt!, status: 'in_progress', answers: {}, answeredCount: 0 },
    tasks: [0, 1, 2].map(i => ({ id: `sitov.q${i}`, competencyId: 'sitov.words', kind: 'single_choice', promptDe: `Frage ${i + 1}`, fragmentDe: null, options: [0, 1, 2].map(n => ({ id: `sitov.o${n}`, textDe: `Antwort ${n}` })) })),
  } })
  view(entry(), id)
  await screen.findByText('Frage 1')
  expect(startSitovPronunciationPretest).toHaveBeenCalledWith(expect.objectContaining({ textId: id }))
  expect(screen.queryByText(prompt.sentenceDe)).not.toBeInTheDocument()
})
it('rechecks a passed catalogue entry before loading its body and canonical human reference', async () => {
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: true, data: [passed()] })
  jest.mocked(getPronunciationPrompts).mockResolvedValue([prompt])
  view(passed()); fireEvent.click(screen.getByRole('button', { name: 'Open speaking text' }))
  await screen.findByText(prompt.sentenceDe)
  expect(getSitovPronunciationPretests).toHaveBeenCalledWith('A1.1'); expect(getPronunciationPrompts).toHaveBeenCalledWith('A1.1')
  expect(screen.getByTestId('private-reference')).toHaveTextContent(JSON.stringify({ kind: 'reading_text', id, part: 'reference' }))
  expect(screen.getByTestId('recorder')).toHaveAttribute('data-version', version)
})
it('refuses a stale pass without loading a body, while the historical mailbox remains reachable', async () => {
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: true, data: [entry()] })
  view(passed()); fireEvent.click(screen.getByRole('button', { name: 'Open speaking text' }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(getPronunciationPrompts).not.toHaveBeenCalled(); expect(screen.queryByTestId('recorder')).not.toBeInTheDocument()
  const tabs = screen.getAllByRole('tab'); fireEvent.click(tabs[1])
  expect(screen.getByText('Historical conversations')).toBeInTheDocument()
})
