import { getNextMonthStaffOverview } from '@/app/actions/admin-operations'
import NextMonthBookings from '@/components/admin/NextMonthBookings'
import { Notice, PageHeader } from '@/components/admin/ui'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { formatProfileMonth } from '@/lib/profile-month'

export default async function AdminBookingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [overviewResult, dict] = await Promise.all([
    getNextMonthStaffOverview(),
    getDictionary(lang),
  ])
  const t = createAdminTranslator(dict.admin)

  if (overviewResult.success === false) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader title={t('bookings_title')} />
        <Notice tone="warning" role="alert">{t('overview_load_failed')}</Notice>
      </div>
    )
  }

  const overview = overviewResult.data
  const month = formatProfileMonth(overview.targetMonth, lang)
  const titles = Object.fromEntries(overview.groups.map(group => [
    group.courseId,
    group.title || t('course_fallback'),
  ]))

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader eyebrow={month} title={t('bookings_title')} description={t('bookings_intro', { month })} />
      <NextMonthBookings overview={overview} lang={lang} courseTitles={titles} />
    </div>
  )
}
