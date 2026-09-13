/**
 * Sprach-Routing, das die Middleware und die Auth-Callback-Route teilen.
 *
 * Die Bestätigungslinks aus den E-Mails zeigen auf `/auth/confirm?lang=de&…`.
 * Würde die Middleware `?lang=` wie eine alte Marketing-URL behandeln, landete
 * der Nutzer auf `/de` – ohne Token, ohne Sitzung, ohne Konto.
 */

export const LOCALES = ['de', 'en', 'uk', 'ru', 'tr'] as const

export type UiLocale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: UiLocale = 'de'

/**
 * Alte Sprachkürzel aus den `?lang=`-URLs der Vorgänger-Website.
 * `ua` ist das alte Kürzel für Ukrainisch, heute `uk`.
 */
export const LEGACY_LANG_MAP: Readonly<Record<string, string>> = {
  de: 'de',
  en: 'en',
  ru: 'ru',
  tr: 'tr',
  uk: 'uk',
  ua: 'uk',
}

/**
 * Pfade ohne Sprachpräfix. `/auth` ist zwingend: Die Query trägt Einmal-Token.
 */
export const LOCALE_EXEMPT_PREFIXES = ['/auth', '/api'] as const

export function isLocaleExempt(pathname: string): boolean {
  return LOCALE_EXEMPT_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function localeFromPathname(pathname: string): UiLocale | null {
  const candidate = LOCALES.find(
    locale => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
  return candidate ?? null
}

/**
 * Ob eine alte `?lang=`-URL auf `/{lang}` umgeleitet werden darf.
 *
 * Bewusst false für `/auth/confirm`: Dort ist `lang` ein Parameter der
 * Bestätigung, keine Legacy-Startseite.
 */
export function shouldApplyLegacyLangRedirect(
  pathname: string,
  legacyLang: string | null
): boolean {
  if (!legacyLang) return false
  if (isLocaleExempt(pathname)) return false
  if (localeFromPathname(pathname)) return false
  return true
}

export function mapLegacyLang(raw: string): UiLocale {
  const mapped = LEGACY_LANG_MAP[raw.toLowerCase()]
  return LOCALES.find(locale => locale === mapped) ?? DEFAULT_LOCALE
}

/**
 * Endonyme der Oberflächensprachen (jede Sprache in ihrer eigenen Schrift).
 *
 * Bewusst NICHT übersetzt: Ein Sprachumschalter zeigt jede Option in ihrer
 * eigenen Sprache an, damit sie unabhängig von der aktuellen UI-Sprache
 * erkennbar ist (Standard bei mehrsprachigen Oberflächen).
 */
export const UI_LOCALE_ENDONYMS: Readonly<Record<UiLocale, string>> = {
  de: 'Deutsch',
  en: 'English',
  uk: 'Українська',
  ru: 'Русский',
  tr: 'Türkçe',
}

/** Native and interface languages use the same ISO codes. */
export function localeFromNativeLanguage(value: string | null | undefined): UiLocale {
  return toUiLocale(value)
}

/** Sichere Normalisierung eines beliebigen Werts auf eine bekannte UI-Locale. */
export function toUiLocale(value: string | null | undefined): UiLocale {
  return LOCALES.find(locale => locale === value) ?? DEFAULT_LOCALE
}

const LOCALE_PREFIX = /^\/(de|en|uk|ru|tr)(?=\/|$)/
const UI_LANGUAGE_APP_PREFIXES = ['/dashboard', '/admin'] as const

/** Tauscht oder setzt das Sprachpräfix, ohne den Rest des Pfads zu verändern. */
export function withUiLocale(pathname: string, lang: UiLocale): string {
  const stripped = pathname.replace(LOCALE_PREFIX, '') || '/'
  return stripped === '/' ? `/${lang}` : `/${lang}${stripped}`
}

/**
 * Erlaubt nur interne Dashboard-/Admin-Pfade als Ziel nach einem Sprachwechsel.
 * Verhindert Open Redirects (`//`, Protokolle) und fremde App-Routen.
 */
export function safeUiLanguageNextPath(raw: unknown, lang: UiLocale): string {
  const fallback = `/${lang}/dashboard/profile`
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || /[:\\]/.test(raw)) return fallback
  const pathOnly = raw.split(/[?#]/, 1)[0] ?? raw
  const stripped = pathOnly.replace(LOCALE_PREFIX, '') || '/'
  const allowed = UI_LANGUAGE_APP_PREFIXES.some(
    prefix => stripped === prefix || stripped.startsWith(`${prefix}/`)
  )
  return allowed ? withUiLocale(pathOnly, lang) : fallback
}

export function isProtectedPath(pathname: string): boolean {
  return (
    pathname.includes('/dashboard') ||
    pathname.includes('/admin')
  )
}

export function isAuthPath(pathname: string): boolean {
  return pathname.includes('/login') || pathname.includes('/register')
}
