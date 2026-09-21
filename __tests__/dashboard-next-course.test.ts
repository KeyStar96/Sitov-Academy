import { berlinNow, nextUpcomingEvent } from '@/lib/dashboard-next-course'
import type { ProfileCourseCalendarState, ProfileCourseEvent } from '@/lib/profile-course-calendar'
import { DASHBOARD_HOME_MESSAGES } from '@/lib/dashboard-home-i18n'
import { LOCALES } from '@/lib/locale-routing'

const event = (over: Partial<ProfileCourseEvent> & Pick<ProfileCourseEvent, 'id' | 'date' | 'startTime' | 'endTime'>): ProfileCourseEvent => ({
  courseId: 'c1', title: 'Kurs', translations: [], pending: false, trial: false, cancelled: false, reasons: [], ...over,
})
const calendar = (events: ProfileCourseEvent[]): ProfileCourseCalendarState => ({
  currentMonth: '2026-09-01', nextMonth: '2026-10-01', events, unscheduled: [], unresolved: false,
})

describe('berlinNow', () => {
  it('reports the Berlin civil date and time (summer/DST)', () => {
    // 2026-09-21 08:30 UTC is 10:30 in Berlin (CEST, +2).
    expect(berlinNow(new Date('2026-09-21T08:30:00Z'))).toEqual({ date: '2026-09-21', time: '10:30' })
  })
})

describe('nextUpcomingEvent', () => {
  const now = new Date('2026-09-21T08:30:00Z') // Berlin: Mon 2026-09-21 10:30

  it('returns null without a calendar', () => {
    expect(nextUpcomingEvent(null, now)).toBeNull()
  })

  it('marks a later appointment on the same day as today', () => {
    const result = nextUpcomingEvent(calendar([event({ id: 'a', date: '2026-09-21', startTime: '18:00', endTime: '19:30' })]), now)
    expect(result?.event.id).toBe('a')
    expect(result?.relation).toBe('today')
  })

  it('skips appointments that already ended today', () => {
    const result = nextUpcomingEvent(calendar([
      event({ id: 'past', date: '2026-09-21', startTime: '08:00', endTime: '09:30' }),
      event({ id: 'next', date: '2026-09-22', startTime: '09:00', endTime: '10:30' }),
    ]), now)
    expect(result?.event.id).toBe('next')
    expect(result?.relation).toBe('tomorrow')
  })

  it('ignores cancelled appointments and classifies distant dates', () => {
    const result = nextUpcomingEvent(calendar([
      event({ id: 'cancelled', date: '2026-09-23', startTime: '09:00', endTime: '10:30', cancelled: true }),
      event({ id: 'later', date: '2026-09-28', startTime: '09:00', endTime: '10:30' }),
    ]), now)
    expect(result?.event.id).toBe('later')
    expect(result?.relation).toBe('date')
  })

  it('returns null when only past or cancelled appointments remain', () => {
    expect(nextUpcomingEvent(calendar([
      event({ id: 'past', date: '2026-09-20', startTime: '09:00', endTime: '10:30' }),
      event({ id: 'cancelled', date: '2026-09-25', startTime: '09:00', endTime: '10:30', cancelled: true }),
    ]), now)).toBeNull()
  })
})

describe('dashboard home messages', () => {
  const keys = Object.keys(DASHBOARD_HOME_MESSAGES.de)
  it.each(LOCALES)('%s defines every key with a non-empty string and matching placeholders', locale => {
    const messages = DASHBOARD_HOME_MESSAGES[locale] as Record<string, string>
    for (const key of keys) {
      expect(typeof messages[key]).toBe('string')
      expect(messages[key].length).toBeGreaterThan(0)
      expect((messages[key].match(/\{\w+\}/g) ?? []).sort())
        .toEqual(((DASHBOARD_HOME_MESSAGES.de as Record<string, string>)[key].match(/\{\w+\}/g) ?? []).sort())
    }
  })
})
