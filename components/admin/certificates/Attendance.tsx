'use client'
import { useMemo, useState, type FormEvent } from 'react'
import type { CertificateAdminData, CertificateStaffCommand } from '@/lib/certificates/types'
import { berlinToday } from '@/lib/certificates/periods'
import { certificateStatus } from './i18n'
import { button, primary, control, panel, Field, Empty, monthEnd, personName, courseName, parseSchedule, ScheduleEditor, type Schedule, type DeskProps } from './shared'

type PeriodPayload = Extract<CertificateStaffCommand, { command: 'confirm_participation' }>['payload']['periods'][number]
type Candidate = PeriodPayload & { key: string }

/** Bookings suggest a range; the teacher explicitly verifies attendance before saving. */
export function attendanceCandidates(data: CertificateAdminData, month: string, courseId: string, today: string): Candidate[] {
  const start = `${month}-01`
  const end = [monthEnd(month), today].sort()[0]
  const entries: Candidate[] = data.periods.filter(period => period.status === 'pending' && period.start_date.slice(0, 7) === month && (!courseId || period.course_id === courseId) && period.start_date <= end).map(period => ({
    key: `${period.id}:${period.revision}`, id: period.id, revision: period.revision, person_id: period.person_id, course_id: period.course_id,
    start: period.start_date, end: period.end_date < end ? period.end_date : end, title: period.title_snapshot, description: period.description_snapshot, schedule: parseSchedule(period.schedule_snapshot),
  }))
  for (const booking of data.bookings.filter(row => row.target_month === start && row.status === 'confirmed' && row.kind !== 'trial')) {
    for (const item of data.bookingItems.filter(row => row.booking_id === booking.id && (!courseId || row.course_id === courseId))) {
      if (entries.some(row => row.person_id === booking.person_id && row.course_id === item.course_id) || data.periods.some(row => row.person_id === booking.person_id && row.course_id === item.course_id && row.start_date.slice(0, 7) === month)) continue
      const course = data.courses.find(row => row.id === item.course_id)
      const from = [start, booking.start_date, course?.start_date ?? start].sort().at(-1)!
      const until = [end, course?.end_date ?? end].sort()[0]
      if (from > until) continue
      const mapped = data.productCourses.find(row => row.course_id === item.course_id)
      entries.push({ key: `booking:${item.id}`, person_id: booking.person_id, course_id: item.course_id, start: from, end: until,
        title: mapped?.certificate_title ?? item.title_snapshot, description: mapped?.certificate_description ?? course?.description ?? '',
        schedule: mapped ? parseSchedule(mapped.schedule_snapshot) : data.schedules.filter(row => row.course_id === item.course_id).map(({ weekday, start_time, end_time }) => ({ weekday, start_time: start_time.slice(0, 5), end_time: end_time.slice(0, 5) })),
      })
    }
  }
  return entries
}

