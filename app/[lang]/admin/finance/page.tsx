import AdminView from '@/components/admin/AdminView'
import { getRegistrationOverview } from '@/app/actions/admin-registrations'
import { getNextMonthStaffOverview } from '@/app/actions/admin-operations'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { Notice, PageHeader } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function AdminFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ month?: string }>
}) {
  const [{ lang }, { month }] = await Promise.all([params, searchParams])
  const monthArg = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : undefined
  const [overviewResult, bookingsResult, dict] = await Promise.all([
    getRegistrationOverview(monthArg),
    getNextMonthStaffOverview(),
    getDictionary(lang),
  ])
  const t = createAdminTranslator(dict.admin)

  if (!overviewResult.success) {
    return (
      <div className="min-w-0 space-y-5">
        <PageHeader title={t('finance_title')} />
        <Notice tone="warning" role="alert">{t('overview_load_failed')}</Notice>
      </div>
    )
  }

  return (
    <AdminView
      lang={lang}
      overview={overviewResult.data}
      bookings={bookingsResult.success ? bookingsResult.data : null}
    />
  )
}
