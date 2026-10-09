import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PronunciationStudio from '@/components/audio/PronunciationStudio'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { getPronunciationPrompts } from '@/app/actions/pronunciation'
import { getSitovPronunciationPretests } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPronunciationPretestCopy } from '@/lib/sitov-pronunciation-pretest-i18n'
import { sitovPronunciationPretestCatalogSchema, type SitovPronunciationPretestCatalogEntry as Entry } from '@/lib/sitov-pronunciation-pretest-contract'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
import type { PronunciationCheckpointSnapshot } from '@/lib/pronunciation-checkpoint'

jest.unmock('lucide-react')
jest.mock('@/app/actions/pronunciation', () => ({ getPronunciationPrompts: jest.fn() }))
jest.mock('@/app/actions/sitov-pronunciation-pretest', () => ({
  getSitovPronunciationPretests: jest.fn(), startSitovPronunciationPretest: jest.fn(),
  getSitovPronunciationPretestAttempt: jest.fn(), saveSitovPronunciationPretestAnswers: jest.fn(), submitSitovPronunciationPretest: jest.fn(),
}))
jest.mock('@/components/audio/AudioRecorder', () => ({ __esModule: true, default: ({ promptId, textVersion }: { promptId: string; textVersion: string }) => <div data-testid="recorder" data-prompt={promptId} data-version={textVersion} /> }))
jest.mock('@/components/audio/Mailbox', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/dashboard/useLearningNew', () => ({ useLearningNew: () => ({ mark: jest.fn(), isNew: () => false }) }))
jest.mock('@/lib/audio/neural-client', () => ({ prefetchNeuralAudio: () => () => {} }))
jest.mock('@/app/actions/learning-checkpoints', () => ({ loadLearningCheckpoint: jest.fn() }))
// Playback is the boundary: prepared reference timing reports an exact word index,
// independently of the fraction used for the progress strip and account checkpoint.
jest.mock('@/components/exercises/SolutionAudioButton', () => ({
  __esModule: true,
  default: jest.fn(({ onWordChange, onProgress }: { onWordChange?: (index: number | null) => void; onProgress?: (fraction: number | null) => void }) =>
    <button onClick={() => { onProgress?.(0.9); onWordChange?.(1) }}>Vorbereitete Referenz abspielen</button>),
}))

const id = '00000000-0000-4000-8000-000000000001'
const secondId = '00000000-0000-4000-8000-000000000002'
const attemptId = '00000000-0000-4000-8000-000000000003'
const version = 'a'.repeat(64), testVersion = 'b'.repeat(64), time = '2026-10-08T21:00:00Z'
const prompt: PronunciationPrompt = {
  id, unitId: id, title: 'Mein Weg', lesson: '1', cefrLevel: 'A1', sentenceDe: 'Die Straßenverkehrsordnung ändert sich.',
  focus: null, audioUrl: null, sortOrder: 0,
}
function available(text: PronunciationPrompt, level: Entry['level']): Entry {
  return { textId: text.id, unitId: text.unitId, level, title: text.title!, focus: null, kind: 'regular',
    textVersion: version, testVersion, status: 'available', lockedReason: null, attempt: null, proof: null, target: 'pretest' }
}
function passed(text: PronunciationPrompt, level: Entry['level']): Entry {
  return { ...available(text, level), status: 'passed', target: 'pronunciation',
    attempt: { id: attemptId, textId: text.id, textVersion: version, testVersion, status: 'passed', revision: 1,
      startedAt: time, updatedAt: time, questionIds: ['sitov.q0', 'sitov.q1', 'sitov.q2'],
      answers: { 'sitov.q0': 'sitov.o0', 'sitov.q1': 'sitov.o0', 'sitov.q2': 'sitov.o0' }, answeredCount: 3, totalCount: 3 },
    proof: { id, textId: text.id, textVersion: version, testVersion, passedAttemptId: attemptId, passedAt: time, compatibilityId: null } }
}
const originalFetch = global.fetch
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(getPronunciationPrompts).mockReset()
  jest.mocked(getSitovPronunciationPretests).mockReset()
  global.fetch = jest.fn(async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    return { json: async () => ({ ok: true, checkpoint: { state: body.state, revision: body.revision + 1, updatedAt: time }, learnerId: 'learner' }) } as Response
  })
})
afterEach(() => { global.fetch = originalFetch })

async function open(texts = [prompt], level: Entry['level'] = 'A1.2', checkpoint?: PronunciationCheckpointSnapshot, focusTextId?: string) {
  const rows = texts.map(text => passed(text, level))
  expect(sitovPronunciationPretestCatalogSchema.safeParse(rows).success).toBe(true)
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue({ ok: true, data: rows })
  jest.mocked(getPronunciationPrompts).mockResolvedValue(texts)
  const view = render(<PronunciationStudio prompts={texts} conversations={[]} level={level} lang="de" translations={{}}
    catalog={{ ok: true, data: rows }} learnerId="learner" checkpoint={checkpoint} focusTextId={focusTextId} />)
  expect(SolutionAudioButton).not.toHaveBeenCalled()
  expect(screen.queryByTestId('pronunciation-reading-text')).not.toBeInTheDocument()
  if (!focusTextId) fireEvent.click(screen.getByRole('button', { name: sitovPronunciationPretestCopy('de').open }))
  await screen.findByTestId('pronunciation-reading-text')
  expect(getSitovPronunciationPretests).toHaveBeenCalledWith(level)
  expect(getPronunciationPrompts).toHaveBeenCalledWith(level)
  expect(jest.mocked(getSitovPronunciationPretests).mock.invocationCallOrder[0])
    .toBeLessThan(jest.mocked(getPronunciationPrompts).mock.invocationCallOrder[0])
  return view
}

