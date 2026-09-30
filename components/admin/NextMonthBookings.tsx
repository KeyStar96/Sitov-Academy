'use client'

import { useMemo, useState } from 'react'
import { ArrowDownWideNarrow, CalendarClock, ChevronDown, Search } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { Badge, Card, EmptyState, adminButton, adminFocus, adminInput, adminLabel, type AdminTone } from './ui'
import { courseQuantityCopy } from '@/lib/course-quantity-i18n'
import { formatProfileMonth } from '@/lib/profile-month'
import { formatStudentAddress, type NextMonthOverview, type NextMonthRowStatus } from '@/lib/types/admin-staff'
import { bookingGridRows, filterAndSortBookings, type BookingGridFilters, type BookingSort, type BookingSortField } from '@/lib/admin-booking-grid'

const inputClass = adminInput
const statusTone: Record<NextMonthRowStatus, AdminTone> = { pending: 'warning', confirmed: 'success', inherited: 'neutral', cancelled: 'danger' }
const defaultFilters: BookingGridFilters = { search: '', status: 'all', course: 'all', format: 'all' }
const statusKeys = { pending: 'status_pending', confirmed: 'status_confirmed', inherited: 'status_inherited', cancelled: 'status_cancelled' } as const
const sortKeys = { name: 'grid_sort_name', status: 'col_status', courses: 'grid_sort_courses', city: 'grid_sort_city' } as const

