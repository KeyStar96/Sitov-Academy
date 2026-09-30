'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, CheckCircle2, Loader2, Mail, Phone, Search } from 'lucide-react'
import { updateStudentAllowedLevels } from '@/app/actions/admin'
import { ACCESS_LEVELS, sanitizeAllowedLevels, type AccessLevel } from '@/lib/access/levels'
import type { NewStudent } from '@/lib/admin-new-students'
import { newStudentsCopy } from '@/lib/new-students-i18n'
import { useAdminTranslator } from './AdminI18nProvider'
import { Badge, Card, EmptyState, Notice, PageHeader, adminButton, adminChip, adminFocus, adminInput } from './ui'

const DAY = 86_400_000

function relativeDate(value: string | null, lang: string, now: number): string {
  if (!value) return '—'
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return '—'
  const format = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  const hours = Math.round((time - now) / 3_600_000)
  if (Math.abs(hours) < 24) return format.format(hours, 'hour')
  const days = Math.round((time - now) / DAY)
  if (Math.abs(days) < 31) return format.format(days, 'day')
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(new Date(value))
}

function languageName(code: string | null, lang: string): string | null {
  if (!code) return null
  try { return new Intl.DisplayNames([lang], { type: 'language' }).of(code) ?? code } catch { return code }
}

/**
 * Freischalt-Liste „Neue Schüler“: jede Registrierung ohne Niveau als Karte
 * mit Kontakt, Anmeldekontext und direkter Niveau-Zuordnung. Schreibzugriffe
 * laufen nacheinander über die bestehende Freigabe-Action; erfolgreiche Karten
 * bleiben mit Bestätigung stehen, bis die Lehrkraft die Seite verlässt.
 */
