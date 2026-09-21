import type { AdminTranslationKey } from '@/lib/admin-i18n'

/**
 * Geteilte Informationsarchitektur des Lehrer-Dashboards.
 *
 * Die früher flache Top-Navigation (13 gleichrangige Tabs) ist hier in fünf
 * logische Hauptbereiche gruppiert. Der Aufbau ist bewusst frei von React/DOM,
 * damit ihn Server- wie Client-Komponenten teilen können. Die konkreten
 * Icon-Komponenten werden erst in `TeacherSidebar` (Client) aufgelöst.
 */
export type AdminNavIcon =
  | 'overview'
  | 'finance'
  | 'registrations'
  | 'invoices'
  | 'bookings'
  | 'students'
  | 'courses'
  | 'content'
  | 'media'
  | 'videos'
  | 'vocabulary'
  | 'grammar'
  | 'pronunciation'
  | 'analytics'
  | 'feedback'

export interface AdminNavItem {
  /** i18n-Schlüssel aus dem `admin`-Dictionary. */
  labelKey: AdminTranslationKey
  href: string
  icon: AdminNavIcon
  /** Aktiv nur bei exakter Pfadgleichheit (für Sammel-/Hub-Routen). */
  exact?: boolean
}

export interface AdminNavSection {
  /** Gruppenüberschrift; `null` für eine überschriftenlose Einzelgruppe. */
  labelKey: AdminTranslationKey | null
  items: AdminNavItem[]
}

/** Baut die gruppierte Navigation für eine Sprache mit vollständigen Pfaden. */
export function buildAdminNav(lang: string): AdminNavSection[] {
  const base = `/${lang}/admin`
  return [
    {
      labelKey: null,
      items: [{ labelKey: 'nav_overview', href: base, icon: 'overview', exact: true }],
    },
    {
      labelKey: 'group_admin_finance',
      items: [
        { labelKey: 'nav_finance', href: `${base}/finance`, icon: 'finance' },
        { labelKey: 'nav_registrations', href: `${base}/registrations`, icon: 'registrations' },
        { labelKey: 'nav_invoices', href: `${base}/invoices`, icon: 'invoices' },
        { labelKey: 'nav_bookings', href: `${base}/bookings`, icon: 'bookings' },
        { labelKey: 'nav_students', href: `${base}/students`, icon: 'students' },
      ],
    },
    {
      labelKey: 'group_courses',
      items: [{ labelKey: 'nav_courses', href: `${base}/courses`, icon: 'courses' }],
    },
    {
      labelKey: 'group_content',
      items: [
        { labelKey: 'nav_content_hub', href: `${base}/content`, icon: 'content', exact: true },
        { labelKey: 'nav_media', href: `${base}/content/media`, icon: 'media' },
        { labelKey: 'nav_videos', href: `${base}/content/videos`, icon: 'videos' },
        { labelKey: 'nav_vocabulary', href: `${base}/content/vocabulary`, icon: 'vocabulary' },
        { labelKey: 'nav_grammar', href: `${base}/content/exercises`, icon: 'grammar' },
        { labelKey: 'nav_pronunciation', href: `${base}/content/pronunciation`, icon: 'pronunciation' },
      ],
    },
    {
      labelKey: 'group_analytics',
      items: [
        { labelKey: 'nav_analytics', href: `${base}/analytics`, icon: 'analytics' },
        { labelKey: 'nav_feedback', href: `${base}/submissions`, icon: 'feedback' },
      ],
    },
  ]
}

/** Aktiv-Erkennung für ein Navigationsziel anhand des aktuellen Pfads. */
export function isNavItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
