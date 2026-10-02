import Link from 'next/link'
import { ArrowRight, Flame, Map } from 'lucide-react'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import type { DailyQuestStatus } from '@/lib/daily-quest-contract'

export default function DailyQuestEntry({ lang, status }: { lang: string; status: DailyQuestStatus }) {
  const copy = getDailyQuestCopy(lang)
  const href = status.enabled ? `/${lang}/dashboard/daily-quest` : `/${lang}/dashboard/profile#daily-quest`
  const label = !status.enabled ? copy.openSettings
    : status.today?.status === 'completed' ? copy.entryDone
      : status.today?.status === 'skipped' ? copy.entrySkipped : copy.entryStart
  return (
    <section aria-labelledby="daily-quest-entry-title" className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6" data-testid="daily-quest-entry">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Map className="mt-1 shrink-0 text-[var(--accent-text)]" size={26} aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="daily-quest-entry-title" className="text-xl font-bold text-[var(--foreground)]">{copy.eyebrow}</h2>
            <p className="mt-1 text-base text-[var(--muted)]">{status.enabled ? copy.entryHint : copy.disabledHint}</p>
            <p className="mt-3 inline-flex items-center gap-2 text-base font-semibold text-[var(--foreground)]">
              <Flame size={20} aria-hidden="true" />{status.streak.current} {copy.streakDays}
            </p>
          </div>
        </div>
        <Link href={href} className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[var(--accent-strong)] px-5 py-3 text-base font-bold text-[var(--accent-foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]">
          {label}<ArrowRight size={20} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
