import { expect, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_COOKIE_NAME } from '../../lib/supabase-env'

/** Obtain a real test-user session and use the application's SSR cookie codec.
 * Phase-5 UI tests do not repeatedly exercise the login form's shared IP bucket.
 * Every following browser request still runs through real Auth, SSR and RLS. */
export async function authenticateBrowser(page: Page, { api, key, email, password }: {
  api: string; key: string; email: string; password: string
}) {
  const app = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:3100')
  const auth = createServerClient(api, key, {
    cookieOptions: { name: SUPABASE_COOKIE_NAME, secure: app.protocol === 'https:' },
    cookies: {
      getAll: async () => (await page.context().cookies(app.origin)).map(({ name, value }) => ({ name, value })),
      setAll: async cookies => {
        await page.context().addCookies(cookies.map(({ name, value, options }) => ({
          name, value, domain: app.hostname, path: options.path || '/',
          secure: options.secure ?? false, httpOnly: options.httpOnly ?? false,
          sameSite: options.sameSite === 'strict' || options.sameSite === true ? 'Strict' : options.sameSite === 'none' ? 'None' : 'Lax',
          ...(typeof options.maxAge === 'number' ? { expires: Math.floor(Date.now() / 1000) + options.maxAge } : {}),
        })))
      },
    },
  })
  const login = await auth.auth.signInWithPassword({ email, password })
  expect(login.error).toBeNull()
  expect(login.data.session).toBeTruthy()
}
