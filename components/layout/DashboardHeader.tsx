'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { studentTranslator } from '@/lib/student-ui-i18n'
import {
  createDashboardTranslator,
  DASHBOARD_ROUTE_KEYS,
  type DashboardRouteSegment,
  type DashboardTranslations,
} from '@/lib/dashboard-i18n'

export default function DashboardHeader({
  lang,
  translations,
  breadcrumbLabel,
}: {
  lang: string
  translations: DashboardTranslations
  breadcrumbLabel?: string
}) {
  const pathname = usePathname()
  const t = createDashboardTranslator(translations)
  const s = studentTranslator(lang)

  const segments = pathname.split('/').filter(Boolean)
  const dashboardIndex = segments.indexOf('dashboard')

  if (dashboardIndex === -1) return null

  const relevantSegments = segments.slice(dashboardIndex)
  const breadcrumbs: { name: string; href: string }[] = []
  let currentPath = `/${lang}`

  for (let i = 0; i < relevantSegments.length; i++) {
    const segment = relevantSegments[i]
    currentPath += `/${segment}`

    if (segment === 'level') continue

    const decodedSegment = decodeURIComponent(segment)
    const routeKey = DASHBOARD_ROUTE_KEYS[segment as DashboardRouteSegment]
    // Mediathek (videos/media) und Kalender tragen die Namen aus der App-Leiste.
    const displayName = segment === 'media' || segment === 'videos' ? s('media_title')
      : segment === 'calendar' ? s('calendar_title') : routeKey ? t(routeKey) : decodedSegment

    breadcrumbs.push({
      name: displayName,
      href: currentPath,
    })
  }

  const parent = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null
  const currentName = breadcrumbs[breadcrumbs.length - 1]?.name ?? t('nav_dashboard')

  return (
    <div className="flex min-w-0 w-full items-center gap-2 md:w-auto md:flex-1 md:gap-3">
      {/* Handy: „Wo bin ich?" in einem Satz — zurück steht mit Namen da, nicht nur als Pfeil. */}
      {parent ? (
        <Link
          href={parent.href}
          className="st-back-pill st-press md:hidden"
          aria-label={s('nav_back_to', { name: parent.name })}
        >
          <ArrowLeft size={20} aria-hidden="true" />
          <span className="truncate">{parent.name}</span>
        </Link>
      ) : null}
      {parent ? (
        <Link
          href={parent.href}
          className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] md:flex"
          aria-label={t('nav_back_aria')}
          title={t('nav_back')}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
      ) : null}

      <nav className="hidden min-w-0 md:flex" aria-label={breadcrumbLabel || t('nav_dashboard')}>
        <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <li key={crumb.href} className="flex min-w-0 items-center">
                {isLast ? (
                  <h1 aria-current="page" className="inline-flex min-h-12 items-center break-words text-base font-semibold text-[var(--foreground)]">
                    {crumb.name}
                  </h1>
                ) : (
                  <Link href={crumb.href} className="inline-flex min-h-12 items-center break-words text-base font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
                    {crumb.name}
                  </Link>
                )}
                {!isLast && (
                  <ChevronRight size={16} className="ml-2 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {parent && <ChevronRight size={16} className="shrink-0 text-[var(--muted)] md:hidden" aria-hidden="true" />}
      <h1 aria-current="page" className="min-w-0 truncate text-base font-bold text-[var(--foreground)] md:hidden">{currentName}</h1>
    </div>
  )
}
