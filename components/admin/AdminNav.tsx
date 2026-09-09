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
    <nav className="flex w-full items-center gap-2 overflow-x-auto pb-2 whitespace-nowrap scrollbar-hide lg:gap-0 lg:space-x-4 lg:pb-0">
      {navItems.map((item, index) => {
        if ('divider' in item) {
          return <div key={`div-${index}`} className="mx-2 hidden h-4 w-px bg-slate-300 lg:block dark:bg-slate-700" />
        }
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex min-h-12 shrink-0 items-center rounded-lg px-3 py-1.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] ${
              isActive
                ? 'bg-[#FF5C00]/10 text-[#FF5C00] hover:bg-[#FF5C00]/20'
                : 'text-slate-700 hover:bg-slate-100 hover:text-[#FF5C00] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-[#FF5C00]'
            }`}
          >
            {item.name}
          </Link>
        )
      })}
    </nav>
  )
}
