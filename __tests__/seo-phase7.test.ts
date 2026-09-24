/**
 * Phase 7 — SEO für die Google Search Console.
 * sitemap.xml inkl. x-default · robots.txt · hreflang/canonical · FAQPage-JSON-LD · OG-Bild 1200×630.
 */
import fs from 'fs'
import path from 'path'

const CANONICAL = 'https://www.sitov-academy.com'
const DEPLOYMENT = 'https://217.154.228.254'
const LOCALES = ['de', 'en', 'uk', 'ru', 'tr']

type SeoModule = typeof import('@/lib/seo')
type SitemapModule = typeof import('@/app/sitemap')
type RobotsModule = typeof import('@/app/robots')

/** Module mit der Produktions-Konstellation laden: VPS unter IP, Domain als canonical. */
function loadWithProductionEnv<T>(load: () => T): T {
  const originalEnv = process.env
  process.env = { ...originalEnv, NODE_ENV: 'production', CANONICAL_SITE_URL: CANONICAL, NEXT_PUBLIC_SITE_URL: DEPLOYMENT, SITE_URL: DEPLOYMENT }
  try {
    let loaded!: T
    jest.isolateModules(() => { loaded = load() })
    return loaded
  } finally {
    process.env = originalEnv
  }
}

const seo = loadWithProductionEnv(() => require('@/lib/seo') as SeoModule)
const sitemap = loadWithProductionEnv(() => (require('@/app/sitemap') as SitemapModule).default)
const robots = loadWithProductionEnv(() => (require('@/app/robots') as RobotsModule).default)

const dictionaries = Object.fromEntries(LOCALES.map(locale => [
  locale,
  JSON.parse(fs.readFileSync(path.join(process.cwd(), 'dictionaries', `${locale}.json`), 'utf-8')),
]))

describe('hreflang und canonical', () => {
  it.each(['', '/registration', '/agb', '/privacy', '/imprint', '/cancellation'])('baut für "%s" einen vollständigen Cluster inkl. x-default', page => {
    const languages = seo.languageAlternates(page)
    expect(Object.keys(languages).sort()).toEqual(['de', 'en', 'ru', 'tr', 'uk', 'x-default'])
    expect(languages['x-default']).toBe(`${CANONICAL}/de${page}`)
    for (const locale of LOCALES) expect(languages[locale]).toBe(`${CANONICAL}/${locale}${page}`)
  })

  it('setzt canonical selbstreferenzierend auf die Domain, nie auf die IP', () => {
    const metadata = seo.buildPageMetadata({ lang: 'uk', path: '/registration', title: 'T', description: 'D', imageAlt: 'A' })
    expect(metadata.alternates?.canonical).toBe(`${CANONICAL}/uk/registration`)
    expect(JSON.stringify(metadata)).not.toContain('217.154.228.254')
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })

  it('liefert OpenGraph und Twitter Card mit dem 1200×630-Bild', () => {
    const metadata = seo.buildPageMetadata({ lang: 'ru', path: '', title: 'Titel | Sitov Academy', description: 'D', imageAlt: 'Alt', absoluteTitle: true })
    expect(metadata.title).toEqual({ absolute: 'Titel | Sitov Academy' })
    expect(metadata.openGraph).toMatchObject({
      url: `${CANONICAL}/ru`,
      locale: 'ru_RU',
      images: [{ url: `${CANONICAL}/Bilder/og-sitov-academy.jpg`, width: 1200, height: 630, alt: 'Alt' }],
    })
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
  })

  it('hängt die Marke bei Unterseiten nur einmal an (Layout-Template)', () => {
    const metadata = seo.buildPageMetadata({ lang: 'de', path: '/agb', title: 'AGB', description: 'D', imageAlt: 'A' })
    expect(metadata.title).toBe('AGB')
    expect(metadata.openGraph?.title).toBe('AGB | Sitov Academy')
  })
})

describe('sitemap.xml', () => {
  const entries = sitemap()

  it('enthält jede indexierbare Seite in jeder Sprache genau einmal', () => {
    expect(entries).toHaveLength(seo.INDEXABLE_PAGES.length * LOCALES.length)
    expect(new Set(entries.map(entry => entry.url)).size).toBe(entries.length)
    expect(entries.map(entry => entry.url)).toEqual(expect.arrayContaining([`${CANONICAL}/de`, `${CANONICAL}/tr/registration`]))
  })

  it('führt für jeden Eintrag alle Sprachen plus x-default', () => {
    for (const entry of entries) {
      const languages = entry.alternates?.languages as Record<string, string>
      expect(Object.keys(languages).sort()).toEqual(['de', 'en', 'ru', 'tr', 'uk', 'x-default'])
      expect(Object.values(languages)).toContain(entry.url)
      expect(languages['x-default']).toMatch(new RegExp(`^${CANONICAL}/de`))
    }
  })

  it('verwendet ausschließlich die kanonische Origin', () => {
    const serialized = JSON.stringify(entries)
    expect(serialized).not.toContain(DEPLOYMENT)
    for (const entry of entries) expect(entry.url.startsWith(`${CANONICAL}/`)).toBe(true)
  })
})

