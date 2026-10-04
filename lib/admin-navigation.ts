import type { AdminTranslationKey } from '@/lib/admin-i18n'

/**
 * Geteilte Informationsarchitektur des Lehrer-Dashboards (Phase 11.2).
 *
 * Mobile first: Auf dem Smartphone erreichen Lehrkräfte die vier häufigsten
 * Ziele über die untere Tab-Leiste, alles Weitere über „Menü“. Innerhalb eines
 * Bereichs mit mehreren Seiten zeigt die Shell wischbare Unterreiter. Ab `lg`
 * übernimmt eine gruppierte Seitenleiste dieselbe Struktur.
 *
 * Der Aufbau ist bewusst frei von React/DOM, damit ihn Server- wie
 * Client-Komponenten teilen können. Icons werden erst in der Shell aufgelöst.
 */
export type AdminNavIcon =
  | 'overview'
  | 'newStudents'
  | 'students'
  | 'corrections'
  | 'examSimulation'
  | 'analytics'
  | 'courses'
  | 'cancellations'
  | 'vocabulary'
  | 'path'
  | 'media'
  | 'pronunciation'
  | 'finance'
  | 'registrations'
  | 'invoices'
  | 'bookings'
  | 'certificates'
  | 'imports'
  | 'menu'

/** Zähler, die die Shell als Badge an Navigationsziele hängt. */
export type AdminNavBadge = 'newStudents' | 'corrections'
export type AdminNavCounts = Partial<Record<AdminNavBadge, number | null>>

export type AdminSectionId = 'overview' | 'students' | 'exams' | 'courses' | 'content' | 'administration'

export interface AdminNavItem {
  /** i18n-Schlüssel aus dem `admin`-Dictionary. */
  labelKey: AdminTranslationKey
  /** Kurzform für enge Unterreiter; sonst `labelKey`. */
  shortLabelKey?: AdminTranslationKey
  href: string
  icon: AdminNavIcon
  /** Aktiv nur bei exakter Pfadgleichheit (für die Startseite). */
  exact?: boolean
  badge?: AdminNavBadge
}

export interface AdminNavSection {
  id: AdminSectionId
  /** Gruppenüberschrift; `null` für die überschriftenlose Startgruppe. */
  labelKey: AdminTranslationKey | null
  /** Pfade, die ohne eigenen Menüpunkt zu diesem Bereich gehören (z. B. Hubs). */
  basePaths?: string[]
  items: AdminNavItem[]
}

/** Baut die gruppierte Navigation für eine Sprache mit vollständigen Pfaden. */
export function buildAdminNav(lang: string): AdminNavSection[] {
  const base = `/${lang}/admin`
  return [
    {
      id: 'overview',
      labelKey: null,
      items: [{ labelKey: 'nav_overview', href: base, icon: 'overview', exact: true }],
    },
    {
      id: 'students',
      labelKey: 'group_students',
      items: [
        { labelKey: 'nav_new_students', shortLabelKey: 'nav_new_students_short', href: `${base}/new-students`, icon: 'newStudents', badge: 'newStudents' },
        { labelKey: 'nav_all_students', shortLabelKey: 'nav_all_students_short', href: `${base}/students`, icon: 'students' },
        { labelKey: 'nav_corrections', href: `${base}/submissions`, icon: 'corrections', badge: 'corrections' },
        { labelKey: 'nav_analytics', href: `${base}/analytics`, icon: 'analytics' },
      ],
    },
    {
      id: 'exams',
      labelKey: 'group_exams',
      items: [{ labelKey: 'nav_exam_simulation', href: `${base}/exam-simulation`, icon: 'examSimulation' }],
    },
    {
      id: 'courses',
      labelKey: 'group_courses',
      items: [
        { labelKey: 'nav_courses', href: `${base}/courses`, icon: 'courses' },
        { labelKey: 'nav_cancellations', href: `${base}/courses/cancellations`, icon: 'cancellations' },
      ],
    },
    {
      id: 'content',
      labelKey: 'group_content',
      basePaths: [`${base}/content`],
      items: [
        { labelKey: 'nav_vocabulary', href: `${base}/content/vocabulary`, icon: 'vocabulary' },
        { labelKey: 'nav_learning_path', href: `${base}/content/exercises`, icon: 'path' },
        { labelKey: 'nav_media', href: `${base}/content/media`, icon: 'media' },
        { labelKey: 'nav_pronunciation', href: `${base}/content/pronunciation`, icon: 'pronunciation' },
      ],
    },
    {
      id: 'administration',
      labelKey: 'group_administration',
      items: [
        { labelKey: 'nav_finance', href: `${base}/finance`, icon: 'finance' },
        { labelKey: 'nav_registrations', href: `${base}/registrations`, icon: 'registrations' },
        { labelKey: 'nav_invoices', href: `${base}/invoices`, icon: 'invoices' },
        { labelKey: 'nav_bookings', href: `${base}/bookings`, icon: 'bookings' },
        { labelKey: 'nav_certificates', href: `${base}/finance/certificates`, icon: 'certificates' },
        { labelKey: 'nav_imports', href: `${base}/finance/imports`, icon: 'imports' },
      ],
    },
  ]
}

