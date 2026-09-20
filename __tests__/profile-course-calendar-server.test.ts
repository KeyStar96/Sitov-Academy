jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/utils/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/lib/profile-person', () => ({ resolveVerifiedPerson: jest.fn() }))

import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { resolveVerifiedPerson } from '@/lib/profile-person'
import { loadProfileCourseCalendar } from '@/lib/profile-course-calendar-server'
import { getProfileCourseCalendar } from '@/app/actions/profile-calendar'

const user = { id: 'auth-user', email_confirmed_at: '2026-01-01' } as User
function setup(error: { code: string } | null = null) {
  const query = () => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lt: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range: jest.fn().mockResolvedValue({ data: [], error }) })
  const bookings = query(), exceptions = query()
  const db = { from: jest.fn((table: string) => table === 'bookings' ? bookings : exceptions) }
  return { bookings, exceptions, db: db as unknown as Awaited<ReturnType<typeof createClient>> }
}
beforeEach(() => { jest.clearAllMocks(); jest.mocked(resolveVerifiedPerson).mockResolvedValue({ id: 'verified-person', unresolved: false }) })

it('loads the authenticated person bookings and bounded exceptions through the RLS client', async () => {
  const { db, bookings, exceptions } = setup()
  const result = await loadProfileCourseCalendar(db, user, new Date('2026-09-30T22:30:00Z'))
  expect(resolveVerifiedPerson).toHaveBeenCalledWith(user)
  expect(bookings.eq).toHaveBeenCalledWith('person_id', 'verified-person')
  expect(bookings.in).toHaveBeenCalledWith('status', ['pending', 'confirmed'])
  expect(bookings.gte).toHaveBeenCalledWith('target_month', '2026-10-01')
  expect(bookings.lt).toHaveBeenCalledWith('target_month', '2026-12-01')
  expect(bookings.select.mock.calls[0][0]).toContain('booking_items(course_id,title_snapshot,courses(')
  expect(bookings.select.mock.calls[0][0]).toContain('course_schedules(')
  expect(exceptions.gte).toHaveBeenCalledWith('date', '2026-10-01')
  expect(exceptions.lt).toHaveBeenCalledWith('date', '2026-12-01')
  expect(bookings.order).toHaveBeenCalledWith('id')
  expect(exceptions.order).toHaveBeenCalledWith('id')
  expect(result.currentMonth).toBe('2026-10-01')
})

it('includes bookings and cancellations beyond the first PostgREST page', async () => {
  const { db, bookings, exceptions } = setup()
  const row = { id: 'last-booking', kind: 'registration', status: 'confirmed', target_month: '2026-09-01', start_date: '2026-09-01', booking_items: [{
    course_id: 'a1', title_snapshot: 'A1', courses: { id: 'a1', title: 'A1', start_date: null, end_date: null, course_translations: [],
      course_schedules: [{ id: 'schedule', weekday: 2, start_time: '18:00', end_time: '19:30' }] },
  }] }
  bookings.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, index) => ({ ...row, id: `earlier-${index}`, booking_items: [] })), error: null })
    .mockResolvedValueOnce({ data: [row], error: null })
  exceptions.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => ({ course_id: 'another-course', date: '2026-09-01', reason: 'Other course' })), error: null })
    .mockResolvedValueOnce({ data: [{ course_id: 'a1', date: '2026-09-01', reason: 'Cancellation beyond the first page' }], error: null })
  const result = await loadProfileCourseCalendar(db, user, new Date('2026-09-20T10:00:00Z'))
  expect(bookings.range).toHaveBeenNthCalledWith(1, 0, 499)
  expect(bookings.range).toHaveBeenNthCalledWith(2, 500, 999)
  expect(exceptions.range).toHaveBeenNthCalledWith(2, 500, 999)
  expect(result.events[0]).toMatchObject({ cancelled: true, reasons: ['Cancellation beyond the first page'] })
  expect(result.events).toHaveLength(5)
})

it('does not query another person or hide an ambiguous link as a successful empty calendar', async () => {
  jest.mocked(resolveVerifiedPerson).mockResolvedValue({ id: null, unresolved: true })
  const { db } = setup()
  const result = await loadProfileCourseCalendar(db, user)
  expect(result.unresolved).toBe(true)
  expect(db.from).not.toHaveBeenCalled()
})

it('surfaces data failures instead of claiming there are no classes', async () => {
  await expect(loadProfileCourseCalendar(setup({ code: '42501' }).db, user)).rejects.toThrow('not_authorized')
})

it('requires a verified Auth session before the calendar action queries any data', async () => {
  const db = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }) }, from: jest.fn() }
  jest.mocked(createClient).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof createClient>>)
  expect(await getProfileCourseCalendar()).toEqual({ success: false, error: 'not_authenticated' })
  expect(db.from).not.toHaveBeenCalled()
})
