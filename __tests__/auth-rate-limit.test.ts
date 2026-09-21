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
  const keys = jest.mocked(rateLimit).mock.calls.map(call => call[0])
  // Two independent buckets per attempt: the forge-proof client IP and the
  // target account. A forged leading hop must change neither.
  expect(keys.filter(key => !key.includes(':account:'))).toEqual(['auth:login:198.51.100.23','auth:login:198.51.100.23','auth:login:203.0.113.9'])
  expect(keys.filter(key => key.includes(':account:'))).toEqual(['auth:login:account:test@example.test','auth:login:account:test@example.test','auth:login:account:test@example.test'])
})

it('the account bucket is independent of the source address and ignores case and padding', async () => {
  jest.mocked(rateLimit).mockResolvedValue({ success: false, remaining: 0, limit: 10, reset: Date.now() })
  const shaped = (email: string) => { const data = form(); data.set('email', email); return data }
  for (const [chain, email] of [['198.51.100.23, 10.0.2.5', 'test@example.test'], ['203.0.113.9, 10.0.2.5', '  TEST@Example.TEST  ']] as const) {
    jest.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': chain }) as never)
    await expect(login(shaped(email))).rejects.toThrow('login_rate_limited')
  }
  const account = jest.mocked(rateLimit).mock.calls.map(call => call[0]).filter(key => key.includes(':account:'))
  // Same mailbox from two addresses and two spellings must share ONE bucket,
  // otherwise distributed credential stuffing simply fans out across buckets.
  expect(new Set(account)).toEqual(new Set(['auth:login:account:test@example.test']))
  expect(account).toHaveLength(2)
})
