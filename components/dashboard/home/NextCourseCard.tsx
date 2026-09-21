import { CalendarClock } from 'lucide-react'
import { formatCalendarDate, type ProfileCourseCalendarState } from '@/lib/profile-course-calendar'
import { nextUpcomingEvent } from '@/lib/dashboard-next-course'
import { dashboardHomeTranslator } from '@/lib/dashboard-home-i18n'

/** "Dein nächster Kurs" – Snapshot aus dem geladenen Kalender, serverseitig. */
export default function NextCourseCard({ calendar, lang, className = '' }: {
  calendar: ProfileCourseCalendarState | null
  lang: string
  className?: string
}) {
  const t = dashboardHomeTranslator(lang)
  const next = nextUpcomingEvent(calendar)
  const event = next?.event
  const title = event
    ? event.translations.find(entry => entry.locale === lang)?.title || event.title
    : null
  const when = event
    ? next.relation === 'today'
      ? t('next_course_today', { time: event.startTime })
      : next.relation === 'tomorrow'
        ? t('next_course_tomorrow', { time: event.startTime })
        : t('next_course_when', {
            date: formatCalendarDate(event.date, lang, { weekday: 'long', day: 'numeric', month: 'long' }),
            time: event.startTime,
          })
    : null

  return (
    <section className={`flex min-w-0 flex-col rounded-3xl border border-[var(--border)] bg-[var(--accent-soft)] p-6 shadow-md sm:p-7 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-[var(--accent-foreground)]">
          <CalendarClock size={24} aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold text-[var(--foreground)]">{t('next_course_title')}</h2>
      </div>
      {event ? (
        <div className="mt-5 min-w-0">
          <p className="break-words text-2xl font-bold leading-snug text-[var(--foreground)]">{title}</p>
          <p className="mt-2 text-lg font-semibold text-[var(--accent-text)]">{when}</p>
          <p className="mt-1 text-base text-[var(--muted)]">
            <time dateTime={`${event.date}T${event.startTime}`}>{event.startTime}–{event.endTime}</time>
            {event.pending ? ` · ${t('next_course_pending')}` : ''}
          </p>
        </div>
      ) : (
        <p className="mt-5 text-lg leading-relaxed text-[var(--muted)]">{t('next_course_none')}</p>
      )}
    </section>
  )
}
