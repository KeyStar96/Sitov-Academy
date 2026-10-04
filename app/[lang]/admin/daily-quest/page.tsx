import Link from 'next/link'
import { redirect } from 'next/navigation'
import DailyQuestPreview from '@/components/daily-quest/DailyQuestPreview'
import { dailyQuestLevelSchema, sitovQuestTemplateKeySchema } from '@/lib/daily-quest-contract'
import { loadDailyQuestPreview, loadSitovDailyQuestCatalog } from '@/lib/daily-quest-server'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import { toUiLocale } from '@/lib/locale-routing'

export const dynamic = 'force-dynamic'

export default async function DailyQuestPreviewPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{ level?: string | string[]; template?: string | string[] }>
}) {
  const { lang: requestedLang } = await params
  const lang = toUiLocale(requestedLang)
  const query = await searchParams
  const level = dailyQuestLevelSchema.catch('A1').parse(query?.level)
  const template = sitovQuestTemplateKeySchema.safeParse(query?.template)
  const result = template.success ? await loadDailyQuestPreview(level, template.data, lang) : await loadDailyQuestPreview(level, undefined, lang)
  const destination = `/${lang}/admin/daily-quest?level=${level}${template.success ? `&template=${template.data}` : ''}`
  if (result.error === 'not_authenticated') redirect(`/${lang}/login?next=${encodeURIComponent(destination)}`)
  if (result.error === 'not_authorized') redirect(`/${lang}/dashboard`)
  const copy = getDailyQuestCopy(lang)
  const catalog = await loadSitovDailyQuestCatalog(level)
  return (
    <div className="min-w-0 space-y-5">
      <nav aria-label={copy.previewLevel} className="flex flex-wrap gap-2">
        {dailyQuestLevelSchema.options.map(option => <Link key={option} href={`/${lang}/admin/daily-quest?level=${option}`}
          aria-current={option === level ? 'page' : undefined}
          className={`inline-flex min-h-12 min-w-14 items-center justify-center rounded-xl border px-4 py-2 font-semibold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${option === level ? 'border-[var(--accent)] bg-[var(--accent-strong)] text-[var(--accent-foreground)]' : 'border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]'}`}>{option}</Link>)}
      </nav>
      {catalog.data && catalog.data.templates.length > 0 && <form action={`/${lang}/admin/daily-quest`} method="get"
        className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:flex-row sm:items-end">
        <input type="hidden" name="level" value={level} />
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="sitov-quest-template" className="block font-semibold">{copy.sitovPreviewQuest}</label>
          <select id="sitov-quest-template" name="template" defaultValue={result.data?.quest.templateKey}
            className="min-h-12 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-base text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-[var(--accent)]">
            {catalog.data.templates.map(item => <option key={item.templateKey} value={item.templateKey}>
              {item.day ? `${item.day}.` : copy.sitovPreviewStarter} {item.title}
            </option>)}
          </select>
          <p className="text-base text-[var(--muted)]">{catalog.data.templates.length} {copy.sitovPreviewJourneys}</p>
        </div>
        <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent-strong)] px-5 py-3 font-semibold text-[var(--accent-foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">{copy.previewEntry}</button>
      </form>}
      {result.data ? <DailyQuestPreview key={`${result.data.quest.id}:${level}`} preview={result.data} locale={lang} />
        : <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h1 className="text-2xl font-bold">{copy.unavailableTitle}</h1><p className="text-base text-[var(--muted)]">{copy.unavailableHint}</p>
          <Link href={`/${lang}/admin`} className="inline-flex min-h-12 items-center font-semibold text-[var(--accent-text)] underline">{copy.dashboard}</Link>
        </section>}
    </div>
  )
}
