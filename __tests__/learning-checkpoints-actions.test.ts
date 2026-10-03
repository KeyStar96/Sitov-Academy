/** @jest-environment node */
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
import { createClient } from '@/utils/supabase/server'
import { loadLearningCheckpoint, saveLearningCheckpoint } from '@/app/actions/learning-checkpoints'
const learner = '00000000-0000-4000-8000-000000000001'
const rpc = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: learner } }, error: null }) }, rpc } as never)
})
it('loads account state and refuses a stale mounted session belonging to another account', async () => {
  rpc.mockResolvedValue({ data: { checkpoint: null }, error: null })
  expect(await loadLearningCheckpoint('exercises', 'A1.1')).toEqual({ ok: true, checkpoint: null, learnerId: learner })
  expect(await saveLearningCheckpoint('exercises', 'A1.1', { index: 2 }, 0, 'different-user')).toEqual({ ok: false, error: 'unauthorized' })
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('passes only UI checkpoint data to the authenticated CAS RPC and exposes conflicts', async () => {
  const checkpoint = { state: { index: 3 }, revision: 4, updatedAt: '2026-10-03T09:00:00Z' }
  rpc.mockResolvedValue({ data: { error: 'conflict', checkpoint }, error: null })
  expect(await saveLearningCheckpoint('exercises', 'A1.1', { index: 2 }, 2, learner)).toEqual({ ok: false, error: 'conflict', checkpoint })
  expect(rpc).toHaveBeenCalledWith('sitov_learning_checkpoint', { p_action: 'save', p_kind: 'exercises', p_level: 'A1.1', p_state: { index: 2 }, p_expected_revision: 2 })
})
it('does not invent a successful load on malformed or failed database responses', async () => {
  rpc.mockResolvedValueOnce({ data: {}, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
  expect(await loadLearningCheckpoint('videos', 'A1.1')).toEqual({ ok: false, error: 'unavailable' })
  expect(await loadLearningCheckpoint('videos', 'A1.1')).toEqual({ ok: false, error: 'unavailable' })
})
it('rejects invalid targets and oversized snapshots before mutation', async () => {
  expect(await saveLearningCheckpoint('exercises', 'other', {}, 0)).toEqual({ ok: false, error: 'invalid' })
  expect(await saveLearningCheckpoint('exercises', 'A1.1', { large: 'x'.repeat(262145) }, 0)).toEqual({ ok: false, error: 'invalid' })
  expect(rpc).not.toHaveBeenCalled()
})
