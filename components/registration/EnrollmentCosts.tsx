'use client'

import { useMemo } from 'react'
import { CalendarDays, ChevronDown, Gift } from 'lucide-react'
import type { CourseConfig, CourseException } from '@/lib/course-config'
import type { CourseSelection } from '@/lib/course-selection'
import { calculateMonthlyStats } from '@/lib/course-calculations'
import { courseText } from '@/lib/business-courses'
import { formatCourseQuantity } from '@/lib/course-quantity-i18n'
import { countLabel, fill, formatDay, formatEuro, formatMonth, type FlowCopy } from './registration-copy'

type Stats = ReturnType<typeof calculateMonthlyStats>

export function monthCost(courses: CourseConfig[], selections: CourseSelection[], iso: string, exceptions: CourseException[], lang: string, fromDay?: number) {
  const [year, month, day] = iso.split('-').map(Number)
  const lines = courses.map(course => {
    const requested = selections.find(selection => selection.courseId === course.id)?.requestedUnits ?? 1
    const stats: Stats = calculateMonthlyStats(course, lang, month - 1, year, exceptions, fromDay ?? day, requested)
    return { course, stats, price: stats.totalUnits * course.unitPrice }
  })
  return { lines, total: lines.reduce((sum, line) => sum + line.price, 0) }
}

/**
 * Content of the cost aside, shown only once a course is chosen. It states the
 * first month in large type, how it is paid, and what follows – in words.
 */
export default function EnrollmentCosts({ courses, selections, startIso, startChosen, exceptions, lang, copy, agbHref, referenceYear }: {
  courses: CourseConfig[]; selections: CourseSelection[]; startIso: string; startChosen: boolean
  exceptions: CourseException[]; lang: string; copy: FlowCopy; agbHref: string; referenceYear: string
}) {
  const costs = copy.costs
  const first = useMemo(() => monthCost(courses, selections, startIso, exceptions, lang), [courses, selections, startIso, exceptions, lang])
  const later = useMemo(() => [1, 2].map(offset => {
    const [year, month] = startIso.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1 + offset, 1))
    const iso = date.toISOString().slice(0, 10)
    return { iso, total: monthCost(courses, selections, iso, exceptions, lang, 1).total }
  }), [courses, selections, startIso, exceptions, lang])

  return (
    <div className="reg-costs-card">
      <h2 id="reg-costs-title" className="reg-costs__title">{costs.title}</h2>
      <p className="reg-costs__label">{fill(costs.first_month, { month: formatMonth(startIso, lang) })}</p>
      <p className="reg-costs__total" aria-live="polite" aria-atomic="true">{formatEuro(first.total)}</p>
      <p className="reg-costs__from">
        <CalendarDays size={20} aria-hidden="true" />
        <span>{fill(startChosen ? costs.counted_from : costs.counted_from_next, { date: formatDay(startIso, lang, referenceYear) })}</span>
      </p>
      <p className="reg-costs__note">{costs.pay_first}</p>

      <ul className="reg-costs__lines">
        {first.lines.map(({ course, stats, price }) => (
          <li key={course.id}>
            <span className="reg-costs__line">
              <span className="reg-costs__course">{courseText(course, lang).title}</span>
              <span className="reg-costs__price">{formatEuro(price)}</span>
            </span>
            <span className="reg-costs__count">
              {course.category === 'private' ? formatCourseQuantity(stats.totalUnits, course.unitMinutes, lang) : countLabel(costs.sessions, stats.sessionCount, lang)}
            </span>
            {stats.deductions.map(deduction => (
              <span key={`${deduction.date}-${deduction.reason}`} className="reg-costs__cancelled">
                {fill(costs.cancelled, { date: deduction.date, reason: deduction.reason })}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <div className="reg-costs__later">
        <h3>{costs.later_title}</h3>
        <ul>
          {later.map(month => <li key={month.iso}>{fill(costs.later_month, { month: formatMonth(month.iso, lang), price: formatEuro(month.total) })}</li>)}
        </ul>
        <p>{costs.renewal}</p>
      </div>

      <details className="reg-disclosure">
        <summary><span>{costs.how_title}</span><ChevronDown size={22} aria-hidden="true" /></summary>
        <p>{costs.how_text}</p>
        <a href={agbHref} target="_blank" rel="noopener noreferrer">{costs.agb_link} <span className="reg-visually-hidden">{copy.consents.new_tab}</span></a>
      </details>
      <p className="reg-costs__vat">{costs.vat}</p>
    </div>
  )
}

export function EnrollmentTrialCosts({ copy, dateLabel }: { copy: FlowCopy; dateLabel?: string }) {
  return (
    <div className="reg-costs-card">
      <h2 id="reg-costs-title" className="reg-costs__title">{copy.costs.title_trial}</h2>
      <p className="reg-costs__total reg-costs__total--free"><Gift size={28} aria-hidden="true" />{copy.costs.trial_price}</p>
      {dateLabel && <p className="reg-costs__from"><CalendarDays size={20} aria-hidden="true" /><span>{fill(copy.costs.trial_date, { date: dateLabel })}</span></p>}
      <p className="reg-costs__note">{copy.costs.trial_free}</p>
    </div>
  )
}