describe('robots.txt', () => {
  const result = robots()
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules]

  it('lässt die Kursanmeldung und alle öffentlichen Seiten crawlen', () => {
    const disallowed = rules.flatMap(rule => [rule.disallow ?? []].flat())
    expect(disallowed).not.toContain('/registration')
    for (const blocked of disallowed) {
      for (const locale of LOCALES) {
        for (const page of seo.INDEXABLE_PAGES) expect(`/${locale}${page.path}`.startsWith(blocked)).toBe(false)
      }
    }
    expect(disallowed).toEqual(expect.arrayContaining(['/api/', '/auth/']))
  })

  it('verweist auf die Sitemap der kanonischen Domain', () => {
    expect(result.sitemap).toBe(`${CANONICAL}/sitemap.xml`)
    expect(result.host).toBe(CANONICAL)
  })
})

describe('FAQPage JSON-LD', () => {
  it.each(LOCALES)('%s: jede sichtbare Frage ist ein schema.org Question mit Answer', locale => {
    const items = dictionaries[locale].faq.items as { question: string; answer: string }[]
    expect(items.length).toBeGreaterThanOrEqual(3)
    const jsonLd = seo.buildFaqPageJsonLd(locale, items)
    expect(jsonLd['@type']).toBe('FAQPage')
    expect(jsonLd['@id']).toBe(`${CANONICAL}/${locale}#faq`)
    expect(jsonLd.mainEntity).toHaveLength(items.length)
    jsonLd.mainEntity.forEach((entity, index) => {
      expect(entity).toEqual({ '@type': 'Question', name: items[index].question, acceptedAnswer: { '@type': 'Answer', text: items[index].answer } })
      expect(entity.name.trim().length).toBeGreaterThan(5)
      expect(entity.acceptedAnswer.text.trim().length).toBeGreaterThan(20)
    })
    expect(new Set(items.map(item => item.question)).size).toBe(items.length)
  })

  it('serialisiert ohne </script>-Ausbruch und bleibt gültiges JSON', () => {
    const payload = { '@context': 'https://schema.org', text: '</script><script>alert(1)</script>' }
    const serialized = seo.serializeJsonLd(payload)
    expect(serialized).not.toContain('</script>')
    expect(JSON.parse(serialized)).toEqual(payload)
  })
})

describe('OpenGraph-Bild', () => {
  it('liegt als 1200×630-JPEG unter /Bilder/og-sitov-academy.jpg', () => {
    const file = path.join(process.cwd(), 'public', seo.OG_IMAGE.path)
    const bytes = fs.readFileSync(file)
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
    // SOF-Marker (Baseline/Progressive) enthält Höhe und Breite.
    let offset = 2
    let size: { width: number; height: number } | null = null
    while (offset < bytes.length) {
      const marker = bytes[offset + 1]
      const length = bytes.readUInt16BE(offset + 2)
      if (marker === 0xc0 || marker === 0xc2) {
        size = { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
        break
      }
      offset += 2 + length
    }
    expect(size).toEqual({ width: seo.OG_IMAGE.width, height: seo.OG_IMAGE.height })
    expect(bytes.length).toBeLessThan(1024 * 1024)
  })
})

describe('Crawling-Falle im Sprachsegment', () => {
  it('app/[lang]/layout.tsx erlaubt nur die generierten Sprachen', () => {
    const layout = fs.readFileSync(path.join(process.cwd(), 'app', '[lang]', 'layout.tsx'), 'utf-8')
    expect(layout).toMatch(/export const dynamicParams = false/)
    expect(layout).toMatch(/generateStaticParams\(\)\s*\{\s*return LOCALES\.map/)
  })

  it('enthält kein hartcodiertes Meta-Pixel und kein noscript-Tracking mehr', () => {
    const layout = fs.readFileSync(path.join(process.cwd(), 'app', '[lang]', 'layout.tsx'), 'utf-8')
    expect(layout).not.toMatch(/fbevents|facebook\.com\/tr|<noscript/)
  })
})
