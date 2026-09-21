import { ACADEMY_TIME_ZONE, type ProfileCourseCalendarState, type ProfileCourseEvent } from '@/lib/profile-course-calendar'

/** Berlin wall-clock "today" and "now", as civil strings for calendar comparison. */
export function berlinNow(now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ACADEMY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? ''
  // `hour` can arrive as "24" at midnight in some engines – normalise to "00".
  const hour = value('hour') === '24' ? '00' : value('hour')
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${hour}:${value('minute')}` }
}

/** Civil date one day after the supplied `YYYY-MM-DD`, kept stable across DST at noon. */
function nextCivilDate(date: string): string {
  const base = new Date(`${date}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + 1)
  return base.toISOString().slice(0, 10)
}

export type NextCourseRelation = 'today' | 'tomorrow' | 'date'
export interface NextCourse {
  event: ProfileCourseEvent
  relation: NextCourseRelation
}

/**
 * The soonest still-upcoming, non-cancelled appointment from the calendar
 * snapshot. Events are already sorted by date and start time.
 */
export function nextUpcomingEvent(
  calendar: ProfileCourseCalendarState | null | undefined,
  now = new Date()
): NextCourse | null {
  if (!calendar) return null
  const { date: today, time } = berlinNow(now)
  const tomorrow = nextCivilDate(today)
  const upcoming = calendar.events.find(event =>
    !event.cancelled && (event.date > today || (event.date === today && event.endTime >= time))
  )
  if (!upcoming) return null
  return {
    event: upcoming,
    relation: upcoming.date === today ? 'today' : upcoming.date === tomorrow ? 'tomorrow' : 'date',
  }
}
