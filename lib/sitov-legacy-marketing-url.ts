import {
  DEFAULT_LOCALE,
  isLocaleExempt,
  localeFromPathname,
  mapLegacyLang,
  shouldApplyLegacyLangRedirect,
} from '@/lib/locale-routing'

// Nur bekannte alte Seiten auf ihre inhaltlich entsprechende Seite umleiten.
// Unbekannte Pfade bleiben erhalten, damit sie weiterhin einen 404 liefern.
const SITOV_LEGACY_PAGE_PATHS = new Map([
  ['/AGB.html', '/agb'],
  ['/Impressum.html', '/imprint'],
  ['/impressum', '/imprint'],
])

/** Alte Seiten-/Sprachlinks korrigieren; Origin und übrige Query bleiben erhalten. */
export function sitovLegacyMarketingUrl(url: URL): URL | null {
  const currentLocale = localeFromPathname(url.pathname)
  const pagePath = currentLocale ? url.pathname.slice(currentLocale.length + 1) || '/' : url.pathname
  // Auch versehentlich sprachpräfixierte Token-Endpunkte niemals anfassen.
  if (isLocaleExempt(pagePath)) return null

  const mappedPath = SITOV_LEGACY_PAGE_PATHS.get(pagePath)
  const legacyLang = url.searchParams.get('lang')
  const consumesLegacyLang = shouldApplyLegacyLangRedirect(url.pathname, legacyLang)
  if (!mappedPath && !consumesLegacyLang) return null

  const locale = currentLocale ?? (legacyLang ? mapLegacyLang(legacyLang) : DEFAULT_LOCALE)
  const target = new URL(url)
  const suffix = mappedPath ?? (pagePath === '/' ? '' : pagePath)
  target.pathname = `/${locale}${suffix}`
  if (consumesLegacyLang) target.searchParams.delete('lang')
  return target
}
