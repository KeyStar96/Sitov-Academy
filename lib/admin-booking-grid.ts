import type { NextMonthOverview, NextMonthRowStatus, NextMonthStudentRow } from '@/lib/types/admin-staff'

export type BookingSortField = 'name' | 'status' | 'courses' | 'city' | 'discount'
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
  discountByStudent: ReadonlyMap<string, number> = new Map(),
): NextMonthStudentRow[] {
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const search = filters.search.normalize('NFKC').toLocaleLowerCase(locale).trim()
  const formats = new Map(overview.groups.map(group => [group.courseId, group.type]))
  const statusOrder: Record<NextMonthRowStatus, number> = { pending: 0, inherited: 1, confirmed: 2, cancelled: 3 }
  function compare(left: NextMonthStudentRow, right: NextMonthStudentRow, field: BookingSortField): number {
    switch (field) {
      case 'name': return collator.compare(left.student.name || left.student.email, right.student.name || right.student.email)
      case 'status': return statusOrder[left.status] - statusOrder[right.status]
      case 'courses': return left.courseIds.length - right.courseIds.length
      case 'city': return collator.compare(left.student.city || '', right.student.city || '')
      case 'discount': return (discountByStudent.get(left.student.id) ?? left.note?.discount_percent ?? 0) - (discountByStudent.get(right.student.id) ?? right.note?.discount_percent ?? 0)
    }
  }
  return bookingGridRows(overview).filter(row => {
    const nameAndEmail = `${row.student.name ?? ''} ${row.student.email}`.normalize('NFKC').toLocaleLowerCase(locale)
    return (!search || search.split(/\s+/).every(part => nameAndEmail.includes(part)))
      && (filters.status === 'all' || row.status === filters.status)
      && (filters.course === 'all' || row.courseIds.includes(filters.course))
      && (filters.format === 'all' || row.courseIds.some(id => formats.get(id) === filters.format))
  }).sort((left, right) => {
    for (const sort of sorts) {
      const result = compare(left, right, sort.field)
      if (result !== 0) return sort.direction === 'asc' ? result : -result
    }
    return left.student.id.localeCompare(right.student.id)
  })
}
