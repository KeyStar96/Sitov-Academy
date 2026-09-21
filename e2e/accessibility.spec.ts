import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const theme of ['light', 'dark'] as const) {
  for (const [name, path] of [['Home', '/de'], ['Registration', '/de/registration'], ['Cancellation', '/de/cancellation']] as const) {
    test(`${name} has no accessibility violations (${theme})`, async ({ page }) => {
      await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
      await page.addInitScript(value => {
        localStorage.setItem('theme', value)
        localStorage.setItem('academy-contrast', 'standard')
      }, theme)
      // Sample the SETTLED UI: axe reads the live DOM, so a mid-flight fade (e.g. a
      // GSAP hero reveal at opacity 0.25, or a Framer mount fade) would report transient,
      // non-representative colour pairs. Emulating reduced motion makes reduced-motion-aware
      // animations (GSAP hero, the Reveal sections, all CSS transitions) render final at once;
      // the explicit settle below covers the few Framer opacity fades that ignore it.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('.academy-preloader')).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      // Under reduced motion the registration step renders final at once (filter: none),
      // so no per-route entrance wait is needed. Let any remaining Framer opacity fades
      // finish before sampling the perceivable colours.
      await page.waitForTimeout(1500)
      // Assert the complete axe result. No rule, node, impact or tag exclusions.
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
