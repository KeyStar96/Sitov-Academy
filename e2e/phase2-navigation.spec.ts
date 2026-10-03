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
    await page.evaluate(step => window.scrollBy({ top: step, behavior: 'instant' }), Math.sign(distance) * 40)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(450)
}

async function ensureScrollRoom(page: Page) {
  // Die Fixture-Übersicht ist nach dem Karussell-Umbau bewusst kurz. Nur diese
  // Scroll-Regressionsprüfung braucht zusätzlichen Platz, damit 400 px Bewegung
  // auf allen Handyhöhen möglich sind, unabhängig von den künstlichen Kennzahlen.
  await page.locator('.academy-student-content').evaluate(async element => {
    (element as HTMLElement).style.minHeight = '2500px'
    window.scrollTo({ top: 0, behavior: 'instant' })
    // Der neue Inhalt und die Scroll-Baseline müssen committed sein, bevor der
    // Test eine neue Richtung auslöst; die HTML-Regel für weiche Anker entfällt hier.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  })
}

async function scrollWithChromeMotion(page: Page, distance: number, reducedMotion: 'no-preference' | 'reduce') {
  if (reducedMotion === 'reduce') {
    await page.evaluate(step => window.scrollBy({ top: step, behavior: 'instant' }), distance)
    return
  }
  // Ein echtes Zwischenbild prüft die Bewegung selbst: Beide Leisten bleiben
  // während Ein-/Ausblenden sichtbar und haben interpolierte Deckkraft und Lage.
  // Eine sofortige visibility-Umschaltung könnte diese Prüfung nicht bestehen.
  // Scrollen und Abtasten laufen in derselben Browser-Auswertung. Dadurch kann
  // die kurze Ausblendung nicht zwischen zwei Playwright-Protokollaufrufen enden.
  const samples = await page.evaluate(async step => {
    const elements = [...document.querySelectorAll('.st-tabbar, .st-mode-dock')]
    const samples: { visibility: string; opacity: number; y: number }[][] = []
    const started = performance.now()
    window.scrollBy({ top: step, behavior: 'instant' })
    await new Promise<void>(resolve => {
      const sample = () => {
        const states = elements.map(element => {
          const style = getComputedStyle(element)
          const transform = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform)
          return { visibility: style.visibility, opacity: Number(style.opacity), y: transform.m42 }
        })
        samples.push(states)
        if (states.length === 2 && states.every(state => state.visibility === 'visible' && state.opacity > .03 && state.opacity < .97 && Math.abs(state.y) > .5)
          || performance.now() - started >= 700) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    return samples
  }, distance)
  expect(samples.some(states => states.length === 2 && states.every(state =>
    state.visibility === 'visible' && state.opacity > .03 && state.opacity < .97 && Math.abs(state.y) > .5)),
  `Chrome transition frames: ${JSON.stringify(samples)}`).toBe(true)
}

test.describe('Modus-Dock', () => {
  for (const [name, path] of Object.entries(ROUTES).filter(([name]) => name in ACTIVE) as [keyof typeof ACTIVE, string][]) {
    test(`${name}: aktiver Modus mit aria-current, kein waagerechtes Scrollen`, async ({ page }) => {
      await signIn(page)
      await open(page, path)
      // Textauswahl kann zum Lesetext scrollen; den Dock-Zustand prüfen wir oben.
      if (name === 'pronunciation') {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await expect(page.locator('.academy-student-shell')).toHaveAttribute('data-tabbar', 'visible')
      }
      const dock = page.getByRole('navigation', { name: 'Learning areas of A1.1' })
      await expect(dock).toBeVisible()
      await expect(dock.getByRole('link')).toHaveCount(5)
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

  test('gleitet beim Runterscrollen weg und klebt beim Hochscrollen unter dem Seitenkopf', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.lessons)
    const dock = page.getByRole('navigation', { name: 'Learning areas of A1.1' })
    await scrollBy(page, 900)
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(200)
    await expect(page.locator('.academy-student-shell')).toHaveAttribute('data-tabbar', 'hidden')
    await expect(dock).toBeHidden()
    await scrollBy(page, -120)
    await expect(page.locator('.academy-student-shell')).toHaveAttribute('data-tabbar', 'visible')
    await expect(dock).toBeInViewport()
    const header = (await page.locator('.academy-student-header').boundingBox())!
    const dockBox = (await dock.boundingBox())!
    expect(Math.abs(dockBox.y - (header.y + header.height))).toBeLessThanOrEqual(2)
  })

  test('Niveau-Übersicht: kein Modus aktiv, oben „Weiter, wo du aufgehört hast", darunter das Home-Karussell mit fünf Modi', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.level)
    await expect(page.getByRole('navigation', { name: 'Learning areas of A1.1' }).locator('a[aria-current]')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Continue where you left off' })).toBeVisible()
    await expect(page.getByText('Last time: Vocabulary · Lesson 1')).toBeVisible()
    const carousel = page.locator('[role="region"][aria-roledescription="Carousel"]')
    await expect(carousel).toBeVisible()
    const cards = carousel.locator('.st-tile')
    await expect(cards).toHaveCount(5)
    expect(await carousel.locator('[data-sitov-mode]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-sitov-mode'))))
      .toEqual(['vocabulary', 'verbs', 'path', 'pronunciation', 'media'])
    await expect(carousel.getByRole('group', { name: 'Choose a trainer' }).getByRole('button')).toHaveCount(5)
    await expect(carousel.locator('[data-sitov-active="true"]')).toHaveAttribute('data-sitov-mode', 'vocabulary')
    const sizes = await cards.evaluateAll(nodes => nodes.map(node => (node as HTMLElement).offsetWidth))
    expect(new Set(sizes).size).toBe(1)
    await carousel.getByRole('button', { name: 'Next trainer' }).click()
    await expect(carousel.locator('[data-sitov-active="true"]')).toHaveAttribute('data-sitov-mode', 'verbs')
    await expect(carousel.getByRole('status')).toHaveText('Verb trainer, 2 of 5')
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
  test('weg nach Runterscrollen bis zum Seitenende, zurück nach Hochscrollen und sichtbar oben', async ({ page }) => {
    await signIn(page)
    await open(page, ROUTES.home)
    const bar = tabbar(page)
    if (isDesktop()) {
      // Ab Tablet-Breite übernimmt die Kopfzeile; die Leiste gibt es dort nicht.
      await expect(bar).toBeHidden()
      return
    }
    await ensureScrollRoom(page)
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
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await page.waitForTimeout(450)
    await expect(shell).toHaveAttribute('data-tabbar', 'hidden')
    await expect(bar).toBeHidden()
    await scrollBy(page, -120)
    await expect(shell).toHaveAttribute('data-tabbar', 'visible')
    await expect(bar).toBeInViewport()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
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
    // Die Aussprache-Ansicht kann beim Laden bereits zum Lesetext springen.
    // Für den Vergleich brauchen wir zuerst eine ausdrücklich sichtbare App-Leiste.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await expect(bar).toBeVisible()
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

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(`Lernen über die App-Leiste (${reducedMotion})`, () => {
    test.use({ contextOptions: { reducedMotion } })

    test('Pointer-Wechsel zu Learn und Modus: beide Leisten folgen dem Scrollen; Tastaturfokus hält sie sichtbar', async ({ page }) => {
      test.skip(isDesktop(), 'Der persistente Learn-Reiter gehört zur mobilen App-Leiste.')
      await signIn(page)
      await open(page, ROUTES.home)
      const bar = tabbar(page)
      const shell = page.locator('.academy-student-shell')
      const dock = page.getByRole('navigation', { name: 'Learning areas of A1.1' })

      // Echte Link-Aktivierung statt page.goto: Der fokussierte Learn-Link im
      // persistenten Layout war die Ursache für die festgehaltenen Leisten.
      await bar.getByRole('link', { name: 'Learn', exact: true }).click()
      await page.waitForURL(`**${ROUTES.level}`)
      // Der persistente Dock kann schon vorhanden sein, während der alte Inhalt
      // noch steht. Erst die tatsächliche Übersicht bestätigt den RSC-Wechsel.
      await expect(page.locator('.st-mode-content').getByRole('heading', { name: 'Continue where you left off' })).toBeVisible()
      await expect(page.locator('.st-mode-content [role="region"][aria-roledescription="Carousel"]')).toBeVisible()
      await expect(bar.getByRole('link', { name: 'Learn', exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(dock.locator('a[aria-current="page"]')).toHaveCount(0)
      await page.waitForLoadState('networkidle')
      await expect(dock).toBeVisible()
      await ensureScrollRoom(page)
      await scrollWithChromeMotion(page, 400, reducedMotion)
      await expect(shell).toHaveAttribute('data-tabbar', 'hidden')
      await expect(bar).toBeHidden()
      await expect(dock).toBeHidden()
      await scrollWithChromeMotion(page, -120, reducedMotion)
      await expect(shell).toHaveAttribute('data-tabbar', 'visible')
      await expect(bar).toBeInViewport()
      await expect(dock).toBeInViewport()

      await dock.getByRole('link', { name: /^Media library/ }).click()
      await page.waitForURL(`**${ROUTES.media}`)
      await expect(page.locator('.st-mode-content').getByRole('heading', { level: 1, name: 'Media library', exact: true })).toBeVisible()
      await expect(dock.getByRole('link', { name: /^Media library/ })).toHaveAttribute('aria-current', 'page')
      await page.waitForLoadState('networkidle')
      await ensureScrollRoom(page)
      await scrollBy(page, 400)
      await expect(shell).toHaveAttribute('data-tabbar', 'hidden')
      await expect(bar).toBeHidden()
      await expect(dock).toBeHidden()
      await scrollBy(page, -120)
      await expect(shell).toHaveAttribute('data-tabbar', 'visible')
      await expect(bar).toBeVisible()
      await expect(dock).toBeVisible()
      await expect(bar).toBeInViewport()
      await expect(dock).toBeInViewport()

      // Eine tatsächliche Tab-Taste aktiviert den Tastaturmodus. Der anschließende
      // Fokus mit preventScroll macht die Prüfung unabhängig von WebKits mobiler
      // Tab-Reihenfolge: Geprüft wird der Schutz des fokussierten Links beim Scrollen.
      await page.keyboard.press('Tab')
      const verbLink = dock.getByRole('link', { name: /^Verb trainer/ })
      await verbLink.evaluate(element => (element as HTMLElement).focus({ preventScroll: true }))
      await expect(verbLink).toBeFocused()
      await scrollBy(page, 200)
      await expect(shell).toHaveAttribute('data-tabbar', 'visible')
      await expect(dock).toBeInViewport()
      await expect(bar).toBeInViewport()
      await expect(verbLink).toBeFocused()

      await expect(bar).toBeVisible()
      await expect(dock).toBeVisible()
      await page.keyboard.press('Tab')
      const learnLink = bar.getByRole('link', { name: 'Learn', exact: true })
      await learnLink.evaluate(element => (element as HTMLElement).focus({ preventScroll: true }))
      await expect(learnLink).toBeFocused()
      await scrollBy(page, 200)
      await expect(shell).toHaveAttribute('data-tabbar', 'visible')
      await expect(bar).toBeInViewport()
      await expect(dock).toBeInViewport()
      await expect(learnLink).toBeFocused()

      if (reducedMotion === 'reduce') {
        expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
        for (const chrome of [bar, dock]) {
          expect(await chrome.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s')
        }
      }
    })
  })
}

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
        // Ruhende Lichtringe und Pointer-Licht sind ausdrücklich dekorativ.
        if (element.closest('[aria-hidden="true"]')) return false
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
