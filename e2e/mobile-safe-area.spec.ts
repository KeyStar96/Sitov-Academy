import { expect, test, type Page } from '@playwright/test'

/**
 * Die App rendert mit `viewport-fit=cover` und `black-translucent` unter die
 * Statusleiste. Jede Seite muss deshalb selbst `env(safe-area-inset-top)`
 * freihalten – sonst liegen Logo und Zurück-Knopf unter Uhrzeit und Akku.
 *
 * Chromium emuliert die Insets per CDP (iPhone mit Dynamic Island: 59/34 px).
 * Geprüft wird jeder sichtbare Inhalt (Text, Links, Knöpfe, Bilder) oben auf
 * der Seite und – nach dem Scrollen – alles, was fixiert oder sticky bleibt.
 */
const TOP = 59
const BOTTOM = 34
const ROUTES = ['/de', '/de/agb', '/de/privacy', '/de/imprint', '/de/cancellation', '/de/login', '/de/register',
  '/de/forgot-password', '/de/reset-password', '/de/registration', '/de/gibt-es-nicht']

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 })

async function emulateNotch(page: Page) {
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: TOP, topMax: TOP, bottom: BOTTOM, bottomMax: BOTTOM, left: 0, leftMax: 0, right: 0, rightMax: 0 },
  })
}

/** Sichtbarer Inhalt, der in den Streifen der Statusleiste ragt. */
function contentUnderStatusBar(page: Page, onlyPinned: boolean) {
  return page.evaluate(({ inset, onlyPinned }) => {
    const pinned = (element: Element | null): boolean => {
      for (let node = element; node; node = node.parentElement) {
        const position = getComputedStyle(node).position
        if (position === 'fixed' || position === 'sticky') return true
      }
      return false
    }
    const hits: string[] = []
    for (const element of document.querySelectorAll('body *')) {
      const interactive = element.matches('a, button, input, select, textarea, img, svg, [role="button"]')
      const text = [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
      if (!interactive && !text) continue
      if (!interactive && element.closest('[aria-hidden="true"]')) continue
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue
      const box = element.getBoundingClientRect()
      if (box.width === 0 || box.height === 0 || box.bottom <= 0 || box.top >= inset - 0.5) continue
      if (onlyPinned && !pinned(element)) continue
      const label = (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().slice(0, 40)
      hits.push(`${element.tagName.toLowerCase()} „${label}“ top=${Math.round(box.top)}`)
    }
    return hits
  }, { inset: TOP, onlyPinned })
}

for (const route of ROUTES) {
  test(`${route}: nichts liegt unter der Statusleiste`, async ({ page }) => {
    await emulateNotch(page)
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.locator('.academy-preloader').waitFor({ state: 'hidden' }).catch(() => {})

    expect(await contentUnderStatusBar(page, false), 'Seitenanfang').toEqual([])
    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 200)
    await page.mouse.wheel(0, 900)
    await page.waitForTimeout(400)
    if (scrollable) expect(await page.evaluate(() => scrollY), 'Seite wurde gescrollt').toBeGreaterThan(100)
    expect(await contentUnderStatusBar(page, true), 'nach dem Scrollen (fixiert/sticky)').toEqual([])
  })
}

test('Skip-Link erscheint mit Fokus vollständig unter der Statusleiste', async ({ page }) => {
  await emulateNotch(page)
  await page.goto('/de', { waitUntil: 'networkidle' })
  const link = page.locator('.academy-skip-link')
  expect((await link.boundingBox())!.y + (await link.boundingBox())!.height, 'versteckt').toBeLessThanOrEqual(0)
  await link.focus()
  await page.waitForTimeout(300)
  expect((await link.boundingBox())!.y, 'fokussiert').toBeGreaterThanOrEqual(TOP)
})
