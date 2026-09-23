import type { CSSProperties } from 'react'
import { Check } from 'lucide-react'
import { formatCalendarDate } from '@/lib/profile-course-calendar'
import { studentTranslator } from '@/lib/student-ui-i18n'

/**
 * Ruhiger Wochenrückblick: sieben Tage, gelernte Tage mit Haken. Kein
 * Punktestand und keine „Serie", die man verlieren könnte — nur ein freund-
 * licher Blick darauf, was diese Woche schon geschafft ist.
 */
export default function WeekStrip({ lang, week }: { lang: string; week: { days: string[]; learned: string[]; today: string } }) {
  const t = studentTranslator(lang)
  const learned = new Set(week.learned)
  const count = week.days.filter(day => learned.has(day)).length
  return (
    <div className="st-week">
      <p className="st-week__summary">{count === 0 ? t('week_empty') : t.count('week_summary', count)}</p>
      <ol className="st-week__days">
        {week.days.map((day, index) => {
          const done = learned.has(day)
          const isToday = day === week.today
          const name = formatCalendarDate(day, lang, { weekday: 'long' })
          return (
            <li key={day} className="st-week__day" data-done={done} data-today={isToday} data-future={day > week.today}
              style={{ '--i': index } as CSSProperties}>
              <span className="st-week__dot">
                {done && <Check size={16} strokeWidth={3} aria-hidden="true" />}
              </span>
              <span className="st-week__name" aria-hidden="true">{formatCalendarDate(day, lang, { weekday: 'short' }).replace('.', '')}</span>
              <span className="sr-only">{t(done ? 'week_day_learned' : 'week_day_open', { day: isToday ? `${name} (${t('week_today')})` : name })}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
