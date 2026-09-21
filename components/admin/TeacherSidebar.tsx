'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LibraryBig,
  type LucideIcon,
  MessageSquareText,
  Mic,
  PencilRuler,
  Receipt,
  Users,
  UserPlus,
  Video,
  Wallet,
} from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { buildAdminNav, isNavItemActive, type AdminNavIcon } from '@/lib/admin-navigation'

const ICONS: Record<AdminNavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  finance: Wallet,
  registrations: UserPlus,
  invoices: Receipt,
  bookings: CalendarClock,
  students: Users,
  courses: BookOpen,
  content: LibraryBig,
  media: FolderOpen,
  videos: Video,
  vocabulary: FileText,
  grammar: PencilRuler,
  pronunciation: Mic,
  analytics: BarChart3,
  feedback: MessageSquareText,
}

/**
 * Gruppierte Sidebar-Navigation. Aktive Ziele werden dezent in der Markenfarbe
 * Orange (`--accent`) hervorgehoben – ein farbiger Indikatorbalken plus weiche
 * Akzentfläche, ohne die Fläche komplett einzufärben.
 */
export default function TeacherSidebar({ lang, onNavigate }: { lang: string; onNavigate?: () => void }) {
  const pathname = usePathname()
  const t = useAdminTranslator()
  const sections = buildAdminNav(lang)

  return (
    <nav aria-label={t('sidebar_primary_label')} className="flex flex-col gap-6">
      {sections.map((section, sectionIndex) => (
        <div key={section.labelKey ?? `section-${sectionIndex}`} className="min-w-0">
          {section.labelKey && (
            <p className="mb-1.5 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {t(section.labelKey)}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map(item => {
              const Icon = ICONS[item.icon]
              const active = isNavItemActive(pathname, item)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex min-h-11 items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--foreground)]'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full transition-colors ${
                        active ? 'bg-[var(--accent)]' : 'bg-transparent'
                      }`}
                    />
                    <Icon
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 transition-colors ${active ? 'text-[var(--accent-text)]' : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'}`}
                    />
                    <span className="min-w-0 truncate">{t(item.labelKey)}</span>
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
