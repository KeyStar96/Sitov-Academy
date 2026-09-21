import Link from 'next/link'
import { courseText } from '@/lib/business-courses'
import { ArrowUpRight, Clock3, MapPin, Monitor } from 'lucide-react'
import { toUiLocale } from '@/lib/locale-routing'
import { getCourses } from '@/app/actions/get-courses'
import { sortMarketingCourses } from '@/lib/marketing-course-order'
import type { getDictionary } from '@/lib/dictionary'
import Reveal from '@/components/ui/Reveal'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>
export default async function AcademyCourses({ dictionary, lang }: { dictionary: Dictionary; lang: string }) {
  const courses = sortMarketingCourses(await getCourses())
  const copy = dictionary.academy
  const formatter = new Intl.NumberFormat(toUiLocale(lang), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
  const days: Record<string, string> = dictionary.timetable.days
  return <section id="courses" className="academy-section academy-container">
    <Reveal className="academy-section-heading"><p className="academy-eyebrow">{copy.course_eyebrow}</p><h2>{copy.course_title}</h2><p>{copy.course_description}</p></Reveal>
    {courses.length === 0 ? <div className="academy-course-empty"><p>{copy.course_empty}</p><a className="academy-button academy-button-outline" href={`mailto:${dictionary.Footer.Contact.email}`}>{dictionary.Footer.Contact.email_button}<ArrowUpRight size={18} aria-hidden="true" /></a></div> : <Reveal className="academy-course-grid" delay={0.05}>{courses.map(course => {
      const text = courseText(course, lang)
      return <article className="academy-course-card" key={course.id}>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="academy-course-level">{course.level}</span><span className="academy-course-mode">{course.type === 'online' ? <Monitor size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}{course.type === 'online' ? copy.course_online : copy.course_presence}</span></div>
        <h3>{text.title}</h3><p className="academy-course-description">{text?.description}</p>
        <ul className="academy-course-schedule" aria-label={copy.course_schedule}>{course.sessions.map((session, index) => <li key={`${session.day}-${index}`}><Clock3 size={16} aria-hidden="true" /><span>{days[session.day] || session.day}</span><span>{session.startTime}–{session.endTime}</span></li>)}</ul>
        <div className="academy-course-price"><strong>{formatter.format(course.unitPrice)}</strong><span>{copy.course_unit.replace('{minutes}', String(course.unitMinutes))}</span></div><Link className="academy-button academy-button-outline" href={`/${lang}/registration?courseId=${encodeURIComponent(course.id)}`}>{copy.course_details}<ArrowUpRight size={18} aria-hidden="true" /></Link>{course.trialLessons !== false && <Link className="academy-course-trial" href={`/${lang}/registration?courseId=${encodeURIComponent(course.id)}&trial=1`}>{dictionary.courses_v2.trial_cta}</Link>}
      </article>
    })}</Reveal>}
  </section>
}