it('connects prepared Qwen reference word timing and the exact course level after a current pass recheck', async () => {
  await open()
  expect(jest.mocked(SolutionAudioButton).mock.calls[0][0]).toMatchObject({ level: 'A1.2', language: 'de', reference: { kind: 'reading_text', id, part: 'reference' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Vorbereitete Referenz abspielen' })))
  const text = screen.getByTestId('pronunciation-reading-text')
  expect(text).toHaveAttribute('lang', 'de'); expect(text).toHaveAttribute('translate', 'no')
  expect(text.querySelector('[data-state="current"]')).toHaveTextContent('Straßenverkehrsordnung')
  await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  const [url, options] = jest.mocked(global.fetch).mock.calls[0]
  expect(url).toBe('/api/learning-checkpoints')
  expect(options).toMatchObject({ method: 'POST', cache: 'no-store', keepalive: true })
  expect(JSON.parse(String(options?.body))).toMatchObject({ kind: 'pronunciation', level: 'A1.2', learnerId: 'learner', revision: 0,
    state: { promptId: id, listened: true, referencePosition: 0.9 } })
})

it.each([
  ['legacy generated reference', 'https://storage.test/audio_cache/legacy.mp3'],
  ['authored teacher recording', 'https://storage.test/teacher/recording.mp3'],
])('routes a %s through its exact canonical reference without a client URL or voice selector', async (_kind, audioUrl) => {
  const text = { ...prompt, audioUrl }
  await open([text], 'A2.1')
  const props = jest.mocked(SolutionAudioButton).mock.calls.at(-1)![0]
  expect(props).toMatchObject({ reference: { kind: 'reading_text', id, part: 'reference' }, level: 'A2.1', language: 'de', text: text.sentenceDe })
  expect(props).not.toHaveProperty('audioUrl')
  expect(screen.getByTestId('recorder')).toHaveAttribute('data-version', version)
  expect(screen.queryByRole('combobox', { name: 'Stimme' })).not.toBeInTheDocument()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Vorbereitete Referenz abspielen' })))
  expect(screen.getByTestId('pronunciation-reading-text').querySelector('[data-state="current"]')).toHaveTextContent('Straßenverkehrsordnung')
})

it('rechecks the next text and keeps its own canonical reference rather than the teacher text reference', async () => {
  const second = { ...prompt, id: secondId, title: 'Nächster Text' }
  await open([{ ...prompt, title: 'Lehrertext', audioUrl: 'https://storage.test/teacher/recording.mp3' }, second], 'B1.1')
  fireEvent.click(screen.getByRole('button', { name: /Nächster Text/ }))
  await waitFor(() => expect(jest.mocked(SolutionAudioButton).mock.calls.at(-1)?.[0]).toMatchObject({
    reference: { kind: 'reading_text', id: secondId, part: 'reference' }, level: 'B1.1', language: 'de', initialProgress: 0,
  }))
  expect(getSitovPronunciationPretests).toHaveBeenCalledTimes(2)
  expect(getPronunciationPrompts).toHaveBeenCalledTimes(2)
  expect(screen.getByTestId('recorder')).toHaveAttribute('data-prompt', secondId)
})

it('rehydrates the account reading and passes its saved position only after that exact text is rechecked', async () => {
  const savedPrompt = { ...prompt, id: secondId, title: 'Gespeicherter Text' }
  await open([prompt, savedPrompt], 'A1.1', { state: { promptId: secondId, listened: true, referencePosition: 0.35 }, revision: 2, updatedAt: time }, secondId)
  expect(screen.getByTestId('recorder')).toHaveAttribute('data-prompt', secondId)
  expect(jest.mocked(SolutionAudioButton).mock.calls.at(-1)?.[0]).toMatchObject({
    reference: { kind: 'reading_text', id: secondId, part: 'reference' }, initialProgress: 0.35,
  })
  expect(global.fetch).not.toHaveBeenCalled()
})

it('keeps private body, reference and recording absent without a passed proof', () => {
  render(<PronunciationStudio prompts={[prompt]} conversations={[]} level="A1.1" lang="de" translations={{}}
    catalog={{ ok: true, data: [available(prompt, 'A1.1')] }} learnerId="learner" />)
  expect(screen.getByRole('button', { name: sitovPronunciationPretestCopy('de').start })).toBeEnabled()
  expect(screen.queryByTestId('pronunciation-reading-text')).not.toBeInTheDocument()
  expect(screen.queryByText(prompt.sentenceDe)).not.toBeInTheDocument()
  expect(SolutionAudioButton).not.toHaveBeenCalled()
  expect(screen.queryByTestId('recorder')).not.toBeInTheDocument()
  expect(getPronunciationPrompts).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
})

it.each(['revoked', 'stale'] as const)('does not request private body/audio when the current recheck is %s', async reason => {
  jest.mocked(getSitovPronunciationPretests).mockResolvedValue(reason === 'revoked'
    ? { ok: false, error: 'authentication_required', retryable: false }
    : { ok: true, data: [available(prompt, 'A1.1')] })
  render(<PronunciationStudio prompts={[prompt]} conversations={[]} level="A1.1" lang="de" translations={{}}
    catalog={{ ok: true, data: [passed(prompt, 'A1.1')] }} learnerId="learner" />)
  fireEvent.click(screen.getByRole('button', { name: sitovPronunciationPretestCopy('de').open }))
  await screen.findByRole('alert')
  expect(getPronunciationPrompts).not.toHaveBeenCalled()
  expect(screen.queryByText(prompt.sentenceDe)).not.toBeInTheDocument()
  expect(SolutionAudioButton).not.toHaveBeenCalled()
  expect(screen.queryByTestId('recorder')).not.toBeInTheDocument()
  expect(global.fetch).not.toHaveBeenCalled()
})
