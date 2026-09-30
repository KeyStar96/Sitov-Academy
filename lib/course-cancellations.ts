/**
 * Reine Logik für „Kursausfälle“ – ohne Server-/Client-Abhängigkeiten, damit
 * Server-Action, Oberfläche und Tests dieselben Regeln teilen.
 *
 * Datumswerte sind Kalendertage `YYYY-MM-DD` (wie `course_exceptions.date`),
 * Wochentage folgen ISO wie `course_schedules.weekday`: 1 = Montag … 7 = Sonntag.
 */
export interface CancellationSchedule { weekday: number; start: string; end: string }
export interface CancellationCourse {
  id: string
  title: string
  type: 'presence' | 'online'
  category: 'german' | 'speaking' | 'online' | 'private'
  level: string
  startDate: string | null
  endDate: string | null
  archived: boolean
  schedules: CancellationSchedule[]
}
export interface CancellationEntry { id: string; date: string; reason: string; courseId: string | null }
export interface CancellationData { courses: CancellationCourse[]; cancellations: CancellationEntry[] }

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** ISO-Wochentag (1 = Mo … 7 = So) eines Kalendertags, zeitzonenunabhängig. */
export function isoWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

/** Heutiger Kalendertag in Hannover. */
export function berlinToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Findet an diesem Tag laut Stundenplan und Kurslaufzeit Unterricht statt? */
export function courseHasLessonOn(course: CancellationCourse, date: string): boolean {
  if (course.archived || !isCalendarDate(date)) return false
  if (course.startDate && date < course.startDate) return false
  if (course.endDate && date > course.endDate) return false
  const weekday = isoWeekday(date)
  return course.schedules.some(schedule => schedule.weekday === weekday)
}

/** Kurse, die ein ganztägiger Ausfall an diesem Datum tatsächlich betrifft. */
export function coursesOnDate(courses: CancellationCourse[], date: string): CancellationCourse[] {
  return courses.filter(course => courseHasLessonOn(course, date))
}

export interface CancellationGroup { date: string; entries: CancellationEntry[] }

/** Ausfälle nach Datum gruppiert: kommende aufsteigend, vergangene absteigend. */
export function groupCancellations(entries: CancellationEntry[], today: string, view: 'upcoming' | 'past'): CancellationGroup[] {
  const selected = entries.filter(entry => (view === 'upcoming' ? entry.date >= today : entry.date < today))
  const groups = new Map<string, CancellationEntry[]>()
  for (const entry of selected) groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry])
  return [...groups.entries()]
    .sort(([a], [b]) => (view === 'upcoming' ? a.localeCompare(b) : b.localeCompare(a)))
    .map(([date, list]) => ({ date, entries: list.sort((a, b) => (a.courseId === null ? -1 : b.courseId === null ? 1 : 0) || a.id.localeCompare(b.id)) }))
}

/** Kalendertag lesbar formatieren, ohne Zeitzonenverschiebung. */
export function formatCalendarDate(date: string, lang: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }): string {
  if (!isCalendarDate(date)) return date
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(lang, { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}