export default function Attendance(props: DeskProps) {
  const { data, c, lang, busy, run } = props
  const today = berlinToday()
  const [month, setMonth] = useState(today.slice(0, 7))
  const [courseId, setCourseId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [edits, setEdits] = useState<Record<string, Partial<PeriodPayload>>>({})
  const [limit, setLimit] = useState(30)
  const candidates = useMemo(() => attendanceCandidates(data, month, courseId, today), [data, month, courseId, today])
  const visible = candidates.slice(0, limit)
  const selectedCandidates = candidates.filter(row => selected.includes(row.key))
  const periods = data.periods.filter(row => row.start_date.slice(0, 7) === month && (!courseId || row.course_id === courseId) && row.status !== 'pending')
  const update = (key: string, patch: Partial<PeriodPayload>) => setEdits(current => ({ ...current, [key]: { ...current[key], ...patch } }))
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = selectedCandidates.map(candidate => { const { key, ...period } = candidate; return { ...period, ...edits[key] } })
    if (await run({ command: 'confirm_participation', payload: { periods: payload } })) { setSelected([]); setEdits({}) }
  }
  return <div className="space-y-5">
    <section className={`${panel} space-y-4`}><p className="text-sm text-[var(--muted)]">{c.attendanceHint} {c.todayLimit}</p><div className="grid gap-3 sm:grid-cols-2">
      <Field label={c.month}><input className={control} type="month" value={month} max={today.slice(0, 7)} required onChange={event => { if (event.target.value) { setMonth(event.target.value); setSelected([]); setLimit(30) } }} /></Field>
      <Field label={c.course}><select className={control} value={courseId} onChange={event => { setCourseId(event.target.value); setSelected([]); setLimit(30) }}><option value="">{c.allCourses}</option>{data.courses.map(row => <option key={row.id} value={row.id}>{courseName(data, row.id, lang)}</option>)}</select></Field>
    </div></section>
    <section className={`${panel} space-y-4`}><h2 className="text-sm font-semibold">{c.pending} ({candidates.length})</h2>
      {!candidates.length ? <Empty text={c.noData} /> : <form onSubmit={confirm}><fieldset disabled={busy} className="space-y-4">
        <label className="flex min-h-11 items-center gap-3 text-sm"><input className="h-5 w-5" type="checkbox" checked={visible.length > 0 && visible.every(row => selected.includes(row.key))} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, ...visible.map(row => row.key)])].slice(0, 250) : current.filter(key => !visible.some(row => row.key === key)))} />{c.selectAll}</label>
        {visible.map(candidate => {
          const row = { ...candidate, ...edits[candidate.key] }
          const checked = selected.includes(candidate.key)
          return <div className="space-y-3 rounded-lg border border-[var(--admin-line)] p-3" key={candidate.key}>
            <label className="flex min-h-11 items-start gap-3 text-sm font-medium"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={checked} disabled={!checked && selected.length >= 250} onChange={event => setSelected(current => event.target.checked ? [...current, candidate.key] : current.filter(key => key !== candidate.key))} /><span>{personName(data, row.person_id)}<span className="mt-1 block font-normal text-[var(--muted)]">{courseName(data, row.course_id, lang)}</span></span></label>
            <div className="grid gap-3 sm:grid-cols-2"><Field label={c.start}><input className={control} type="date" min={`${month}-01`} max={today < monthEnd(month) ? today : monthEnd(month)} value={row.start} required={checked} onChange={event => update(candidate.key, { start: event.target.value })} /></Field><Field label={c.end}><input className={control} type="date" min={row.start} max={today < monthEnd(month) ? today : monthEnd(month)} value={row.end} required={checked} onChange={event => update(candidate.key, { end: event.target.value })} /></Field></div>
            <details><summary className="cursor-pointer py-3 text-sm font-medium">{c.details}</summary><div className="space-y-3"><Field label={c.titleText}><input className={control} maxLength={180} value={row.title} required={checked} onChange={event => update(candidate.key, { title: event.target.value })} /></Field><Field label={c.description}><textarea className={control} rows={3} maxLength={6000} value={row.description ?? ''} onChange={event => update(candidate.key, { description: event.target.value })} /></Field><ScheduleEditor c={c} lang={lang} value={row.schedule ?? []} onChange={value => update(candidate.key, { schedule: value })} /></div></details>
          </div>
        })}
        {candidates.length > limit && <button className={button} type="button" onClick={() => setLimit(value => value + 30)}>{c.more} ({limit}/{candidates.length})</button>}
        <button className={primary} type="submit" disabled={!selectedCandidates.length || selectedCandidates.length > 250}>{c.confirmSelected} ({selectedCandidates.length})</button>
      </fieldset></form>}
    </section>
    <details className={panel}><summary className="cursor-pointer py-2 font-semibold">{c.manual}</summary><PeriodEditor key={`manual:${month}:${courseId}`} month={month} initialCourse={courseId} {...props} /></details>
    <section className={`${panel} space-y-4`}><h2 className="text-sm font-semibold">{c.confirmedPeriods} ({periods.length})</h2>
      {!periods.length ? <Empty text={c.noData} /> : periods.map(period => <details className="rounded-lg border border-[var(--admin-line)] p-3" key={`${period.id}:${period.revision}`}><summary className="cursor-pointer py-2 text-sm font-medium">{personName(data, period.person_id)} · {period.title_snapshot} · {period.start_date}–{period.end_date} · {certificateStatus(period.status, c)}</summary>
        <PeriodEditor period={period} month={month} {...props} />
        {period.status !== 'revoked' && <form className="mt-6 space-y-3 border-t border-[var(--admin-line)] pt-4" onSubmit={async event => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get('reason') ?? ''); await run({ command: 'revoke_participation', payload: { id: period.id, revision: period.revision, reason } }) }}><p className="text-sm text-[var(--muted)]">{c.revokeHint}</p><Field label={c.revokeReason}><input className={control} name="reason" maxLength={1000} required disabled={busy} /></Field><button className={button} type="submit" disabled={busy}>{c.revoke}</button></form>}
      </details>)}
    </section>
  </div>
}

