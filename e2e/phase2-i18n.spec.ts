import { expect, test } from '@playwright/test'
import de from '../dictionaries/de.json'

// Regression für den zuletzt ungetesteten Commit 6bdb3c9.
for (const route of ['/de/login', '/de/register']) {
  test(`${route}: eigener Sprachwechsel und Schutz deutscher Lerntexte`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('html')).toHaveAttribute('translate', 'no')
    await expect(page.locator('meta[name="google"]')).toHaveAttribute('content', 'notranslate')
    const language = page.locator('header').getByRole('combobox')
    await expect(language).toBeVisible()
    await expect(language).toHaveAccessibleName(de.academy.language)
    await expect(language.locator('option')).toHaveCount(5)
    await expect(language).toHaveValue('de')
    await language.selectOption('uk')
    await expect(page).toHaveURL(route.replace('/de/', '/uk/'))
    await expect(page.locator('html')).toHaveAttribute('lang', 'uk')
    await expect(page.locator('header').getByRole('combobox')).toHaveValue('uk')
  })
}

test('Browsersprache leitet ohne Sprachpräfix temporär um und erhält Suchparameter', async ({ request }) => {
  const response = await request.get('/?utm_source=phase2', {
    headers: { 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8' }, maxRedirects: 0,
  })
  expect(response.status()).toBe(307)
  expect(new URL(response.headers().location, response.url()).pathname).toBe('/ru')
  expect(new URL(response.headers().location, response.url()).search).toBe('?utm_source=phase2')
  expect(response.headers().vary.toLowerCase()).toContain('accept-language')
})
