'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CalendarCheck, CalendarDays, Check, CirclePause, Loader2, Pencil, Plus, Sparkles } from 'lucide-react'
import { createProfileTranslator, type ProfileTranslations } from '@/lib/profile-i18n'
import { formatProfileMonth, profileMonthWindow } from '@/lib/profile-month'
import type { MonthlySelection, ProfileMonthlyState } from '@/lib/types/monthly-bookings'
import CourseQuantityInput from '@/components/registration/CourseQuantityInput'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { useMonthlySelection } from './useMonthlySelection'
import ProfileCourseCalendar from './ProfileCourseCalendar'
import type { ProfileCourseCalendarState } from '@/lib/profile-course-calendar'

type Step = 1 | 2 | 3
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Monatsbuchung als geführter Ablauf: 1. weiterlernen oder pausieren, 2. Kurse
 * wählen, 3. prüfen und bestätigen („Du buchst für Oktober: 2 Kurse, 8 Termine").
 * Bis zur Bestätigung ist alles nur ein Entwurf; gespeichert wird genau
 * einmal über dieselbe serialisierte Schreibwarteschlange wie bisher.
 */
export default function ProfileMonthlyCourses({ initial, lang, translations, courseTitles, calendar, onRevisionChange }: {
  initial: ProfileMonthlyState; lang: string; translations: ProfileTranslations; courseTitles: Record<string, string>
  calendar?: ProfileCourseCalendarState | null
  // Lets a sibling calendar widget refresh once a booking is persisted.
  onRevisionChange?: (revision: string) => void
}) {
  const t = createProfileTranslator(translations)
  const s = studentTranslator(lang)
  const router = useRouter()
  const reduced = useReducedMotion() ?? false
  const { state, saving, message, hasError, change } = useMonthlySelection(initial)
  const bookingRevision = `${state.booking?.id ?? ''}:${state.booking?.revision ?? ''}`
  useEffect(() => { onRevisionChange?.(bookingRevision) }, [bookingRevision, onRevisionChange])
  const [monthExpired, setMonthExpired] = useState(false)
  const planned = state.source === 'booking' || state.source === 'previous'
  const [editing, setEditing] = useState(!planned)
  const [step, setStep] = useState<Step>(1)
  const [draft, setDraft] = useState<MonthlySelection>(state.selection)
  const [justSaved, setJustSaved] = useState(false)
  const pendingSave = useRef(false)
  const month = formatProfileMonth(state.targetMonth, lang)
  const courses = state.courses.filter(course => course.available || draft.courseSelections.some(selection => selection.courseId === course.id)
    || state.selection.courseSelections.some(selection => selection.courseId === course.id))
  const titleOf = (id: string) => courseTitles[id] || state.courses.find(course => course.id === id)?.title || t('course_fallback')

  useEffect(() => {
    const check = () => setMonthExpired(profileMonthWindow().next !== state.targetMonth)
    check()
    const timer = window.setInterval(check, 60_000)
    window.addEventListener('focus', check)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', check) }
  }, [state.targetMonth])

  // Nach dem Bestätigen: Sobald der Server geantwortet hat, zeigt die Karte die
  // gespeicherte Planung mit einem Haken — bei einem Fehler bleibt der Entwurf.
  useEffect(() => {
    if (!pendingSave.current || saving) return
    pendingSave.current = false
    if (hasError) return
    setEditing(false)
    setJustSaved(true)
  }, [saving, hasError])

  function startEditing() {
    setDraft(state.selection)
    setStep(state.selection.paused || state.selection.courseSelections.length === 0 ? 1 : 2)
    setJustSaved(false)
    setEditing(true)
  }
  function chooseContinue() {
    setDraft(current => ({ courseSelections: current.courseSelections.length ? current.courseSelections : state.selection.courseSelections, paused: false }))
    setStep(2)
  }
  function choosePause() {
    setDraft({ courseSelections: [], paused: true })
    setStep(3)
  }
  function toggleCourse(id: string) {
    setDraft(current => {
      const selected = current.courseSelections.some(selection => selection.courseId === id)
      const courseSelections = selected ? current.courseSelections.filter(selection => selection.courseId !== id)
        : [...current.courseSelections, { courseId: id, ...(courses.find(course => course.id === id)?.category === 'private' ? { requestedUnits: 1 } : {}) }]
      return { courseSelections, paused: false }
    })
  }
  function confirm() {
    pendingSave.current = true
    change(draft)
  }

  const summary = (selection: MonthlySelection) => {
    const chosen = selection.courseSelections.map(item => ({ item, course: state.courses.find(course => course.id === item.courseId) }))
    const dates = chosen.reduce((sum, { item, course }) => sum + (course?.category === 'private' ? 0 : course?.sessions ?? 0), 0)
    const units = chosen.reduce((sum, { item, course }) => sum + (course?.category === 'private' ? item.requestedUnits ?? 1 : 0), 0)
    return { chosen, dates, units }
  }
  const stepMotion = {
    initial: reduced ? false : { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: EASE },
  } as const

  const statusArea = (
    <div className="mt-4 min-h-8 break-words text-base leading-relaxed" role={hasError ? 'alert' : 'status'} aria-live={hasError ? 'assertive' : 'polite'} aria-atomic="true">
      {saving ? <p className="flex items-center gap-2 text-[var(--muted)]"><Loader2 size={18} aria-hidden="true" className="shrink-0 animate-spin" />{t('saving')}</p>
        : message && hasError && <p className="text-red-700 dark:text-red-300">{t(message)}</p>}
      {monthExpired && <p className="mt-2 text-amber-900 dark:text-amber-200">{t('month_changed')}</p>}
      {(hasError || monthExpired) && <button type="button" onClick={() => router.refresh()} className="mt-2 min-h-12 min-w-12 rounded-xl border border-[var(--border)] px-4 py-2 font-bold text-[var(--foreground)]">{t('reload')}</button>}
    </div>
  )

  const current = summary(state.selection)
  const review = summary(draft)

  return (
    <div className="min-w-0 space-y-6">
      {calendar !== undefined && <ProfileCourseCalendar initial={calendar} lang={lang} bookingRevision={bookingRevision} />}
      <section id="booking" aria-labelledby="monthly-title" className="st-booking sl-glass scroll-mt-28">
        <div className="flex min-w-0 items-start gap-3">
          <span className="sl-icon-tile h-12 w-12"><CalendarDays size={24} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 break-words text-base font-bold text-[var(--accent-text)]">{month}</p>
            <h2 id="monthly-title" className="break-words text-xl font-bold text-[var(--foreground)]">{t('next_month_title')}</h2>
          </div>
        </div>
        {state.source === 'unresolved' && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-base text-amber-900 dark:bg-amber-950 dark:text-amber-200">{t('unresolved_courses')}</p>}

        <AnimatePresence mode="wait" initial={false}>
          {!editing ? (
            <motion.div key="plan" {...stepMotion} className="mt-5">
              <div className="st-plan" data-paused={state.selection.paused}>
                <p className="st-plan__title">
                  {justSaved && <span className="st-plan__saved st-pop"><Check size={16} strokeWidth={3} aria-hidden="true" />{s('booking_saved')}</span>}
                  {s('booking_current', { month })}
                </p>
                {state.selection.paused ? <p className="st-plan__pause"><CirclePause size={22} aria-hidden="true" />{t('paused_notice', { month })}</p>
                  : current.chosen.length === 0 ? <p className="text-base text-[var(--muted)]">{s('booking_none')}</p> : <>
                    <p className="st-plan__numbers">
                      <strong>{s.count('booking_courses', current.chosen.length)}</strong>
                      {current.dates > 0 && <><span aria-hidden="true">·</span><strong>{s.count('booking_dates', current.dates)}</strong></>}
                      {current.units > 0 && <><span aria-hidden="true">·</span><strong>{s.count('booking_units', current.units)}</strong></>}
                    </p>
                    <ul className="st-plan__list">{current.chosen.map(({ item }) => <li key={item.courseId}><Check size={18} aria-hidden="true" />{titleOf(item.courseId)}</li>)}</ul>
                  </>}
                {state.source === 'previous' && <p className="mt-3 text-base text-[var(--accent-text)]">{t('inherited_courses')}</p>}
              </div>
              <button type="button" onClick={startEditing} disabled={monthExpired || saving} className="st-button st-button--soft st-press mt-4 w-full sm:w-auto">
                <Pencil size={18} aria-hidden="true" />{current.chosen.length || state.selection.paused ? s('booking_change') : s('booking_start')}
              </button>
            </motion.div>
          ) : (
            <motion.div key={`step-${step}`} {...stepMotion} className="mt-5">
              <div className="st-booking__progress" aria-hidden="true">
                {[1, 2, 3].map(value => <span key={value} data-done={value <= step} />)}
              </div>
              <p className="mt-2 text-base font-semibold text-[var(--muted)]">{s('booking_step', { step })}</p>

              {step === 1 && <>
                <h3 className="st-booking__question">{s('booking_q', { month })}</h3>
                <div className="mt-4 grid gap-3">
                  <button type="button" onClick={choosePause} disabled={monthExpired} className="st-choice st-press" data-tone="pause">
                    <span className="st-choice__icon" aria-hidden="true"><CirclePause size={24} /></span>
                    <span className="min-w-0 flex-1"><span className="st-choice__title">{s('booking_pause')}</span><span className="st-choice__hint">{s('booking_pause_hint', { month })}</span></span>
                    <ArrowRight size={22} aria-hidden="true" className="shrink-0" />
                  </button>
                  <button type="button" onClick={chooseContinue} disabled={monthExpired} className="st-choice st-press" data-tone="go">
                    <span className="st-choice__icon" aria-hidden="true"><Sparkles size={24} /></span>
                    <span className="min-w-0 flex-1"><span className="st-choice__title">{s('booking_continue')}</span><span className="st-choice__hint">{s('booking_continue_hint')}</span></span>
                    <ArrowRight size={22} aria-hidden="true" className="shrink-0" />
                  </button>
                </div>
              </>}

              {step === 2 && <>
                <h3 className="st-booking__question">{s('booking_choose')}</h3>
                <div className="mt-4 grid grid-cols-1 gap-2.5">
                  {courses.map((course, index) => {
                    const selected = draft.courseSelections.some(selection => selection.courseId === course.id)
                    return (
                      <div key={course.id} className="space-y-2 st-rise" style={{ '--i': Math.min(index, 8) } as CSSProperties}>
                        <button type="button" role="checkbox" aria-checked={selected} aria-label={titleOf(course.id)}
                          disabled={monthExpired || (!course.available && !selected)} onClick={() => toggleCourse(course.id)}
                          data-selected={selected} className="sl-card st-press flex min-h-16 w-full items-center gap-3 px-3 py-2.5 pl-4 text-left disabled:opacity-60">
                          <span aria-hidden="true" data-selected={selected} className="sl-chip h-10 min-h-10 w-10 shrink-0 px-0">{selected ? <Check size={18} /> : <Plus size={18} />}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-base font-semibold leading-snug text-[var(--foreground)]">{titleOf(course.id)}</span>
                            <span className="mt-0.5 block text-base leading-snug text-[var(--muted)]">
                              {t(course.available ? course.type === 'online' ? 'course_online' : 'course_presence' : 'course_unavailable')}
                              {course.category !== 'private' && course.sessions ? ` · ${s.count('booking_dates', course.sessions)}` : ''}
                            </span>
                          </span>
                        </button>
                        {selected && course.category === 'private' && <CourseQuantityInput value={draft.courseSelections.find(selection => selection.courseId === course.id)?.requestedUnits ?? 1}
                          onChange={requestedUnits => setDraft(current => ({ ...current, courseSelections: current.courseSelections.map(selection => selection.courseId === course.id ? { ...selection, requestedUnits } : selection) }))}
                          unitPrice={course.unitPrice} unitMinutes={course.unitMinutes} lang={lang} disabled={monthExpired} />}
                      </div>
                    )
                  })}
                  {courses.length === 0 && <p className="rounded-xl bg-[var(--surface-muted)] p-4 text-base text-[var(--muted)]">{t('no_courses')}</p>}
                </div>
                <div className="st-booking__nav">
                  <button type="button" onClick={() => setStep(1)} className="st-button st-button--soft st-press"><ArrowLeft size={18} aria-hidden="true" />{s('booking_back')}</button>
                  <button type="button" onClick={() => setStep(3)} disabled={draft.courseSelections.length === 0 || monthExpired} className="st-button st-button--primary st-press">{s('booking_next')}<ArrowRight size={18} aria-hidden="true" /></button>
                </div>
              </>}

              {step === 3 && <>
                <h3 className="st-booking__question">{s('booking_review')}</h3>
                <div className="st-plan mt-4" data-paused={draft.paused}>
                  {draft.paused ? <p className="st-plan__pause"><CirclePause size={22} aria-hidden="true" />{s('booking_pause_summary', { month })}</p> : <>
                    <p className="st-plan__title">{s('booking_summary', { month })}</p>
                    <p className="st-plan__numbers st-plan__numbers--big">
                      <strong>{s.count('booking_courses', review.chosen.length)}</strong>
                      {review.dates > 0 && <><span aria-hidden="true">·</span><strong>{s.count('booking_dates', review.dates)}</strong></>}
                      {review.units > 0 && <><span aria-hidden="true">·</span><strong>{s.count('booking_units', review.units)}</strong></>}
                    </p>
                    <ul className="st-plan__list">{review.chosen.map(({ item, course }) => (
                      <li key={item.courseId}><Check size={18} aria-hidden="true" />
                        <span>{titleOf(item.courseId)}{course?.category === 'private' ? ` · ${s.count('booking_units', item.requestedUnits ?? 1)}` : course?.sessions ? ` · ${s.count('booking_dates', course.sessions)}` : ''}</span>
                      </li>
                    ))}</ul>
                  </>}
                </div>
                <div className="st-booking__nav">
                  <button type="button" onClick={() => setStep(draft.paused ? 1 : 2)} disabled={saving} className="st-button st-button--soft st-press"><ArrowLeft size={18} aria-hidden="true" />{s('booking_back')}</button>
                  <button type="button" onClick={confirm} disabled={saving || monthExpired} className="st-button st-button--primary st-press">
                    {saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <CalendarCheck size={18} aria-hidden="true" />}
                    {draft.paused ? s('booking_confirm_pause') : s('booking_confirm')}
                  </button>
                </div>
              </>}
            </motion.div>
          )}
        </AnimatePresence>
        {statusArea}
      </section>
    </div>
  )
}
