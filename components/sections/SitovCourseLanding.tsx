import Link from 'next/link'
import { ArrowUpRight, BookOpen, ChevronDown, Clock3, MapPin, MessageCircle, Monitor } from 'lucide-react'
import { getCourses } from '@/app/actions/get-courses'
import { courseText } from '@/lib/business-courses'
import type { CourseType } from '@/lib/course-config'
import type { getDictionary } from '@/lib/dictionary'
import { toUiLocale } from '@/lib/locale-routing'
import { sortMarketingCourses } from '@/lib/marketing-course-order'
import { localizedUrl, serializeJsonLd } from '@/lib/seo'
import { getSitovCourseSeoCopy, sitovCoursePagePath } from '@/lib/sitov-course-seo-copy'
import Header from '@/components/layout/Header'
import PressableCard from '@/components/motion/PressableCard'
import AcademyFooter from '@/components/sections/AcademyFooter'

type Dictionary = Awaited<ReturnType<typeof getDictionary>>

/** Text and native links are visible in the server response, including without JavaScript. */
export default async function SitovCourseLanding({ lang, type, dictionary }: {
  lang: string
  type: CourseType
  dictionary: Dictionary
}) {
  const copy = getSitovCourseSeoCopy(lang, type)
  const courses = sortMarketingCourses((await getCourses()).filter(course => course.type === type))
  const formatter = new Intl.NumberFormat(toUiLocale(lang), { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
  const otherType = type === 'presence' ? 'online' : 'presence'
  const otherLabel = type === 'presence' ? copy.onlineLink : copy.presenceLink
  const path = sitovCoursePagePath(type)
  const url = localizedUrl(lang, path)
  const classroom = dictionary.Footer.Addresses.classroom
  const featureIcons = [BookOpen, MessageCircle, Clock3]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage', '@id': `${url}#webpage`, url,
        name: copy.heading, description: copy.intro, inLanguage: lang,
        breadcrumb: { '@id': `${url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Sitov Academy', item: localizedUrl(lang) },
          { '@type': 'ListItem', position: 2, name: copy.heading, item: url },
        ],
      },
    ],
  }

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    <Header lang={lang} dictionary={dictionary} />
    <div className="academy-home">
      <nav className="academy-container flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 pt-6 text-sm text-[var(--muted)]" aria-label={dictionary.academy.breadcrumb}>
        <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={`/${lang}`}>Sitov Academy</Link>
        <span aria-hidden="true">/</span><span aria-current="page">{copy.heading}</span>
      </nav>

      <section className="academy-hero academy-container" aria-labelledby="sitov-course-page-title">
        <div className="academy-hero-copy">
          <p className="academy-eyebrow">Sitov Academy · {type === 'presence' ? dictionary.academy.course_presence : dictionary.academy.course_online}</p>
          <h1 id="sitov-course-page-title">{copy.heading}</h1>
          <p className="academy-hero-description">{copy.intro}</p>
          <div className="academy-hero-actions">
            <PressableCard className="academy-button academy-button-primary" href="#courses">{copy.chooseCourse}<ArrowUpRight size={18} aria-hidden="true" /></PressableCard>
            <PressableCard className="academy-button academy-button-outline" href={`/${lang}${sitovCoursePagePath(otherType)}`}>{otherLabel}<ArrowUpRight size={18} aria-hidden="true" /></PressableCard>
          </div>
        </div>
        <aside className="academy-method-card" aria-labelledby="sitov-course-practical-title">
          <div className="academy-method-meta">{type === 'presence' ? <MapPin size={26} aria-hidden="true" /> : <Monitor size={26} aria-hidden="true" />}</div>
          <h2 className="text-xl font-bold tracking-tight" id="sitov-course-practical-title">{copy.asideTitle}</h2>
          <p>{copy.asideBody}</p>
          {type === 'presence' && <>
            <address className="my-5 grid gap-1 not-italic leading-relaxed">
              <span>{classroom.venue}</span><span>{classroom.street}</span><span>{classroom.city}</span>
            </address>
            <a className="academy-button academy-button-outline" href="https://www.google.com/maps/dir/?api=1&destination=Vahrenwalder+Str.+92+30165+Hannover" target="_blank" rel="noreferrer">{dictionary.academy.location_map}<ArrowUpRight size={18} aria-hidden="true" /></a>
          </>}
        </aside>
      </section>

      <section id="courses" className="academy-section academy-container" aria-labelledby="sitov-course-catalog-title">
        <div className="academy-section-heading"><p className="academy-eyebrow">{dictionary.academy.course_eyebrow}</p><h2 id="sitov-course-catalog-title">{copy.coursesTitle}</h2><p>{copy.coursesDescription}</p></div>
        {courses.length === 0 ? <div className="academy-course-empty">
          <p className="max-w-2xl leading-relaxed">{copy.noCourses}</p>
          <a className="academy-button academy-button-outline" href={`mailto:${dictionary.Footer.Contact.email}`}>{copy.contact}<ArrowUpRight size={18} aria-hidden="true" /></a>
          <PressableCard className="academy-button academy-button-outline" href={`/${lang}${sitovCoursePagePath(otherType)}`}>{otherLabel}<ArrowUpRight size={18} aria-hidden="true" /></PressableCard>
        </div> : <div className="academy-course-grid">{courses.map(course => {
          const text = courseText(course, lang)
          return <article className="academy-course-card" key={course.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {course.level && <span className="academy-course-level">{course.level}</span>}
              <span className="academy-course-mode">{type === 'online' ? <Monitor size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}{type === 'online' ? dictionary.academy.course_online : dictionary.academy.course_presence}</span>
            </div>
            <h3>{text.title}</h3>{text.description && <p className="academy-course-description">{text.description}</p>}
            {course.sessions.length > 0 ? <ul className="academy-course-schedule" aria-label={dictionary.academy.course_schedule}>{course.sessions.map((session, index) => <li key={`${session.day}-${index}`}><Clock3 size={16} aria-hidden="true" /><span>{dictionary.timetable.days[session.day] || session.day}</span><span>{session.startTime}–{session.endTime}</span></li>)}</ul> : <p className="academy-course-schedule">{copy.arrangedTimes}</p>}
            <div className="academy-course-price"><strong>{formatter.format(course.unitPrice)}</strong><span>{dictionary.academy.course_unit.replace('{minutes}', String(course.unitMinutes))}</span></div>
            <PressableCard className="academy-button academy-button-outline" href={`/${lang}/registration?courseId=${encodeURIComponent(course.id)}`}>{dictionary.academy.course_details}<ArrowUpRight size={18} aria-hidden="true" /></PressableCard>
            {course.trialLessons !== false && <PressableCard className="academy-course-trial" href={`/${lang}/registration?courseId=${encodeURIComponent(course.id)}&trial=1`}>{dictionary.courses_v2.trial_cta}</PressableCard>}
          </article>
        })}</div>}
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-[var(--muted)]" role="note">{copy.trialNotice}</p>
      </section>

      <section className="academy-section academy-container" aria-labelledby="sitov-course-format-title">
        <div className="academy-section-heading"><h2 id="sitov-course-format-title">{copy.formatTitle}</h2></div>
        <div className="academy-method-grid">{copy.features.map((feature, index) => {
          const Icon = featureIcons[index]
          return <article className="academy-method-card" key={feature.title}><div className="academy-method-meta"><Icon size={25} aria-hidden="true" /></div><h3>{feature.title}</h3><p>{feature.body}</p></article>
        })}</div>
        <div className="academy-learning-bridge mt-8">
          <div><h2>{copy.selectionTitle}</h2><p>{copy.selectionBody}</p></div>
          <a className="academy-button academy-button-outline" href={`mailto:${dictionary.Footer.Contact.email}`}>{copy.contact}<ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
      </section>

      <section className="academy-section academy-container" aria-labelledby="sitov-course-platform-title">
        <div className="academy-section-heading"><h2 id="sitov-course-platform-title">{copy.platformTitle}</h2><p>{copy.platformBody}</p></div>
        <PressableCard className="academy-button academy-button-outline" href={`/${lang}/dashboard`}>{dictionary.academy.platform}<ArrowUpRight size={18} aria-hidden="true" /></PressableCard>
      </section>

      <section className="academy-section academy-container" aria-labelledby="sitov-course-faq-title">
        <div className="academy-section-heading"><h2 id="sitov-course-faq-title">{copy.faqsTitle}</h2></div>
        <div className="academy-faq-list">{copy.faqs.map(item => <details className="academy-faq-item" key={item.question}><summary><span>{item.question}</span><ChevronDown size={20} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
      </section>
    </div>
    <AcademyFooter lang={lang} dictionary={dictionary} />
  </>
}
