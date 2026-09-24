import type { CourseConfig, CourseException } from '@/lib/course-config'
import { DAY_MAP } from '@/lib/course-calculations'
import { berlinNow } from '@/lib/dashboard-next-course'

export interface StartSession { courseId: string; startTime: string; endTime: string }
export interface StartDay { iso: string; sessions: StartSession[] }

/** Civil `YYYY-MM-DD` plus `days`; noon keeps the date stable across DST. */
export function addCivilDays(iso: string, days: number): string {
  const base = new Date(`${iso}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

/** The earliest possible start: tomorrow in Berlin (the database rejects past starts). */
export function firstStartDate(now: number): string {
  return addCivilDays(berlinNow(new Date(now)).date, 1)
}

export function isoToGerman(iso: string): string {
  return iso.split('-').reverse().join('.')
}

function isCancelled(course: CourseConfig, iso: string, exceptions: CourseException[]) {
  return exceptions.some(exception => exception.date === iso && (!exception.courseIds || exception.courseIds.includes(course.id)))
}

/**
 * Real upcoming lesson days of the given courses, from `from` (inclusive) for
 * `days` days, at most `limit` entries. Days outside a course period and
 * cancelled lessons are left out, so every suggestion is a lesson that happens.
 */
export function upcomingCourseDays(courses: CourseConfig[], exceptions: CourseException[], from: string,
  { days, limit }: { days: number; limit: number }): StartDay[] {
  const result: StartDay[] = []
  for (let offset = 0; offset < days && result.length < limit; offset++) {
    const iso = addCivilDays(from, offset)
    const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay()
    const sessions = courses.flatMap(course => {
      if ((course.startDate && iso < course.startDate) || (course.endDate && iso > course.endDate)) return []
      if (isCancelled(course, iso, exceptions)) return []
      return course.sessions.filter(session => DAY_MAP[session.day] === weekday)
        .map(session => ({ courseId: course.id, startTime: session.startTime, endTime: session.endTime }))
    }).sort((a, b) => a.startTime.localeCompare(b.startTime))
    if (sessions.length > 0) result.push({ iso, sessions })
  }
  return result
}

/**
 * Courses without fixed lesson times (private lessons) start per month:
 * from `from` in the current month, then on the first of each following month.
 */
export function monthStarts(from: string, count: number): string[] {
  const starts = [from]
  let [year, month] = from.split('-').map(Number)
  while (starts.length < count) {
    month += 1
    if (month > 12) { month = 1; year += 1 }
    starts.push(`${year}-${String(month).padStart(2, '0')}-01`)
  }
  return starts
}
