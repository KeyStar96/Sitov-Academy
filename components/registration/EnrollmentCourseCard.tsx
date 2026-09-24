'use client'

import { useId } from 'react'
import { Check, MapPin, Monitor, Plus } from 'lucide-react'
import type { CourseConfig } from '@/lib/course-config'
import { courseText } from '@/lib/business-courses'
import { fill, formatEuro, weekdayName, type FlowCopy } from './registration-copy'

/**
 * One course as a large tap target, like the monthly booking in the learning
 * space: a big check box, readable weekdays and times, and "Das ist gewählt"
 * in words once selected. Trial mode uses a radio (only one course).
 */
export default function EnrollmentCourseCard({ course, lang, copy, selected, single, trialPriceLabel, onToggle }: {
  course: CourseConfig; lang: string; copy: FlowCopy; selected: boolean; single: boolean
  trialPriceLabel?: string; onToggle: () => void
}) {
  const id = useId()
  const card = copy.card
  const title = courseText(course, lang).title
  const online = course.type === 'online'
  return (
    <label className="reg-course" data-selected={selected}>
      <input type={single ? 'radio' : 'checkbox'} name={single ? 'reg-trial-course' : undefined} checked={selected}
        onChange={onToggle} className="reg-visually-hidden" aria-labelledby={`${id}-title`} aria-describedby={`${id}-details`} />
      <span className="reg-check" aria-hidden="true">{selected ? <Check size={26} strokeWidth={3} /> : <Plus size={24} />}</span>
      <span className="reg-course__body">
        <span id={`${id}-title`} className="reg-course__title">{title}</span>
        <span id={`${id}-details`} className="reg-course__details">
          <span className="reg-course__meta">
            {online ? <Monitor size={20} aria-hidden="true" /> : <MapPin size={20} aria-hidden="true" />}
            {online ? card.online : card.presence}
            {course.level && <>{' '}<span className="reg-course__level">{fill(card.level, { level: course.level })}</span></>}
          </span>{' '}
          {course.sessions.length > 0
            ? course.sessions.map(session => (
              <span key={`${session.day}-${session.startTime}`} className="reg-course__time">
                {fill(card.time, { day: weekdayName(session.day, lang), start: session.startTime, end: session.endTime })}{' '}
              </span>
            ))
            : <span className="reg-course__time">{card.by_arrangement}{' '}</span>}
          <span className="reg-course__price">
            {trialPriceLabel ?? fill(card.price, { price: formatEuro(course.unitPrice), minutes: course.unitMinutes })}
          </span>
        </span>
        {selected && <span className="reg-course__state"><Check size={20} strokeWidth={3} aria-hidden="true" />{card.selected}</span>}
      </span>
    </label>
  )
}
