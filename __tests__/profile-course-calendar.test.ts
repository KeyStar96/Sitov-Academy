import { buildProfileCourseCalendar, calendarMonthDays, calendarWeekday, formatCalendarDate, type CalendarBooking } from '@/lib/profile-course-calendar'

const now = new Date('2026-09-20T10:00:00Z')
const booking = (overrides: Partial<CalendarBooking> = {}): CalendarBooking => ({
  id: 'booking', kind: 'registration', status: 'confirmed', target_month: '2026-09-01', start_date: '2026-09-08',
  booking_items: [{ course_id: 'a1', title_snapshot: 'German A1', courses: {
    id: 'a1', title: 'Deutsch A1', start_date: '2026-09-01', end_date: null,
    course_translations: [{ locale: 'en', title: 'German A1' }],
    course_schedules: [{ id: 'schedule', weekday: 2, start_time: '18:00:00', end_time: '19:30:00' }],
  } }], ...overrides,
})

it('shows only saved active bookings, respects course and booking start/end and preserves Berlin wall times', () => {
  const first = booking()
  first.booking_items[0].courses!.end_date = '2026-09-22'
  const result = buildProfileCourseCalendar([first, booking({ id: 'cancelled', status: 'cancelled' }), booking({ id: 'rejected', status: 'rejected' }), booking({ id: 'old', target_month: '2026-08-01' })], [], now)
  expect(result.events.map(event => event.date)).toEqual(['2026-09-08', '2026-09-15', '2026-09-22'])
  expect(result.events.every(event => event.startTime === '18:00' && event.endTime === '19:30')).toBe(true)
  expect(result.events.some(event => event.date.startsWith('2026-10'))).toBe(false)
})

it('marks global and course-specific cancellations without losing the booked appointment', () => {
  const result = buildProfileCourseCalendar([booking()], [
    { course_id: null, date: '2026-09-08', reason: 'Feiertag' },
    { course_id: 'a1', date: '2026-09-15', reason: 'Lehrkraft verhindert' },
    { course_id: 'other-course', date: '2026-09-22', reason: 'Not our course' },
    { course_id: 'a1', date: '2026-09-16', reason: 'Not a scheduled day' },
  ], now)
  expect(result.events[0]).toMatchObject({ cancelled: true, reasons: ['Feiertag'] })
  expect(result.events[1]).toMatchObject({ cancelled: true, reasons: ['Lehrkraft verhindert'] })
  expect(result.events[2]).toMatchObject({ cancelled: false, reasons: [] })
  expect(result.events).toHaveLength(4)
})

it('includes pending next-month bookings and limits trial appointments to the booked day', () => {
  const result = buildProfileCourseCalendar([
    booking({ id: 'next', target_month: '2026-10-01', start_date: '2026-10-01', status: 'pending' }),
    booking({ id: 'trial', kind: 'trial', start_date: '2026-09-08' }),
  ], [], now)
  expect(result.events.filter(event => event.trial).map(event => event.date)).toEqual(['2026-09-08'])
  expect(result.events.filter(event => event.pending).map(event => event.date)).toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27'])
})

it('retains private or unavailable course titles without inventing dates', () => {
  const privateBooking = booking({ booking_items: [{ course_id: 'private', title_snapshot: 'Privatunterricht', courses: null }] })
  const result = buildProfileCourseCalendar([privateBooking], [], now)
  expect(result.events).toEqual([])
  expect(result.unscheduled).toEqual([{ id: 'booking:private', month: '2026-09-01', title: 'Privatunterricht', translations: [], pending: false }])
})

it.each([
  ['2026-09-30T22:30:00Z', '2026-10-01', '2026-11-01'],
  ['2026-12-31T23:30:00Z', '2027-01-01', '2027-02-01'],
  ['2026-03-31T22:30:00Z', '2026-04-01', '2026-05-01'],
])('selects the Berlin month window at %s', (instant, currentMonth, nextMonth) => {
  expect(buildProfileCourseCalendar([], [], new Date(instant))).toMatchObject({ currentMonth, nextMonth })
})

it.each(['2026-03-29', '2026-10-25'])('does not shift dates or weekdays at the daylight-saving transition %s', date => {
  expect(calendarWeekday(date)).toBe(7)
  expect(formatCalendarDate(date, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })).toBe(date)
})

it('generates all calendar days including leap-day and the last day of long months', () => {
  expect(calendarMonthDays('2028-02-01').at(-1)).toBe('2028-02-29')
  expect(calendarMonthDays('2026-10-01')).toHaveLength(31)
})
