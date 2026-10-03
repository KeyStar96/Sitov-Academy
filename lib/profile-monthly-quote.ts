import { calendarMonthDays, calendarWeekday } from '@/lib/profile-course-calendar'

interface MonthlyQuoteCourse {
  id: string
  category: string
  unit_price: number
  unit_minutes: number
  start_date: string | null
  end_date: string | null
  course_schedules: { weekday: number; start_time: string; end_time: string }[]
}

/** Mirrors the database course quote: fixed calendar dates, per-unit rates,
 * course bounds and one deduction per cancelled session. */
export function profileMonthlyQuote(course: MonthlyQuoteCourse, month: string, exceptions: { course_id: string | null; date: string }[]) {
  if (course.category === 'private') return { sessions: null, monthlyAmount: null }
  let units = 0
  let sessions = 0
  for (const date of calendarMonthDays(month)) {
    if ((course.start_date && date < course.start_date) || (course.end_date && date > course.end_date)) continue
    if (exceptions.some(exception => exception.date === date && (!exception.course_id || exception.course_id === course.id))) continue
    for (const schedule of course.course_schedules) {
      if (calendarWeekday(date) !== schedule.weekday) continue
      const minutes = (time: string) => { const [hour, minute, second = 0] = time.split(':').map(Number); return hour * 60 + minute + second / 60 }
      units += (minutes(schedule.end_time) - minutes(schedule.start_time)) / course.unit_minutes
      sessions += 1
    }
  }
  return { sessions, monthlyAmount: Math.round(units * course.unit_price * 100) / 100 }
}
