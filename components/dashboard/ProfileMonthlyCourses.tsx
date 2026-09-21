'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, Plus, Loader2 } from 'lucide-react'
import { createProfileTranslator, type ProfileTranslations } from '@/lib/profile-i18n'
import { formatProfileMonth, profileMonthWindow } from '@/lib/profile-month'
import type { ProfileMonthlyState } from '@/lib/types/monthly-bookings'
import CourseQuantityInput from '@/components/registration/CourseQuantityInput'
import { useMonthlySelection } from './useMonthlySelection'
import ProfileCourseCalendar from './ProfileCourseCalendar'
import type { ProfileCourseCalendarState } from '@/lib/profile-course-calendar'

export default function ProfileMonthlyCourses({ initial, lang, translations, courseTitles, calendar, onRevisionChange }: {
  initial: ProfileMonthlyState; lang: string; translations: ProfileTranslations; courseTitles: Record<string, string>
  calendar?: ProfileCourseCalendarState | null
  // Lets a sibling calendar widget refresh once a booking is persisted.
  onRevisionChange?: (revision: string) => void
}) {
  const t = createProfileTranslator(translations)
  const router = useRouter()
  const { state, saving, message, hasError, change } = useMonthlySelection(initial)
  const bookingRevision = `${state.booking?.id ?? ''}:${state.booking?.revision ?? ''}`
  useEffect(() => { onRevisionChange?.(bookingRevision) }, [bookingRevision, onRevisionChange])
  const [monthExpired, setMonthExpired] = useState(false)
  const [needsCourse, setNeedsCourse] = useState(false)
  // Preserve the original hint's height when an inherited selection is saved.
  // The hidden CSS content reserves space without duplicating accessible text.
  const sourceHint = useRef(initial.source === 'unresolved' ? 'unresolved_courses' as const
    : initial.source === 'previous' ? 'inherited_courses' as const : null)
  const month = formatProfileMonth(state.targetMonth, lang)
  const { courseSelections, paused } = state.selection
  const courseIds = courseSelections.map(selection=>selection.courseId)
  const courses = state.courses.filter(course => course.available || courseIds.includes(course.id))
  useEffect(() => {
    const check = () => setMonthExpired(profileMonthWindow().next !== state.targetMonth)
    check()
    const timer = window.setInterval(check, 60_000)
    window.addEventListener('focus', check)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check) }
  }, [state.targetMonth])

  function togglePause() {
    if (paused && courseIds.length === 0) { setNeedsCourse(true); return }
    setNeedsCourse(false)
    change({ courseSelections: paused ? courseSelections : [], paused: !paused })
  }
  function toggleCourse(id: string) {
    const selected = courseIds.includes(id)
    const next = selected ? courseSelections.filter(value => value.courseId !== id) : [...courseSelections, {courseId:id,...(courses.find(course=>course.id===id)?.category==='private'?{requestedUnits:1}:{})}]
    setNeedsCourse(false)
    change({ courseSelections: next, paused: next.length === 0 })
  }

  return (
    <div className="min-w-0 space-y-6">
    {calendar !== undefined && <ProfileCourseCalendar initial={calendar} lang={lang} bookingRevision={bookingRevision} />}
    <section aria-labelledby="monthly-title" className="min-w-0 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-7">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-[var(--accent-foreground)]"><CalendarDays size={24} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="mb-1 break-words text-base font-bold text-orange-800 dark:text-orange-300">{month}</p>
          <h2 id="monthly-title" className="break-words text-xl font-bold text-[var(--foreground)]">{t('next_month_title')}</h2>
        </div>
      </div>
      <p className="mt-4 text-base leading-relaxed text-[var(--muted)]">{t('next_month_intro', { month })}</p>
      <div className="mt-4 grid min-h-12">
        {sourceHint.current && <p aria-hidden="true" data-reserve={t(sourceHint.current)} className="invisible rounded-xl p-3 text-base [grid-area:1/1] before:content-[attr(data-reserve)]" />}
        {(state.source === 'previous') && <p className="rounded-xl bg-[var(--surface-muted)] p-3 text-base text-[var(--violet)] [grid-area:1/1]">{t('inherited_courses')}</p>}
        {state.source === 'unresolved' && <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-900 [grid-area:1/1] dark:bg-amber-950 dark:text-amber-200">{t('unresolved_courses')}</p>}
      </div>
      <button type="button" role="switch" aria-checked={paused} aria-label={t('pause_next_month')}
        aria-describedby="pause-description" onClick={togglePause} disabled={monthExpired}
        className={`mt-4 flex min-h-16 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 ${paused ? 'border-amber-500 bg-amber-50 dark:bg-amber-950' : 'border-[var(--border)] bg-[var(--surface-muted)]  '}`}>
        <span className="min-w-0 break-words font-semibold text-[var(--foreground)]">{t('pause_next_month')}</span>
        <span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${paused ? 'bg-[var(--accent-strong)]' : 'bg-[var(--muted)]'}`}>
          <span className={`h-5 w-5 rounded-full bg-[var(--surface)] shadow-sm transition-transform motion-reduce:transition-none ${paused ? 'translate-x-5' : ''}`} />
        </span>
      </button>
      <p id="pause-description" className="mt-2 text-base leading-relaxed text-[var(--muted)]">{t('pause_description', { month })}</p>
      <div className="mt-4 min-h-14 text-base leading-relaxed" aria-live="polite">
        {paused ? <p className="text-amber-900 dark:text-amber-200">{t('paused_notice', { month })}</p>
          : <p className="font-semibold text-[var(--foreground)]">{t('selection_count', { count: courseIds.length })}</p>}
        {needsCourse && <p className="mt-2 text-amber-900 dark:text-amber-200">{t('choose_to_resume')}</p>}
      </div>
      <h3 className="mb-3 font-bold text-[var(--foreground)]">{t('choose_courses')}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {courses.map(course => {
          const selected = courseIds.includes(course.id)
          const title = courseTitles[course.id] || course.title || t('course_fallback')
          return (
            <div key={course.id} className="space-y-2"><button type="button" role="checkbox" aria-checked={selected}
              aria-label={title} disabled={monthExpired || (!course.available && !selected)}
              onClick={() => toggleCourse(course.id)}
              className={`flex min-h-12 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:opacity-60 ${selected && !paused ? 'border-[var(--violet)] bg-[var(--surface-muted)]  ' : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)]   '}`}>
              <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${selected ? 'border-[var(--violet)] bg-[var(--violet)] text-[var(--surface)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>
                {selected ? <Check size={18} /> : <Plus size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-base font-semibold leading-snug text-[var(--foreground)]">{title}</span>
                <span className="mt-0.5 block text-base leading-snug text-[var(--muted)]">
                  {t(course.available ? course.type === 'online' ? 'course_online' : 'course_presence' : 'course_unavailable')}
                  {' · '}
                  <span className="font-bold text-[var(--violet)]">{t(selected ? 'course_remove' : 'course_add')}</span>
                </span>
              </span>
            </button>
            {selected&&course.category==='private'&&<CourseQuantityInput value={courseSelections.find(selection=>selection.courseId===course.id)?.requestedUnits??1}
              onChange={requestedUnits=>change({courseSelections:courseSelections.map(selection=>selection.courseId===course.id?{...selection,requestedUnits}:selection),paused})}
              unitPrice={course.unitPrice} unitMinutes={course.unitMinutes} lang={lang} disabled={monthExpired||paused}/>}
            </div>
          )
        })}
        {courses.length === 0 && <p className="rounded-xl bg-[var(--surface-muted)] p-4 text-base text-[var(--muted)] sm:col-span-2">{t('no_courses')}</p>}
        {courses.length > 0 && !courseIds.length && !paused && <p className="text-base text-[var(--muted)] sm:col-span-2">{t('no_selection')}</p>}
      </div>
      <div className="mt-4 min-h-14 break-words text-base leading-relaxed" role={hasError ? 'alert' : 'status'} aria-live={hasError ? 'assertive' : 'polite'} aria-atomic="true">
        {saving ? <p className="flex items-center gap-2 text-[var(--muted)]"><Loader2 size={18} aria-hidden="true" className="shrink-0 animate-spin" />{t('saving')}</p>
          : message && <p className={hasError ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}>{t(message)}</p>}
        {monthExpired && <p className="mt-2 text-amber-900 dark:text-amber-200">{t('month_changed')}</p>}
        {(hasError || monthExpired) && <button type="button" onClick={() => router.refresh()} className="mt-2 min-h-12 min-w-12 rounded-xl border border-[var(--border)] px-4 py-2 font-bold text-[var(--foreground)]">{t('reload')}</button>}
      </div>
    </section>
    </div>
  )
}
