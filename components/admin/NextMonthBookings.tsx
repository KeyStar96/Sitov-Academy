'use client'

import { useMemo, useState } from 'react'
import { ArrowDownWideNarrow, Search, SlidersHorizontal } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import BlackboardEditor from './BlackboardEditor'
import { useBlackboard } from './BlackboardProvider'
import { formatProfileMonth } from '@/lib/profile-month'
import { formatStudentAddress, type NextMonthOverview, type NextMonthRowStatus } from '@/lib/types/admin-staff'
import { bookingGridRows, filterAndSortBookings, type BookingGridFilters, type BookingSort, type BookingSortField } from '@/lib/admin-booking-grid'

const inputClass = 'min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'
const defaultFilters: BookingGridFilters = { search: '', status: 'all', course: 'all', format: 'all' }
const statusKeys = { pending: 'status_pending', confirmed: 'status_confirmed', inherited: 'status_inherited', cancelled: 'status_cancelled' } as const
const sortKeys = { name: 'grid_sort_name', status: 'col_status', courses: 'grid_sort_courses', city: 'grid_sort_city', discount: 'col_discount' } as const

export default function NextMonthBookings({ overview, lang, courseTitles }: {
  overview: NextMonthOverview
  lang: string
  courseTitles: Record<string, string>
}) {
  const t = useAdminTranslator()
  const { getBoard } = useBlackboard()
  const [filters, setFilters] = useState(defaultFilters)
  const [sorts, setSorts] = useState<BookingSort[]>([{ field: 'name', direction: 'asc' }, { field: 'status', direction: 'asc' }])
  const rows = useMemo(() => filterAndSortBookings(overview, filters, sorts, lang, new Map(bookingGridRows(overview).map(row => [row.student.id, getBoard(row.student.id).discount]))), [overview, filters, sorts, lang, getBoard])
  const total = useMemo(() => bookingGridRows(overview).length, [overview])
  const month = formatProfileMonth(overview.targetMonth, lang)
  const setFilter = <K extends keyof BookingGridFilters>(key: K, value: BookingGridFilters[K]) => setFilters(previous => ({ ...previous, [key]: value }))
  const setSort = (index: number, value: Partial<BookingSort>) => setSorts(previous => previous.map((sort, at) => at === index ? { ...sort, ...value } : sort))

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
      <div className="space-y-4 border-b border-[var(--border)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={17} aria-hidden="true" />{t('grid_title')}</h2>
          <p className="text-sm tabular-nums text-[var(--muted)]" role="status">{t('grid_result_count', { count: rows.length, total })}</p>
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="min-w-0 text-sm font-medium">
            <span className="mb-1.5 block">{t('grid_search_label')}</span>
            <span className="relative block"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-[var(--muted)]" aria-hidden="true" /><input type="search" value={filters.search} onChange={event => setFilter('search', event.target.value)} placeholder={t('grid_search_placeholder')} className={`${inputClass} pl-9`} /></span>
          </label>
          <label className="min-w-0 text-sm font-medium"><span className="mb-1.5 block">{t('col_status')}</span>
            <select value={filters.status} onChange={event => setFilter('status', event.target.value as NextMonthRowStatus | 'all')} className={inputClass}>
              <option value="all">{t('grid_all_statuses')}</option>
              {Object.entries(statusKeys).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium"><span className="mb-1.5 block">{t('grid_course')}</span>
            <select value={filters.course} onChange={event => setFilter('course', event.target.value)} className={inputClass}>
              <option value="all">{t('grid_all_courses')}</option>
              {overview.groups.map(group => <option key={group.courseId} value={group.courseId}>{courseTitles[group.courseId] || group.title || t('course_fallback')}</option>)}
            </select>
          </label>
          <label className="min-w-0 text-sm font-medium"><span className="mb-1.5 block">{t('grid_format')}</span>
            <select value={filters.format} onChange={event => setFilter('format', event.target.value as BookingGridFilters['format'])} className={inputClass}>
              <option value="all">{t('grid_all_formats')}</option><option value="online">{t('course_online')}</option><option value="presence">{t('course_presence')}</option>
            </select>
          </label>
        </div>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium"><ArrowDownWideNarrow size={17} aria-hidden="true" />{t('grid_sorting')}</summary>
          <div className="grid gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-4">
            {sorts.map((sort, index) => <div key={index} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:col-span-2">
              <label className="min-w-0 text-sm"><span className="mb-1.5 block">{t(index === 0 ? 'grid_sort_primary' : 'grid_sort_secondary')}</span>
                <select value={sort.field} onChange={event => setSort(index, { field: event.target.value as BookingSortField })} className={inputClass}>{Object.entries(sortKeys).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select>
              </label>
              <label className="min-w-0 text-sm"><span className="mb-1.5 block">{t('grid_sort_direction')}</span><select value={sort.direction} onChange={event => setSort(index, { direction: event.target.value === 'desc' ? 'desc' : 'asc' })} className={inputClass}><option value="asc">{t('grid_sort_asc')}</option><option value="desc">{t('grid_sort_desc')}</option></select></label>
            </div>)}
          </div>
        </details>
      </div>
      {rows.length === 0 ? <div className="px-4 py-12 text-center"><p className="font-semibold">{t(total === 0 ? 'bookings_empty' : 'grid_no_results')}</p><p className="mt-2 text-sm text-[var(--muted)]">{t(total === 0 ? 'bookings_empty_hint' : 'grid_no_results_hint')}</p>{total > 0 && <button type="button" onClick={() => setFilters(defaultFilters)} className="mt-4 min-h-11 rounded-md border border-[var(--border)] px-4 text-sm font-semibold">{t('grid_reset')}</button>}</div> : (
        <table className="block w-full table-fixed border-collapse text-left text-sm lg:table">
          <caption className="sr-only">{t('grid_caption', { month })}</caption>
          <thead className="hidden border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] lg:table-header-group"><tr>{(['col_name_email', 'grid_course', 'col_status', 'col_contact', 'blackboard_title'] as const).map(key => <th scope="col" key={key} className="px-4 py-3 font-medium">{t(key)}</th>)}</tr></thead>
          <tbody className="block divide-y divide-[var(--border)] lg:table-row-group">{rows.map(row => (
            <tr key={row.student.id} className="grid min-w-0 grid-cols-1 gap-3 p-4 align-top sm:grid-cols-2 lg:table-row lg:p-0">
              <td className="min-w-0 break-words lg:px-4 lg:py-3"><p className="font-semibold">{row.student.name || t('unknown_name')}</p><p className="mt-1 break-all text-xs text-[var(--muted)]">{row.student.email}</p></td>
              <td className="min-w-0 lg:px-4 lg:py-3"><p className="mb-1 text-xs text-[var(--muted)] lg:hidden">{t('grid_course')}</p>{row.courseIds.length ? <ul className="space-y-1">{row.courseIds.map(id => <li key={id} className="break-words">{courseTitles[id] || t('course_fallback')}</li>)}</ul> : <span className="text-[var(--muted)]">{t('status_cancelled')}</span>}</td>
              <td className="min-w-0 lg:px-4 lg:py-3"><span className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${row.status === 'confirmed' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : row.status === 'cancelled' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200' : 'bg-[var(--surface-muted)] text-[var(--foreground)]'}`}>{t(statusKeys[row.status])}</span></td>
              <td className="min-w-0 break-words text-[var(--muted)] lg:px-4 lg:py-3"><p>{row.student.phone || t('not_specified')}</p><p className="mt-1 text-xs leading-relaxed">{formatStudentAddress(row.student) || t('not_specified')}</p></td>
              <td className="min-w-0 sm:col-span-2 lg:px-4 lg:py-3"><details><summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-[var(--border)] px-3 font-medium">{t('grid_open_notes')}</summary><div className="pt-3"><BlackboardEditor studentId={row.student.id} studentName={row.student.name || t('unknown_name')} compact /></div></details></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </section>
  )
}
