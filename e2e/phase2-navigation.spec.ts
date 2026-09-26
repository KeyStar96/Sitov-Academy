import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signInPhase2 as signIn } from './helpers/phase2-session'

/**
 * Phase 2 — Navigation und Design-System im echten Browser (Desktop, Pixel 7,
 * iPhone 14) gegen das künstliche Loopback-Fixture (e2e/phase2.config.ts).
 * Keine Regel, kein Knoten und kein Gerät wird ausgeblendet.
 */
const ROUTES = {
  home: '/en/dashboard',
  level: '/en/dashboard/level/A1.1',
  vocabulary: '/en/dashboard/level/A1.1/vocabulary',
  lessons: '/en/dashboard/level/A1.1/vocabulary/lessons',
  path: '/en/dashboard/level/A1.1/exercises',
  pronunciation: '/en/dashboard/level/A1.1/pronunciation',
  media: '/en/dashboard/level/A1.1/videos',
} as const
const ACTIVE = { vocabulary: 'Vocabulary', lessons: 'Vocabulary', path: 'Learning path', pronunciation: 'Pronunciation', media: 'Media library' } as const

async function open(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: 'networkidle' })
  expect(response?.status()).toBe(200)
  expect(page.url()).not.toContain('/login')
  await expect(page.locator('h1').first()).toBeVisible()
}

const isDesktop = () => test.info().project.name === 'desktop'
const tabbar = (page: Page) => page.getByRole('navigation', { name: 'Main navigation' })

async function scrollBy(page: Page, distance: number) {
  // In kleinen Schritten wie ein Daumen — jeder Schritt löst ein Scroll-Ereignis aus.
  for (let moved = 0; Math.abs(moved) < Math.abs(distance); moved += Math.sign(distance) * 40) {
    await page.evaluate(step => window.scrollBy(0, step), Math.sign(distance) * 40)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(450)
}

test.describe('Modus-Dock', () => {
  for (const [name, path] of Object.entries(ROUTES).filter(([name]) => name in ACTIVE) as [keyof typeof ACTIVE, string][]) {
    test(`${name}: aktiver Modus mit aria-current, kein waagerechtes Scrollen`, async ({ page }) => {
      await signIn(page)
      await open(page, path)
      const dock = page.getByRole('navigation', { name: 'Learning areas of A1.1' })
      await expect(dock).toBeVisible()
      await expect(dock.getByRole('link')).toHaveCount(4)
      const current = dock.locator('a[aria-current="page"]')
      await expect(current).toHaveCount(1)
      await expect(current).toContainText(ACTIVE[name])
      for (const link of await dock.getByRole('link').all()) {
        const box = (await link.boundingBox())!
        expect(box.height).toBeGreaterThanOrEqual(48)
        expect(box.width).toBeGreaterThanOrEqual(48)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      if (name === 'vocabulary') {
        // Kontrastreiche Fachnummern dürfen die Anzahl nicht mehr überlagern.
        const plates = page.locator('.lb-plate').filter({ has: page.locator('.lb-plate__numeral') })
        await expect(plates).toHaveCount(6)
        for (const plate of await plates.all()) {
          const number = (await plate.locator('.lb-plate__numeral').boundingBox())!
          const count = (await plate.locator('.lb-plate__count').boundingBox())!
          expect(number.y).toBeGreaterThanOrEqual(count.y + count.height)
        }
      }
    })
  }

  test('bleibt beim Scrollen unter dem Seitenkopf kleben', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.lessons)
    const dock = page.getByRole('navigation', { name: 'Learning areas of A1.1' })
    await scrollBy(page, 900)
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(200)
    await expect(dock).toBeInViewport()
    const header = (await page.locator('.academy-student-header').boundingBox())!
    const dockBox = (await dock.boundingBox())!
    expect(Math.abs(dockBox.y - (header.y + header.height))).toBeLessThanOrEqual(2)
  })

  test('Niveau-Übersicht: kein Modus aktiv, oben „Weiter, wo du aufgehört hast", darunter vier gleich große Modus-Karten', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.level)
    await expect(page.getByRole('navigation', { name: 'Learning areas of A1.1' }).locator('a[aria-current]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Continue where you left off' })).toBeVisible()
    await expect(page.getByText('Last time: Vocabulary · Lesson 1')).toBeVisible()
    const cards = page.locator('.st-tiles--modes .st-tile')
    await expect(cards).toHaveCount(4)
    const sizes = await cards.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().width)))
    expect(new Set(sizes).size).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('Brotkrumen', () => {
  test('voller Pfad auf jeder Breite; der aktuelle Ort ist sichtbar', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.lessons)
    const crumbs = page.getByRole('navigation', { name: 'Page navigation' })
    await expect(crumbs.getByRole('listitem')).toHaveText(['Home', 'A1.1', 'Vocabulary', 'Lessons'])
    for (const name of ['Home', 'A1.1', 'Vocabulary']) await expect(crumbs.getByRole('link', { name })).toBeAttached()
    const current = crumbs.getByRole('heading', { level: 1, name: 'Lessons' })
    await expect(current).toHaveAttribute('aria-current', 'page')
    await expect(current).toBeInViewport()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  })
})

