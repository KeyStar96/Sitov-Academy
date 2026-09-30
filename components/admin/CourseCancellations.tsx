'use client'

import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck2, CalendarX2, Check, Loader2 } from 'lucide-react'
import { cancelCourseDate, cancelWholeDay, restoreCancellation } from '@/app/actions/course-cancellations'
import {
  berlinToday, courseHasLessonOn, coursesOnDate, formatCalendarDate, groupCancellations, isCalendarDate, isoWeekday,
  type CancellationCourse, type CancellationData,
} from '@/lib/course-cancellations'
import { courseCancellationsCopy } from '@/lib/course-cancellations-i18n'
import { useAdminTranslator } from './AdminI18nProvider'
import { Badge, Card, CardHeader, EmptyState, Notice, PageHeader, SectionHeading, adminButton, adminChip, adminInput, adminLabel } from './ui'

type Mode = 'day' | 'course'
type Feedback = { tone: 'success' | 'danger' | 'warning'; text: string } | null

/**
 * Kursausfälle: oben ein Formular für „Ganzer Tag“ (alle an diesem Wochentag
 * laufenden Kurse vorausgewählt) oder „Einzelner Kurs“, darunter alle
 * geplanten Ausfälle nach Datum, einzeln rücknehmbar (mit Bestätigung).
 */
