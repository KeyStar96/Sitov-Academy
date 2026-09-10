import { bookingGridRows, filterAndSortBookings, type BookingGridFilters } from '@/lib/admin-booking-grid'
import type { NextMonthOverview, NextMonthStudentRow } from '@/lib/types/admin-staff'

const filters: BookingGridFilters = { search: '', status: 'all', course: 'all', format: 'all' }
function row(id: string, name: string, status: NextMonthStudentRow['status'], courseIds: string[], city = ''): NextMonthStudentRow {
  return { student: { id, name, email: `${id}@example.invalid`, city, phone: null, street: null, zip_code: null }, status, courseIds, source: 'booking', note: null }
}
const anna = row('a', 'Änne Müller', 'pending', ['online', 'presence'], 'Berlin')
const boris = row('b', 'Boris', 'confirmed', ['online'], 'Berlin')
const carla = row('c', 'Carla', 'cancelled', [], 'Aachen')
const overview: NextMonthOverview = { targetMonth: '2026-10-01', enrolledCount: 2, paused: [carla], groups: [
  { courseId: 'online', type: 'online', title: 'Online', translationKey: 'online', students: [boris, anna] },
  { courseId: 'presence', type: 'presence', title: 'Presence', translationKey: 'presence', students: [anna] },
] }

describe('staff booking grid', () => {
  it('lists a student only once across several courses and includes paused students', () => {
    expect(bookingGridRows(overview).map(value => value.student.id).sort()).toEqual(['a', 'b', 'c'])
  })
  it('matches normalized multiword student names and email without case sensitivity', () => {
    expect(filterAndSortBookings(overview, { ...filters, search: ' MÜLLER  änne ' }, [], 'de').map(value => value.student.id)).toEqual(['a'])
    expect(filterAndSortBookings(overview, { ...filters, search: 'B@EXAMPLE' }, [], 'de').map(value => value.student.id)).toEqual(['b'])
  })
  it('combines status, course, format and name filters', () => {
    expect(filterAndSortBookings(overview, { search: 'Boris', status: 'confirmed', course: 'online', format: 'online' }, [], 'de').map(value => value.student.id)).toEqual(['b'])
    expect(filterAndSortBookings(overview, { ...filters, course: 'presence', format: 'online' }, [], 'de').map(value => value.student.id)).toEqual(['a'])
    expect(filterAndSortBookings(overview, { ...filters, status: 'cancelled', format: 'online' }, [], 'de')).toHaveLength(0)
  })
  it('applies prioritized multi-sort with descending tie-breakers and stable IDs', () => {
    expect(filterAndSortBookings(overview, filters, [{ field: 'city', direction: 'asc' }, { field: 'name', direction: 'desc' }], 'de').map(value => value.student.id)).toEqual(['c', 'b', 'a'])
    expect(filterAndSortBookings(overview, filters, [{ field: 'courses', direction: 'desc' }], 'de').map(value => value.student.id)).toEqual(['a', 'b', 'c'])
  })
  it('does not mutate source rows or source ordering while sorting', () => {
    filterAndSortBookings(overview, filters, [{ field: 'name', direction: 'asc' }], 'de')
    expect(overview.groups[0].students.map(value => value.student.id)).toEqual(['b', 'a'])
  })
})
