import { profileMonthlyQuote } from '@/lib/profile-monthly-quote'
const course = { id: 'a1', category: 'german', unit_price: 10, unit_minutes: 45, start_date: null, end_date: null,
  course_schedules: [{ weekday: 4, start_time: '19:00:00', end_time: '20:30:00' }] }
it('quotes actual teaching units rather than charging one unit per appointment', () => {
  expect(profileMonthlyQuote(course, '2026-10-01', [])).toEqual({ sessions: 5, monthlyAmount: 100 })
})
it('deducts overlapping global and course cancellations once and respects bounds', () => {
  expect(profileMonthlyQuote({ ...course, start_date: '2026-10-08', end_date: '2026-10-22' }, '2026-10-01', [
    { date: '2026-10-15', course_id: null }, { date: '2026-10-15', course_id: 'a1' }, { date: '2026-10-08', course_id: 'other' },
  ])).toEqual({ sessions: 2, monthlyAmount: 40 })
})
it('leaves individually requested private units to the quantity selection', () => {
  expect(profileMonthlyQuote({ ...course, category: 'private' }, '2026-10-01', [])).toEqual({ sessions: null, monthlyAmount: null })
})
