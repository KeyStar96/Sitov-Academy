'use client'
import { useRef, useState } from 'react'
import { getStaffCertificateEligibility } from '@/app/actions/certificates'
import type { CertificateEligibilityPeriod } from '@/lib/certificates/types'
import type { BackendActionError } from '@/lib/types/backend'
import { certificateReason, certificateStatus } from './i18n'
import { button, primary, control, panel, Field, Empty, Table, cell, formatDate, personName, type DeskProps } from './shared'

export default function Issues({ data, c, lang, busy, run, onError }: DeskProps & { onError: (error: BackendActionError) => void }) {
  const [person, setPerson] = useState('')
  const [periods, setPeriods] = useState<CertificateEligibilityPeriod[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [limit, setLimit] = useState(30)
  const request = useRef(0)
  const issues = data.issues.filter(issue => !person || issue.person_id === person)
  async function check() {
    const current = ++request.current
    setLoading(true); setPeriods(null)
    try {
      const result = await getStaffCertificateEligibility(person)
      if (current !== request.current) return
      if (result.success === true) setPeriods(result.data)
      else onError(result.error)
    } catch { onError('request_failed') }
    finally { if (current === request.current) setLoading(false) }
  }
  return <div className="space-y-5">
    <section className={`${panel} space-y-4`}><h2 className="text-sm font-semibold">{c.eligibility}</h2><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><Field label={c.person}><select className={control} value={person} onChange={event => { setPerson(event.target.value); setPeriods(null); setLimit(30); ++request.current; setLoading(false) }}><option value="">{c.select}</option>{data.people.map(row => <option key={row.id} value={row.id}>{row.display_name} · {row.email}</option>)}</select></Field></div><button type="button" className={primary} disabled={!person || loading || busy} onClick={check}>{loading ? c.working : c.check}</button></div>
      {periods && (!periods.length ? <Empty text={c.noData} /> : <Table caption={c.eligibility} headings={[c.course, c.start, c.end, c.status, c.reason]}>{periods.map(period => <tr key={period.id}><td className={cell}>{period.title_snapshot}</td><td className={cell}>{formatDate(period.start_date, lang)}</td><td className={cell}>{formatDate(period.end_date, lang)}</td><td className={cell}>{period.eligible ? c.eligible : c.blocked}</td><td className={cell}>{certificateReason(period.reason, lang)}</td></tr>)}</Table>)}
    </section>
    <section className={`${panel} space-y-4`}><h2 className="text-sm font-semibold">{c.issued} ({issues.length})</h2>{!issues.length ? <Empty text={c.noData} /> : <Table caption={c.issued} headings={[c.number, c.person, c.issuedAt, c.status, c.details]}>{issues.slice(0, limit).map(issue => <tr key={issue.id}><td className={cell}>{issue.certificate_number ?? '—'}</td><td className={`${cell} min-w-52`}>{personName(data, issue.person_id)}</td><td className={cell}>{formatDate(issue.issued_at ?? issue.created_at, lang, true)}</td><td className={cell}>{certificateStatus(issue.status, c)}</td><td className={`${cell} min-w-72`}>
      {issue.revoked_reason && <p className="text-sm">{issue.revoked_reason}</p>}
      {issue.status === 'issued' && <details><summary className="cursor-pointer py-3 text-sm font-medium">{c.revoke}</summary><form className="space-y-3" onSubmit={async event => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get('reason') ?? ''); if (await run({ command: 'revoke_issue', payload: { id: issue.id, reason } })) setPeriods(null) }}><p className="text-sm text-[var(--muted)]">{c.issueRevokeHint}</p><Field label={c.revokeReason}><textarea className={control} name="reason" rows={2} required maxLength={1000} disabled={busy} /></Field><button className={button} type="submit" disabled={busy}>{c.revoke}</button></form></details>}
    </td></tr>)}</Table>}{issues.length > limit && <button className={button} type="button" onClick={() => setLimit(value => value + 30)}>{c.more} ({limit}/{issues.length})</button>}</section>
  </div>
}
