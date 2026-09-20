/** @jest-environment node */
import { NextRequest } from 'next/server'
const mockServerClient = jest.fn()
jest.mock('@supabase/ssr', () => ({ createServerClient: (...args: unknown[]) => mockServerClient(...args) }))
jest.mock('@/lib/supabase-env', () => ({
  SUPABASE_COOKIE_NAME: 'sb-sitov-auth-token',
  readSupabaseServerConfig: () => ({ url: 'http://kong:8000', anonKey: 'test-local-key' }),
}))
import { middleware } from '@/middleware'

let language: string | null, user: { id: string } | null, profileError: object | null
const profile = jest.fn(), eq = jest.fn(), from = jest.fn()
beforeEach(() => {
  jest.clearAllMocks(); language = 'en'; user = { id: 'existing-learner' }; profileError = null
  profile.mockImplementation(async () => ({ data: language === null ? null : { ui_language: language }, error: profileError }))
  eq.mockReturnValue({ maybeSingle: profile })
  from.mockReturnValue({ select: jest.fn().mockReturnValue({ eq }) })
  mockServerClient.mockImplementation((_url, _key, config) => ({
    auth: { getUser: async () => {
      config.cookies.setAll([{ name: 'sb-sitov-auth-token', value: 'refreshed', options: { path: '/', httpOnly: true, sameSite: 'lax' } }])
      return { data: { user } }
    } }, from,
  }))
})
const visit = (path: string, method = 'GET') => middleware(new NextRequest(`https://school.example${path}`, { method }))

it('keeps the public website German but returns an existing learner to English', async () => {
  expect((await visit('/de')).headers.get('location')).toBeNull()
  expect(mockServerClient).not.toHaveBeenCalled()
  const response = await visit('/de/dashboard')
  expect(response.status).toBe(307)
  expect(response.headers.get('location')).toBe('https://school.example/en/dashboard')
  expect(from).toHaveBeenCalledWith('profiles')
  expect(eq).toHaveBeenCalledWith('id', 'existing-learner')
  expect(response.cookies.get('sb-sitov-auth-token')).toMatchObject({ value: 'refreshed', httpOnly: true })
  expect(response.headers.get('cache-control')).toBe('private, no-store')
})
it.each(['en', 'ru', 'uk', 'tr', 'de'])('uses saved %s for deep links and keeps query parameters', async locale => {
  language = locale
  const path = '/en/dashboard/level/A1.1/vocabulary/train?mode=review&lesson=2'
  const response = await visit(path)
  expect(response.headers.get('location')).toBe(locale === 'en' ? null : `https://school.example/${locale}/dashboard/level/A1.1/vocabulary/train?mode=review&lesson=2`)
})
it.each(['/de/login', '/de/register'])('uses the profile when an authenticated visitor opens %s', async path => {
  expect((await visit(path)).headers.get('location')).toBe('https://school.example/en/dashboard')
})
it('also canonicalizes staff pages and paths without a language prefix', async () => {
  language = 'uk'
  expect((await visit('/de/admin/content/media?folder=1')).headers.get('location')).toBe('https://school.example/uk/admin/content/media?folder=1')
  expect((await visit('/dashboard/profile?tab=language')).headers.get('location')).toBe('https://school.example/uk/dashboard/profile?tab=language')
})
it('preserves website language for first registration and anonymous login', async () => {
  user = null
  expect((await visit('/ru/register')).headers.get('location')).toBeNull()
  expect((await visit('/ru/login')).headers.get('location')).toBeNull()
  expect((await visit('/ru/dashboard')).headers.get('location')).toBe('https://school.example/ru/login')
  expect(from).not.toHaveBeenCalled()
})
it('does not redirect a language-saving POST and observes the new preference on navigation', async () => {
  expect((await visit('/de/dashboard/profile', 'POST')).headers.get('location')).toBeNull()
  expect(from).not.toHaveBeenCalled()
  language = 'tr'
  expect((await visit('/de/dashboard/profile')).headers.get('location')).toBe('https://school.example/tr/dashboard/profile')
  expect((await visit('/tr/dashboard/profile')).headers.get('location')).toBeNull()
})
it('does not rewrite email verification or public registration links', async () => {
  for (const path of ['/auth/confirm?lang=de&token_hash=one-time', '/de/registration', '/api/health']) {
    expect((await visit(path)).headers.get('location')).toBeNull()
  }
  expect(mockServerClient).not.toHaveBeenCalled()
})
it.each([null, 'invalid'])('avoids inventing a profile preference when it is %s', async value => {
  language = value
  expect((await visit('/ru/dashboard')).headers.get('location')).toBeNull()
})
it('does not silently render the wrong language when the profile lookup fails', async () => {
  profileError = { message: 'database unavailable' }
  await expect(visit('/de/dashboard')).rejects.toThrow('Interface language could not be loaded')
})
