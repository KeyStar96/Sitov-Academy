'use client'

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { CalendarDays, ChevronDown, Clock, Loader2 } from 'lucide-react'
import { getProfileCourseCalendar } from '@/app/actions/profile-calendar'
import { formatCalendarDate, type ProfileCourseCalendarState, type ProfileCourseEvent } from '@/lib/profile-course-calendar'
import { profileCalendarMessages } from '@/lib/profile-calendar-i18n'
import { formatProfileMonth, profileMonthWindow } from '@/lib/profile-month'
import { berlinNow } from '@/lib/dashboard-next-course'
import { studentTranslator } from '@/lib/student-ui-i18n'

type GroupKey = 'past' | 'today' | 'tomorrow' | 'week' | 'later' | 'month'

function addDays(date: string, days: number): string {
  const base = new Date(`${date}T12:00:00Z`)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

/** Sonntag der laufenden Woche (Berliner Kalender). */
function endOfWeek(today: string): string {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7
  return addDays(today, 7 - weekday)
}

/**
 * Stundenplan als Agenda: Kalenderblätter mit Wochentag und großer Tageszahl,
 * gruppiert nach „Heute / Morgen / Diese Woche / Später". Ein Blick genügt,
 * um zu sehen, wann der nächste Unterricht ist — kein Suchen im Monatsraster.
 */
export default function ProfileCourseCalendar({ initial, lang, bookingRevision }: {
  initial: ProfileCourseCalendarState | null
  lang: string
  bookingRevision: string
}) {
  const messages = profileCalendarMessages(lang)
  const s = studentTranslator(lang)
  const headingId = useId()
  const [calendar, setCalendar] = useState(initial)
  const [month, setMonth] = useState(initial?.currentMonth ?? '')
  const [failed, setFailed] = useState(!initial)
  const [loading, setLoading] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [today, setToday] = useState<string | null>(null)
  const previousRevision = useRef(bookingRevision)
  const request = useRef(0)

  const reload = useCallback(async () => {
    const id = ++request.current
    setLoading(true)
    try {
      const result = await getProfileCourseCalendar()
      if (id !== request.current) return
      if (result.success === false) throw new Error(result.error)
      setCalendar(result.data)
      setFailed(false)
    } catch {
      if (id === request.current) setFailed(true)
    } finally {
      if (id === request.current) setLoading(false)
    }
  }, [])

  useEffect(() => { setToday(berlinNow().date) }, [])
  useEffect(() => {
    request.current += 1
    setCalendar(initial)
    setFailed(!initial)
    setLoading(false)
  }, [initial])
  useEffect(() => () => { request.current += 1 }, [])
  useEffect(() => {
    if (previousRevision.current === bookingRevision) return
    previousRevision.current = bookingRevision
    // Only persisted booking revisions refresh appointments, never optimistic selections.
    void reload()
  }, [bookingRevision, reload])
  useEffect(() => {
    const onFocus = () => { void reload() }
    const timer = window.setInterval(() => {
      if (calendar && profileMonthWindow().current !== calendar.currentMonth) void reload()
    }, 60_000)
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [calendar, reload])

  const activeMonth = month === calendar?.nextMonth ? calendar.nextMonth : calendar?.currentMonth
  const monthEvents = calendar?.events.filter(event => event.date.startsWith(activeMonth?.slice(0, 7) ?? '!')) ?? []
  const unscheduled = calendar?.unscheduled.filter(course => course.month === activeMonth) ?? []
  const title = (course: { title: string; translations: { locale: string; title: string }[] }) => course.translations.find(value => value.locale === lang)?.title || course.title

  // Vor dem Mounten kennt der Server „heute" nicht zuverlässig — dann bleibt es
  // bei einer schlichten Monatsliste, danach kommen die Tagesgruppen.
  const groups = new Map<GroupKey, ProfileCourseEvent[]>()
  const isCurrentMonth = activeMonth === calendar?.currentMonth
  for (const event of monthEvents) {
    const key: GroupKey = !today || !isCurrentMonth ? 'month'
      : event.date < today ? 'past'
        : event.date === today ? 'today'
          : event.date === addDays(today, 1) ? 'tomorrow'
            : event.date <= endOfWeek(today) ? 'week' : 'later'
    groups.set(key, [...(groups.get(key) ?? []), event])
  }
  const order: GroupKey[] = ['today', 'tomorrow', 'week', 'later', 'month']
  const groupTitle: Record<GroupKey, string> = {
    past: s('calendar_past'), today: s('calendar_today'), tomorrow: s('calendar_tomorrow'), week: s('calendar_week'),
    later: s('calendar_later'), month: activeMonth ? formatProfileMonth(activeMonth, lang) : '',
  }
  const upcoming = order.filter(key => groups.has(key))
  const past = groups.get('past') ?? []
  let tile = 0

  const renderEvent = (event: ProfileCourseEvent) => {
    const index = tile++
    return (
      <li key={event.id} className="st-leaf-row st-rise" data-cancelled={event.cancelled} style={{ '--i': Math.min(index, 10) } as CSSProperties}>
        <span className="st-leaf" aria-hidden="true">
          <span className="st-leaf__weekday">{formatCalendarDate(event.date, lang, { weekday: 'short' }).replace('.', '')}</span>
          <span className="st-leaf__day">{Number(event.date.slice(-2))}</span>
          <span className="st-leaf__month">{formatCalendarDate(event.date, lang, { month: 'short' }).replace('.', '')}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="sr-only"><time dateTime={event.date}>{formatCalendarDate(event.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</time> · </span>
          <span className="st-leaf-row__time"><Clock size={16} aria-hidden="true" />{s('calendar_time', { start: event.startTime, end: event.endTime })}</span>
          <span className="st-leaf-row__title">{title(event)}</span>
          {event.cancelled && <span className="st-leaf-row__cancelled">{messages.cancelled}{event.reasons.length > 0 ? `: ${event.reasons.join(' · ')}` : ''}</span>}
          {(event.pending || event.trial) && (
            <span className="st-leaf-row__chips">
              {event.pending && <span className="st-chip-soft">{messages.pending}</span>}
              {event.trial && <span className="st-chip-soft">{messages.trial}</span>}
            </span>
          )}
        </span>
      </li>
    )
  }

  return (
    <section aria-labelledby={headingId} className="st-agenda sl-glass">
      <div className="flex items-center gap-3">
        <span className="sl-icon-tile h-12 w-12"><CalendarDays aria-hidden="true" size={24} /></span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-xl font-bold text-[var(--foreground)]">{messages.title}</h2>
          <p className="text-base text-[var(--muted)]">{messages.timezone}</p>
        </div>
        {loading && <Loader2 size={20} className="ml-auto animate-spin text-[var(--muted)]" aria-hidden="true" />}
      </div>
      {failed && <div role="alert" className="mt-4 rounded-xl bg-[var(--warning)] p-3 text-[var(--warning-foreground)]">
        <p>{messages.failed}</p>
        <button type="button" disabled={loading} onClick={() => void reload()} className="mt-2 min-h-11 rounded-lg border border-current px-3 font-semibold">{messages.retry}</button>
      </div>}
      <div role="status" className="sr-only">{loading ? messages.loading : ''}</div>
      {calendar && activeMonth && <>
        <div role="group" aria-label={messages.months} className="st-segment st-segment--compact mt-5"
          style={{ '--st-active': activeMonth === calendar.currentMonth ? 0 : 1 } as CSSProperties}>
          <span className="st-segment__pill" aria-hidden="true" />
          {[calendar.currentMonth, calendar.nextMonth].map(value => (
            <button key={value} type="button" aria-pressed={activeMonth === value} onClick={() => { setMonth(value); setShowPast(false) }}
              className="st-segment__option st-press">
              {formatProfileMonth(value, lang)}
            </button>
          ))}
        </div>
        {calendar.unresolved && <p className="mt-4 rounded-xl bg-[var(--warning)] p-3 text-base text-[var(--warning-foreground)]">{messages.unresolved}</p>}

        <div aria-live="polite">
          {monthEvents.length === 0 && unscheduled.length === 0 && <p className="st-empty mt-5">{messages.empty}</p>}
          {upcoming.map(key => (
            <section key={key} className="mt-5" aria-label={groupTitle[key]}>
              <h3 className="st-agenda__group" data-group={key}>{groupTitle[key]}</h3>
              <ul className="mt-2 grid gap-2.5">{groups.get(key)!.map(renderEvent)}</ul>
            </section>
          ))}
          {upcoming.length === 0 && past.length > 0 && <p className="st-empty mt-5">{s('calendar_empty_month')}</p>}
          {past.length > 0 && (
            <div className="mt-5">
              <button type="button" aria-expanded={showPast} onClick={() => setShowPast(value => !value)} className="st-agenda__toggle st-press">
                {groupTitle.past} ({past.length})
                <ChevronDown size={18} aria-hidden="true" style={{ transform: showPast ? 'rotate(180deg)' : undefined }} className="transition-transform" />
              </button>
              {showPast && <ul className="mt-2 grid gap-2.5 opacity-80">{past.map(renderEvent)}</ul>}
            </div>
          )}
        </div>
        {unscheduled.length > 0 && <ul className="mt-4 space-y-3">
          {unscheduled.map(course => <li key={course.id} className="rounded-xl border border-[var(--border)] p-3 text-[var(--foreground)]">
            <p className="font-semibold">{title(course)}</p><p className="mt-1 text-base text-[var(--muted)]">{messages.unscheduled}</p>
            {course.pending && <p className="mt-1 text-base text-[var(--muted)]">{messages.pending}</p>}
          </li>)}
        </ul>}
      </>}
    </section>
  )
}
