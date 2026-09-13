/** @jest-environment node */
import type { CookieOptions } from '@supabase/ssr'
const mockServerClient = jest.fn()
jest.mock('@supabase/ssr', () => ({ createServerClient: (...args: unknown[]) => mockServerClient(...args) }))
jest.mock('@/lib/supabase-env', () => ({
  SUPABASE_COOKIE_NAME: 'sb-sitov-auth-token',
  readSupabaseServerConfig: () => ({ url: 'http://kong:8000', anonKey: 'test-local-key' }),
}))
import { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

it('preserves every refreshed cookie and uses the same secure cookie name over internal HTTP', async () => {
  const previousNodeEnv = process.env.NODE_ENV
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true, writable: true })
  try {
    mockServerClient.mockImplementation((_url: string, _key: string, config: {
      cookieOptions: { name: string; secure: boolean }
      cookies: { getAll: () => { name: string; value: string }[]; setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => void }
    }) => ({ auth: { getUser: async () => {
      expect(config.cookieOptions).toEqual({ name: 'sb-sitov-auth-token', secure: true })
      config.cookies.setAll([{ name: 'sb-sitov-auth-token.1', value: '', options: { maxAge: 0, path: '/', secure: true } }])
      config.cookies.setAll([{ name: 'sb-sitov-auth-token.0', value: 'refreshed', options: { httpOnly: false, sameSite: 'lax', path: '/', secure: true } }])
      expect(config.cookies.getAll()).toContainEqual({ name: 'sb-sitov-auth-token.0', value: 'refreshed' })
      return { data: { user: { id: 'signed-in' } } }
    } } }))
    const { supabaseResponse, user } = await updateSession(new NextRequest('https://school.example/ru/dashboard'))
    expect(user?.id).toBe('signed-in')
    expect(supabaseResponse.cookies.get('sb-sitov-auth-token.1')).toMatchObject({ maxAge: 0, value: '', secure: true })
    expect(supabaseResponse.cookies.get('sb-sitov-auth-token.0')).toMatchObject({ value: 'refreshed', secure: true, sameSite: 'lax' })
  } finally { Object.defineProperty(process.env, 'NODE_ENV', { value: previousNodeEnv, configurable: true, writable: true }) }
})
