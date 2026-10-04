import Link from 'next/link'
import { redirect } from 'next/navigation'
import DailyQuestEngine from '@/components/daily-quest/DailyQuestEngine'
import { loadDailyQuest } from '@/lib/daily-quest-server'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import { toUiLocale } from '@/lib/locale-routing'

export const dynamic = 'force-dynamic'

export default async function DailyQuestPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: requestedLang } = await params
  const lang = toUiLocale(requestedLang)
  const result = await loadDailyQuest(lang)
  if (result.error === 'not_authenticated') redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/dashboard/daily-quest`)}`)
  if (result.error === 'not_authorized') redirect(`/${lang}/dashboard`)
  const copy = getDailyQuestCopy(lang)
  if (result.data?.quest) return <DailyQuestEngine initialQuest={result.data.quest} initialStreak={result.data.streak} locale={lang} dashboardHref={`/${lang}/dashboard`} />
  const disabled = result.data?.enabled === false
  return (
    <section className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
      <p className="text-sm font-semibold text-[var(--accent-text)]">{copy.eyebrow}</p>
      <h1 className="text-2xl font-bold text-[var(--foreground)]">{disabled ? copy.disabledTitle : copy.unavailableTitle}</h1>
      <p className="text-lg leading-relaxed text-[var(--muted)]">{disabled ? copy.disabledHint : copy.unavailableHint}</p>
      {disabled && <Link href={`/${lang}/dashboard/profile#daily-quest`} className="inline-flex min-h-14 items-center rounded-xl px-4 font-semibold text-[var(--accent-text)] underline focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2">{copy.openSettings}</Link>}
      <Link href={`/${lang}/dashboard`} className="flex min-h-14 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-5 py-3 text-lg font-bold text-[var(--accent-foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2">{copy.dashboard}</Link>
    </section>
  )
}
