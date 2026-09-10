'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft } from 'lucide-react'
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
    const displayName = routeKey ? t(routeKey) : decodedSegment

    breadcrumbs.push({
      name: displayName,
      href: currentPath,
    })
  }

  const backHref = breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].href : null
  const currentName = breadcrumbs[breadcrumbs.length - 1]?.name ?? t('nav_dashboard')

  return (
    <div className="flex min-w-0 w-full items-center gap-2 md:w-auto md:flex-1 md:gap-3">
      {backHref ? (
        <Link
          href={backHref}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
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
                  <h1 aria-current="page" className="inline-flex min-h-12 items-center break-words text-sm font-semibold text-[var(--foreground)]">
                    {crumb.name}
                  </h1>
                ) : (
                  <Link href={crumb.href} className="inline-flex min-h-12 items-center break-words text-sm font-medium text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
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

      <h1 aria-current="page" className="min-w-0 truncate text-base font-semibold text-[var(--foreground)] md:hidden">{currentName}</h1>
    </div>
  )
}
