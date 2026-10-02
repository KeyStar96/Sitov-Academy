/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn((path: string) => { throw new Error(path) }) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/profile-person', () => ({ resolveVerifiedPerson: jest.fn() }))
jest.mock('@/lib/daily-quest-server', () => ({ resolveDailyQuestLoginTarget: jest.fn() }))

import { headers } from 'next/headers'
import { login } from '@/app/actions/auth'
import { rateLimit } from '@/lib/ratelimit'
import { createClient } from '@/utils/supabase/server'
import { resolveDailyQuestLoginTarget } from '@/lib/daily-quest-server'

const signInWithPassword = jest.fn()
const single = jest.fn()
const client = { auth: { signInWithPassword }, from: jest.fn(() => ({ select: jest.fn(() => ({ eq: jest.fn(() => ({ single })) })) })) }
const form = (next?: string) => {
  const data = new FormData()
  data.set('email', 'student@example.test'); data.set('password', 'a-valid-password'); data.set('lang', 'de')
  if (next) data.set('next', next)
  return data
}
const oldProxy = process.env.TRUSTED_PROXY_HOPS
beforeEach(() => {
  jest.clearAllMocks(); process.env.TRUSTED_PROXY_HOPS = '1'
  jest.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '198.51.100.10, 10.0.0.1' }) as never)
  jest.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 1, limit: 10, reset: Date.now() })
  jest.mocked(createClient).mockResolvedValue(client as never)
  signInWithPassword.mockResolvedValue({ data: { user: { id: 'verified-student' } }, error: null })
  single.mockResolvedValue({ data: { ui_language: 'ru' }, error: null })
  jest.mocked(resolveDailyQuestLoginTarget).mockImplementation(async input => input.nextPath)
})
afterAll(() => { if (oldProxy === undefined) delete process.env.TRUSTED_PROXY_HOPS; else process.env.TRUSTED_PROXY_HOPS = oldProxy })

it('uses the profile UI language and the verified Auth user for the daily switch', async () => {
  jest.mocked(resolveDailyQuestLoginTarget).mockResolvedValue('/ru/dashboard/daily-quest')
  await expect(login(form())).rejects.toThrow('/ru/dashboard/daily-quest')
  expect(resolveDailyQuestLoginTarget).toHaveBeenCalledWith({ supabase: client, userId: 'verified-student', lang: 'ru', nextPath: '/ru/dashboard' })
})

it('accepts the later-login dashboard outcome without forcing the quest again', async () => {
  await expect(login(form())).rejects.toThrow('/ru/dashboard')
})

it('passes a validated learning deep link through the switch unchanged', async () => {
  const next = '/ru/dashboard/level/A1.1/path?lesson=4#task'
  await expect(login(form(next))).rejects.toThrow(next)
  expect(resolveDailyQuestLoginTarget).toHaveBeenCalledWith(expect.objectContaining({ nextPath: next }))
})

it.each(['https://external.test', '//external.test', '/\\external.test', '/\n/external.test'])('rejects redirect bypass %s', async next => {
  await expect(login(form(next))).rejects.toThrow('/ru/dashboard')
  expect(resolveDailyQuestLoginTarget).toHaveBeenCalledWith(expect.objectContaining({ nextPath: '/ru/dashboard' }))
})

it('falls back to the form language when profile language is unknown', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  single.mockResolvedValue({ data: { ui_language: 'unknown' }, error: null })
  try { await expect(login(form())).rejects.toThrow('/de/dashboard') }
  finally { log.mockRestore() }
  expect(resolveDailyQuestLoginTarget).toHaveBeenCalledWith(expect.objectContaining({ lang: 'de', nextPath: '/de/dashboard' }))
})

it('never invokes the daily switch after failed authentication', async () => {
  signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'invalid_credentials' } })
  await expect(login(form())).rejects.toThrow('/de/login?status=login_failed')
  expect(resolveDailyQuestLoginTarget).not.toHaveBeenCalled()
})

it('keeps the validated destination available after a failed login attempt', async () => {
  expect.assertions(4)
  const next = '/ru/dashboard/level/A1.1/path?lesson=4#task'
  signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: 'invalid_credentials' } })
  try { await login(form(next)) }
  catch (error) {
    const target = new URL((error as Error).message, 'https://example.test')
    expect(target.pathname).toBe('/de/login')
    expect(target.searchParams.get('status')).toBe('login_failed')
    expect(target.searchParams.get('next')).toBe(next)
  }
  expect(resolveDailyQuestLoginTarget).not.toHaveBeenCalled()
})
