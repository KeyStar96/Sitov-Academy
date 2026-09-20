import Link from 'next/link'
import { ChevronRight, Mic } from 'lucide-react'
import {
  createPronunciationTranslator,
  type PronunciationTranslations,
} from '@/lib/pronunciation-i18n'
import type { UnseenFeedbackSummary } from '@/lib/types/feedback'

/**
 * Hinweis auf neue Sprachnachrichten der Lehrkraft.
 *
 * Ruhige, positive Ansprache statt Badge-Zähler: Für unsere Zielgruppe ist
 * eine erklärende Karte mit einem großen Ziel-Button verständlicher als eine
 * rote Zahl am Menüpunkt.
 */
export default function FeedbackNotificationCard({
  summary,
  translations,
  lang,
}: {
  summary: UnseenFeedbackSummary
  translations: PronunciationTranslations
  lang: string
}) {
  if (summary.count === 0) return null

  const t = createPronunciationTranslator(translations)

  const description =
    summary.count === 1 && summary.latestLevel
      ? t('notification_text_one', { level: summary.latestLevel })
      : t('notification_text_many', { count: summary.count })

  const href = summary.latestLevel
    ? `/${lang}/dashboard/level/${encodeURIComponent(summary.latestLevel)}/pronunciation`
    : `/${lang}/dashboard`

  return (
    <section
      aria-label={t('notification_title')}
      className="rounded-3xl border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-6 shadow-sm"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)] shadow-md">
            <Mic size={30} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">
              {t('notification_title')}
            </h2>
            <p className="mt-1 text-lg text-[var(--foreground)]">{description}</p>
          </div>
        </div>

        <Link
          href={href}
          className="flex min-h-16 w-full shrink-0 items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-8 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-slate-900 md:w-auto"
        >
          {t('notification_cta')}
          <ChevronRight size={26} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
