/** Production adapter source in a real browser; all network responses are local
 * Playwright fixtures. No request reaches Meta or a production database. */
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const compile = (path: string) => ts.transpileModule(readFileSync(resolve(process.cwd(), path), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText
const consent = compile('lib/analytics/consent.ts')
const analytics = compile('lib/analytics/meta-pixel.ts')
const adapter = `
window.sitovTestConsent = (() => { const exports = {}; ${consent}; return exports; })();
window.sitovTestAnalytics = (() => {
  const exports = {};
  const require = () => window.sitovTestConsent;
  ${analytics};
  return exports;
})();`

declare global {
  interface Window {
    sitovTestConsent: typeof import('../lib/analytics/consent')
    sitovTestAnalytics: typeof import('../lib/analytics/meta-pixel')
  }
}

test.beforeEach(async ({ context }) => {
  await context.route('http://sitov-privacy.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body><p>Sitov Academy privacy fixture</p></body></html>' }))
  await context.addInitScript(adapter)
})

test('sends sanitized public events with no HTTP referrer and no private-route events', async ({ page, context }) => {
  const requests: { url: string; headers: Record<string, string> }[] = []
  await context.route('https://www.facebook.com/**', async route => {
    requests.push({ url: route.request().url(), headers: await route.request().allHeaders() })
    await route.fulfill({ status: 204 })
  })
  await page.goto('http://sitov-privacy.test/de/registration?email=secret%40example.test&token=private#answer')
  await page.evaluate(() => window.sitovTestAnalytics.trackMetaEvent('Lead'))
  expect(requests).toHaveLength(0)
  await page.evaluate(() => {
    window.sitovTestConsent.saveConsent(true)
    window.sitovTestAnalytics.trackMetaEvent('Lead', { currency: 'EUR', value: 0, email: 'secret@example.test' })
  })
  await expect.poll(() => requests.length).toBe(1)
  const url = new URL(requests[0].url)
  expect(url.searchParams.get('dl')).toBe('http://sitov-privacy.test/de/registration')
  expect(url.searchParams.get('rl')).toBe('')
  expect(url.searchParams.get('ev')).toBe('Lead')
  expect(requests[0].headers.referer).toBeUndefined()
  expect(requests[0].url).not.toMatch(/secret|token|private|answer|email/)
  for (const path of ['/de/dashboard', '/de/admin', '/de/login', '/de/register', '/de/reset-password']) {
    await page.goto(`http://sitov-privacy.test${path}?token=private`)
    await page.evaluate(() => window.sitovTestAnalytics.trackMetaEvent('PageView'))
  }
  expect(requests).toHaveLength(1)
})

test('native cross-tab consent changes revoke and clear stale decisions', async ({ context }) => {
  const first = await context.newPage()
  const second = await context.newPage()
  await first.goto('http://sitov-privacy.test/de')
  await second.goto('http://sitov-privacy.test/de/registration')
  await second.evaluate(() => window.sitovTestConsent.subscribeConsent(() => {
    if (window.sitovTestConsent.consentStatus() !== 'granted') window.sitovTestAnalytics.revokeMetaPixel()
  }))
  await first.evaluate(() => window.sitovTestConsent.saveConsent(true))
  await expect.poll(() => second.evaluate(() => window.sitovTestConsent.consentStatus())).toBe('granted')
  await first.evaluate(() => window.sitovTestConsent.saveConsent(false))
  await expect.poll(() => second.evaluate(() => window.sitovTestConsent.consentStatus())).toBe('denied')
  await first.evaluate(() => window.localStorage.removeItem(window.sitovTestConsent.CONSENT_STORAGE_KEY))
  await expect.poll(() => second.evaluate(() => window.sitovTestConsent.consentStatus())).toBe('unset')
  await expect(second.locator('html')).toHaveAttribute('data-consent', 'open')
})