export default function CourseCancellations({ data, lang }: { data: CancellationData; lang: string }) {
  const t = useAdminTranslator()
  const c = courseCancellationsCopy(lang)
  const router = useRouter()
  const today = useMemo(() => berlinToday(), [])
  const [mode, setMode] = useState<Mode>('day')
  const [date, setDate] = useState(today)
  const [reason, setReason] = useState('')
  const [courseId, setCourseId] = useState('')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [listFeedback, setListFeedback] = useState<Feedback>(null)
  const lock = useRef(false)

  const courseById = useMemo(() => new Map(data.courses.map(course => [course.id, course])), [data.courses])
  const activeCourses = data.courses.filter(course => !course.archived)
  const validDate = isCalendarDate(date)
  const dayCourses = validDate ? coursesOnDate(data.courses, date) : []
  const selectedDayCourses = dayCourses.filter(course => !excluded.has(course.id))
  const cancelledOnDate = new Set(data.cancellations.filter(entry => entry.date === date).map(entry => entry.courseId))
  const singleCourse = courseById.get(courseId)
  const quickReasons = [c.quickHoliday, c.quickIllness, c.quickTraining, c.quickVacation]
  const trimmedReason = reason.trim()
  const canSubmit = validDate && trimmedReason.length > 0 && (mode === 'day' ? selectedDayCourses.length > 0 : Boolean(singleCourse))
  const groups = groupCancellations(data.cancellations, today, view)
  const title = (course: CancellationCourse | undefined) => course?.title ?? c.unknownCourse
  const weekday = validDate ? isoWeekday(date) : null
  const schedule = (course: CancellationCourse) => course.schedules
    .filter(entry => entry.weekday === weekday)
    .map(entry => `${entry.start}–${entry.end}`).join(', ')

  function changeDate(value: string) {
    setDate(value)
    setExcluded(new Set())
    setFeedback(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (lock.current || !canSubmit) return
    lock.current = true
    setPending(true)
    setFeedback(null)
    try {
      if (mode === 'course' && singleCourse) {
        const result = await cancelCourseDate({ courseId: singleCourse.id, date, reason: trimmedReason })
        if (result.success === false) throw new Error(result.error)
        setFeedback({ tone: 'success', text: c.saved.replace('{courses}', singleCourse.title) })
      } else {
        const result = await cancelWholeDay({ date, reason: trimmedReason, courseIds: selectedDayCourses.map(course => course.id) })
        if (result.success === false) throw new Error(result.error)
        const saved = result.data.results.filter(entry => entry.saved).map(entry => title(courseById.get(entry.courseId)))
        const failed = result.data.results.filter(entry => !entry.saved).map(entry => title(courseById.get(entry.courseId)))
        if (!saved.length) throw new Error('none_saved')
        setFeedback(failed.length
          ? { tone: 'warning', text: `${c.saved.replace('{courses}', saved.join(', '))} ${c.partial.replace('{courses}', failed.join(', '))}` }
          : { tone: 'success', text: c.saved.replace('{courses}', saved.join(', ')) })
      }
      setReason('')
      router.refresh()
    } catch {
      setFeedback({ tone: 'danger', text: c.failed })
    } finally {
      lock.current = false
      setPending(false)
    }
  }

  async function restore(id: string) {
    if (lock.current) return
    lock.current = true
    setRestoringId(id)
    setListFeedback(null)
    try {
      const result = await restoreCancellation({ id })
      if (result.success === false) throw new Error(result.error)
      setConfirmId(null)
      setListFeedback({ tone: 'success', text: c.restored })
      router.refresh()
    } catch {
      setListFeedback({ tone: 'danger', text: c.restoreFailed })
    } finally {
      lock.current = false
      setRestoringId(null)
    }
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader title={t('nav_cancellations')} description={c.intro} />

      <Card labelledBy="cancellation-form-title">
        <CardHeader id="cancellation-form-title" icon={CalendarX2} title={c.formTitle} description={c.formHint} />
        <form onSubmit={submit} className="space-y-5 p-4 sm:p-5" noValidate>
          <fieldset disabled={pending} className="min-w-0 space-y-5">
            <div className="flex flex-wrap gap-2" role="group" aria-label={c.modeLabel}>
              {(['day', 'course'] as const).map(value => (
                <button key={value} type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setFeedback(null) }} className={adminChip(mode === value)}>
                  {value === 'day' ? c.modeDay : c.modeCourse}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className={adminLabel}>{c.date}</span>
                <input type="date" required value={date} onChange={event => changeDate(event.target.value)} className={adminInput} />
              </label>
              {mode === 'course' && (
                <label className="block min-w-0">
                  <span className={adminLabel}>{c.course}</span>
                  <select value={courseId} onChange={event => { setCourseId(event.target.value); setFeedback(null) }} className={adminInput}>
                    <option value="">{c.chooseCourse}</option>
                    {activeCourses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
                  </select>
                </label>
              )}
            </div>

            {validDate && date < today && <Notice tone="warning">{c.past}</Notice>}
            {mode === 'course' && singleCourse && validDate && !courseHasLessonOn(singleCourse, date) && <Notice tone="warning">{c.noLesson}</Notice>}

            <fieldset className="min-w-0">
              <legend className={adminLabel}>{c.reason}</legend>
              <div className="flex flex-wrap gap-2">
                {quickReasons.map(option => (
                  <button key={option} type="button" aria-pressed={trimmedReason === option} onClick={() => setReason(option)} className={adminChip(trimmedReason === option)}>
                    {option}
                  </button>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="sr-only">{c.reasonCustom}</span>
                <input type="text" value={reason} maxLength={250} onChange={event => setReason(event.target.value)} placeholder={c.reasonCustom} className={adminInput} />
              </label>
            </fieldset>

            {mode === 'day' && validDate && (
              <fieldset className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <legend className="text-sm font-medium">{c.affected.replace('{date}', formatCalendarDate(date, lang))}</legend>
                  {dayCourses.length > 1 && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setExcluded(new Set())} className={adminButton('ghost', 'sm')}>{c.selectAll}</button>
                      <button type="button" onClick={() => setExcluded(new Set(dayCourses.map(course => course.id)))} className={adminButton('ghost', 'sm')}>{c.selectNone}</button>
                    </div>
                  )}
                </div>
                {dayCourses.length === 0 ? (
                  <p className="rounded-lg bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--muted)]">{c.noCourses}</p>
                ) : (
                  <ul className="divide-y divide-[var(--admin-line)] overflow-hidden rounded-lg border border-[var(--admin-line)]">
                    {dayCourses.map(course => (
                      <li key={course.id}>
                        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-5 w-5 shrink-0 accent-[var(--accent-strong)]"
                            checked={!excluded.has(course.id)}
                            onChange={event => setExcluded(current => {
                              const next = new Set(current)
                              if (event.target.checked) next.delete(course.id)
                              else next.add(course.id)
                              return next
                            })}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-medium">{course.title}</span>
                            <span className="block text-xs tabular-nums text-[var(--muted)]">{schedule(course)}</span>
                          </span>
                          {(cancelledOnDate.has(course.id) || cancelledOnDate.has(null)) && <Badge tone="warning">{c.already}</Badge>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
            )}
          </fieldset>

          {feedback && (
            <Notice tone={feedback.tone === 'success' ? 'success' : feedback.tone === 'warning' ? 'warning' : 'danger'} role={feedback.tone === 'success' ? 'status' : 'alert'}>
              {feedback.text}
            </Notice>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {!canSubmit && !pending && (
              <p className="text-xs text-[var(--muted)] sm:mr-auto">
                {!trimmedReason ? c.needReason : c.needCourse}
              </p>
            )}
            <button type="submit" disabled={!canSubmit || pending} className={adminButton('primary', 'md', 'w-full sm:w-auto')}>
              {pending ? <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <CalendarX2 size={16} aria-hidden="true" />}
              {pending ? c.submitting : c.submit}
            </button>
          </div>
        </form>
      </Card>

      <section aria-labelledby="cancellation-list-title" className="space-y-3">
        <SectionHeading
          id="cancellation-list-title"
          title={c.listTitle}
          actions={(
            <div className="flex gap-2" role="group" aria-label={c.filterLabel}>
              {(['upcoming', 'past'] as const).map(value => (
                <button key={value} type="button" aria-pressed={view === value} onClick={() => { setView(value); setConfirmId(null) }} className={adminChip(view === value)}>
                  {value === 'upcoming' ? c.upcoming : c.pastView}
                </button>
              ))}
            </div>
          )}
        />
        {listFeedback && (
          <Notice tone={listFeedback.tone === 'success' ? 'success' : 'danger'} role={listFeedback.tone === 'success' ? 'status' : 'alert'}>{listFeedback.text}</Notice>
        )}
        {groups.length === 0 ? (
          <Card><EmptyState icon={CalendarCheck2} title={view === 'upcoming' ? c.emptyUpcoming : c.emptyPast} /></Card>
        ) : (
          <ul className="space-y-3">
            {groups.map(group => (
              <li key={group.date}>
                <Card as="div">
                  <h3 className="border-b border-[var(--admin-line)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold">
                    <time dateTime={group.date}>{formatCalendarDate(group.date, lang)}</time>
                  </h3>
                  <ul className="divide-y divide-[var(--admin-line)]">
                    {group.entries.map(entry => {
                      const name = entry.courseId === null ? c.allCourses : title(courseById.get(entry.courseId))
                      const confirming = confirmId === entry.id
                      return (
                        <li key={entry.id} className="space-y-3 px-4 py-3">
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words text-[0.9375rem] font-medium">
                                {name}
                                {entry.courseId === null && <Badge tone="info" className="ml-2 align-middle">{c.modeDay}</Badge>}
                              </p>
                              <p className="mt-0.5 break-words text-sm text-[var(--muted)]">{entry.reason}</p>
                            </div>
                            {!confirming && (
                              <button
                                type="button"
                                onClick={() => { setConfirmId(entry.id); setListFeedback(null) }}
                                disabled={Boolean(restoringId)}
                                aria-label={c.restoreAria.replace('{course}', name).replace('{date}', formatCalendarDate(entry.date, lang))}
                                className={adminButton('danger', 'sm', 'shrink-0')}
                              >
                                {c.restore}
                              </button>
                            )}
                          </div>
                          {confirming && (
                            <div className="rounded-lg border border-[var(--admin-line-strong)] p-3" role="group" aria-label={c.restore}>
                              <p className="text-sm">{c.restoreConfirm}</p>
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <button type="button" onClick={() => setConfirmId(null)} disabled={restoringId === entry.id} className={adminButton('secondary', 'sm')}>{c.keep}</button>
                                <button type="button" onClick={() => void restore(entry.id)} disabled={restoringId === entry.id} className={adminButton('danger', 'sm')}>
                                  {restoringId === entry.id ? <Loader2 size={15} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Check size={15} aria-hidden="true" />}
                                  {c.restoreYes}
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
