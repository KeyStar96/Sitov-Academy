import Link from 'next/link'
import { Lock, ArrowLeft } from 'lucide-react'
import {
  createDashboardTranslator,
  type DashboardTranslations,
} from '@/lib/dashboard-i18n'

/**
 * Freundliche „Kein Zugriff"-Anzeige für ein noch nicht freigeschaltetes
 * Sprachniveau. Bewusst ohne Kauf-/Premium-Hinweis: Die Freischaltung erfolgt
 * ausschließlich durch die Lehrkraft/Admin.
 */
export default function LevelLocked({
  lang,
  level,
  translations,
  trainer = false,
}: {
  lang: string
  level: string
  trainer?: boolean
  translations: DashboardTranslations
}) {
  const t = createDashboardTranslator(translations)

  return (
    <div className="mx-auto max-w-xl rounded-3xl bg-[var(--surface)] p-8 text-center shadow-sm ring-1 ring-[var(--border)] sm:p-12">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-muted)]">
        <Lock className="h-8 w-8 text-[var(--muted)]" aria-hidden="true" />
      </div>
      <h1 className="mb-4 break-words text-2xl font-bold text-[var(--foreground)]">
        {t(trainer ? 'trainer_locked_title' : 'level_locked_title')}
      </h1>
      <p className="mx-auto mb-8 max-w-md text-lg leading-relaxed text-[var(--muted)]">
        {t(trainer ? 'trainer_locked_text' : 'level_locked_text', { level })}
      </p>
      <Link
        href={trainer ? `/${lang}/dashboard/level/${encodeURIComponent(level)}` : `/${lang}/dashboard`}
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-6 text-lg font-bold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
      >
        <ArrowLeft size={20} aria-hidden="true" />
        {t(trainer ? 'back_to_level' : 'back_to_dashboard')}
      </Link>
    </div>
  )
}
