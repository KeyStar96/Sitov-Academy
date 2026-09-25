#!/usr/bin/env node
/** Phase 1 visual QA. Requires the LOCAL phase1-visual-fixture and an app built against it. */
const { chromium } = require('playwright')
const AxeBuilder = require('@axe-core/playwright').default
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const stage = process.argv[2] || 'after'
if (!['before', 'after'].includes(stage)) throw new Error('Use before or after')
const output = path.resolve(__dirname, '../docs/master-4/phase-1-bilder')
const base = 'http://localhost:3000'
const fixture = 'http://127.0.0.1:54321'
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const user = {
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'demo@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
}
const expires = Math.floor(Date.now() / 1000) + 3600
const session = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: expires })}.local-fixture-only`,
  refresh_token: 'local-fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user,
}
const screens = [
  ['buttons', '/en/dashboard/level/A1.1/vocabulary/train', 'vocabulary', 'flashcard'],
  ['article', '/en/dashboard/level/A1.1/vocabulary/train', 'vocabulary', 'typed'],
  ['assessment', '/en/dashboard/level/A1.1/vocabulary/assess?lesson=Lektion%201', 'assessment', 'flashcard'],
  ['pending', '/en/dashboard', 'pending', 'flashcard'],
]
const screenshots = []
const checks = []

async function contextFor(browser, theme, viewport, authenticated = true) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1,
    isMobile: viewport.width < 640, hasTouch: viewport.width < 640, reducedMotion: 'reduce', colorScheme: theme })
  if (authenticated) await context.addCookies([{ name: 'sb-sitov-auth-token', value: `base64-${b64(session)}`,
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }])
  await context.addInitScript(value => { localStorage.setItem('theme', value); localStorage.setItem('academy-contrast', 'standard') }, theme)
  await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  return context
}

async function visit(page, pathname) {
  const response = await page.goto(base + pathname, { waitUntil: 'networkidle', timeout: 90000 })
  await page.locator('h1:visible').first().waitFor({ state: 'visible' })
  await page.waitForTimeout(1500)
  if (response.status() !== 200 || (await page.locator('body').innerText()).includes('Application error')) throw new Error(`Failed page: ${pathname}`)
  return response
}

async function inspect(page, name, theme, device) {
  // Complete axe results: no node, rule, severity or tag exclusions.
  const result = await new AxeBuilder({ page }).analyze()
  checks.push({ name, theme, device, url: page.url(), violations: result.violations, incomplete: result.incomplete,
    passes: result.passes.length, inapplicable: result.inapplicable.length })
  console.log(`${name} ${theme} ${device}: ${result.violations.length} axe violations`)
}

async function main() {
  fs.mkdirSync(output, { recursive: true })
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' })
  try {
    for (const theme of ['light', 'dark']) for (const [device, viewport] of [
      ['desktop', { width: 1440, height: 1000 }], ['handy', { width: 390, height: 844 }],
    ]) {
      const context = await contextFor(browser, theme, viewport)
      const page = await context.newPage()
      for (const [name, pathname, scenario, mode] of screens) {
        await fetch(`${fixture}/fixture?scenario=${scenario}`)
        await context.addInitScript(value => localStorage.setItem('sitov_vocab_study_mode', value), mode)
        const response = await visit(page, pathname)
        if (page.url().includes('/login')) throw new Error(`Fixture session failed: ${name}`)
        if (name === 'buttons' || name === 'assessment') await page.getByRole('button', { name: 'Reveal the answer', exact: true }).click()
        if (stage === 'after') {
          if (name === 'article') await page.getByText('Include the article:', { exact: false }).waitFor()
          if (name === 'pending') await page.getByRole('heading', { name: 'Waiting for access', exact: true }).waitFor()
          await inspect(page, name, theme, device)
        }
        if (theme === 'light') {
          const file = `${stage}-${name}-${device}.png`
          await page.screenshot({ path: path.join(output, file), fullPage: true, animations: 'disabled' })
          screenshots.push({ file, path: pathname, status: response.status(), viewport,
            width: await page.evaluate(() => document.documentElement.scrollWidth),
            height: await page.evaluate(() => document.documentElement.scrollHeight),
            sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') })
        }
      }
      await context.close()
    }
    if (stage === 'after') for (const theme of ['light', 'dark']) {
      const context = await contextFor(browser, theme, { width: 1440, height: 1000 }, false)
      const page = await context.newPage()
      for (const [name, pathname] of [
        ['public-home', '/de'], ['registration', '/de/registration'], ['cancellation', '/de/cancellation'],
        ['signup-sent', '/en/login?status=signup_email_sent'], ['email-confirmed', '/en/login?status=confirm_success'],
      ]) {
        await visit(page, pathname)
        await inspect(page, name, theme, 'desktop')
      }
      await context.close()
      const signedIn = await contextFor(browser, theme, { width: 1440, height: 1000 })
      await fetch(`${fixture}/fixture?scenario=pending`)
      const confirmedHome = await signedIn.newPage()
      await visit(confirmedHome, '/en/dashboard?status=confirm_success')
      await confirmedHome.getByRole('status').filter({ hasText: 'Your email address is confirmed' }).waitFor()
      await inspect(confirmedHome, 'email-confirmed-home', theme, 'desktop')
      await signedIn.close()
    }
  } finally {
    await browser.close()
    fs.writeFileSync(path.join(output, `${stage}-screenshots.json`), `${JSON.stringify(screenshots, null, 2)}\n`)
    fs.writeFileSync(path.join(output, `${stage}-axe.json`), `${JSON.stringify(checks, null, 2)}\n`)
  }
  if (checks.some(check => check.violations.length > 0)) process.exitCode = 1
}
main().catch(error => { console.error(error); process.exitCode = 1 })
