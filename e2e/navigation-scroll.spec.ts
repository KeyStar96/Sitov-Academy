import { expect, test, type Page } from '@playwright/test'

/**
 * Seitenwechsel landen oben. Regression 24.09.2026: „Zur Homepage" und das Logo
 * auf den Anmelde-Seiten führten auf der Startseite weich bis zum Footer, weil
 * `scroll-behavior: smooth` ohne `data-scroll-behavior="smooth"` am <html> lag
 * (siehe app/[lang]/layout.tsx). Anker innerhalb der Seite scrollen weiter weich.
 */
test.use({ viewport: { width: 390, height: 844 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date(Date.now() - 60000).toISOString() }))
    } catch {}
  })
})

async function settledScrollY(page: Page) {
  await page.waitForTimeout(2000)
  return page.evaluate(() => scrollY)
}

for (const from of ['/de/register', '/de/login', '/de/forgot-password']) {
  test(`${from}: „Zur Homepage" landet oben auf der Startseite`, async ({ page }) => {
    await page.goto(from, { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Zur Homepage' }).click()
    await page.waitForURL(/\/de$/)
    expect(await settledScrollY(page)).toBe(0)
  })
}

test('Logo auf der Registrierung landet oben auf der Startseite', async ({ page }) => {
  await page.goto('/de/register', { waitUntil: 'networkidle' })
  await page.locator('header a').first().click()
  await page.waitForURL(/\/de$/)
  expect(await settledScrollY(page)).toBe(0)
})

test('Anker innerhalb der Startseite scrollen weiterhin zum Ziel', async ({ page }) => {
  await page.goto('/de', { waitUntil: 'networkidle' })
  await page.locator('.academy-hero-actions a[href="#courses"]').click()
  await page.waitForTimeout(2000)
  const top = await page.locator('#courses').evaluate((element) => element.getBoundingClientRect().top)
  expect(top).toBeGreaterThanOrEqual(0)
  expect(top).toBeLessThan(200)
})