export default function NextMonthBookings({ overview, lang, courseTitles }: {
  overview: NextMonthOverview
  lang: string
  courseTitles: Record<string, string>
}) {
  const t = useAdminTranslator()
  const [filters, setFilters] = useState(defaultFilters)
  const [sorts, setSorts] = useState<BookingSort[]>([{ field: 'name', direction: 'asc' }, { field: 'status', direction: 'asc' }])
  const rows = useMemo(() => filterAndSortBookings(overview, filters, sorts, lang), [overview, filters, sorts, lang])
  const total = useMemo(() => bookingGridRows(overview).length, [overview])
  const month = formatProfileMonth(overview.targetMonth, lang)
  const setFilter = <K extends keyof BookingGridFilters>(key: K, value: BookingGridFilters[K]) => setFilters(previous => ({ ...previous, [key]: value }))
  const setSort = (index: number, value: Partial<BookingSort>) => setSorts(previous => previous.map((sort, at) => at === index ? { ...sort, ...value } : sort))

  return (
    <div className="min-w-0 space-y-4 text-[var(--foreground)]">
      <div className="space-y-3">
        <label className="block min-w-0">
          <span className="sr-only">{t('grid_search_label')}</span>
          <span className="relative block"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" /><input type="search" value={filters.search} onChange={event => setFilter('search', event.target.value)} placeholder={t('grid_search_placeholder')} aria-label={t('grid_search_label')} className={`${inputClass} pl-9`} /></span>
        </label>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block min-w-0"><span className={adminLabel}>{t('col_status')}</span>
            <select value={filters.status} onChange={event => setFilter('status', event.target.value as NextMonthRowStatus | 'all')} className={inputClass}>
              <option value="all">{t('grid_all_statuses')}</option>
              {Object.entries(statusKeys).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
            </select>
          </label>
          <label className="block min-w-0"><span className={adminLabel}>{t('grid_course')}</span>
            <select value={filters.course} onChange={event => setFilter('course', event.target.value)} className={inputClass}>
              <option value="all">{t('grid_all_courses')}</option>
              {overview.groups.map(group => <option key={group.courseId} value={group.courseId}>{courseTitles[group.courseId] || group.title || t('course_fallback')}</option>)}
            </select>
          </label>
          <label className="block min-w-0"><span className={adminLabel}>{t('grid_format')}</span>
            <select value={filters.format} onChange={event => setFilter('format', event.target.value as BookingGridFilters['format'])} className={inputClass}>
              <option value="all">{t('grid_all_formats')}</option><option value="online">{t('course_online')}</option><option value="presence">{t('course_presence')}</option>
            </select>
          </label>
        </div>
        <details className="group overflow-hidden rounded-xl border border-[var(--admin-line)] bg-[var(--surface)]">
          <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold ${adminFocus}`}><ArrowDownWideNarrow size={16} aria-hidden="true" className="text-[var(--muted)]" /><span className="flex-1">{t('grid_sorting')}</span><ChevronDown size={16} aria-hidden="true" className="text-[var(--muted)] transition-transform group-open:rotate-180" /></summary>
          <div className="grid gap-3 border-t border-[var(--admin-line)] p-4 sm:grid-cols-2">
            {sorts.map((sort, index) => <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              <label className="block min-w-0"><span className={adminLabel}>{t(index === 0 ? 'grid_sort_primary' : 'grid_sort_secondary')}</span>
                <select value={sort.field} onChange={event => setSort(index, { field: event.target.value as BookingSortField })} className={inputClass}>{Object.entries(sortKeys).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select>
              </label>
              <label className="block min-w-0"><span className={adminLabel}>{t('grid_sort_direction')}</span><select value={sort.direction} onChange={event => setSort(index, { direction: event.target.value === 'desc' ? 'desc' : 'asc' })} className={inputClass}><option value="asc">{t('grid_sort_asc')}</option><option value="desc">{t('grid_sort_desc')}</option></select></label>
            </div>)}
          </div>
        </details>
        <p className="text-sm tabular-nums text-[var(--muted)]" role="status">{t('grid_result_count', { count: rows.length, total })}</p>
      </div>
      {rows.length === 0 ? <Card><EmptyState icon={CalendarClock} title={t(total === 0 ? 'bookings_empty' : 'grid_no_results')} description={t(total === 0 ? 'bookings_empty_hint' : 'grid_no_results_hint')} action={total > 0 ? <button type="button" onClick={() => setFilters(defaultFilters)} className={adminButton('secondary', 'sm')}>{t('grid_reset')}</button> : undefined} /></Card> : (
        <table className="block w-full border-collapse text-left text-sm lg:table lg:table-fixed lg:overflow-hidden lg:rounded-xl lg:border lg:border-[var(--admin-line)] lg:bg-[var(--surface)]">
          <caption className="sr-only">{t('grid_caption', { month })}</caption>
          <thead className="hidden border-b border-[var(--admin-line)] bg-[var(--surface-muted)] lg:table-header-group"><tr>{(['col_name_email', 'grid_course', 'col_status', 'col_contact'] as const).map(key => <th scope="col" key={key} className="px-4 py-2.5 text-xs font-semibold text-[var(--muted)]">{t(key)}</th>)}</tr></thead>
          <tbody className="block space-y-3 lg:table-row-group lg:space-y-0 lg:divide-y lg:divide-[var(--admin-line)]">{rows.map(row => (
            <tr key={row.student.id} className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 align-top sm:grid-cols-2 lg:table-row lg:rounded-none lg:border-0 lg:p-0">
              <td className="flex min-w-0 items-start justify-between gap-3 break-words sm:col-span-2 lg:table-cell lg:px-4 lg:py-3"><div className="min-w-0"><p className="font-semibold">{row.student.person?.display_name || t('unknown_name')}</p><p className="mt-0.5 break-all text-xs text-[var(--muted)]">{row.student.person?.email}</p></div><span className="shrink-0 lg:hidden"><Badge tone={statusTone[row.status]}>{t(statusKeys[row.status])}</Badge></span></td>
              <td className="min-w-0 lg:px-4 lg:py-3"><p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('grid_course')}</p>{row.courseSelections.length ? <ul className="space-y-1">{row.courseSelections.map(selection => <li key={selection.courseId} className="break-words">{courseTitles[selection.courseId] || t('course_fallback')}{selection.requestedUnits!==undefined&&<span className="block text-xs text-[var(--muted)]">{courseQuantityCopy(lang).label}: {selection.requestedUnits}</span>}</li>)}</ul> : <span className="text-[var(--muted)]">{t('status_cancelled')}</span>}</td>
              <td className="hidden min-w-0 lg:table-cell lg:px-4 lg:py-3"><Badge tone={statusTone[row.status]}>{t(statusKeys[row.status])}</Badge></td>
              <td className="min-w-0 break-words text-[var(--muted)] lg:px-4 lg:py-3"><p className="mb-1 text-xs lg:hidden">{t('col_contact')}</p><p className="text-[var(--foreground)]">{row.student.person?.phone || t('not_specified')}</p><p className="mt-0.5 text-xs leading-relaxed">{formatStudentAddress(row.student) || t('not_specified')}</p></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
