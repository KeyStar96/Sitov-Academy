import { getNextMonthStaffOverview } from '@/app/actions/admin-operations'
import NextMonthBookings from '@/components/admin/NextMonthBookings'
import { BlackboardProvider } from '@/components/admin/BlackboardProvider'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { formatProfileMonth } from '@/lib/profile-month'
import type { TeacherStudentNote } from '@/lib/types/teacher-notes'

export default async function AdminBookingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [overviewResult, dict] = await Promise.all([
    getNextMonthStaffOverview(),
    getDictionary(lang),
  ])
  const t = createAdminTranslator(dict.admin)

  if (overviewResult.success === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t('bookings_title')}</h1>
        <p role="alert" className="mt-3 text-amber-900 dark:text-amber-200">{t('overview_load_failed')}</p>
      </div>
    )
  }

  const overview = overviewResult.data
  const titles = Object.fromEntries(overview.groups.map(group => [
    group.courseId,
    group.title || t('course_fallback'),
  ]))
  const notes: Record<string, TeacherStudentNote> = {}
  for (const group of overview.groups) {
    for (const row of group.students) {
      if (row.note) notes[row.student.id] = row.note
    }
  }
  for (const row of overview.paused) {
    if (row.note) notes[row.student.id] = row.note
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-bold text-[var(--muted)]">{formatProfileMonth(overview.targetMonth, lang)}</p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t('bookings_title')}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t('bookings_intro', { month: formatProfileMonth(overview.targetMonth, lang) })}</p>
      </div>
      <BlackboardProvider initialNotes={notes}>
        <NextMonthBookings overview={overview} lang={lang} courseTitles={titles} />
      </BlackboardProvider>
    </div>
  )
}
