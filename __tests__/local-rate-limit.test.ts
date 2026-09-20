/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/utils/supabase/admin', () => ({ createAdminClient: jest.fn() }))
import { createAdminClient } from '@/utils/supabase/admin'
import { parseWindowToMs, rateLimit } from '@/lib/ratelimit'

const rpc = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createAdminClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createAdminClient>)
})
it('uses an opaque key and returns the atomic database result', async () => {
  rpc.mockResolvedValue({ data: [{ success: true, remaining: 2, reset_at: '2026-09-13T14:00:00Z' }], error: null })
  expect(await rateLimit('login:127.0.0.1', 3, '60 m')).toEqual({ success: true, remaining: 2, limit: 3, reset: Date.parse('2026-09-13T14:00:00Z') })
  expect(rpc).toHaveBeenCalledWith('consume_rate_limit', { p_key: expect.stringMatching(/^[a-f0-9]{64}$/), p_limit: 3, p_window_seconds: 3600 })
  expect(JSON.stringify(rpc.mock.calls)).not.toContain('127.0.0.1')
})
it.each([null, {}, { success: null, remaining: 0, reset_at: '2026-09-13' }, { success: true, remaining: -1, reset_at: '2026-09-13' }, { success: true, remaining: 2, reset_at: null }, { success: true, remaining: 2, reset_at: 'invalid' }])('fails closed for a malformed RPC row %j', async row => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    rpc.mockResolvedValue({ data: [row], error: null })
    const result = await rateLimit('login:test', 3)
    expect(result.success).toBe(false)
    expect(result.remaining).toBe(0)
    expect(Number.isFinite(result.reset)).toBe(true)
  } finally { log.mockRestore() }
})
it('rejects invalid thresholds and duration before RPC', async () => {
  for (const limit of [0, NaN, Infinity, 1.5, 10001]) await expect(rateLimit('x', limit)).rejects.toThrow()
  for (const window of ['0 s', '25 h', '99999999999999999999 h', '-1 m']) expect(() => parseWindowToMs(window)).toThrow()
  expect(rpc).not.toHaveBeenCalled()
})
it('fails closed for a structured database failure', async () => {
 const log = jest.spyOn(console, 'error').mockImplementation(() => {})
 try {
  rpc.mockResolvedValue({ data: { error: 'retry_required', message: 'Reload and retry the request.', sqlstate: '40P01' }, error: null })
  expect(await rateLimit('login:test', 3)).toEqual({ success: false, limit: 3, remaining: 0, reset: expect.any(Number) })
 } finally { log.mockRestore() }
})
