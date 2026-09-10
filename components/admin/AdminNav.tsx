'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdminTranslator } from './AdminI18nProvider'

export default function AdminNav({ lang }: { lang: string }) {
  const pathname = usePathname()
  const t = useAdminTranslator()

  const navItems: Array<{ name: string; href: string; exact?: boolean } | { divider: true }> = [
    { name: t('nav_overview'), href: `/${lang}/admin`, exact: true },
    { name: t('nav_students'), href: `/${lang}/admin/students` },
    { name: t('nav_bookings'), href: `/${lang}/admin/bookings` },
    { name: t('nav_feedback'), href: `/${lang}/admin/submissions` },
    { divider: true },
    { name: t('nav_vocabulary'), href: `/${lang}/admin/content/vocabulary` },
    { name: t('nav_exercises'), href: `/${lang}/admin/content/exercises` },
    { name: t('nav_videos'), href: `/${lang}/admin/content/videos` },
  ]

  return (
    <nav className="flex w-full min-w-0 flex-wrap items-center gap-1">
      {navItems.map((item, index) => {
        if ('divider' in item) {
          return <div key={`div-${index}`} className="hidden h-4 w-px bg-slate-300 sm:block dark:bg-slate-700" />
        }
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`inline-flex min-h-11 min-w-0 items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] ${
              isActive
                ? 'bg-[var(--foreground)] text-[var(--surface)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
