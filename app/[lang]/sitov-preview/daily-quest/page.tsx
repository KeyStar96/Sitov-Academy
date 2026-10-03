import { notFound } from 'next/navigation'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import SitovLearningShell from '@/components/layout/SitovLearningShell'
import SitovDailyQuestShellPreview from '@/components/daily-quest/SitovDailyQuestShellPreview'
import { getDictionary } from '@/lib/dictionary'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import Link from 'next/link'
import '@/components/dashboard/student.css'

/** Local synthetic learner shell and active/completed quest for responsive QA. */
export default async function DailyQuestPreviewPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ state?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const { lang } = await params
  const [sitovDict, sitovSearch] = await Promise.all([getDictionary(lang), searchParams])
  const sitovCopy = getDailyQuestCopy(lang)
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
    <SitovDailyQuestShellPreview lang={lang} completed={sitovCompleted} />
  </SitovLearningShell>
}
