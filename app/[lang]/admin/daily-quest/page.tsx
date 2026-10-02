import Link from 'next/link'
import { redirect } from 'next/navigation'
import DailyQuestPreview from '@/components/daily-quest/DailyQuestPreview'
import { dailyQuestLevelSchema } from '@/lib/daily-quest-contract'
import { loadDailyQuestPreview } from '@/lib/daily-quest-server'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import { toUiLocale } from '@/lib/locale-routing'

export const dynamic = 'force-dynamic'

export default async function DailyQuestPreviewPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{ level?: string | string[] }>
}) {
  const { lang: requestedLang } = await params
  const lang = toUiLocale(requestedLang)
  const level = dailyQuestLevelSchema.catch('A1').parse((await searchParams)?.level)
  const result = await loadDailyQuestPreview(level)
  if (result.error === 'not_authenticated') redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/admin/daily-quest?level=${level}`)}`)
  if (result.error === 'not_authorized') redirect(`/${lang}/dashboard`)
  const copy = getDailyQuestCopy(lang)
  return (
    <div className="min-w-0 space-y-5">
      <nav aria-label={copy.previewLevel} className="flex flex-wrap gap-2">
        {dailyQuestLevelSchema.options.map(option => <Link key={option} href={`/${lang}/admin/daily-quest?level=${option}`}
          aria-current={option === level ? 'page' : undefined}
          className={`inline-flex min-h-12 min-w-14 items-center justify-center rounded-xl border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${option === level ? 'border-[var(--accent)] bg-[var(--accent-strong)] text-[var(--accent-foreground)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'}`}>{option}</Link>)}
      </nav>
      {result.data ? <DailyQuestPreview key={`${result.data.quest.id}:${level}`} preview={result.data} locale={lang} />
        : <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h1 className="text-2xl font-bold">{copy.unavailableTitle}</h1><p className="text-base text-[var(--muted)]">{copy.unavailableHint}</p>
          <Link href={`/${lang}/admin`} className="inline-flex min-h-12 items-center font-semibold text-[var(--accent-text)] underline">{copy.dashboard}</Link>
        </section>}
    </div>
  )
}
