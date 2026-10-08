import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'

/**
 * Phase 7 — Abnahme für die Google Search Console (gegen einen Produktions-Build).
 * sitemap.xml inkl. x-default · robots.txt · JSON-LD · OG-Bild HTTP 200 · ohne Consent kein Request an Meta.
 */

const LOCALES = ['de', 'en', 'uk', 'ru', 'tr'] as const
const CANONICAL = (process.env.CANONICAL_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
const META_HOST = /(^|\.)(facebook\.com|facebook\.net)$/
const de = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', 'de.json'), 'utf-8'))

function trackMetaRequests(page: Page): string[] {
  const requests: string[] = []
  // Nie wirklich zu Meta verbinden; jeder Versuch wird trotzdem gezählt.
  void page.route(url => META_HOST.test(url.hostname), route => {
    requests.push(route.request().url())
    return route.abort()
  })
  return requests
}

test.describe('Consent und Meta-Pixel', () => {
  test('ohne Einwilligung verlässt kein Request den Browser Richtung Meta', async ({ page }) => {
    const metaRequests = trackMetaRequests(page)
    await page.goto('/de')
    await expect(page.getByTestId('consent-banner')).toBeVisible()
    await expect(page.locator('script#meta-pixel')).toHaveCount(0)
    await page.goto('/de/registration')
    await page.waitForLoadState('networkidle')
    expect(metaRequests).toEqual([])

    await page.getByRole('button', { name: de.consent.reject_all }).click()
    await expect(page.getByTestId('consent-banner')).toHaveCount(0)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('consent-banner')).toHaveCount(0)
    expect(metaRequests).toEqual([])
  })

  test('nach „Alle akzeptieren“ sendet die öffentliche Seite ein explizites PageView-Bild', async ({ page }) => {
    const metaRequests = trackMetaRequests(page)
    await page.goto('/de')
    await page.getByRole('button', { name: de.consent.accept_all }).click()
    await expect.poll(() => metaRequests.some(url => {
      const pixel = new URL(url)
      return pixel.hostname === 'www.facebook.com' && pixel.pathname === '/tr' && pixel.searchParams.get('ev') === 'PageView'
    })).toBe(true)
    expect(metaRequests.some(url => new URL(url).hostname === 'connect.facebook.net')).toBe(false)
    await expect(page.locator('script#meta-pixel')).toHaveCount(0)
    await expect(page.locator('noscript img[src*="facebook.com/tr"]')).toHaveCount(0)
  })

  test('wiederkehrende Besucher sehen kein Banner und laden nichts von Meta', async ({ page }) => {
    const metaRequests = trackMetaRequests(page)
    await page.addInitScript(() => localStorage.setItem('sitov-consent', JSON.stringify({ version: 1, marketing: false, decidedAt: new Date().toISOString() })))
    await page.goto('/de')
    await expect(page.locator('html')).toHaveAttribute('data-consent', 'set')
    await expect(page.getByTestId('consent-banner')).toHaveCount(0)
    await page.waitForLoadState('networkidle')
    expect(metaRequests).toEqual([])
  })

  test('das Banner steht im statischen HTML (kein spätes LCP-Element)', async ({ request }) => {
    const html = await (await request.get('/de')).text()
    expect(html).toContain('data-prompt="auto"')
    expect(html).toContain(de.consent.title)
    expect(html).not.toContain('connect.facebook.net')
  })

  test('Einwilligung lässt sich im Seitenfuß widerrufen', async ({ page }) => {
    trackMetaRequests(page)
    await page.goto('/de/privacy')
    await page.getByRole('button', { name: de.consent.accept_all }).click()
    await page.getByRole('button', { name: de.consent.settings_button }).click()
    const marketing = page.getByRole('switch', { name: de.consent.marketing_label })
    await expect(marketing).toBeChecked()
    await marketing.uncheck()
    await page.getByRole('button', { name: de.consent.save }).click()
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').marketing, 'sitov-consent')).toBe(false)
  })
})

