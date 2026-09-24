import type { Metadata } from 'next'
import { CANONICAL_SITE_URL } from '@/lib/site-url'
import { DEFAULT_LOCALE, LOCALES } from '@/lib/locale-routing'

/**
 * Suchmaschinen-Metadaten an einer Stelle: canonical, hreflang (inkl.
 * `x-default`), Sitemap, OpenGraph und JSON-LD bauen alle auf derselben
 * kanonischen Origin auf. Nie eine Domain hartcodieren.
 */

export const SITE_NAME = 'Sitov Academy'

/** Statisches 1200×630-Vorschaubild (`public/Bilder/og-sitov-academy.jpg`). */
export const OG_IMAGE = { path: '/Bilder/og-sitov-academy.jpg', width: 1200, height: 630 } as const

export const OG_LOCALES: Readonly<Record<string, string>> = {
  de: 'de_DE',
  en: 'en_US',
  uk: 'uk_UA',
  ru: 'ru_RU',
  tr: 'tr_TR',
}

/** Öffentliche, indexierbare Seiten (ohne Sprachpräfix). */
export const INDEXABLE_PAGES = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/registration', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/agb', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/privacy', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/imprint', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/cancellation', changeFrequency: 'monthly', priority: 0.3 },
] as const

export type IndexablePath = (typeof INDEXABLE_PAGES)[number]['path']

export function absoluteUrl(path: string, origin: string = CANONICAL_SITE_URL): string {
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}

/** `/{lang}{path}` auf der kanonischen Origin; die Startseite ohne Schrägstrich. */
export function localizedUrl(lang: string, path: string = '', origin: string = CANONICAL_SITE_URL): string {
  return absoluteUrl(`/${lang}${path}`, origin)
}

/** hreflang-Cluster einer Seite: jede Sprache plus `x-default` (Deutsch). */
export function languageAlternates(path: string = '', origin: string = CANONICAL_SITE_URL): Record<string, string> {
  return {
    'x-default': localizedUrl(DEFAULT_LOCALE, path, origin),
    ...Object.fromEntries(LOCALES.map(locale => [locale, localizedUrl(locale, path, origin)])),
  }
}

export function pageAlternates(lang: string, path: string = ''): NonNullable<Metadata['alternates']> {
  return { canonical: localizedUrl(lang, path), languages: languageAlternates(path) }
}

interface PageMetadataInput {
  lang: string
  path: IndexablePath
  title: string
  description: string
  imageAlt: string
  /** Startseite: Titel ohne Layout-Template, weil er die Marke schon enthält. */
  absoluteTitle?: boolean
}

/** Metadaten einer indexierbaren Seite inkl. hreflang, OpenGraph und Twitter Card. */
export function buildPageMetadata({ lang, path, title, description, imageAlt, absoluteTitle = false }: PageMetadataInput): Metadata {
  const url = localizedUrl(lang, path)
  const image = { url: absoluteUrl(OG_IMAGE.path), width: OG_IMAGE.width, height: OG_IMAGE.height, alt: imageAlt }
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    robots: { index: true, follow: true },
    alternates: pageAlternates(lang, path),
    openGraph: {
      title: socialTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: OG_LOCALES[lang] ?? OG_LOCALES[DEFAULT_LOCALE],
      alternateLocale: LOCALES.filter(locale => locale !== lang).map(locale => OG_LOCALES[locale]),
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: socialTitle, description, images: [image] },
  }
}

export interface FaqEntry {
  question: string
  answer: string
}

/** Schema.org FAQPage; Fragen und Antworten müssen sichtbar auf der Seite stehen. */
export function buildFaqPageJsonLd(lang: string, items: readonly FaqEntry[]) {
  return {
    '@type': 'FAQPage',
    '@id': `${localizedUrl(lang)}#faq`,
    inLanguage: lang,
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/** JSON für `<script type="application/ld+json">`, ohne `</script>`-Ausbruch. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
