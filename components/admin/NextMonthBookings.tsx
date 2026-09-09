'use client'

import { PauseCircle, Users } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import BlackboardEditor from './BlackboardEditor'
import { formatProfileMonth } from '@/lib/profile-month'
import { formatStudentAddress, type NextMonthCourseGroup, type NextMonthOverview, type NextMonthStudentRow } from '@/lib/types/admin-staff'

export default function NextMonthBookings({
  overview, lang, courseTitles,
}: {
  overview: NextMonthOverview
  lang: string
  courseTitles: Record<string, string>
}) {
  const t = useAdminTranslator()
  const month = formatProfileMonth(overview.targetMonth, lang)

  if (overview.groups.length === 0 && overview.paused.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Users className="mx-auto mb-4 text-slate-400" size={40} aria-hidden="true" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('bookings_empty')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{t('bookings_empty_hint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {overview.groups.map(group => (
        <CourseGroup
          key={group.courseId}
          group={group}
          title={courseTitles[group.courseId] || group.title || t('course_fallback')}
        />
      ))}
      {overview.paused.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-6 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              <PauseCircle size={24} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('bookings_paused_title')}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('bookings_paused_count', { count: overview.paused.length })}</p>
            </div>
          </div>
          <ul className="space-y-3">
            {overview.paused.map(row => (
              <li key={row.student.id} className="rounded-2xl bg-white/80 p-4 dark:bg-slate-900/70">
                <StudentSummary row={row} />
                <div className="mt-4">
                  <BlackboardEditor studentId={row.student.id} studentName={row.student.name || t('unknown_name')} compact />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="sr-only">{month}</p>
    </div>
  )
}

function CourseGroup({ group, title }: { group: NextMonthCourseGroup; title: string }) {
  const t = useAdminTranslator()
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="border-b border-slate-200 p-4 sm:p-6 dark:border-slate-800">
        <p className="text-sm font-bold text-orange-800 dark:text-orange-300">
          {t(group.type === 'online' ? 'course_online' : 'course_presence')}
        </p>
        <h2 className="break-words text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('student_count', { count: group.students.length })}</p>
      </header>
      <div className="space-y-4 p-4 lg:hidden">
        {group.students.map(row => (
          <article key={row.student.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <StudentSummary row={row} />
            <div className="mt-4">
              <BlackboardEditor studentId={row.student.id} studentName={row.student.name || t('unknown_name')} compact />
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_name_email')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_contact')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_status')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('blackboard_title')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {group.students.map(row => (
              <tr key={row.student.id} className="align-top">
                <td className="p-4">
                  <div className="font-bold text-slate-900 dark:text-white">{row.student.name || t('unknown_name')}</div>
                  <div className="break-words text-sm text-slate-500">{row.student.email}</div>
                </td>
                <td className="p-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  <ContactBlock row={row} />
                </td>
                <td className="p-4">
                  <StatusBadge row={row} />
                </td>
                <td className="min-w-[18rem] p-4">
                  <BlackboardEditor studentId={row.student.id} studentName={row.student.name || t('unknown_name')} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function statusKey(row: NextMonthStudentRow): 'status_pending' | 'status_confirmed' | 'status_inherited' | 'status_cancelled' {
  if (row.status === 'confirmed') return 'status_confirmed'
  if (row.status === 'inherited') return 'status_inherited'
  if (row.status === 'cancelled') return 'status_cancelled'
  return 'status_pending'
}

function StudentSummary({ row }: { row: NextMonthStudentRow }) {
  const t = useAdminTranslator()
  return (
    <div>
      <p className="font-bold text-slate-900 dark:text-white">{row.student.name || t('unknown_name')}</p>
      <p className="break-words text-sm text-slate-500">{row.student.email}</p>
      <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        <ContactBlock row={row} />
      </div>
      <div className="mt-2">
        <StatusBadge row={row} />
      </div>
    </div>
  )
}

function ContactBlock({ row }: { row: NextMonthStudentRow }) {
  const t = useAdminTranslator()
  const address = formatStudentAddress(row.student)
  return (
    <>
      <p>{t('phone')}: {row.student.phone || t('not_specified')}</p>
      <p className="break-words">{address || t('not_specified')}</p>
    </>
  )
}

function StatusBadge({ row }: { row: NextMonthStudentRow }) {
  const t = useAdminTranslator()
  const key = statusKey(row)
  return (
    <div>
      <span className={`inline-flex min-h-12 items-center rounded-full px-3 text-xs font-bold ${
        key === 'status_confirmed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
          : key === 'status_inherited' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
          : key === 'status_cancelled' ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }`}>
        {t(key)}
      </span>
      {key === 'status_inherited' && (
        <p className="mt-2 max-w-[16rem] text-xs leading-relaxed text-slate-500">{t('inherited_hint')}</p>
      )}
    </div>
  )
}