export default function NewStudents({ students, lang }: { students: NewStudent[]; lang: string }) {
  const t = useAdminTranslator()
  const c = newStudentsCopy(lang)
  const router = useRouter()
  const [now] = useState(() => Date.now())
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState<Record<string, AccessLevel[]>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [failedId, setFailedId] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Record<string, { student: NewStudent; levels: AccessLevel[] }>>({})
  const lock = useRef(false)

  // Nach router.refresh() fehlen freigeschaltete Schüler in der Serverliste –
  // ihre Bestätigung bleibt trotzdem sichtbar.
  const rows = useMemo(() => {
    const ids = new Set(students.map(student => student.id))
    const kept = Object.values(completed).filter(entry => !ids.has(entry.student.id)).map(entry => entry.student)
    return [...students, ...kept].sort((a, b) => (b.registeredAt ?? '').localeCompare(a.registeredAt ?? '') || a.id.localeCompare(b.id))
  }, [students, completed])
  const pending = rows.filter(row => !completed[row.id]).length
  const needle = search.trim().toLocaleLowerCase(lang)
  const visible = needle
    ? rows.filter(row => `${row.name} ${row.email ?? ''}`.toLocaleLowerCase(lang).includes(needle))
    : rows

  const toggle = (id: string, level: AccessLevel) => setSelection(current => {
    const levels = current[id] ?? []
    return { ...current, [id]: levels.includes(level) ? levels.filter(item => item !== level) : [...levels, level] }
  })

  async function grant(student: NewStudent) {
    const levels = sanitizeAllowedLevels(selection[student.id] ?? [])
    if (lock.current || !levels.length) return
    lock.current = true
    setSavingId(student.id)
    setFailedId(null)
    try {
      const result = await updateStudentAllowedLevels(student.id, levels)
      if (result.success !== true) throw new Error('levels_save_failed')
      setCompleted(current => ({ ...current, [student.id]: { student, levels: sanitizeAllowedLevels(result.allowedLevels ?? levels) } }))
      router.refresh()
    } catch {
      setFailedId(student.id)
    } finally {
      lock.current = false
      setSavingId(null)
    }
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader title={t('nav_new_students')} description={c.intro} />

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={CheckCircle2} title={c.emptyTitle} description={c.emptyBody} />
        </Card>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold" role="status">
              {c.open}
              <Badge tone={pending ? 'accent' : 'success'}>{pending}</Badge>
            </p>
            {rows.length > 6 && (
              <label className="relative block min-w-0 sm:w-72">
                <span className="sr-only">{c.search}</span>
                <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={c.search} className={`${adminInput} pl-9`} />
              </label>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{c.noResults}</p>
          ) : (
            <ul className="space-y-3" aria-label={t('nav_new_students')}>
              {visible.map(student => {
                const selected = selection[student.id] ?? []
                const done = completed[student.id]
                const saving = savingId === student.id
                const headingId = `new-student-${student.id}`
                const name = student.name || student.email || c.unnamed
                const native = languageName(student.nativeLanguage, lang)
                const registeredTitle = student.registeredAt
                  ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(student.registeredAt))
                  : undefined
                return (
                  <li key={student.id} data-testid={`new-student-${student.id}`}>
                    <Card as="article" labelledBy={headingId}>
                      <div className="space-y-4 p-4">
                        <div className="min-w-0">
                          <h2 id={headingId} className="break-words text-[0.9375rem] font-semibold">{name}</h2>
                          <p className="mt-0.5 text-sm text-[var(--muted)]">
                            {c.registered}{' '}
                            <time dateTime={student.registeredAt ?? undefined} title={registeredTitle} suppressHydrationWarning>
                              {relativeDate(student.registeredAt, lang, now)}
                            </time>
                          </p>
                        </div>

                        <dl className="grid min-w-0 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                          {student.email && (
                            <div className="flex min-w-0 items-center gap-2">
                              <dt className="sr-only">{c.email}</dt>
                              <Mail size={15} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
                              <dd className="min-w-0 truncate"><a href={`mailto:${student.email}`} className={`rounded underline-offset-4 hover:underline ${adminFocus}`}>{student.email}</a></dd>
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex min-w-0 items-center gap-2">
                              <dt className="sr-only">{c.phone}</dt>
                              <Phone size={15} aria-hidden="true" className="shrink-0 text-[var(--muted)]" />
                              <dd className="min-w-0 truncate"><a href={`tel:${student.phone.replace(/[^\d+]/g, '')}`} className={`rounded underline-offset-4 hover:underline ${adminFocus}`}>{student.phone}</a></dd>
                            </div>
                          )}
                          {native && (
                            <div className="min-w-0"><dt className="inline text-[var(--muted)]">{c.nativeLanguage}: </dt><dd className="inline">{native}</dd></div>
                          )}
                          {student.city && (
                            <div className="min-w-0"><dt className="inline text-[var(--muted)]">{c.city}: </dt><dd className="inline break-words">{student.city}</dd></div>
                          )}
                        </dl>

                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[var(--muted)]">{c.bookings}</p>
                          {student.bookings.length ? (
                            <ul className="mt-1.5 flex flex-wrap gap-1.5">
                              {student.bookings.map(booking => (
                                <li key={`${booking.title}:${booking.kind}`} className="min-w-0 max-w-full">
                                  <Badge tone="neutral" className="font-medium">
                                    <span className="truncate">{booking.title}</span>
                                    <span className="shrink-0 text-[var(--muted)]">· {booking.kind === 'trial' ? c.kindTrial : booking.kind === 'monthly' ? c.kindMonthly : c.kindRegistration}</span>
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm">{c.noBookings}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 border-t border-[var(--admin-line)] p-4">
                        {done ? (
                          <Notice
                            tone="success"
                            role="status"
                            title={<span className="inline-flex items-center gap-2"><Check size={16} aria-hidden="true" />{c.success.replace('{levels}', done.levels.join(' · '))}</span>}
                            action={<Link href={`/${lang}/admin/students/${student.id}`} className={adminButton('secondary', 'sm', 'w-full sm:w-auto')}>{c.adjust}</Link>}
                          />
                        ) : (
                          <>
                            <fieldset className="min-w-0" disabled={Boolean(savingId)}>
                              <legend className="text-sm font-semibold">{c.levels}</legend>
                              <p className="mt-0.5 text-xs text-[var(--muted)]">{c.levelsHint}</p>
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                {ACCESS_LEVELS.map(level => {
                                  const active = selected.includes(level)
                                  return (
                                    <button key={level} type="button" aria-pressed={active} onClick={() => toggle(student.id, level)} className={adminChip(active, 'tabular-nums disabled:opacity-60')}>
                                      {active && <Check size={14} aria-hidden="true" />}
                                      {level}
                                    </button>
                                  )
                                })}
                              </div>
                            </fieldset>
                            {failedId === student.id && (
                              <Notice tone="danger" role="alert" action={<button type="button" onClick={() => void grant(student)} className={adminButton('secondary', 'sm')}>{c.retry}</button>}>
                                {c.failed}
                              </Notice>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                              {!selected.length && <p className="text-xs text-[var(--muted)] sm:mr-auto">{c.selectFirst}</p>}
                              <Link href={`/${lang}/admin/students/${student.id}`} className={adminButton('ghost', 'md')}>{c.openProfile}</Link>
                              <button type="button" onClick={() => void grant(student)} disabled={!selected.length || Boolean(savingId)} className={adminButton('primary', 'md')}>
                                {saving && <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                                {saving ? c.submitting : c.submit}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
