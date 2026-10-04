import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sitov-intro-seen', '1')
    localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})

test('exam motion runs in view, follows the pointer and sleeps outside the viewport', async ({ page }) => {
  await page.goto('/de/sitov-preview/home-motion')
  const card = page.locator('[data-sitov-exam-entry]')
  const stage = page.locator('[data-sitov-motion-stage]').filter({ has: card })
  const graphic = page.locator('[data-sitov-exam-graphic]')
  await card.scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-sitov-live', 'true')
  expect(await graphic.evaluate(el => el.getAnimations({ subtree: true }).some(a => a.playState === 'running'))).toBe(true)
  const box = (await card.boundingBox())!
  await page.mouse.move(box.x + box.width * .9, box.y + box.height * .3)
  await expect(card).toHaveAttribute('data-sitov-pointer', 'true')
  await expect.poll(() => card.evaluate(el => Number.parseFloat((el as HTMLElement).style.getPropertyValue('--sitov-pointer-x')))).toBeGreaterThan(.5)
  await page.mouse.move(0, 0)
  await expect(card).toHaveAttribute('data-sitov-pointer', 'false')
  await expect.poll(() => card.evaluate(el => (el as HTMLElement).style.getPropertyValue('--sitov-pointer-x'))).toBe('0')
  await page.evaluate(() => scrollTo(0, 0))
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await graphic.evaluate(el => el.getAnimations({ subtree: true }).every(a => a.playState !== 'running'))).toBe(true)
})

test('reduced motion and keyboard focus preserve both ordinary links', async ({ page }) => {
  await page.goto('/de/sitov-preview/home-motion')
  const card = page.locator('[data-sitov-exam-entry]')
  const stage = page.locator('[data-sitov-motion-stage]').filter({ has: card })
  await card.scrollIntoViewIfNeeded()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await card.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  await card.focus()
  await expect(card).toBeFocused()
  await expect(card).toHaveAttribute('href', '/de/dashboard/exam-simulation')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: /Vorbereitung öffnen/ })).toBeFocused()
  await expect(page.getByRole('link', { name: /Vorbereitung öffnen/ })).toHaveAttribute('href', '/de/dashboard/exam-preparation')
})

test('touch input keeps the graphic still and the exam destination usable', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  await page.addInitScript(() => {
    sessionStorage.setItem('sitov-intro-seen', '1')
    localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
  })
  await page.goto('/de/sitov-preview/home-motion')
  const card = page.locator('[data-sitov-exam-entry]')
  await card.scrollIntoViewIfNeeded()
  await card.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 230, clientY: 350 })
  await expect(card).not.toHaveAttribute('data-sitov-pointer', 'true')
  await expect(card).toHaveAttribute('href', '/de/dashboard/exam-simulation')
  await context.close()
})

for (const theme of ['light', 'dark', 'contrast-light', 'contrast-dark']) {
  test(`exam cards stay legible and fit mobile and desktop in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => {
      localStorage.setItem('theme', value.includes('dark') ? 'dark' : 'light')
      localStorage.setItem('academy-contrast', value.startsWith('contrast-') ? 'high' : 'standard')
    }, theme)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/de/sitov-preview/home-motion')
    await expect(page.locator('html')).toHaveAttribute('data-contrast', theme.startsWith('contrast-') ? 'high' : 'standard')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.includes('dark') ? 'dark' : 'light')
    const card = page.locator('[data-sitov-exam-entry]')
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await card.scrollIntoViewIfNeeded()
      await expect(card).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `artifacts/sitov-exam-home-${theme}-${width}.png`, fullPage: false })
    }
    expect((await new AxeBuilder({ page }).include('[data-sitov-exam-entry]').analyze()).violations).toEqual([])
  })
}
