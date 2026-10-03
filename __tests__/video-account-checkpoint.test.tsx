import { act, renderHook, waitFor } from '@testing-library/react'
import { useVideoCheckpoint } from '@/lib/useVideoCheckpoint'
import { loadLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import type { LearningCheckpoint } from '@/lib/learning-checkpoints'
jest.mock('@/app/actions/learning-checkpoints', () => ({ loadLearningCheckpoint: jest.fn() }))
const learner = '00000000-0000-4000-8000-000000000001', video = '00000000-0000-4000-8000-000000000002'
const ids = [video], fetchMock = jest.fn(), originalFetch = global.fetch
const checkpoint = (t: number, revision: number): LearningCheckpoint => ({ state: { progress: { [video]: { t, d: 100, at: 10 } } }, revision, updatedAt: '2026-10-03T09:00:00Z' })
beforeEach(() => { jest.clearAllMocks(); global.fetch = fetchMock; localStorage.clear() })
afterEach(() => { global.fetch = originalFetch })
it('restores on a fresh device entirely from account data and discards an unowned browser key', () => {
  localStorage.setItem('sitov:media-progress', JSON.stringify({ [video]: { t: 90, d: 100, at: 99 } }))
  const view = renderHook(() => useVideoCheckpoint('A1.1', checkpoint(25, 3), learner, ids))
  expect(view.result.current.progress[video].t).toBe(25)
  expect(localStorage.getItem('sitov:media-progress')).toBeNull()
})
it('saves exact paused positions with the current account revision and reloads on device two', async () => {
  let saved: LearningCheckpoint | null = null
  fetchMock.mockImplementation(async (_url, options) => {
    const body = JSON.parse(options.body)
    saved = { state: body.state, revision: body.revision + 1, updatedAt: 'now' }
    return { json: async () => ({ ok: true, learnerId: learner, checkpoint: saved }) }
  })
  const first = renderHook(() => useVideoCheckpoint('A1.1', null, learner, ids))
  act(() => first.result.current.track(video, 24.7, 100, true))
  await waitFor(() => expect(saved?.revision).toBe(1))
  first.unmount()
  const second = renderHook(() => useVideoCheckpoint('A1.1', saved, learner, ids))
  expect(second.result.current.progress[video].t).toBe(24.7)
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).learnerId).toBe(learner)
  expect(fetchMock.mock.calls[0][1].keepalive).toBe(true)
})
it('serializes writes, including movement during a pending save', async () => {
  let resolve!: (value: unknown) => void
  fetchMock.mockImplementationOnce(() => new Promise(r => { resolve = r })).mockResolvedValueOnce({ json: async () => ({ ok: true, learnerId: learner, checkpoint: checkpoint(30, 2) }) })
  const view = renderHook(() => useVideoCheckpoint('A1.1', null, learner, ids))
  act(() => { view.result.current.track(video, 20, 100); view.result.current.track(video, 30, 100, true) })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { resolve({ json: async () => ({ ok: true, learnerId: learner, checkpoint: checkpoint(20, 1) }) }); await view.result.current.flush() })
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).revision).toBe(1)
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).state.progress[video].t).toBe(30)
})
it('blocks stale device writes, shows a conflict and restores the current checkpoint', async () => {
  fetchMock.mockResolvedValue({ json: async () => ({ ok: false, error: 'conflict', checkpoint: checkpoint(60, 3) }) })
  jest.mocked(loadLearningCheckpoint).mockResolvedValue({ ok: true, learnerId: learner, checkpoint: checkpoint(60, 3) })
  const view = renderHook(() => useVideoCheckpoint('A1.1', checkpoint(10, 1), learner, ids))
  act(() => view.result.current.track(video, 20, 100))
  await waitFor(() => expect(view.result.current.issue).toBe('conflict'))
  act(() => view.result.current.track(video, 25, 100))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { await view.result.current.reload() })
  expect(view.result.current.progress[video].t).toBe(60)
  expect(loadLearningCheckpoint).toHaveBeenCalledWith('videos','A1.1',learner)
})
it('exposes a network save failure and retries the same revision without local persistence', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ json: async () => ({ ok: true, learnerId: learner, checkpoint: checkpoint(20,1) }) })
  const view = renderHook(() => useVideoCheckpoint('A1.1', null, learner, ids))
  act(() => view.result.current.track(video, 20, 100))
  await waitFor(() => expect(view.result.current.issue).toBe('unavailable'))
  await act(async () => { await view.result.current.retry() })
  expect(view.result.current.issue).toBeNull()
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).revision).toBe(0)
  expect(localStorage.getItem('sitov:media-progress')).toBeNull()
})
