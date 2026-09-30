'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resolveRegistrationIdentity } from '@/app/actions/registration-identity'
import { identityLabels } from '@/lib/registration-identity-i18n'
import type { IdentityConflict } from '@/lib/types/registration-identity'
import { Notice, adminButton, adminInput, adminLabel } from './ui'

function ConflictRow({ conflict, lang }: { conflict: IdentityConflict; lang: string }) {
  const t = identityLabels(lang)
  const router = useRouter()
  const [account, setAccount] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<'saved' | 'failed' | null>(null)
  const inFlight = useRef(false)
  const eligible = conflict.candidates.find(candidate => candidate.auth_user_id === account)?.can_assign === true
  async function assign() {
    if (!eligible || !confirmed || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setStatus(null)
    try {
      const result = await resolveRegistrationIdentity({ personId: conflict.person_id, authUserId: account, confirmed: true })
      setStatus(result.success ? 'saved' : 'failed')
      if (result.success) router.refresh()
    } catch { setStatus('failed') }
    finally { inFlight.current = false; setPending(false) }
  }
  return <article className="space-y-3 rounded-lg border border-[var(--admin-line)] bg-[var(--surface)] p-4">
    <div><h3 className="text-sm font-semibold">{conflict.display_name}</h3><p className="break-all text-sm text-[var(--muted)]">{conflict.email}</p><p className="text-xs text-[var(--muted)]">{t.bookings}: {conflict.booking_count}</p></div>
    {status === 'saved' ? <p role="status" className="text-sm font-medium text-[var(--success)]">{t.saved}</p> : <>
      <label className="block"><span className={adminLabel}>{t.account}</span>
        <select value={account} disabled={pending} onChange={event => { setAccount(event.target.value); setConfirmed(false); setStatus(null) }} className={adminInput}>
          <option value="">{t.choose}</option>
          {conflict.candidates.map(candidate => <option key={candidate.auth_user_id} value={candidate.auth_user_id}>{candidate.display_name} — {candidate.email}</option>)}
        </select>
      </label>
      {account && !eligible && <p role="status" className="text-sm text-[var(--muted)]">{t.blocked}</p>}
      <label className="flex min-h-12 items-center gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={!eligible || pending} onChange={event => setConfirmed(event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--accent-strong)]" /><span>{t.confirm}</span></label>
      <button type="button" onClick={assign} disabled={!eligible || !confirmed || pending} className={adminButton('primary', 'md', 'w-full sm:w-auto')}>{pending ? t.loading : t.assign}</button>
      {status === 'failed' && <p role="alert" className="text-sm text-[var(--danger)]">{t.failed}</p>}
    </>}
  </article>
}

export default function RegistrationIdentityConflicts({ conflicts, lang, failed = false }: { conflicts: IdentityConflict[]; lang: string; failed?: boolean }) {
  const t = identityLabels(lang)
  return <section aria-labelledby="identity-conflicts-title" className="space-y-3 rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-[var(--foreground)] sm:p-5">
    <div><h2 id="identity-conflicts-title" className="text-sm font-semibold">{t.title}</h2><p className="mt-1 text-sm leading-relaxed">{t.intro}</p></div>
    {failed ? <Notice tone="warning" role="alert" action={<a className={adminButton('secondary', 'sm')} href={`/${lang}/admin/registrations`}>{t.reload}</a>}>{t.failed}</Notice> : conflicts.length ? conflicts.map(conflict => <ConflictRow key={conflict.person_id} conflict={conflict} lang={lang} />) : <p className="text-sm">{t.empty}</p>}
  </section>
}
