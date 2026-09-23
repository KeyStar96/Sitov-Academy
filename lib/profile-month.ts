/** Use the academy's timezone on both sides, even at year/month boundaries. */
export function profileMonthWindow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit',
  }).formatToParts(now)
  const year = Number(parts.find(part => part.type === 'year')?.value)
  const month = Number(parts.find(part => part.type === 'month')?.value)
  const date = (offset: number) => new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10)
  return { current: date(0), next: date(1), afterNext: date(2) }
}
export function formatProfileMonth(month: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' })
    .format(new Date(`${month}T12:00:00Z`))
}

/**
 * Planmäßige Termine eines Kurses in einem Monat: jeder Tag, dessen Wochentag
 * (1 = Montag … 7 = Sonntag) im Stundenplan steht und der in die Laufzeit des
 * Kurses fällt. Ohne festen Wochentag gibt es keine Zahl („nach Vereinbarung").
 */
export function courseSessionsInMonth(schedules: readonly { weekday: number }[], month: string, startDate: string | null, endDate: string | null): number | null {
  if (schedules.length === 0) return null
  const [year, number] = month.split('-').map(Number)
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate()
  let count = 0
  for (let day = 1; day <= days; day++) {
    const date = `${month.slice(0, 7)}-${String(day).padStart(2, '0')}`
    if ((startDate && date < startDate) || (endDate && date > endDate)) continue
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
    count += schedules.filter(schedule => schedule.weekday === weekday).length
  }
  return count
}
