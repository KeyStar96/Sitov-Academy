import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sitov-intro-seen', '1')
    localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
  })
})

for (const theme of ['light', 'dark', 'contrast-light', 'contrast-dark']) {
  test(`both independent learning boxes fit and remain accessible in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => {
      localStorage.setItem('theme', value.includes('dark') ? 'dark' : 'light')
      localStorage.setItem('academy-contrast', value.startsWith('contrast-') ? 'high' : 'standard')
    }, theme)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const route of ['/en/sitov-preview/motion', '/en/sitov-preview/verbs']) {
      await page.goto(route)
      const box = page.locator('[data-sitov-learning-box]')
      await expect(box).toBeVisible()
      await expect(box.locator('[data-sitov-box-key]')).toHaveCount(7)
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        for (const shelf of await box.locator('[data-sitov-box-key]').all()) {
          const bounds = (await shelf.boundingBox())!
          expect(bounds.x).toBeGreaterThanOrEqual(0)
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width)
          const graphic = (await shelf.locator('[data-sitov-box-graphic]').boundingBox())!
          expect(graphic.width).toBeGreaterThan(25)
          expect(graphic.height).toBeGreaterThan(25)
        }
      }
      const violations = await new AxeBuilder({ page }).include('[data-sitov-learning-box]').analyze()
      expect(violations.violations).toEqual([])
      await box.screenshot({ path: `artifacts/sitov-${route.endsWith('verbs') ? 'verb' : 'vocabulary'}-box-${theme}.png` })
    }
  })
}

test('learning box responds to the pointer and pauses its paper outside the viewport and for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/de/sitov-preview/motion')
  await page.bringToFront()
  const box = page.locator('[data-sitov-learning-box]')
  const stage = box.locator('[data-sitov-motion-stage]').first()
  const shelf = box.locator('[data-sitov-box-key="1"]')
  await shelf.scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-sitov-live', 'true')
  expect(await shelf.evaluate(el => el.getAnimations({ subtree: true }).some(animation => animation.playState === 'running'))).toBe(true)
  const bounds = (await shelf.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .3)
  await expect(shelf).toHaveAttribute('data-sitov-pointer', 'true')
  await page.evaluate(() => {
    const spacer = document.createElement('div')
    spacer.style.height = '3000px'
    document.body.append(spacer)
    scrollTo(0, document.body.scrollHeight)
  })
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  await expect.poll(() => shelf.evaluate(el => el.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running'))).toBe(true)
  await shelf.scrollIntoViewIfNeeded()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await shelf.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
  await expect(box.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '56')
})

test('verb inspector opens with the keyboard and returns focus after Escape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/en/sitov-preview/verbs')
  const shelf = page.locator('[data-sitov-learning-box] [data-sitov-box-key="1"]')
  await shelf.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  const inspector = page.getByRole('dialog')
  const words = inspector.locator('[lang="de"][translate="no"]')
  expect(await words.count()).toBeGreaterThan(0)
  const search = inspector.getByRole('textbox', { name: /Search this box/ })
  await search.fill('sitov-no-matching-verb')
  await expect(inspector.getByText('No verbs match this selection.')).toBeVisible()
  await search.fill('')
  expect(await words.count()).toBeGreaterThan(0)
  await inspector.getByRole('combobox').selectOption('perfect')
  await inspector.getByRole('checkbox', { name: 'Only ready' }).check()
  expect(await words.count()).toBeGreaterThan(0)
  const violations = await new AxeBuilder({ page }).include('dialog').analyze()
  expect(violations.violations).toEqual([])
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(shelf).toBeFocused()
})

for (const lang of ['de', 'en', 'ru', 'uk', 'tr']) {
  test(`pronunciation readiness shows real remaining work in ${lang}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${lang}/sitov-preview/pronunciation?locked=1`)
    const readiness = page.locator('[data-sitov-pronunciation-readiness]')
    await expect(readiness).toBeVisible()
    await expect(readiness.locator('a[href*="/vocabulary"]')).toHaveCount(1)
    await expect(readiness.locator('a[href*="/path"]')).toHaveCount(1)
    await expect(readiness.locator('a[href*="/verbs"]')).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const violations = await new AxeBuilder({ page }).include('[data-sitov-pronunciation-readiness]').analyze()
    expect(violations.violations).toEqual([])
    if (lang === 'de') await readiness.screenshot({ path: 'artifacts/sitov-pronunciation-readiness-mobile.png' })
  })
}
