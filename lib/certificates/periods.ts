import type { CertificateEligibilityPeriod } from './types'

export type CertificateSegment = {
  courseId: string
  title: string
  description: string
  schedule: CertificateEligibilityPeriod['schedule_snapshot']
  start: string
  end: string
  periodIds: string[]
}
export function berlinToday(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
function nextDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}
/** Merge only adjacent eligible intervals with identical historical wording. */
export function groupCertificatePeriods(periods: CertificateEligibilityPeriod[], month: string | null = null, today = berlinToday()): CertificateSegment[] {
  const eligible = periods.filter(period => period.eligible && period.status === 'confirmed' &&
    period.start_date <= today && (!month || period.start_date.slice(0, 7) === month.slice(0, 7)))
    .sort((a, b) => a.course_id.localeCompare(b.course_id) || a.start_date.localeCompare(b.start_date))
  const grouped: CertificateSegment[] = []
  for (const period of eligible) {
    const previous = grouped.at(-1)
    const end = period.end_date < today ? period.end_date : today
    if (previous && previous.courseId === period.course_id && previous.title === period.title_snapshot &&
      previous.description === period.description_snapshot && JSON.stringify(previous.schedule) === JSON.stringify(period.schedule_snapshot) &&
      period.start_date <= nextDate(previous.end)) {
      previous.end = end > previous.end ? end : previous.end
      previous.periodIds.push(period.id)
    } else {
      grouped.push({ courseId: period.course_id, title: period.title_snapshot, description: period.description_snapshot,
        schedule: period.schedule_snapshot, start: period.start_date, end, periodIds: [period.id] })
    }
  }
  return grouped.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title))
}
