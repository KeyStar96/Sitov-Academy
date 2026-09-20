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
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      await expect(page.locator('.academy-preloader')).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      // Wait for the registration step's entrance animation, without excluding its nodes.
      if (path.endsWith('/registration')) {
        await expect(page.locator('.enrollment-control-grid').locator('..')).toHaveCSS('opacity', '1')
        await expect(page.locator('.enrollment-control-grid').locator('..')).toHaveCSS('filter', 'blur(0px)')
      }
      // Assert the complete axe result. No rule, node, impact or tag exclusions.
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
