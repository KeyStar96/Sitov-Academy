/** @jest-environment node */
jest.mock('@/app/actions/learning-checkpoints', () => ({ saveLearningCheckpoint: jest.fn() }))
import { POST } from '@/app/api/learning-checkpoints/route'
import { saveLearningCheckpoint } from '@/app/actions/learning-checkpoints'
const learnerId = '00000000-0000-4000-8000-000000000001'
const body = { kind: 'videos', level: 'A1.1', state: { progress: {} }, revision: 0, learnerId }
const request = (data: unknown = body, origin = 'https://www.sitov-academy.com') => new Request('https://www.sitov-academy.com/api/learning-checkpoints', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
beforeEach(() => jest.clearAllMocks())
it('authenticates through the same account action and does not cache lifecycle save responses', async () => {
  jest.mocked(saveLearningCheckpoint).mockResolvedValue({ ok: true, learnerId, checkpoint: { state: {}, revision: 1, updatedAt: 'now' } })
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(saveLearningCheckpoint).toHaveBeenCalledWith('videos','A1.1',body.state,0,learnerId)
})
it('rejects cross-origin and unsupported checkpoint writes before database mutation', async () => {
  expect((await POST(request(body,'https://untrusted.example'))).status).toBe(403)
  expect((await POST(request({ ...body, kind: 'exercises' }))).status).toBe(400)
  expect(saveLearningCheckpoint).not.toHaveBeenCalled()
})
it('surfaces account switches and concurrent device conflicts', async () => {
  jest.mocked(saveLearningCheckpoint).mockResolvedValueOnce({ ok: false, error: 'unauthorized' }).mockResolvedValueOnce({ ok: false, error: 'conflict', checkpoint: null })
  expect((await POST(request())).status).toBe(403)
  expect((await POST(request())).status).toBe(409)
})
