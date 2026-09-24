'use client'

import { useState } from 'react'
import { Check, Clock } from 'lucide-react'
import type { CourseConfig } from '@/lib/course-config'
import { courseText } from '@/lib/business-courses'
import type { StartDay } from '@/lib/registration-start-dates'
import { fill, formatDay, leafParts, type FlowCopy } from './registration-copy'

const PAGE = 6

export type StartOption = StartDay & { byArrangement?: boolean }

/**
 * Start dates as calendar sheets ("Dienstag, 29. September, 18:00 bis 19:30 Uhr"),
 * only days that can actually be chosen. Six at a time keeps the list calm.
 */
export default function EnrollmentStartDates({ options, value, onChange, lang, copy, courses, labelledBy, emptyText, referenceYear }: {
  options: StartOption[]; value: string; onChange: (iso: string) => void; lang: string; copy: FlowCopy
  courses: CourseConfig[]; labelledBy: string; emptyText: string; referenceYear: string
}) {
  const selectedIndex = options.findIndex(option => option.iso === value)
  const [visible, setVisible] = useState(() => Math.max(PAGE, Math.ceil((selectedIndex + 1) / PAGE) * PAGE))
  const showTitles = courses.length > 1
  const titleOf = (id: string) => {
    const course = courses.find(candidate => candidate.id === id)
    return course ? courseText(course, lang).title : ''
  }

  if (options.length === 0) return <p className="reg-empty">{emptyText}</p>

  return (
    <div className="reg-days-wrap">
      <div role="radiogroup" aria-labelledby={labelledBy} className="reg-days">
        {options.slice(0, visible).map(option => {
          const leaf = leafParts(option.iso, lang)
          const selected = option.iso === value
          return (
            <label key={option.iso} className="reg-day" data-selected={selected}>
              <input type="radio" name="reg-start" value={option.iso} checked={selected} onChange={() => onChange(option.iso)} className="reg-visually-hidden" />
              <span className="reg-leaf" aria-hidden="true">
                <span className="reg-leaf__weekday">{leaf.weekday}</span>
                <span className="reg-leaf__day">{leaf.day}</span>
                <span className="reg-leaf__month">{leaf.month}</span>
              </span>
              <span className="reg-day__body">
                <span className="reg-day__date">
                  {option.byArrangement ? fill(copy.start.from, { date: formatDay(option.iso, lang, referenceYear) }) : formatDay(option.iso, lang, referenceYear)}
                </span>{' '}
                {option.byArrangement
                  ? <span className="reg-day__time">{copy.card.by_arrangement}</span>
                  : option.sessions.map(session => (
                    <span key={`${session.courseId}-${session.startTime}`} className="reg-day__time">
                      <Clock size={18} aria-hidden="true" />
                      <span>{fill(copy.start.time, { start: session.startTime, end: session.endTime })}{showTitles ? ` · ${titleOf(session.courseId)}` : ''}</span>{' '}
                    </span>
                  ))}
                {selected && <span className="reg-course__state"><Check size={20} strokeWidth={3} aria-hidden="true" />{copy.card.selected}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {visible < options.length && (
        <button type="button" className="reg-button reg-button--soft reg-days__more" onClick={() => setVisible(count => count + PAGE)}>
          {copy.start.more}
        </button>
      )}
    </div>
  )
}
