import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { sitovSimulationCopy } from '../lib/exam-simulation/ui-copy'

const copy = sitovSimulationCopy('en')
const appearances = [
  { theme: 'light', contrast: 'standard', width: 1440, reduced: false },
  { theme: 'dark', contrast: 'standard', width: 390, reduced: true },
  { theme: 'light', contrast: 'high', width: 320, reduced: true },
  { theme: 'dark', contrast: 'high', width: 390, reduced: false },
] as const

for (const appearance of appearances) {
  test(`matching menus work in ${appearance.theme}/${appearance.contrast} at ${appearance.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: appearance.width, height: 900 })
    await page.emulateMedia({ reducedMotion: appearance.reduced ? 'reduce' : 'no-preference' })
    await page.addInitScript(value => {
      sessionStorage.setItem('sitov-intro-seen', '1')
      localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() }))
      localStorage.setItem('theme', value.theme)
      localStorage.setItem('academy-contrast', value.contrast)
    }, appearance)
    await page.goto('/en/sitov-preview/exam-simulation?level=A1')
    await page.getByRole('button', { name: copy.t('startExam'), exact: true }).click()
    const title = page.locator('header[lang="de"] h2')
    await expect(title).toBeVisible()
    for (let index = 0; index < 10 && await title.textContent() !== 'Angebote zuordnen'; index++) {
      const taskCount = page.getByText(/· Task \d+\/\d+/)
      const previous = await taskCount.textContent()
      await page.getByRole('button', { name: copy.t('skip'), exact: true }).click()
      await expect(taskCount).not.toHaveText(previous!)
    }
    await expect(title).toHaveText('Angebote zuordnen')
    const menus = page.getByRole('combobox')
    await expect(menus).toHaveCount(3)
    const first = menus.nth(0)
    const second = menus.nth(1)
    const third = menus.nth(2)
    if (appearance.width < 700) await first.tap()
    else await first.click()
    const listbox = page.getByRole('listbox')
    await expect(listbox).toHaveAttribute('lang', 'en')
    const offer = page.locator('[role="option"][lang="de"][translate="no"]').first()
    const offerText = (await offer.textContent())!.trim()
    await offer.click()
    await second.click()
    await expect(page.getByRole('option', { name: offerText, exact: true })).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')
    await expect(second).toBeFocused()
    await first.click()
    await page.getByRole('option', { name: copy.t('choose'), exact: true }).click()
    await second.click()
    await expect(page.getByRole('option', { name: offerText, exact: true })).not.toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Tab')
    await expect(listbox).toHaveCount(0)
    await expect(third).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(listbox).toBeVisible()
    await page.keyboard.press('End')
    const activeId = await third.getAttribute('aria-activedescendant')
    const active = page.locator(`[id="${activeId}"]`)
    await expect(active).toBeInViewport()
    await expect(active).not.toHaveAttribute('aria-disabled', 'true')
    const bounds = (await listbox.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(appearance.width)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (appearance.reduced) expect(await listbox.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
    const audit = await new AxeBuilder({ page }).include('[role="listbox"]').include('[role="combobox"]').analyze()
    expect(audit.violations).toEqual([])
    await page.screenshot({ path: `artifacts/sitov-simulation-menu-${appearance.theme}-${appearance.contrast}-${appearance.width}.png` })
    await page.keyboard.press('Enter')
    await expect(listbox).toHaveCount(0)
    const chosen = await third.textContent()
    await page.getByRole('button', { name: copy.t('saveNext'), exact: true }).click()
    await expect(title).not.toHaveText('Angebote zuordnen')
    await page.getByRole('button', { name: copy.t('back'), exact: true }).click()
    await expect(title).toHaveText('Angebote zuordnen')
    await expect(menus.nth(2)).toHaveText(chosen!)
  })
}
