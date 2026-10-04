'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdminTranslator } from './AdminI18nProvider'
import { ADMIN_NAV_ICONS } from './TeacherNavIcons'
import { CountBadge, adminFocus } from './ui'
import { buildAdminNav, findActiveNavItem, type AdminNavCounts } from '@/lib/admin-navigation'
import { cn } from '@/lib/utils'

/**
 * Gruppierte Navigation für die Desktop-Seitenleiste und das mobile Menü-Blatt.
 * Aktiv ist genau ein Ziel (längster passender Pfad): dezente Fläche plus
 * orangefarbener Indikator, Zähler als kleine Badges.
 */
export default function TeacherSidebar({ lang, counts, onNavigate, size = 'compact', sitovPreviewPathname }: {
  lang: string
  sitovPreviewPathname?: string
  counts?: AdminNavCounts
  onNavigate?: () => void
  /** `comfortable` = 48-px-Zeilen für Touch im Menü-Blatt. */
  size?: 'compact' | 'comfortable'
}) {
  const actualPathname = usePathname()
  const pathname = sitovPreviewPathname ?? actualPathname
  const t = useAdminTranslator()
  const sections = buildAdminNav(lang)
  const active = findActiveNavItem(pathname, sections)

  return (
    <nav aria-label={t('sidebar_primary_label')} className="flex flex-col gap-5">
      {sections.map(section => (
        <div key={section.id} className="min-w-0">
          {section.labelKey && (
            <p className="mb-1 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              {t(section.labelKey)}
            </p>
          )}
          <ul className="space-y-px">
            {section.items.map(item => {
              const Icon = ADMIN_NAV_ICONS[item.icon]
              const current = item === active
              const count = item.badge ? counts?.[item.badge] : null
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg pl-3 pr-2.5 text-sm transition-colors',
                      size === 'comfortable' ? 'min-h-12' : 'min-h-10',
                      adminFocus,
                      current
                        ? 'bg-[var(--surface-muted)] font-semibold text-[var(--foreground)]'
                        : 'font-medium text-[var(--muted)] hover:bg-[var(--admin-hover)] hover:text-[var(--foreground)]',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full', current ? 'bg-[var(--accent)]' : 'bg-transparent')}
                    />
                    <Icon size={17} aria-hidden="true" className={cn('shrink-0', current ? 'text-[var(--accent-text)]' : 'text-[var(--muted)] group-hover:text-[var(--foreground)]')} />
                    <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                    <CountBadge count={count} label={count ? t('badge_count_aria', { count }) : undefined} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
