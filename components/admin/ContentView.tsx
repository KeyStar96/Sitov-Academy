'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { ADMIN_NAV_ICONS } from './TeacherNavIcons'
import { PageHeader, adminFocus } from './ui'
import { buildAdminNav } from '@/lib/admin-navigation'
import { contentAdminCopy } from '@/lib/content-admin-i18n'

/**
 * Übersicht „Lerninhalte“: die vier eigenständigen Verwaltungsbereiche
 * (Vokabeltrainer, Learning Path, Mediathek, Aussprache-Trainer) als Einstiege.
 * Die Bereiche selbst sind vollständig getrennt; diese Seite bleibt als Hub
 * und für alte Lesezeichen erhalten.
 */
export default function ContentView({ lang }: { lang: string }) {
  const t = useAdminTranslator()
  const copy = contentAdminCopy(lang)
  const section = buildAdminNav(lang).find(entry => entry.id === 'content')
  const descriptions: Record<string, string> = {
    vocabulary: copy.vocabularyIntro,
    path: copy.pathIntro,
    media: copy.mediaIntro,
    pronunciation: copy.pronunciationIntro,
  }
  return (
    <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
      <PageHeader title={t('content_hub_title')} description={copy.hubIntro} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {section?.items.map(item => {
          const Icon = ADMIN_NAV_ICONS[item.icon]
          return (
            <li key={item.href}>
              <Link href={item.href} className={`group flex h-full min-h-24 items-start gap-3 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--admin-line-strong)] hover:bg-[var(--admin-hover)] ${adminFocus}`}>
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--foreground)]">
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.9375rem] font-semibold">{t(item.labelKey)}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">{descriptions[item.icon]}</span>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