test.describe('Crawling und Indexierung', () => {
  test('sitemap.xml ist gültig und führt x-default für jede URL', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('xml')
    const xml = await response.text()
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(match => match[1])
    expect(entries).toHaveLength(8 * LOCALES.length)
    expect(xml).not.toContain('<lastmod>')
    for (const entry of entries) {
      const loc = /<loc>([^<]+)<\/loc>/.exec(entry)?.[1] ?? ''
      expect(loc.startsWith(`${CANONICAL}/`)).toBe(true)
      for (const hreflang of [...LOCALES, 'x-default']) expect(entry).toContain(`hreflang="${hreflang}"`)
      expect(entry).toContain(`hreflang="x-default" href="${CANONICAL}/de`)
    }
    expect(xml).toContain(`<loc>${CANONICAL}/de/registration</loc>`)
    expect(xml).toContain(`<loc>${CANONICAL}/de/deutschkurse-hannover</loc>`)
    expect(xml).toContain(`<loc>${CANONICAL}/de/deutschkurse-online</loc>`)
  })

  test('robots.txt ist erreichbar und blockiert keine öffentliche Seite', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('User-Agent: *')
    expect(body).toContain(`Sitemap: ${CANONICAL}/sitemap.xml`)
    expect(body).not.toMatch(/Disallow: \/registration/)
    expect(body).toMatch(/Disallow: \/api\//)
  })

  test('OG-Bild liefert HTTP 200 als 1200×630-JPEG', async ({ page, request }) => {
    await page.goto('/de')
    const ogImage = await page.locator('meta[property="og:image"]').first().getAttribute('content')
    expect(ogImage).toBe(`${CANONICAL}/Bilder/og-sitov-academy.jpg`)
    await expect(page.locator('meta[property="og:image:width"]').first()).toHaveAttribute('content', '1200')
    await expect(page.locator('meta[property="og:image:height"]').first()).toHaveAttribute('content', '630')
    const response = await request.get(new URL(ogImage!).pathname)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/jpeg')
  })

  for (const [route, pagePath] of [['/de', ''], ['/uk/registration', '/registration'], ['/en/deutschkurse-hannover', '/deutschkurse-hannover'], ['/ru/deutschkurse-online', '/deutschkurse-online'], ['/tr/agb', '/agb'], ['/ru/privacy', '/privacy'], ['/en/imprint', '/imprint'], ['/de/cancellation', '/cancellation']] as const) {
    test(`${route}: canonical und hreflang inkl. x-default im <head>`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${CANONICAL}${route}`)
      const alternates = await page.locator('link[rel="alternate"][hreflang]').evaluateAll(links =>
        Object.fromEntries(links.map(link => [link.getAttribute('hreflang'), link.getAttribute('href')])))
      expect(alternates).toEqual({
        'x-default': `${CANONICAL}/de${pagePath}`,
        ...Object.fromEntries(LOCALES.map(locale => [locale, `${CANONICAL}/${locale}${pagePath}`])),
      })
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
      const googleBot = await page.locator('meta[name="googlebot"]').getAttribute('content')
      expect(googleBot).toContain('max-image-preview:large')
      expect(googleBot).toContain('max-snippet:-1')
      expect(await page.title()).not.toMatch(/Sitov Academy.*\|\s*Sitov Academy/)
    })
  }

  for (const locale of LOCALES) {
    test(`${locale}: Layout-Fallback ist übersetzt und Kontoseiten bleiben noindex`, async ({ request }) => {
      const dict = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', `${locale}.json`), 'utf-8'))
      const response = await request.get(`/${locale}/login`)
      expect(response.status()).toBe(200)
      const html = await response.text()
      // Der robots-Wert der privaten Seite ersetzt die öffentlichen Einstellungen.
      expect(html).toContain('<meta name="robots" content="noindex, nofollow"')
      expect(html).not.toContain('<meta name="googlebot"')
      const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1]
      const escapedDescription = dict.meta.description.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      expect(description).toBe(escapedDescription)
    })
  }

  test('ungültige Sprachsegmente sind 404 statt Seitenkopien', async ({ request }) => {
    for (const trap of ['/authx', '/authx/login', '/apifoo/registration', '/Bilderx/agb']) {
      const response = await request.get(trap, { maxRedirects: 0 })
      expect(response.status(), trap).toBe(404)
    }
  })

  test('/ leitet ohne Kette direkt auf /de', async ({ request }) => {
    const response = await request.get('/', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    expect(new URL(response.headers().location, 'http://base.invalid').pathname).toBe('/de')
  })

  test('alte Seitenlinks behalten die richtige Seite, Sprache und Kampagnenparameter', async ({ request }) => {
    for (const [source, destination] of [
      ['/impressum?lang=en&utm_source=google', '/en/imprint?utm_source=google'],
      ['/AGB.html?lang=uk', '/uk/agb'],
      ['/registration?lang=ru&courseId=test&trial=1', '/ru/registration?courseId=test&trial=1'],
    ]) {
      const response = await request.get(source, { maxRedirects: 0 })
      expect(response.status()).toBe(301)
      const location = new URL(response.headers().location, 'http://base.invalid')
      expect(location.pathname + location.search).toBe(destination)
    }
  })

  test('unbekannte alte Sprachlinks liefern weiterhin 404 und keine Startseitenkopie', async ({ request }) => {
    const response = await request.get('/sitov-missing-seo-page?lang=tr&utm_source=test', { maxRedirects: 0 })
    expect(response.status()).toBe(301)
    const target = new URL(response.headers().location, 'http://base.invalid')
    expect(target.pathname + target.search).toBe('/tr/sitov-missing-seo-page?utm_source=test')
    expect((await request.get(target.pathname + target.search)).status()).toBe(404)
  })
})

test.describe('Strukturierte Daten', () => {
  for (const locale of LOCALES) {
    test(`${locale}: JSON-LD ist gültiges schema.org mit sichtbarer FAQPage`, async ({ page }) => {
      await page.goto(`/${locale}`)
      const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
      expect(blocks.length).toBeGreaterThan(0)
      const graph = blocks.flatMap(block => {
        const data = JSON.parse(block)
        expect(data['@context']).toBe('https://schema.org')
        return data['@graph'] ?? [data]
      })
      for (const node of graph) expect(node['@type']).toBeTruthy()
      const types = graph.flatMap(node => [node['@type']].flat())
      expect(types).toEqual(expect.arrayContaining(['EducationalOrganization', 'WebSite', 'BreadcrumbList', 'FAQPage']))
      expect(JSON.stringify(graph)).not.toContain('217.154.228.254')

      const faq = graph.find(node => node['@type'] === 'FAQPage')
      expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3)
      const visibleQuestions = await page.locator('#faq summary').allInnerTexts()
      expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visibleQuestions.map(text => text.trim()))
      for (const question of faq.mainEntity) {
        expect(question['@type']).toBe('Question')
        expect(question.acceptedAnswer['@type']).toBe('Answer')
        expect(question.acceptedAnswer.text.length).toBeGreaterThan(20)
        await expect(page.locator('#faq').getByText(question.acceptedAnswer.text, { exact: true })).toHaveCount(1)
      }
    })
  }
})
