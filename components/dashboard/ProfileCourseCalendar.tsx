'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { CalendarDays, Loader2 } from 'lucide-react'
import { getProfileCourseCalendar } from '@/app/actions/profile-calendar'
import { calendarMonthDays, calendarWeekday, formatCalendarDate, type ProfileCourseCalendarState } from '@/lib/profile-course-calendar'
import { profileCalendarMessages } from '@/lib/profile-calendar-i18n'
import { formatProfileMonth, profileMonthWindow } from '@/lib/profile-month'

export default function ProfileCourseCalendar({ initial, lang, bookingRevision }: {
  initial: ProfileCourseCalendarState | null
  lang: string
  bookingRevision: string
}) {
  const messages = profileCalendarMessages(lang)
  const headingId = useId()
  const [calendar, setCalendar] = useState(initial)
  const [month, setMonth] = useState(initial?.currentMonth ?? '')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [failed, setFailed] = useState(!initial)
  const [loading, setLoading] = useState(false)
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
  const activeDay = selectedDay?.startsWith(activeMonth?.slice(0, 7) ?? '!') ? selectedDay : null
  const monthEvents = calendar?.events.filter(event => event.date.startsWith(activeMonth?.slice(0, 7) ?? '!')) ?? []
  const events = activeDay ? monthEvents.filter(event => event.date === activeDay) : monthEvents
  const unscheduled = calendar?.unscheduled.filter(course => course.month === activeMonth) ?? []
  const title = (course: { title: string; translations: { locale: string; title: string }[] }) => course.translations.find(value => value.locale === lang)?.title || course.title
  const fullDate = (date: string) => formatCalendarDate(date, lang, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section aria-labelledby={headingId} className="sl-glass min-w-0 rounded-3xl p-4 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="sl-icon-tile h-12 w-12"><CalendarDays aria-hidden="true" size={24} /></span>
        <h2 id={headingId} className="text-xl font-bold text-[var(--foreground)]">{messages.title}</h2>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{messages.intro}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{messages.timezone}</p>
      {failed && <div role="alert" className="mt-4 rounded-xl bg-[var(--warning)] p-3 text-[var(--warning-foreground)]">
        <p>{messages.failed}</p>
        <button type="button" disabled={loading} onClick={() => void reload()} className="mt-2 min-h-11 rounded-lg border border-current px-3 font-semibold">{messages.retry}</button>
      </div>}
      <div role="status" className="sr-only">{loading ? messages.loading : ''}</div>
      {calendar && activeMonth && <>
        <div role="group" aria-label={messages.months} className="mt-5 grid grid-cols-2 gap-2">
          {[calendar.currentMonth, calendar.nextMonth].map(value => <button key={value} type="button" aria-pressed={activeMonth === value}
            onClick={() => { setMonth(value); setSelectedDay(null) }}
            className={`min-h-12 rounded-xl border px-2 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)] ${activeMonth === value ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]' : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-muted)]'}`}>
            {formatProfileMonth(value, lang)}
          </button>)}
        </div>
        {calendar.unresolved && <p className="mt-4 rounded-xl bg-[var(--warning)] p-3 text-sm text-[var(--warning-foreground)]">{messages.unresolved}</p>}
        <div className="mt-4 grid grid-cols-7 gap-1" aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => <span key={index} className="py-1 text-center text-xs font-semibold text-[var(--muted)]">
            {formatCalendarDate(`2024-01-0${index + 1}`, lang, { weekday: 'short' })}
          </span>)}
        </div>
        <div role="group" aria-label={messages.days} className="grid grid-cols-7 gap-1">
          {Array.from({ length: calendarWeekday(activeMonth) - 1 }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
          {calendarMonthDays(activeMonth).map(date => {
            const dated = monthEvents.filter(event => event.date === date)
            const cancellations = dated.filter(event => event.cancelled).length
            return <button key={date} type="button" aria-pressed={activeDay === date}
              aria-label={`${fullDate(date)} · ${messages.appointments}: ${dated.length}${cancellations ? ` · ${messages.cancelled}: ${cancellations}` : ''}`}
              onClick={() => setSelectedDay(activeDay === date ? null : date)}
              className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--foreground)] ${activeDay === date ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--surface)]' : dated.length ? 'border-[var(--border)] bg-[var(--surface-muted)] font-bold text-[var(--foreground)]' : 'border-transparent text-[var(--muted)] hover:border-[var(--border)]'}`}>
              <span aria-hidden="true">{Number(date.slice(-2))}</span>
              <span aria-hidden="true" className="flex h-1.5 gap-0.5">
                {dated.some(event => !event.cancelled) && <span className="h-1 w-1 rounded-full bg-current" />}
                {cancellations > 0 && <span className="h-1 w-2 border-b-2 border-current" />}
              </span>
            </button>
          })}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-[var(--foreground)]">{activeDay ? fullDate(activeDay) : messages.appointments}</h3>
          {activeDay && <button type="button" onClick={() => setSelectedDay(null)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[var(--foreground)] underline underline-offset-4">{messages.all}</button>}
          {loading && <Loader2 size={18} className="animate-spin text-[var(--muted)]" aria-hidden="true" />}
        </div>
        <div aria-live="polite" aria-atomic="true">
          {events.length === 0 && <p className="mt-3 text-sm text-[var(--muted)]">{activeDay ? messages.emptyDay : messages.empty}</p>}
          <ul className="mt-3 space-y-3">
            {events.map(event => <li key={event.id} className="sl-card p-3 pl-4">
              <p className="text-sm font-semibold text-[var(--muted)]"><time dateTime={event.date}>{fullDate(event.date)}</time> · {event.startTime}–{event.endTime}</p>
              <p className={`mt-1 font-semibold text-[var(--foreground)] ${event.cancelled ? 'line-through' : ''}`}>{title(event)}</p>
              {event.cancelled && <p className="mt-2 rounded-lg bg-[var(--warning)] px-2 py-1 text-sm font-semibold text-[var(--warning-foreground)]">{messages.cancelled}{event.reasons.length > 0 ? `: ${event.reasons.join(' · ')}` : ''}</p>}
              {event.pending && <p className="mt-1 text-sm text-[var(--muted)]">{messages.pending}</p>}
              {event.trial && <p className="mt-1 text-sm text-[var(--muted)]">{messages.trial}</p>}
            </li>)}
          </ul>
        </div>
        {!activeDay && unscheduled.length > 0 && <ul className="mt-3 space-y-3">
          {unscheduled.map(course => <li key={course.id} className="rounded-xl border border-[var(--border)] p-3 text-[var(--foreground)]">
            <p className="font-semibold">{title(course)}</p><p className="mt-1 text-sm text-[var(--muted)]">{messages.unscheduled}</p>
            {course.pending && <p className="mt-1 text-sm text-[var(--muted)]">{messages.pending}</p>}
          </li>)}
        </ul>}
      </>}
    </section>
  )
}
