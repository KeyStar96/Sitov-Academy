import type { NextMonthOverview, NextMonthRowStatus, NextMonthStudentRow } from '@/lib/types/admin-staff'

export type BookingSortField = 'name' | 'status' | 'courses' | 'city'
export type BookingSortDirection = 'asc' | 'desc'
export interface BookingSort { field: BookingSortField; direction: BookingSortDirection }
export interface BookingGridFilters {
  search: string
  status: NextMonthRowStatus | 'all'
  course: string
  format: 'all' | 'online' | 'presence'
}

/** One row per student, including students taking several courses. */
export function bookingGridRows(overview: NextMonthOverview): NextMonthStudentRow[] {
  const rows = new Map<string, NextMonthStudentRow>()
  for (const group of overview.groups) {
    for (const row of group.students) rows.set(row.student.id, row)
  }
  for (const row of overview.paused) rows.set(row.student.id, row)
  return [...rows.values()]
}

export function filterAndSortBookings(
  overview: NextMonthOverview,
  filters: BookingGridFilters,
  sorts: readonly BookingSort[],
  locale: string,
): NextMonthStudentRow[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const search = filters.search.normalize('NFKC').toLocaleLowerCase(locale).trim()
  const formats = new Map(overview.groups.map(group => [group.courseId, group.type]))
  const statusOrder: Record<NextMonthRowStatus, number> = { pending: 0, inherited: 1, confirmed: 2, cancelled: 3 }
  function compare(left: NextMonthStudentRow, right: NextMonthStudentRow, field: BookingSortField): number {
    switch (field) {
      case 'name': return collator.compare(left.student.person?.display_name || left.student.person?.email || '', right.student.person?.display_name || right.student.person?.email || '')
      case 'status': return statusOrder[left.status] - statusOrder[right.status]
      case 'courses': return left.courseSelections.length - right.courseSelections.length
      case 'city': return collator.compare(left.student.person?.city || '', right.student.person?.city || '')
    }
  }
  return bookingGridRows(overview).filter(row => {
    const nameAndEmail = `${row.student.person?.display_name ?? ''} ${row.student.person?.email ?? ''}`.normalize('NFKC').toLocaleLowerCase(locale)
    return (!search || search.split(/\s+/).every(part => nameAndEmail.includes(part)))
      && (filters.status === 'all' || row.status === filters.status)
      && (filters.course === 'all' || row.courseSelections.some(selection=>selection.courseId===filters.course))
      && (filters.format === 'all' || row.courseSelections.some(selection => formats.get(selection.courseId) === filters.format))
  }).sort((left, right) => {
    for (const sort of sorts) {
      const result = compare(left, right, sort.field)
      if (result !== 0) return sort.direction === 'asc' ? result : -result
    }
    return left.student.id.localeCompare(right.student.id)
  })
}
