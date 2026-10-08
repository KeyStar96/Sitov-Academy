import { test, expect } from '@playwright/test'

const canonical = 'https://www.sitov-academy.com'
const locales = ['de', 'en', 'ru', 'uk', 'tr']

test('the registration first question and catalog are in Googlebot HTML before JavaScript', async ({ request }) => {
  for (const lang of locales) {
    for (const suffix of ['', '?trial=1']) {
      const response = await request.get(`/${lang}/registration${suffix}`, { headers: { 'user-agent': 'Googlebot' } })
      expect(response.status()).toBe(200)
      const html = await response.text()
      expect(html).not.toContain('BAILOUT_TO_CLIENT_SIDE_RENDERING')
      expect(html).toMatch(/<h1[^>]*id="reg-step-title"/)
      expect(html).toContain('class="reg-course')
      expect(html).toContain(`rel="canonical" href="${canonical}/${lang}/registration"`)
      if (suffix) expect(html).toContain('role="note"')
    }
  }
})

test('a selected course and trial survive SSR and client hydration', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() })))
  await page.goto('/de/deutschkurse-hannover')
  const href = await page.locator('a[href*="&trial=1"]').first().getAttribute('href')
  expect(href).toContain('courseId=')
  await page.goto(href!)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('.reg-course[data-selected="true"] input[type="radio"]')).toBeChecked()
  await expect(page.getByRole('note')).toContainText('Ob sie bereits genutzt wurde, prüfen wir beim Absenden')
  await page.getByRole('button', { name: 'Weiter', exact: true }).click()
  await expect(page.locator('.registration-flow form')).toHaveAttribute('data-step', '2')
})

test('new course pages remain readable and linked without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' })
  const page = await context.newPage()
  for (const path of ['deutschkurse-hannover', 'deutschkurse-online']) {
    await page.goto(`/de/${path}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${canonical}/de/${path}`)
    expect((await page.locator('body').innerText()).length).toBeGreaterThan(1000)
    await expect(page.locator('a[href^="/de/registration?courseId="]').first()).toBeVisible()
  }
  await context.close()
})

test('the commercial landing page fits a phone with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/de/deutschkurse-online')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/sitov-seo-online-mobile.png', fullPage: true })
})
