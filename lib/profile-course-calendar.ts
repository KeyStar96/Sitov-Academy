import { profileMonthWindow } from '@/lib/profile-month'
import type { Tables } from '@/supabase/database.types'

export const ACADEMY_TIME_ZONE = 'Europe/Berlin'

type CalendarCourse = Pick<Tables<'courses'>, 'id' | 'title' | 'start_date' | 'end_date'> & {
  course_schedules: Pick<Tables<'course_schedules'>, 'id' | 'weekday' | 'start_time' | 'end_time'>[]
  course_translations: { locale: string; title: string }[]
}
export type CalendarBooking = Pick<Tables<'bookings'>, 'id' | 'kind' | 'status' | 'target_month' | 'start_date'> & {
  booking_items: { course_id: string; title_snapshot: string; courses: CalendarCourse | null }[]
}
export type CalendarException = Pick<Tables<'course_exceptions'>, 'course_id' | 'date' | 'reason'>
export interface ProfileCourseEvent {
  id: string
  courseId: string
  title: string
  translations: { locale: string; title: string }[]
  date: string
  startTime: string
  endTime: string
  pending: boolean
  trial: boolean
  cancelled: boolean
  reasons: string[]
}
export interface ProfileCourseCalendarState {
  currentMonth: string
  nextMonth: string
  events: ProfileCourseEvent[]
  unscheduled: { id: string; month: string; title: string; translations: { locale: string; title: string }[]; pending: boolean }[]
  unresolved: boolean
}

/** These are civil dates, not instants. UTC is used only for calendar arithmetic;
 * course times stay as Berlin wall times across both daylight-saving changes. */
export function calendarMonthDays(month: string): string[] {
  const [year, number] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) => `${month.slice(0, 7)}-${String(index + 1).padStart(2, '0')}`)
}
export function calendarWeekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay() || 7
}
export function formatCalendarDate(date: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  // Noon keeps the supplied civil date intact in Berlin in winter and summer.
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: ACADEMY_TIME_ZONE }).format(new Date(`${date}T12:00:00Z`))
}

export function buildProfileCourseCalendar(bookings: CalendarBooking[], exceptions: CalendarException[], now = new Date()): ProfileCourseCalendarState {
  const { current, next } = profileMonthWindow(now)
  const events: ProfileCourseEvent[] = []
  const unscheduled: ProfileCourseCalendarState['unscheduled'] = []
  for (const booking of bookings) {
    if (!['pending', 'confirmed'].includes(booking.status) || ![current, next].includes(booking.target_month)) continue
    for (const item of booking.booking_items) {
      const course = item.courses
      const title = course?.title || item.title_snapshot
      const translations = course?.course_translations ?? []
      if (!course?.course_schedules.length) {
        unscheduled.push({ id: `${booking.id}:${item.course_id}`, month: booking.target_month, title, translations, pending: booking.status === 'pending' })
        continue
      }
      for (const date of calendarMonthDays(booking.target_month)) {
        if (date < booking.start_date || (course.start_date && date < course.start_date) || (course.end_date && date > course.end_date)) continue
        if (booking.kind === 'trial' && date !== booking.start_date) continue
        for (const schedule of course.course_schedules) {
          if (calendarWeekday(date) !== schedule.weekday) continue
          const matches = exceptions.filter(exception => exception.date === date && (!exception.course_id || exception.course_id === course.id))
          events.push({
            id: `${booking.id}:${schedule.id}:${date}`, courseId: course.id, title, translations, date,
            startTime: schedule.start_time.slice(0, 5), endTime: schedule.end_time.slice(0, 5),
            pending: booking.status === 'pending', trial: booking.kind === 'trial', cancelled: matches.length > 0,
            reasons: [...new Set(matches.map(exception => exception.reason.trim()).filter(Boolean))],
          })
        }
      }
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
  return { currentMonth: current, nextMonth: next, events, unscheduled, unresolved: false }
}
