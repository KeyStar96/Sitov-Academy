/** Explicit deployment origins prevent email links from depending on request headers. */
export const DEV_FALLBACK_SITE_URL = 'http://localhost:3000'

/** Nur die Variablen, die für die Auflösung gelesen werden. */
export interface SiteUrlEnv {
  CANONICAL_SITE_URL?: string
  NEXT_PUBLIC_SITE_URL?: string
  SITE_URL?: string
  NODE_ENV?: string
}

/**
 * Bringt eine Eingabe auf die Form `https://host` ohne Schrägstrich am Ende.
 * Gibt `null` zurück, wenn nichts Brauchbares übrig bleibt.
 */
export function normalizeOrigin(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null

  const trimmed = raw.trim()
  if (trimmed.length === 0) return null

  // Ein bereits vorhandenes Schema muss http oder https sein. Ohne diese Prüfung
  // würde aus `ftp://example.com` durch das Voranstellen von `https://` der
  // unsinnige Host `ftp` entstehen.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)?.[1]?.toLowerCase()
  if (scheme && scheme !== 'http' && scheme !== 'https') return null

  // Auch explizit konfigurierte Hostnamen ohne Schema unterstützen.
  const withProtocol = scheme ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (url.hostname.length === 0 || url.username || url.password) return null
    return `${url.protocol}//${url.host}`
  } catch {
    return null
  }
}

/** Baut aus den Weiterleitungs-Headern eine Origin. */
export function originFromHeaders(
  forwardedHost: string | null,
  forwardedProto: string | null,
  host: string | null
): string | null {
  // Bei mehreren Proxies steht in den Headern eine Liste; der erste Eintrag
  // ist der ursprüngliche Client-Request.
  const rawHost = (forwardedHost ?? host ?? '').split(',')[0]?.trim()
  if (!rawHost) return null

  const rawProto = (forwardedProto ?? '').split(',')[0]?.trim().toLowerCase()
  const isLocal = rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1')
  const protocol = rawProto === 'http' || rawProto === 'https' ? rawProto : isLocal ? 'http' : 'https'

  return normalizeOrigin(`${protocol}://${rawHost}`)
}

/** True für Loopback-Adressen, die außerhalb dieser Maschine nicht erreichbar sind. */
export function isLocalhostOrigin(origin: string | null): boolean {
  if (!origin) return false

  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1'
  } catch {
    return false
  }
}

/**
 * Explizite Deployment-Origin; Request-Header sind keine Konfigurationsquelle.
 */
export function resolveSiteUrl(env: SiteUrlEnv, _headerOrigin: string | null = null): string {
  const explicit = normalizeOrigin(env.NEXT_PUBLIC_SITE_URL) ?? normalizeOrigin(env.SITE_URL)
  if (explicit) return explicit

  if (env.NODE_ENV === 'production') throw new Error('NEXT_PUBLIC_SITE_URL must identify this VPS deployment')
  return DEV_FALLBACK_SITE_URL
}

/**
 * Öffentliche Origin für Suchmaschinen (canonical, hreflang, Sitemap, OG, JSON-LD).
 *
 * `CANONICAL_SITE_URL` gewinnt vor der Deployment-Origin: Der VPS läuft bis zum
 * DNS-Umzug unter seiner IP, Google soll aber nur die Domain als kanonisch sehen.
 * Mail- und Auth-Links bleiben bewusst auf `NEXT_PUBLIC_SITE_URL`.
 */
export function resolveCanonicalSiteUrl(env: SiteUrlEnv): string {
  return normalizeOrigin(env.CANONICAL_SITE_URL) ?? resolveSiteUrl(env)
}

/** Transactional links require a configured origin; request headers cannot supply it. */
export function resolveOutboundSiteUrl(env: SiteUrlEnv, _headerOrigin: string | null = null): string {
  const explicit = normalizeOrigin(env.NEXT_PUBLIC_SITE_URL) ?? normalizeOrigin(env.SITE_URL)
  if (explicit) return explicit
  if (env.NODE_ENV === 'production') throw new Error('SITE_URL is required for transactional email links')
  return DEV_FALLBACK_SITE_URL
}

/**
 * Setzt einen relativen Pfad an die Basis-URL an.
 *
 * Query-Parameter werden hier gesetzt und nicht per String-Verkettung, damit
 * Sonderzeichen (etwa in `next`) korrekt kodiert sind.
 */
export function buildSiteUrl(
  baseUrl: string,
  path: string,
  params: Readonly<Record<string, string>> = {}
): string {
  const base = new URL(baseUrl)
  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${baseUrl}/`)
  if (url.origin !== base.origin) throw new Error('Site links must remain on the configured origin')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

/** Kanonische Origin für Metadaten; Entwicklung bleibt auf localhost. */
export const CANONICAL_SITE_URL = resolveCanonicalSiteUrl(process.env as SiteUrlEnv)

/**
 * Basis für Redirects nach Auth-Callbacks.
 *
 * `NEXT_PUBLIC_SITE_URL` gewinnt in Produktion. Kommt die Anfrage von
 * localhost (Entwicklung, Playwright), bleibt der Redirect auf diesem Host –
 * sonst würden Tests und lokale Bestätigungen auf die Live-Domain springen,
 * und die Session-Cookies wären weg.
 */
export function resolveAuthRedirectOrigin(
  env: SiteUrlEnv,
  requestOrigin: string | null
): string {
  if (env.NODE_ENV !== 'production' && requestOrigin && isLocalhostOrigin(requestOrigin)) {
    return requestOrigin
  }
  return resolveSiteUrl(env)
}

/** Basis-URL aus der Deployment-Konfiguration. */
export async function getSiteUrl(): Promise<string> {
  return resolveSiteUrl(process.env as SiteUrlEnv)
}

/** Explizit konfigurierte E-Mail-Origin; nur Entwicklung erlaubt den Dev-Fallback. */
export async function getOutboundSiteUrl(): Promise<string> {
  return resolveOutboundSiteUrl(process.env as SiteUrlEnv)
}

/**
 * Absoluter Link auf dieser Site. Basis ist `NEXT_PUBLIC_SITE_URL` (bzw. die
 * Auflösung in `getSiteUrl`), nie eine hartcodierte localhost-Adresse.
 */
export async function buildPublicUrl(
  path: string,
  params: Readonly<Record<string, string>> = {}
): Promise<string> {
  return buildSiteUrl(await getSiteUrl(), path, params)
}

/** Wie `buildPublicUrl`, aber mit der Request-Origin als Quelle für lokale Hosts. */
export function buildAuthRedirectUrl(
  requestOrigin: string | null,
  path: string,
  params: Readonly<Record<string, string>> = {}
): string {
  const origin = resolveAuthRedirectOrigin(process.env as SiteUrlEnv, requestOrigin)
  return buildSiteUrl(origin, path, params)
}