function PeriodEditor({ period, month, initialCourse = '', data, c, lang, busy, run }: DeskProps & { period?: CertificateAdminData['periods'][number]; month: string; initialCourse?: string }) {
  const today = berlinToday()
  const [person, setPerson] = useState(period?.person_id ?? '')
  const [courseId, setCourseId] = useState(period?.course_id ?? initialCourse)
  const initial = data.courses.find(row => row.id === courseId)
  const [start, setStart] = useState(period?.start_date ?? `${month}-01`)
  const [end, setEnd] = useState(period?.end_date ?? (monthEnd(month) < today ? monthEnd(month) : today))
  const [title, setTitle] = useState(period?.title_snapshot ?? initial?.title ?? '')
  const [description, setDescription] = useState(period?.description_snapshot ?? initial?.description ?? '')
  const currentSchedule = (id: string): Schedule => data.schedules.filter(row => row.course_id === id).map(({ weekday, start_time, end_time }) => ({ weekday, start_time: start_time.slice(0, 5), end_time: end_time.slice(0, 5) }))
  const [schedule, setSchedule] = useState<Schedule>(period ? parseSchedule(period.schedule_snapshot) : currentSchedule(courseId))
  function changeCourse(id: string) {
    const course = data.courses.find(row => row.id === id)
    setCourseId(id); setTitle(course?.title ?? ''); setDescription(course?.description ?? ''); setSchedule(currentSchedule(id))
  }
  return <form className="mt-4" onSubmit={async event => { event.preventDefault(); await run({ command: 'confirm_participation', payload: { periods: [{ ...(period ? { id: period.id, revision: period.revision } : {}), person_id: person, course_id: courseId, start, end, title, description, schedule }] } }) }}><fieldset disabled={busy} className="space-y-4">
    <p className="text-sm text-[var(--muted)]">{c.manualHint}</p>
    <div className="grid gap-3 sm:grid-cols-2"><Field label={c.person}><select className={control} value={person} onChange={event => setPerson(event.target.value)} required disabled={Boolean(period)}><option value="">{c.select}</option>{data.people.map(row => <option key={row.id} value={row.id}>{row.display_name} · {row.email}</option>)}</select></Field><Field label={c.course}><select className={control} value={courseId} onChange={event => changeCourse(event.target.value)} required disabled={Boolean(period)}><option value="">{c.select}</option>{data.courses.map(row => <option key={row.id} value={row.id}>{courseName(data, row.id, lang)}</option>)}</select></Field><Field label={c.start}><input className={control} type="date" max={today} value={start} required onChange={event => setStart(event.target.value)} /></Field><Field label={c.end}><input className={control} type="date" min={start} max={start ? [monthEnd(start), today].sort()[0] : today} value={end} required onChange={event => setEnd(event.target.value)} /></Field></div>
    <Field label={c.titleText}><input className={control} maxLength={180} value={title} required onChange={event => setTitle(event.target.value)} /></Field><Field label={c.description}><textarea className={control} rows={4} maxLength={6000} value={description} onChange={event => setDescription(event.target.value)} /></Field>
    <ScheduleEditor c={c} lang={lang} value={schedule} onChange={setSchedule} />
    <button className={primary} type="submit">{period ? c.update : c.confirm}</button>
  </fieldset></form>
}
