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
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:text-slate-300 dark:hover:bg-slate-800"
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
                <Link
                  href={crumb.href}
                  className={`inline-flex min-h-11 items-center break-words text-sm font-bold transition-colors ${
                    isLast
                      ? 'text-[var(--accent)] pointer-events-none'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {crumb.name}
                </Link>
                {!isLast && (
                  <ChevronRight size={16} className="ml-2 shrink-0 text-slate-400 dark:text-slate-600" aria-hidden="true" />
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      <p className="min-w-0 truncate text-base font-bold text-[var(--accent)] md:hidden">{currentName}</p>
    </div>
  )
}
