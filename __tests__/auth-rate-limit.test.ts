/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn((url: string) => { throw new Error(url) }) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/profile-person', () => ({ resolveVerifiedPerson: jest.fn() }))
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/ratelimit'
import { createClient } from '@/utils/supabase/server'
import { login } from '@/app/actions/auth'
const form = () => { const data = new FormData(); data.set('email', 'test@example.test'); data.set('password', 'password-test'); data.set('lang', 'de'); return data }
const previousHops = process.env.TRUSTED_PROXY_HOPS
beforeEach(() => { jest.clearAllMocks(); process.env.TRUSTED_PROXY_HOPS = '1'; jest.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '198.51.100.23, 10.0.2.5' }) as never) })
afterAll(() => { if (previousHops === undefined) delete process.env.TRUSTED_PROXY_HOPS; else process.env.TRUSTED_PROXY_HOPS = previousHops })
it.each(['denied', 'throw'] as const)('does not call Auth when the limiter is %s', async mode => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    if (mode === 'throw') jest.mocked(rateLimit).mockRejectedValue(new Error('database unavailable'))
    else jest.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, limit: 10, reset: Date.now() })
    await expect(login(form())).rejects.toThrow('/de/login?status=login_rate_limited')
    expect(createClient).not.toHaveBeenCalled()
  } finally { log.mockRestore() }
})
it('keeps the real client key stable when XFF is forged and separates clients', async () => {
  jest.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, limit: 10, reset: Date.now() })
  for (const chain of ['198.51.100.23, 10.0.2.5', '1.2.3.4, 198.51.100.23, 10.0.2.5', '203.0.113.9, 10.0.2.5']) {
    jest.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': chain }) as never)
    await expect(login(form())).rejects.toThrow('login_rate_limited')
  }
  expect(jest.mocked(rateLimit).mock.calls.map(call => call[0])).toEqual(['auth:login:198.51.100.23','auth:login:198.51.100.23','auth:login:203.0.113.9'])
})
