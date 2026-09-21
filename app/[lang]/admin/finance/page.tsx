import AdminView from '@/components/admin/AdminView'
import { getRegistrationOverview } from '@/app/actions/admin-registrations'
import { getNextMonthStaffOverview } from '@/app/actions/admin-operations'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'

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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
        <h1 className="text-2xl font-semibold">{t('finance_title')}</h1>
        <p role="alert" className="mt-3 text-amber-900 dark:text-amber-200">{t('overview_load_failed')}</p>
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