function matches(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Aktives Ziel = längster passender Pfad. So bleibt „Kurse“ auf
 * `/courses/cancellations` inaktiv und „Monatsübersicht“ auf
 * `/finance/certificates`, ohne jede Route einzeln als exakt zu markieren.
 */
export function findActiveNavItem(pathname: string, sections: AdminNavSection[]): AdminNavItem | null {
  let best: AdminNavItem | null = null
  for (const section of sections) {
    for (const item of section.items) {
      if (matches(pathname, item.href, item.exact) && (!best || item.href.length > best.href.length)) best = item
    }
  }
  return best
}

export function findActiveSection(pathname: string, sections: AdminNavSection[]): AdminNavSection | null {
  const item = findActiveNavItem(pathname, sections)
  if (item) return sections.find(section => section.items.includes(item)) ?? null
  return sections.find(section => section.basePaths?.some(path => matches(pathname, path))) ?? null
}

/** Aktiv-Erkennung für ein einzelnes Navigationsziel im Kontext aller Ziele. */
export function isNavItemActive(pathname: string, item: AdminNavItem, sections?: AdminNavSection[]): boolean {
  if (!sections) return matches(pathname, item.href, item.exact)
  return findActiveNavItem(pathname, sections) === item
}

export interface AdminTabbarItem {
  id: 'overview' | 'newStudents' | 'students' | 'courses' | 'menu'
  labelKey: AdminTranslationKey
  icon: AdminNavIcon
  /** `null` für den Menü-Knopf, der das Blatt mit allen Bereichen öffnet. */
  href: string | null
  badge?: AdminNavBadge
}

/** Untere Tab-Leiste auf dem Smartphone: vier Ziele plus „Menü“. */
export function buildAdminTabbar(lang: string): AdminTabbarItem[] {
  const base = `/${lang}/admin`
  return [
    { id: 'overview', labelKey: 'tab_overview', icon: 'overview', href: base },
    { id: 'newStudents', labelKey: 'tab_new_students', icon: 'newStudents', href: `${base}/new-students`, badge: 'newStudents' },
    { id: 'students', labelKey: 'tab_students', icon: 'students', href: `${base}/students` },
    { id: 'courses', labelKey: 'tab_courses', icon: 'courses', href: `${base}/courses` },
    { id: 'menu', labelKey: 'tab_menu', icon: 'menu', href: null },
  ]
}

/** Welcher Tab der unteren Leiste zur aktuellen Seite gehört. */
export function activeTabbarId(pathname: string, sections: AdminNavSection[]): AdminTabbarItem['id'] {
  const item = findActiveNavItem(pathname, sections)
  const section = findActiveSection(pathname, sections)
  if (section?.id === 'overview') return 'overview'
  if (item?.icon === 'newStudents') return 'newStudents'
  if (section?.id === 'students') return 'students'
  if (section?.id === 'courses') return 'courses'
  return 'menu'
}
