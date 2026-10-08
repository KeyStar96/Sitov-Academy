import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { getSitovVerbBoxCopy } from '../lib/verbs/learning-box-i18n'
import { sitovTrainerUiCopy } from '../lib/sitov-trainer-ui-i18n'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sitov-intro-seen', '1')
    localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
  })
})

for (const lang of ['de', 'en', 'ru', 'uk', 'tr']) {
  test(`verb guide explains the independent form rules in ${lang} and stays usable with reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 900 })
    await page.goto(`/${lang}/sitov-preview/verbs`)
    const copy = getSitovVerbBoxCopy(lang)
    const toggle = page.getByRole('button', { name: sitovTrainerUiCopy(lang).help })
    await toggle.focus()
    await page.keyboard.press('Enter')
    const help = page.getByRole('region', { name: sitovTrainerUiCopy(lang).help })
    await expect(help).toBeVisible()
    await expect(help.getByText(copy.guideDemo)).toBeVisible()
    await expect(help.getByText(copy.guideCompactRight)).toBeVisible()
    await expect(help.getByText(copy.guideCompactWrong)).toBeVisible()
    await expect(help.getByText(copy.guideCompactScope)).toBeVisible()
    await expect(help.locator('ol > li')).toHaveCount(3)
    await expect(help.locator('time')).toHaveCount(0)
    await expect(help.getByText(copy.guideText)).toHaveCount(0)
    await expect(help.getByText(copy.guideTip)).toHaveCount(0)
    await expect(help.getByText(copy.guideWrong, { exact: true })).toHaveCount(0)
    const track = help.locator('[data-sitov-verb-guide-track]')
    await expect(track).toHaveAttribute('aria-hidden', 'true')
    await expect(track.locator('[data-sitov-verb-guide-slot]')).toHaveCount(7)
    await expect(help.locator('[data-sitov-verb-guide-example]')).toHaveCount(2)
    await expect(help.locator('[data-sitov-verb-guide-example="past"]')).toHaveCount(0)
    for (const example of await help.locator('[data-sitov-verb-guide-example] [lang="de"][translate="no"]').all()) {
      await expect(example).toBeVisible()
    }
    expect(await track.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const accessibility = await new AxeBuilder({ page }).include('[data-sitov-trainer-help]').analyze()
    expect(accessibility.violations).toEqual([])
    await toggle.focus()
    await page.keyboard.press(' ')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(help).toHaveCount(0)
    await expect(toggle).toBeFocused()
    await page.getByRole('combobox', { name: 'Level', exact: true }).selectOption('A2.1')
    await page.getByRole('button', { name: sitovTrainerUiCopy(lang).help }).click()
    await expect(page.locator('[data-sitov-verb-guide-example]')).toHaveCount(3)
  })
}

for (const theme of ['light', 'dark', 'contrast-light', 'contrast-dark']) {
  test(`verb guide fits mobile and desktop in ${theme}`, async ({ page }) => {
    await page.addInitScript(value => {
      localStorage.setItem('theme', value.includes('dark') ? 'dark' : 'light')
      localStorage.setItem('academy-contrast', value.startsWith('contrast-') ? 'high' : 'standard')
    }, theme)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/en/sitov-preview/verbs')
    await page.getByRole('button', { name: 'How the learning box works' }).click()
    const help = page.locator('[data-sitov-trainer-help]')
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      const bounds = (await help.boundingBox())!
      if (width === 390) expect(bounds.height).toBeLessThan(520)
      for (const slot of await help.locator('[data-sitov-verb-guide-slot]').all()) {
        const slotBounds = (await slot.boundingBox())!
        expect(slotBounds.x).toBeGreaterThanOrEqual(bounds.x)
        expect(slotBounds.x + slotBounds.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1)
      }
      if (width !== 320) await help.screenshot({ path: `artifacts/sitov-verb-guide-${theme}-${width}.png` })
    }
    const accessibility = await new AxeBuilder({ page }).include('[data-sitov-trainer-help]').analyze()
    expect(accessibility.violations).toEqual([])
  })
}

test('verb guide runs only while visible and pauses for hidden documents and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/en/sitov-preview/verbs')
  await page.bringToFront()
  await page.getByRole('button', { name: 'How the learning box works' }).click()
  const stage = page.locator('[data-sitov-verb-guide-stage]')
  const card = stage.locator('[data-sitov-verb-guide-card]')
  await card.scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-sitov-live', 'true')
  expect(await card.evaluate(element => element.getAnimations().some(animation => animation.playState === 'running'))).toBe(true)
  await page.evaluate(() => {
    const spacer = document.createElement('div')
    spacer.style.height = '3000px'
    document.body.append(spacer)
    scrollTo(0, document.body.scrollHeight)
  })
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await card.evaluate(element => element.getAnimations().every(animation => animation.playState === 'paused'))).toBe(true)
  await card.scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-sitov-live', 'true')
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await card.evaluate(element => element.getAnimations().every(animation => animation.playState === 'paused'))).toBe(true)
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(stage).toHaveAttribute('data-sitov-live', 'true')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(stage).toHaveAttribute('data-sitov-live', 'false')
  expect(await stage.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0)
  await expect(card).toBeVisible()
})

test('verb animation returns a mistaken form to box 1 and advances one compartment at a time to box 7', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/en/sitov-preview/verbs')
  await page.getByRole('button', { name: 'How the learning box works' }).click()
  const stage = page.locator('[data-sitov-verb-guide-stage]')
  await stage.scrollIntoViewIfNeeded()
  await expect(stage).toHaveAttribute('data-sitov-live', 'true')
  const card = stage.locator('[data-sitov-verb-guide-card]')
  for (const [compartment, fraction] of [[1, .04], [2, .12], [3, .22], [1, .36], [2, .46], [3, .55], [4, .64], [5, .73], [6, .82], [7, .93]]) {
    await card.evaluate((element, progress) => {
      const animation = element.getAnimations()[0]
      animation.pause()
      const timing = animation.effect!.getTiming()
      animation.currentTime = Number(timing.delay) + Number(timing.duration) * progress
    }, fraction)
    const cardBounds = (await card.boundingBox())!
    const slotBounds = (await stage.locator(`[data-sitov-verb-guide-slot="${compartment}"]`).boundingBox())!
    expect(Math.abs(cardBounds.x + cardBounds.width / 2 - slotBounds.x - slotBounds.width / 2)).toBeLessThan(2)
  }
  for (const [feedback, fraction] of [['wrong', .26], ['right', .93]] as const) {
    const badge = stage.locator(`[data-sitov-verb-guide-feedback="${feedback}"]`)
    await badge.evaluate((element, progress) => {
      const animation = element.getAnimations()[0]
      animation.pause()
      const timing = animation.effect!.getTiming()
      animation.currentTime = Number(timing.delay) + Number(timing.duration) * progress
    }, fraction)
    await expect(badge).toHaveCSS('opacity', '1')
  }
})
