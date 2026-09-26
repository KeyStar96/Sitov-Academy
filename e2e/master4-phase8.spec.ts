import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const directory = process.env.PHASE8_SESSION_DIR
if (!directory) throw new Error('Set PHASE8_SESSION_DIR to the isolated PostgreSQL harness output')
const learner = JSON.parse(readFileSync(join(directory, 'learner-session.json'), 'utf8'))
const teacher = JSON.parse(readFileSync(join(directory, 'session.json'), 'utf8'))
const level = '/en/dashboard/level/A1.1'
const routes = {
  learner: ['/en/dashboard', '/en/dashboard/profile', '/en/dashboard/calendar', '/en/dashboard/lessons', level,
    ...['vocabulary', 'vocabulary/lessons', 'vocabulary/train', 'vocabulary/assess', 'path', 'exercises', 'pronunciation', 'videos', 'media', 'videos/00000000-0000-4000-8000-000000000099'].map(path => `${level}/${path}`)],
  teacher: ['/en/admin', ...['analytics', 'registrations', 'finance', 'submissions', 'courses', 'students', 'feedback',
    'content', 'content/media', 'content/vocabulary', 'content/exercises', 'content/pronunciation', 'content/videos',
    'invoices', 'bookings'].map(path => `/en/admin/${path}`),
    ...['overview', 'vocabulary', 'path', 'pronunciation', 'activity', 'notes'].map(tab => `/en/admin/students/${learner.user.id}?tab=${tab}`)],
}

for (const role of ['learner', 'teacher'] as const) {
  const session = role === 'learner' ? learner : teacher
  test.describe(role, () => {
    test.use({ storageState: {
      cookies: [{ name: 'sb-sitov-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
        domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax', expires: -1 }], origins: [],
    } })
    for (const theme of ['light', 'dark']) for (const route of routes[role]) {
      test(`${theme} ${route}`, async ({ page }, info) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await page.addInitScript(value => {
          localStorage.setItem('theme', value)
          localStorage.setItem('academy-contrast', 'standard')
          localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
        }, theme)
        await page.route('**/*', request => ['127.0.0.1', 'localhost'].includes(new URL(request.request().url()).hostname) ? request.continue() : request.abort())
        const errors: string[] = []
        page.on('pageerror', error => errors.push(error.message))
        const response = await page.goto(route, { waitUntil: 'networkidle' })
        expect(response?.status()).toBe(200)
        expect(page.url()).not.toContain('/login')
        await expect(page.locator('main').first()).toBeVisible()
        await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
        if (route.endsWith('/exercises') && role === 'learner') await expect(page).toHaveURL(`${level}/path`)
        if (route === `${level}/path`) await expect(page.getByTestId('path-map')).toBeVisible()
        expect(errors).toEqual([])
        const audit = await new AxeBuilder({ page }).analyze()
        if (audit.violations.length) await info.attach('axe-violations', { body: JSON.stringify(audit.violations), contentType: 'application/json' })
        expect(audit.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([])
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
        if (route === '/en/dashboard') {
          await page.getByText('How does the learning path work?', { exact: true }).first().click()
          await expect(page.getByText(/A score of at least 80%/).first()).toBeVisible()
        }
      })
    }
  })
}
