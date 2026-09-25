import {
  DASHBOARD_ROUTE_KEYS,
  type DashboardRouteSegment,
  type DashboardTranslator,
} from '@/lib/dashboard-i18n'

export type CrumbKind = 'home' | 'level' | 'vocabulary' | 'path' | 'pronunciation' | 'media'
  | 'lessons' | 'calendar' | 'profile' | 'page'

export interface Crumb {
  name: string
  href: string
  kind: CrumbKind
}

const KINDS: Partial<Record<string, CrumbKind>> = {
  dashboard: 'home', vocabulary: 'vocabulary', exercises: 'path', path: 'path',
  pronunciation: 'pronunciation', videos: 'media', media: 'media', lessons: 'lessons',
  calendar: 'calendar', profile: 'profile',
}

/**
 * Der volle Pfad für die Brotkrumen (D7), z. B. `Start › A1.1 › Vokabeln ›
 * Lektionen`. Das Segment `level` selbst ist kein Ort und entfällt; das
 * Niveau-Kürzel steht für sich. Beschriftungen kommen aus
 * `DASHBOARD_ROUTE_KEYS`; eine Zahl nach `path` wird „Pfad n", unbekannte
 * Kennungen (Video-ID) übernehmen `detailLabel` statt einer UUID.
 */
export function buildBreadcrumbs(pathname: string, lang: string, t: DashboardTranslator, detailLabel?: string): Crumb[] {
  const segments = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean)
  const start = segments.indexOf('dashboard')
  if (start === -1) return []
  const crumbs: Crumb[] = []
  let href = `/${lang}`
  let previous = ''
  for (const segment of segments.slice(start)) {
    href += `/${segment}`
    if (segment === 'level') { previous = segment; continue }
    const decoded = safeDecode(segment)
    const key = DASHBOARD_ROUTE_KEYS[segment as DashboardRouteSegment]
    if (previous === 'level') crumbs.push({ name: decoded, href, kind: 'level' })
    else if (previous === 'path' && /^\d+$/.test(segment)) crumbs.push({ name: t('nav_path_n', { n: segment }), href, kind: 'path' })
    else if (key) crumbs.push({ name: t(key), href, kind: KINDS[segment] ?? 'page' })
    else crumbs.push({ name: detailLabel ?? decoded, href, kind: 'page' })
    previous = segment
  }
  return crumbs
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}
