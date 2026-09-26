import { test, type Page } from '@playwright/test'

const USER_ID = '00000000-0000-4000-8000-000000000001'

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')

export async function signInPhase2(page: Page, theme: 'light' | 'dark' = 'light') {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid', app_metadata: { provider: 'email' }, user_metadata: {} }
  const session = { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, aud: 'authenticated', role: 'authenticated', exp: expires })}.local-fixture-only`,
    refresh_token: 'local-fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user }
  const origin = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:3100')
  await page.context().addCookies([{ name: 'sb-sitov-auth-token', value: `base64-${b64(session)}`, domain: origin.hostname, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }])
  await page.addInitScript(value => {
    localStorage.setItem('theme', value)
    localStorage.setItem('academy-contrast', 'standard')
    localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date(Date.now() - 60000).toISOString() }))
  }, theme)
  // R3: nur Loopback — keine CDNs, Schriften oder Dienste von außen.
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
}
