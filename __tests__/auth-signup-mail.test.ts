/** @jest-environment node */
jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/headers', () => ({ headers: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn((url: string) => { throw new Error(url) }) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/ratelimit', () => ({ rateLimit: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/site-url', () => ({
  getOutboundSiteUrl: jest.fn(async () => 'https://example.test'),
  buildSiteUrl: jest.fn(() => 'https://example.test/auth/confirm?lang=de'),
}))
import { headers } from 'next/headers'
import { rateLimit } from '@/lib/ratelimit'
import { createClient } from '@/utils/supabase/server'
import { signup } from '@/app/actions/auth'

const form = () => {
  const data = new FormData()
  data.set('display_name', 'Anna Müller')
  data.set('email', 'neu@example.test')
  data.set('password', 'password-test')
  data.set('native_language', 'ru')
  data.set('lang', 'de')
  return data
}

/** signUp gibt {data,error} zurück; nur der Fehlerpfad wird hier variiert. */
function mockSignUp(result: { data: unknown; error: unknown }) {
  jest.mocked(createClient).mockResolvedValue({ auth: { signUp: jest.fn().mockResolvedValue(result) } } as never)
}

const previousHops = process.env.TRUSTED_PROXY_HOPS
beforeEach(() => {
  jest.clearAllMocks()
  process.env.TRUSTED_PROXY_HOPS = '1'
  jest.mocked(headers).mockResolvedValue(new Headers({ 'x-forwarded-for': '198.51.100.23, 10.0.2.5' }) as never)
  jest.mocked(rateLimit).mockResolvedValue({ success: true, remaining: 4, limit: 5, reset: Date.now() })
})
afterAll(() => {
  if (previousHops === undefined) delete process.env.TRUSTED_PROXY_HOPS
  else process.env.TRUSTED_PROXY_HOPS = previousHops
})

it('routet reine Mail-Versandfehler zum handlungsweisenden Status statt in die Sackgasse', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    // Der Zugang wird angelegt, nur der SMTP-Versand scheitert.
    mockSignUp({ data: { user: null }, error: { code: 'unexpected_failure', message: 'Error sending confirmation email' } })
    await expect(signup(form())).rejects.toThrow('/de/login?status=signup_email_failed')
  } finally { log.mockRestore() }
})

it('meldet einen bestehenden Zugang weiterhin neutral als „E-Mail gesendet"', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    mockSignUp({ data: { user: null }, error: { code: 'user_already_exists', message: 'User already registered' } })
    await expect(signup(form())).rejects.toThrow('/de/login?status=signup_email_sent')
  } finally { log.mockRestore() }
})

it('behält den generischen Fehler für alle übrigen Registrierungsfehler', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    mockSignUp({ data: { user: null }, error: { code: 'weak_password', message: 'Password is too weak' } })
    await expect(signup(form())).rejects.toThrow('/de/register?status=signup_failed')
  } finally { log.mockRestore() }
})
