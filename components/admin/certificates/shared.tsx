import type { ReactNode } from 'react'
import type { Json } from '@/supabase/database.types'
import type { CertificateAdminData, CertificateStaffCommand } from '@/lib/certificates/types'
import type { CertificateAdminCopy } from './i18n'

export const control = 'min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'
export const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50'
export const primary = `${button} border-[var(--accent)] bg-[var(--accent-soft)]`
export const panel = 'min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5'
export type CommandRunner = (command: CertificateStaffCommand) => Promise<boolean>
export interface DeskProps { data: CertificateAdminData; lang: string; c: CertificateAdminCopy; busy: boolean; run: CommandRunner }
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-1.5 text-sm"><span className="block font-medium">{label}</span>{children}</label>
}
export function Empty({ text }: { text: string }) { return <p className="py-5 text-sm text-[var(--muted)]">{text}</p> }
export function Table({ caption, headings, children }: { caption: string; headings: string[]; children: ReactNode }) {
  return <div className="min-w-0 overflow-x-auto rounded-lg border border-[var(--border)]" tabIndex={0} role="region" aria-label={caption}>
    <table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="bg-[var(--surface-muted)]"><tr>{headings.map((heading, i) => <th key={i} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[var(--border)]">{children}</tbody></table>
  </div>
}
export const cell = 'min-w-32 px-3 py-3 align-top'
export function personName(data: CertificateAdminData, personId: string): string {
  const person = data.people.find(value => value.id === personId)
  return person ? `${person.display_name} · ${person.email}` : personId
}
export function courseName(data: CertificateAdminData, courseId: string, lang = 'de'): string {
  const course = data.courses.find(value => value.id === courseId)
  if (!course) return courseId
  const times = data.schedules.filter(row => row.course_id === courseId).map(row => `${new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(new Date(Date.UTC(2026, 0, 4 + row.weekday, 12)))} ${row.start_time.slice(0, 5)}–${row.end_time.slice(0, 5)}`).join(' / ')
  return `${course.title}${times ? ` · ${times}` : ` · ${course.type === 'online' ? 'Online' : lang === 'de' ? 'Präsenz' : 'In person'}`}`
}
export function jsonRecord(value: Json): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
export function formatDate(value: string | null, lang: string, withTime = false): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(lang, withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
}
export function monthEnd(month: string): string {
  const [year, number] = month.slice(0, 7).split('-').map(Number)
  return new Date(Date.UTC(year, number, 0, 12)).toISOString().slice(0, 10)
}
export type Schedule = { weekday: number; start_time: string; end_time: string }[]
export function parseSchedule(value: Json): Schedule {
  if (!Array.isArray(value)) return []
  return value.flatMap(entry => {
    const row = jsonRecord(entry)
    return typeof row.weekday === 'number' && typeof row.start_time === 'string' && typeof row.end_time === 'string'
      ? [{ weekday: row.weekday, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5) }] : []
  })
}
export function ScheduleEditor({ value, onChange, c, lang }: { value: Schedule; onChange: (schedule: Schedule) => void; c: CertificateAdminCopy; lang: string }) {
  const update = (index: number, patch: Partial<Schedule[number]>) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row))
  return <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">{c.schedule}</legend>
    {value.map((row, index) => <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" key={index}>
      <Field label={c.weekday}><select className={control} value={row.weekday} onChange={event => update(index, { weekday: Number(event.target.value) })}>{Array.from({ length: 7 }, (_, day) => <option key={day} value={day + 1}>{new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date(Date.UTC(2026, 0, 5 + day, 12)))}</option>)}</select></Field>
      <Field label={c.timeStart}><input className={control} type="time" required value={row.start_time} onChange={event => update(index, { start_time: event.target.value })} /></Field>
      <Field label={c.timeEnd}><input className={control} type="time" min={row.start_time} required value={row.end_time} onChange={event => update(index, { end_time: event.target.value })} /></Field>
      <button className={`${button} self-end`} type="button" onClick={() => onChange(value.filter((_, i) => i !== index))} aria-label={`${c.remove} ${index + 1}`}>{c.remove}</button>
    </div>)}
    <button className={button} type="button" disabled={value.length >= 21} onClick={() => onChange([...value, { weekday: 1, start_time: '09:00', end_time: '10:00' }])}>{c.addTime}</button>
  </fieldset>
}
