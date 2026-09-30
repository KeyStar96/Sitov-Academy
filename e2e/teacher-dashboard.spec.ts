import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import de from '../dictionaries/de.json'

const fixture = 'http://127.0.0.1:54331'
const TEACHER = '00000000-0000-4000-8000-000000000002'
const STUDENT = '00000000-0000-4000-8000-000000000100'
const base64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
const t = de.admin
const errors = new WeakMap<Page, string[]>()

async function signIn(page: Page) {
  const expires = Math.floor(Date.now() / 1000) + 3600
  const user = { id: TEACHER, aud: 'authenticated', role: 'authenticated', email: 'teacher@example.invalid', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} }
  const session = { access_token: `${base64({ alg: 'HS256', typ: 'JWT' })}.${base64({ sub: TEACHER, aud: 'authenticated', role: 'authenticated', exp: expires })}.local-fixture-only`, refresh_token: 'local-fixture-only', token_type: 'bearer', expires_in: 3600, expires_at: expires, user }
  await page.context().addCookies([{ name: 'sb-sitov-auth-token', value: `base64-${base64(session)}`, domain: '127.0.0.1', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }])
  await page.addInitScript(() => { localStorage.setItem('theme', 'light'); localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() })) })
  // R3: nur Loopback – keine externen Dienste.
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}
async function screenshot(page: Page, name: string) {
  await mkdir('/tmp/sitov-teacher-dashboard-qa', { recursive: true })
  // caret: 'initial' – Playwright würde sonst Stilattribute ins DOM schreiben.
  await page.screenshot({ path: `/tmp/sitov-teacher-dashboard-qa/${test.info().project.name}-${name}.png`, fullPage: true, caret: 'initial' })
}

test.beforeEach(async ({ page, request }) => {
  await request.get(`${fixture}/__teacher/reset`)
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', error => list.push(error.message))
  page.on('console', message => { if (message.type() === 'error') list.push(message.text()) })
  await signIn(page)
})
test.afterEach(async ({ page }) => { expect(errors.get(page) ?? []).toEqual([]) })

const routes = [
  ['overview', ''], ['new-students', '/new-students'], ['students', '/students'], ['student', `/students/${STUDENT}`], ['student-activity', `/students/${STUDENT}?tab=activity`],
  ['corrections', '/submissions'], ['analytics', '/analytics'], ['courses', '/courses'], ['cancellations', '/courses/cancellations'],
  ['content', '/content'], ['vocabulary', '/content/vocabulary'], ['path', '/content/exercises'], ['media', '/content/media'], ['pronunciation', '/content/pronunciation'],
  ['finance', '/finance'], ['registrations', '/registrations'], ['invoices', '/invoices'], ['bookings', '/bookings'], ['certificates', '/finance/certificates'], ['imports', '/finance/imports'],
] as const

for (const [name, path] of routes) {
  test(`${name}: one heading, shell navigation and no horizontal overflow`, async ({ page }, info) => {
    await page.goto(`/de/admin${path}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toBeVisible()
    if (info.project.name === 'mobile') {
      const tabbar = page.getByRole('navigation', { name: t.tabbar_label })
      await expect(tabbar).toBeVisible()
      await expect(tabbar.locator('li')).toHaveCount(5)
      await expect(page.getByRole('navigation', { name: t.sidebar_primary_label })).toBeHidden()
    } else {
      await expect(page.getByRole('navigation', { name: t.sidebar_primary_label })).toBeVisible()
      await expect(page.getByRole('navigation', { name: t.tabbar_label })).toBeHidden()
    }
    await noOverflow(page)
    await screenshot(page, name)
  })
}

test('overview highlights new registrations and links to the activation list', async ({ page }) => {
  await page.goto('/de/admin')
  await page.waitForLoadState('networkidle')
  const callout = page.getByRole('region', { name: t.overview_new_title })
  await expect(callout).toContainText('3')
  await callout.getByRole('link', { name: t.overview_new_cta }).click()
  await expect(page).toHaveURL(/\/de\/admin\/new-students$/)
  await expect(page.getByRole('article')).toHaveCount(3)
})

test('assigning a level removes the student from the new registrations', async ({ page }) => {
  await page.goto('/de/admin/new-students')
  await page.waitForLoadState('networkidle')
  const card = page.getByRole('article').first()
  await card.getByRole('button', { name: 'A1.1', exact: true }).click()
  await card.getByRole('button', { name: 'Freischalten', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Freigeschaltet: A1.1' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /Offene Freischaltungen/ })).toContainText('2')
})

test('whole-day cancellation preselects the courses of that weekday', async ({ page }) => {
  await page.goto('/de/admin/courses/cancellations')
  await page.waitForLoadState('networkidle')
  // Nächster Montag als Kalendertag (UTC-Mittag, damit keine Zeitzone den Tag verschiebt).
  const now = new Date(); const noon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7, 12))
  noon.setUTCDate(noon.getUTCDate() - ((noon.getUTCDay() + 6) % 7))
  const monday = noon.toISOString().slice(0, 10)
  await page.getByLabel('Datum', { exact: true }).fill(monday)
  await expect(page.getByRole('checkbox')).toHaveCount(2)
  await page.getByRole('button', { name: 'Feiertag', exact: true }).click()
  await page.getByRole('button', { name: 'Ausfall eintragen', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Deutsch A1.1 (Online), Sprechtraining B1' })).toBeVisible()
  await noOverflow(page)
})

test('mobile menu sheet lists every area', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Das Menü-Blatt gibt es nur auf dem Handy.')
  await page.goto('/de/admin')
  await page.waitForLoadState('networkidle')
  await page.getByRole('navigation', { name: t.tabbar_label }).getByRole('button', { name: t.tab_menu }).click()
  const sheet = page.getByRole('dialog', { name: t.menu_title })
  await expect(sheet).toBeVisible()
  // Gruppenüberschriften (nicht die gleichnamigen Menüpunkte).
  for (const group of [t.group_students, t.group_courses, t.group_content, t.group_administration]) await expect(sheet.locator('p', { hasText: new RegExp(`^${group}$`) })).toBeVisible()
  await screenshot(page, 'menu-sheet')
  await sheet.getByRole('link', { name: t.nav_certificates }).click()
  await expect(page).toHaveURL(/\/finance\/certificates$/)
  await expect(page.getByRole('dialog', { name: t.menu_title })).toHaveCount(0)
})
