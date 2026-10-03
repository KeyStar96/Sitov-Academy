import { act, renderHook } from '@testing-library/react'
import { usePronunciationCheckpoint } from '@/lib/audio/usePronunciationCheckpoint'
import { loadLearningCheckpoint, saveLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import type { LearningCheckpoint, LearningCheckpointResult } from '@/lib/learning-checkpoints'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'

jest.mock('@/app/actions/learning-checkpoints', () => ({ loadLearningCheckpoint: jest.fn(), saveLearningCheckpoint: jest.fn() }))
const owner = 'learner-1'
const prompts: PronunciationPrompt[] = ['first', 'second'].map(id => ({ id, unitId: id, cefrLevel: 'A1', lesson: '1', sentenceDe: 'Ich lerne Deutsch.', audioUrl: null, focus: null, sortOrder: 0 }))
let stored: LearningCheckpoint | null
const originalFetch = global.fetch
beforeEach(() => {
  jest.clearAllMocks()
  stored = null
  jest.mocked(loadLearningCheckpoint).mockImplementation(async () => ({ ok: true, checkpoint: stored, learnerId: owner }))
  jest.mocked(saveLearningCheckpoint).mockImplementation(async (_kind, _level, state, expectedRevision, expectedOwner) => {
    if (expectedOwner !== owner) return { ok: false, error: 'unauthorized' }
    if (expectedRevision !== (stored?.revision ?? 0)) {
      if (stored && JSON.stringify(state) === JSON.stringify(stored.state)) return { ok: true, checkpoint: stored, learnerId: owner }
      return { ok: false, error: 'conflict', checkpoint: stored }
    }
    stored = { state, revision: expectedRevision + 1, updatedAt: '2026-10-03T08:00:00Z' }
    return { ok: true, checkpoint: stored, learnerId: owner }
  })
  global.fetch = jest.fn(async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    const result = await saveLearningCheckpoint(body.kind, body.level, body.state, body.revision, body.learnerId)
    return { json: async () => result } as Response
  })
})
afterEach(() => { global.fetch = originalFetch })
const mount = (initial = stored, unavailable = false) => renderHook(() => usePronunciationCheckpoint({ level: 'A1.1', prompts, learnerId: owner, initial, initialUnavailable: unavailable, fallbackPromptId: 'first' }))

it('resumes the saved text, listened stage and paused position on a second device without browser storage', async () => {
  localStorage.clear()
  const phone = mount()
  await act(async () => phone.result.current.select('second'))
  await act(async () => phone.result.current.referenceProgress(0.15))
  await act(async () => { phone.result.current.referenceProgress(0.42); phone.result.current.referenceProgress(null) })
  expect(stored?.state).toEqual({ promptId: 'second', listened: true, referencePosition: 0.42 })
  phone.unmount()
  localStorage.clear()
  const tablet = mount()
  expect(tablet.result.current.reading).toEqual(stored?.state)
  expect(tablet.result.current.initialProgress).toBe(0.42)
  expect(localStorage.length).toBe(0)
  expect(saveLearningCheckpoint).toHaveBeenLastCalledWith('pronunciation', 'A1.1', stored?.state, stored!.revision - 1, owner)
})

it('ignores saved prompts that are no longer in the accessible catalogue', () => {
  stored = { state: { promptId: 'locked-text', listened: true, referencePosition: 0.7 }, revision: 4, updatedAt: 'today' }
  const device = mount()
  expect(device.result.current.reading).toEqual({ promptId: 'first', listened: false, referencePosition: 0 })
  expect(saveLearningCheckpoint).not.toHaveBeenCalled()
})

it('shows a failed save, retains its checkpoint and allows a server retry', async () => {
  jest.mocked(saveLearningCheckpoint).mockResolvedValueOnce({ ok: false, error: 'unavailable' })
  const device = mount()
  await act(async () => device.result.current.select('second'))
  expect(device.result.current.notice).toBe('failed')
  expect(stored).toBeNull()
  await act(async () => device.result.current.retry())
  expect(device.result.current.notice).toBe('saved')
  expect(stored?.state.promptId).toBe('second')
})

it('recovers a committed checkpoint after its transport response was lost', async () => {
  jest.mocked(saveLearningCheckpoint).mockImplementationOnce(async (_kind, _level, state, expectedRevision) => {
    stored = { state, revision: expectedRevision + 1, updatedAt: 'today' }
    throw new Error('connection closed after commit')
  })
  const device = mount()
  await act(async () => device.result.current.select('second'))
  expect(device.result.current.notice).toBe('failed')
  expect(stored?.revision).toBe(1)
  await act(async () => device.result.current.retry())
  expect(device.result.current.notice).toBe('saved')
  expect(device.result.current.reading.promptId).toBe('second')
  expect(stored?.revision).toBe(1)
})

it('hydrates a newer checkpoint after another device saved instead of overwriting it', async () => {
  const first = mount(), second = mount()
  await act(async () => first.result.current.select('second'))
  await act(async () => first.result.current.referenceProgress(0.5))
  await act(async () => second.result.current.referenceProgress(0.1))
  expect(second.result.current.notice).toBe('conflict')
  expect(second.result.current.reading).toEqual(stored?.state)
  expect(second.result.current.initialProgress).toBe(0.5)
  expect(stored?.state.promptId).toBe('second')
})

it('does not overwrite a failed initial server read with a fresh local session', async () => {
  stored = { state: { promptId: 'second', listened: true, referencePosition: 0.7 }, revision: 6, updatedAt: 'today' }
  const device = mount(null, true)
  await act(async () => device.result.current.referenceProgress(0.1))
  expect(saveLearningCheckpoint).not.toHaveBeenCalled()
  await act(async () => device.result.current.retry())
  expect(loadLearningCheckpoint).toHaveBeenCalledWith('pronunciation', 'A1.1', owner)
  expect(device.result.current.reading).toEqual(stored.state)
})

it('serializes fast text selection so stale requests cannot save out of order', async () => {
  let resolve!: (value: LearningCheckpointResult) => void
  jest.mocked(saveLearningCheckpoint).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const device = mount()
  act(() => { device.result.current.select('second'); device.result.current.select('first') })
  expect(saveLearningCheckpoint).toHaveBeenCalledTimes(1)
  stored = { state: { promptId: 'second', listened: false, referencePosition: 0 }, revision: 1, updatedAt: 'today' }
  await act(async () => resolve({ ok: true, checkpoint: stored, learnerId: owner }))
  expect(stored?.state.promptId).toBe('first')
  expect(stored?.revision).toBe(2)
})

it('flushes the latest fractional checkpoint on pagehide using the same keepalive queue', async () => {
  const device = mount()
  await act(async () => device.result.current.referenceProgress(0.15))
  act(() => device.result.current.referenceProgress(0.37))
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  expect(stored?.state.referencePosition).toBe(0.37)
  expect(global.fetch).toHaveBeenLastCalledWith('/api/learning-checkpoints', expect.objectContaining({ keepalive: true, cache: 'no-store' }))
})
