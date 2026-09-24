import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  DEFAULT_LOCALE,
  isAuthPath,
  isLocaleExempt,
  isProtectedPath,
  localeFromPathname,
  mapLegacyLang,
  shouldApplyLegacyLangRedirect,
  withUiLocale,
} from '@/lib/locale-routing'
import { updateSession } from './utils/supabase/middleware'

/**
 * Leitet weiter und übernimmt dabei die Cookies, die Supabase beim
 * Session-Refresh gesetzt hat. Ohne diese Übernahme verliert jede
 * Weiterleitung das erneuerte Token und der Nutzer wird abgemeldet.
 */
function redirectPreservingSession(
  url: URL,
  sessionResponse: NextResponse,
  status?: 301 | 302 | 307
): NextResponse {
  const response = status
    ? NextResponse.redirect(url, { status })
    : NextResponse.redirect(url)

  sessionResponse.cookies.getAll().forEach(cookie => {
    response.cookies.set(cookie)
  })
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = sessionResponse.headers.get(header)
    if (value) response.headers.set(header, value)
  }

  return response
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams

  // 1. Supabase-Session aktualisieren (setzt ggf. neue Cookies)
  const { supabaseResponse, user, uiLanguage } = isProtectedPath(pathname) || isAuthPath(pathname)
    ? await updateSession(request)
    : { supabaseResponse: NextResponse.next({ request }), user: null, uiLanguage: null }

  // 2. Auth- und API-Routen unverändert durchlassen: Ihre Query-Parameter
  //    tragen Einmal-Token, die keine Weiterleitung überleben würden.
  if (isLocaleExempt(pathname)) {
    return supabaseResponse
  }

  // 3. Legacy-Redirect: alte .html-Seiten → neue Pfade
  if (pathname === '/AGB.html') {
    return redirectPreservingSession(
      new URL(`/${DEFAULT_LOCALE}/agb`, request.url),
      supabaseResponse,
      301
    )
  }

  const currentLocale = localeFromPathname(pathname)

  // 4. Legacy-Redirect: `?lang=xx` → `/xx`. Bewusst nur für Pfade ohne
  //    Sprachpräfix und nie für `/auth/*`, damit Bestätigungslinks ihre
  //    Token behalten.
  const legacyLang = searchParams.get('lang')
  if (shouldApplyLegacyLangRedirect(pathname, legacyLang) && legacyLang) {
    const mappedLang = mapLegacyLang(legacyLang)
    return redirectPreservingSession(
      new URL(`/${mappedLang}`, request.url),
      supabaseResponse,
      301
    )
  }

  // 5. Fehlt das Sprachpräfix, auf die Standardsprache umleiten. Query-Parameter
  //    bleiben erhalten, damit Kampagnen- und Rückkehr-Links nicht abbrechen.
  if (!currentLocale) {
    // `/` direkt auf `/de` (nicht `/de/`): sonst folgt eine zweite
    // Weiterleitung auf die Variante ohne Schrägstrich (Redirect-Kette).
    const suffix = pathname === '/' ? '' : `${pathname.startsWith('/') ? '' : '/'}${pathname}`
    const target = new URL(`/${uiLanguage ?? DEFAULT_LOCALE}${suffix}`, request.url)
    target.search = request.nextUrl.search
    return redirectPreservingSession(target, supabaseResponse, uiLanguage ? 307 : 301)
  }

  // 6. Routenschutz
  if (isProtectedPath(pathname) && !user) {
    return redirectPreservingSession(
      new URL(`/${currentLocale}/login`, request.url),
      supabaseResponse
    )
  }

  if (isAuthPath(pathname) && user) {
    return redirectPreservingSession(
      new URL(`/${uiLanguage ?? currentLocale}/dashboard`, request.url),
      supabaseResponse
    )
  }

  if (isProtectedPath(pathname) && user && uiLanguage && uiLanguage !== currentLocale) {
    const target = request.nextUrl.clone()
    target.pathname = withUiLocale(pathname, uiLanguage)
    return redirectPreservingSession(target, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Matcht alle Pfade außer:
     * 1. /api (API-Routen)
     * 2. /auth (Bestätigungs- und Recovery-Links aus E-Mails)
     * 3. /_next (Next.js Interna wie static, image, data)
     * 4. /Bilder, /public (Assets)
     * 5. favicon.ico, sitemap.xml, robots.txt, Google-Site-Verification
     *
     * `/auth` steht hier bewusst doppelt (Matcher + isLocaleExempt): Fällt der
     * Matcher-Ausschluss weg, fängt die Logik oben den Token-Verlust trotzdem ab.
     */
    '/((?!api|auth|_next|Bilder|public|favicon.ico|sitemap.xml|robots.txt|google236d470275910d3c.html).*)',
  ],
}
