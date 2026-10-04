import { notFound } from 'next/navigation'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import SitovLearningShell from '@/components/layout/SitovLearningShell'
import SitovDailyQuestShellPreview from '@/components/daily-quest/SitovDailyQuestShellPreview'
import { getDictionary } from '@/lib/dictionary'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import Link from 'next/link'
import DailyQuestPreview from '@/components/daily-quest/DailyQuestPreview'
import { dailyQuestPreviewSchema } from '@/lib/daily-quest-contract'
import { localizeSitovDailyQuest } from '@/lib/sitov-daily-quest-localization'
import { buildSitovQuest } from '@/scripts/lib/sitov-daily-quest-template.mjs'
import sitovA1 from '@/content/daily-quests/sitov-a1.json'
import sitovA2 from '@/content/daily-quests/sitov-a2.json'
import sitovB1 from '@/content/daily-quests/sitov-b1.json'
import sitovB2 from '@/content/daily-quests/sitov-b2.json'
import '@/components/dashboard/student.css'

/** Local synthetic learner shell and active/completed quest for responsive QA. */
export default async function DailyQuestPreviewPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ state?: string; template?: string; step?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const [sitovDict, sitovSearch] = await Promise.all([getDictionary(lang), searchParams])
  const sitovCopy = getDailyQuestCopy(lang)
  const sitovRows = [ ...sitovA1.map(row => ({ row, level: 'A1' })), ...sitovA2.map(row => ({ row, level: 'A2' })), ...sitovB1.map(row => ({ row, level: 'B1' })), ...sitovB2.map(row => ({ row, level: 'B2' })) ]
  const sitovRow = sitovRows.find(item => `sitov-${item.level.toLowerCase()}-${item.row.slug}` === sitovSearch.template)
  const sitovAuthored = sitovRow ? buildSitovQuest(sitovRow.level, sitovRow.row, 1) : null
  const sitovPreview = sitovAuthored ? dailyQuestPreviewSchema.parse({ success: true, quest: {
    ...JSON.parse(JSON.stringify(sitovAuthored.content).replaceAll('{{nominative}}', sitovAuthored.forms.nominative).replaceAll('{{accusative}}', sitovAuthored.forms.accusative)),
    id: 'c9e3e3ca-69ac-4383-90cd-3788dc1e3104', date: '2026-10-04', status: 'active', level: sitovAuthored.level, templateKey: sitovAuthored.key,
    personalization: { source: 'fallback', cardId: null }, completedStepIds: sitovSearch.step === 'dialogue' ? ['discover', 'build'] : sitovSearch.step === 'build' ? ['discover'] : [],
  }, answerKey: sitovAuthored.answerKey }) : null
  if (sitovPreview) sitovPreview.quest = localizeSitovDailyQuest(sitovPreview.quest, lang)
  const sitovCompleted = sitovSearch.state === 'completed'
  const sitovSupportLabels = { whatsapp: sitovDict.academy.support_whatsapp, phone: sitovDict.Footer.Contact.phone,
    phoneLabel: sitovDict.Footer.Contact.phone_label, telegram: sitovDict.Footer.Contact.telegram_button,
    email: sitovDict.Footer.Contact.email, emailLabel: sitovDict.Footer.Contact.email_button }
  return <SitovLearningShell lang={lang} translations={sitovDict.dashboard} displayName="Dennis" levels={['A1.1']}
    supportLabels={sitovSupportLabels} sitovPreviewPathname={`/${lang}/dashboard/daily-quest`}>
    <div className="mb-5 flex flex-wrap items-center gap-3"><SitovPreviewAppearance />
      <Link href={`/${lang}/sitov-preview/daily-quest`} className="st-link-pill">{sitovCopy.start}</Link>
      <Link href={`/${lang}/sitov-preview/daily-quest?state=completed`} className="st-link-pill">{sitovCopy.completed}</Link>
    </div>
    {sitovPreview ? <DailyQuestPreview preview={sitovPreview} locale={lang} /> : <SitovDailyQuestShellPreview lang={lang} completed={sitovCompleted} />}
  </SitovLearningShell>
}
