'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resolveRegistrationIdentity } from '@/app/actions/registration-identity'
import { identityLabels } from '@/lib/registration-identity-i18n'
import type { IdentityConflict } from '@/lib/types/registration-identity'

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
  return <article className="space-y-4 rounded-2xl border border-[var(--border)] p-5">
    <div><h3 className="font-bold">{conflict.display_name}</h3><p className="break-all">{conflict.email}</p><p className="text-sm">{t.bookings}: {conflict.booking_count}</p></div>
    {status === 'saved' ? <p role="status">{t.saved}</p> : <>
      <label className="block space-y-2"><span>{t.account}</span>
        <select value={account} disabled={pending} onChange={event => { setAccount(event.target.value); setConfirmed(false); setStatus(null) }} className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <option value="">{t.choose}</option>
          {conflict.candidates.map(candidate => <option key={candidate.auth_user_id} value={candidate.auth_user_id}>{candidate.display_name} — {candidate.email}</option>)}
        </select>
      </label>
      {account && !eligible && <p role="status">{t.blocked}</p>}
      <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={confirmed} disabled={!eligible || pending} onChange={event => setConfirmed(event.target.checked)} className="h-5 w-5 shrink-0" /><span>{t.confirm}</span></label>
      <button type="button" onClick={assign} disabled={!eligible || !confirmed || pending} className="min-h-12 rounded-xl bg-[var(--foreground)] px-5 py-3 font-semibold text-[var(--background)] disabled:opacity-50">{pending ? t.loading : t.assign}</button>
      {status === 'failed' && <p role="alert">{t.failed}</p>}
    </>}
  </article>
}

export default function RegistrationIdentityConflicts({ conflicts, lang, failed = false }: { conflicts: IdentityConflict[]; lang: string; failed?: boolean }) {
  const t = identityLabels(lang)
  return <section aria-labelledby="identity-conflicts-title" className="mb-8 space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--foreground)]">
    <div><h2 id="identity-conflicts-title" className="text-2xl font-bold">{t.title}</h2><p className="mt-2">{t.intro}</p></div>
    {failed ? <p role="alert">{t.failed} <a className="underline" href={`/${lang}/admin/registrations`}>{t.reload}</a></p> : conflicts.length ? conflicts.map(conflict => <ConflictRow key={conflict.person_id} conflict={conflict} lang={lang} />) : <p>{t.empty}</p>}
  </section>
}
