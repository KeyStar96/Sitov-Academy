import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('sitov-intro-seen', '1'))
})

for (const theme of ['light', 'dark']) {
  test(`login stays usable on small phones and accessible in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('theme', value), theme)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/de/login')
      await expect(page.getByRole('heading', { name: 'Willkommen zurück', exact: true })).toBeVisible()
      const submit = page.getByRole('button', { name: 'Anmelden', exact: true })
      await expect(submit).toBeInViewport()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.getByLabel('E-Mail-Adresse', { exact: true })).toHaveAttribute('autocomplete', 'email')
      await expect(page.getByLabel('Passwort', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
    }
    await page.waitForTimeout(250)
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  })
}

test('learning signals sleep offscreen and become still when motion is reduced', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/de/login')
  const graphic = page.locator('[data-sitov-login-graphic]')
  const stage = page.locator('[data-sitov-motion-stage]').filter({ has: graphic })
  await expect(stage).toHaveAttribute('data-sitov-live', 'true')
  expect(await graphic.evaluate(element => element.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))).toBe(true)
  await page.getByRole('heading', { name: 'Dein Deutsch. Dein nächster Schritt.', exact: true }).scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await graphic.evaluate(element => element.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'))).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await graphic.scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await graphic.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
})

test('confirmation recovery keeps both labelled forms, status and return destination', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/de/login?status=login_unconfirmed&next=%2Fde%2Fdashboard%2Fprofile')
  await expect(page.getByRole('status')).toBeVisible()
  await expect(page.locator('form')).toHaveCount(2)
  await expect(page.locator('form').first().locator('input[name=next]')).toHaveValue('/de/dashboard/profile')
  const emailFields = page.locator('input[name=email]')
  await expect(emailFields).toHaveCount(2)
  for (const email of await emailFields.all()) await expect(email).toHaveAccessibleName('E-Mail-Adresse')
  await page.waitForTimeout(250)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})
