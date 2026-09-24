'use client'

import { useId } from 'react'
import { Check, Clock, MapPin, Monitor, Plus } from 'lucide-react'
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
  // The amount stands out; the sentence around it stays one readable line.
  const [beforePrice, afterPrice] = card.price.includes('{price}') ? card.price.split('{price}') : [card.price, '']
  return (
    <label className="reg-course" data-selected={selected}>
      <input type={single ? 'radio' : 'checkbox'} name={single ? 'reg-trial-course' : undefined} checked={selected}
        onChange={onToggle} className="reg-visually-hidden" aria-labelledby={`${id}-title`} aria-describedby={`${id}-details`} />
      <span className="reg-check" aria-hidden="true">{selected ? <Check size={26} strokeWidth={3} /> : <Plus size={24} />}</span>
      <span className="reg-course__body">
        <span id={`${id}-title`} className="reg-course__title">{title}</span>
        <span id={`${id}-details`} className="reg-course__details">
          <span className="reg-course__meta">
            <span className="reg-course__place">
              {online ? <Monitor size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}
              {online ? card.online : card.presence}
            </span>
            {course.level && <>{' '}<span className="reg-course__level">{fill(card.level, { level: course.level })}</span></>}
          </span>{' '}
          <span className="reg-course__times">
            {course.sessions.length > 0
              ? course.sessions.map(session => (
                <span key={`${session.day}-${session.startTime}`} className="reg-course__time">
                  <Clock size={18} aria-hidden="true" />
                  <span>{fill(card.time, { day: weekdayName(session.day, lang), start: session.startTime, end: session.endTime })}{' '}</span>
                </span>
              ))
              : <span className="reg-course__time"><Clock size={18} aria-hidden="true" /><span>{card.by_arrangement}{' '}</span></span>}
          </span>
          <span className="reg-course__price">
            {trialPriceLabel
              ? <strong>{trialPriceLabel}</strong>
              : <>{fill(beforePrice, { minutes: course.unitMinutes })}<strong>{formatEuro(course.unitPrice)}</strong>{fill(afterPrice, { minutes: course.unitMinutes })}</>}
          </span>
        </span>
        {selected && <span className="reg-course__state"><Check size={20} strokeWidth={3} aria-hidden="true" />{card.selected}</span>}
      </span>
    </label>
  )
}
