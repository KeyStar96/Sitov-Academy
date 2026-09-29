'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Download, FileCheck2, RefreshCw } from 'lucide-react'
import type { BackendActionResult } from '@/lib/types/backend'
import type { StudentCertificateData } from '@/lib/certificates/types'
import { groupCertificatePeriods } from '@/lib/certificates/periods'
import { certificateStudentText } from '@/lib/certificates/student-i18n'

const control = 'min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'
export default function ProfileCertificates({ initial, lang }: { initial: BackendActionResult<StudentCertificateData>; lang: string }) {
  const router = useRouter()
  const t = certificateStudentText(lang)
  const [month, setMonth] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const date = (value: string) => new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value))
  const reasonLabel = (reason: string | null) => {
    if (reason && Object.hasOwn(t, reason)) return t[reason as keyof typeof t]
    return t.invoice_review
  }
  if (!initial.success) return <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
    <h2 className="text-lg font-semibold">{t.title}</h2>
    <p role="alert" className="mt-3">{t.error}</p>
    <button type="button" className={`${control} mt-4 inline-flex items-center gap-2`} onClick={() => router.refresh()}><RefreshCw size={18} aria-hidden="true" />{t.refresh}</button>
  </section>
  const data = initial.data
  const periods = data.periods.filter(period => period.status !== 'revoked')
  const months = [...new Set(periods.map(period => period.start_date.slice(0, 7)))].sort().reverse()
  const selected = periods.filter(period => !month || period.start_date.startsWith(month))
  const segments = groupCertificatePeriods(periods, month || null)
  const blocked = selected.filter(period => !period.eligible)
  const address = data.person ? [data.person.street, [data.person.postal_code, data.person.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : ''

  async function createCertificate() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/certificates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: month ? `${month}-01` : null }),
      })
      const payload: unknown = await response.json()
      if (!response.ok || !payload || typeof payload !== 'object' || !('id' in payload) || typeof payload.id !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(payload.id)) throw new Error('request_failed')
      // The URL is derived locally, never taken from untrusted response content.
      const anchor = document.createElement('a')
      anchor.href = `/api/certificates/${payload.id}`
      anchor.download = ''
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      router.refresh()
    } catch { setError(t.error); router.refresh() }
    finally { setBusy(false) }
  }

  return <section className="min-w-0 space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5" aria-labelledby="certificate-title">
    <div className="flex items-start gap-3">
      <FileCheck2 className="mt-1 shrink-0 text-[var(--accent-text)]" size={26} aria-hidden="true" />
      <div><h2 id="certificate-title" className="text-lg font-bold">{t.title}</h2><p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t.intro}</p></div>
    </div>
    {data.identityUnresolved ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-amber-950 dark:bg-amber-950 dark:text-amber-100">{t.identityUnresolved}</p>
      : !data.person ? <p>{t.profileMissing}</p>
        : <>
          <div className="rounded-xl bg-[var(--surface-muted)] p-4 text-sm">
            <p className="font-semibold">{data.person.display_name}</p>{address && <p className="mt-1">{address}</p>}
            <a href="#details" className="mt-2 inline-flex min-h-11 items-center text-[var(--accent-text)] underline underline-offset-4">{t.profileCheck}</a>
          </div>
          {data.paymentUpdatedAt && <p className="text-sm text-[var(--muted)]">{t.paymentUpdatedAt}: {date(data.paymentUpdatedAt)}</p>}
          {!periods.length ? <p className="rounded-xl border border-[var(--border)] p-4">{t.noPeriods}</p> : <>
            <label className="block max-w-sm"><span className="mb-2 block text-sm font-medium">{t.period}</span>
              <select className={`${control} w-full`} value={month} disabled={busy} onChange={event => setMonth(event.target.value)}>
                <option value="">{t.allPeriods}</option>
                {months.map(value => <option key={value} value={value}>{new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`))}</option>)}
              </select>
            </label>
            <div className="space-y-3"><h3 className="font-semibold">{t.preview}</h3>
              {segments.length ? <ul className="space-y-2">{segments.map(segment => <li key={`${segment.courseId}:${segment.start}`} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="font-semibold">{segment.title}</p><p className="mt-1 text-sm">{date(segment.start)} – {date(segment.end)}</p>
              </li>)}</ul> : <p className="text-sm text-[var(--muted)]">{t.blocked}</p>}
              <p className="text-sm text-[var(--muted)]">{t.gapsNotice}</p>
            </div>
            {blocked.length > 0 && <details className="rounded-xl border border-[var(--border)] p-4" open>
              <summary className="min-h-11 cursor-pointer font-semibold">{t.blocked} ({blocked.length})</summary>
              <ul className="divide-y divide-[var(--border)]">{blocked.map(period => <li key={period.id} className="py-3 text-sm">
                <p className="font-medium">{period.title_snapshot}</p><p>{date(period.start_date)} – {date(period.end_date)}</p>
                <p className="mt-1 text-[var(--muted)]">{reasonLabel(period.reason)}</p>
              </li>)}</ul>
            </details>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900 dark:bg-red-950 dark:text-red-100">{error}</p>}
            <button type="button" disabled={busy || !segments.length} onClick={createCertificate}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 py-3 font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-strong-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <Download size={19} aria-hidden="true" />{busy ? t.downloading : t.download}
            </button>
          </>}
        </>}
    {data.issues.length > 0 && <div className="border-t border-[var(--border)] pt-5">
      <h3 className="font-semibold">{t.history}</h3>
      <ul className="mt-3 divide-y divide-[var(--border)]">{data.issues.map(issue => <li key={issue.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <div><p className="font-medium">{issue.certificate_number}</p><p className="text-[var(--muted)]">{date(issue.issued_at || issue.created_at)} · {issue.status === 'issued' ? t.issued : t.revoked}</p>
          {issue.status === 'revoked' && <p className="mt-1 text-[var(--muted)]">{t.source_changed}</p>}</div>
        {issue.status === 'issued' && <a href={`/api/certificates/${issue.id}`} download className={`${control} inline-flex items-center gap-2`}><Download size={17} aria-hidden="true" />{t.downloadExisting}</a>}
      </li>)}</ul>
    </div>}
  </section>
}