test.describe('Untere Leiste (D8)', () => {
  test('weg nach Runterscrollen, zurück nach Hochscrollen, sichtbar oben und am Ende', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.home)
    const bar = tabbar(page)
    if (isDesktop()) {
      // Ab Tablet-Breite übernimmt die Kopfzeile; die Leiste gibt es dort nicht.
      await expect(bar).toBeHidden()
      return
    }
    const shell = page.locator('.academy-student-shell')
    await expect(bar).toBeInViewport()
    await expect(shell).toHaveAttribute('data-tabbar', 'visible')
    await scrollBy(page, 400)
    await expect(shell).toHaveAttribute('data-tabbar', 'hidden')
    await expect(bar).not.toBeInViewport()
    await expect(bar).toBeHidden()
    await scrollBy(page, -120)
    await expect(shell).toHaveAttribute('data-tabbar', 'visible')
    await expect(bar).toBeInViewport()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(450)
    await expect(shell).toHaveAttribute('data-tabbar', 'visible')
    await expect(bar).toBeInViewport()
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(450)
    await expect(bar).toBeInViewport()
  })

  test('das Aufnahme-Dock wandert mit: der Aufnahmeknopf bleibt sichtbar und klickbar', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.pronunciation)
    await page.evaluate(() => {
      Object.defineProperty(Object.getPrototypeOf(navigator.mediaDevices), 'getUserMedia', {
        configurable: true, value: async () => { throw new DOMException('Test microphone permission denied', 'NotAllowedError') },
      })
    })
    const dock = page.getByTestId('pronunciation-recording-bar')
    if (isDesktop()) {
      // Die schwebende Aufnahme-Bedienung gibt es nur unterhalb des lg-Breakpoints.
      await expect(dock).toBeHidden()
      return
    }
    const record = dock.getByRole('button', { name: 'Start recording', exact: true })
    const bar = tabbar(page)
    const onTop = async () => {
      const box = (await record.boundingBox())!
      return page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('button[aria-label="Start recording"]'), { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    }
    await expect(record).toBeInViewport({ ratio: 1 })
    const withBar = (await record.boundingBox())!
    const barBox = (await bar.boundingBox())!
    expect(withBar.y + withBar.height).toBeLessThanOrEqual(barBox.y + 1)
    await scrollBy(page, 600)
    await expect(page.locator('.academy-student-shell')).toHaveAttribute('data-tabbar', 'hidden')
    await expect(record).toBeInViewport({ ratio: 1 })
    expect(await onTop()).toBe(true)
    const withoutBar = (await record.boundingBox())!
    expect(withoutBar.y).toBeGreaterThan(withBar.y)
    await scrollBy(page, -120)
    await expect(bar).toBeInViewport()
    await expect(record).toBeInViewport({ ratio: 1 })
    expect(await onTop()).toBe(true)
    await record.click()
    await expect(dock.getByRole('status')).toBeVisible()
  })
})

test.describe('Weniger Bewegung', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } })
  for (const [name, path] of Object.entries(ROUTES)) {
    test(`${name}: keine laufenden Animationen, alle Inhalte sichtbar`, async ({ page }) => {
      await signIn(page)
      await open(page, path)
      await page.waitForTimeout(300)
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
      const animations = await page.evaluate(() => document.getAnimations().map(animation => {
        const target = (animation.effect as KeyframeEffect | null)?.target as Element | null
        return `${animation.constructor.name} ${animation.playState} ${target?.className ?? ''}`
      }))
      expect(animations).toEqual([])
      const hidden = await page.evaluate(() => [...document.querySelectorAll('.academy-student-shell *')].filter(element => {
        const style = getComputedStyle(element)
        const box = element.getBoundingClientRect()
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) === 0
      }).map(element => element.className.toString()))
      expect(hidden).toEqual([])
      await expect(page.locator('.st-crumb').last()).toBeVisible()
    })
  }
})

test.describe('Accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, path] of Object.entries(ROUTES)) {
      test(`${name} (${theme}): axe ohne Filter`, async ({ page }) => {
        await signIn(page, theme)
        await open(page, path)
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/)
        const results = await new AxeBuilder({ page }).analyze()
        expect(results.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.target.join(' ')) }))).toEqual([])
      })
    }
  }
})
