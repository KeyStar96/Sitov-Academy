'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/client'
import type { SitovStaffMfaCopy } from '@/lib/sitov-staff-mfa-copy'
import styles from './SitovStaffMfa.module.css'

type SitovFactor = { id: string; friendly_name?: string; status: string; factor_type: string }
type SitovEnrollment = { id: string; qr: string; secret: string }
const sitovFactorName = 'Sitov Academy'

export default function SitovStaffMfa({ lang, copy, required }: { lang: string; copy: SitovStaffMfaCopy; required: boolean }) {
  const client = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [factors, setFactors] = useState<SitovFactor[]>([])
  const [factorId, setFactorId] = useState('')
  const [enrollment, setEnrollment] = useState<SitovEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [protectedAccount, setProtectedAccount] = useState(false)
  const codeInput = useRef<HTMLInputElement>(null)
  const successMessage = useRef<HTMLElement>(null)
  const lock = useRef(false)
  const primaryButton = `academy-button academy-button-primary ${styles.sitovButton}`
  const secondaryButton = `academy-button academy-button-outline ${styles.sitovButton}`

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const [list, assurance] = await Promise.all([client.auth.mfa.listFactors(), client.auth.mfa.getAuthenticatorAssuranceLevel()])
        if (list.error || assurance.error) throw new Error('mfa_status_failed')
        if (!active) return
        const verified = list.data.totp.filter(factor => factor.status === 'verified')
        setFactors(verified); setFactorId(verified[0]?.id ?? '')
        setProtectedAccount(required && assurance.data.currentLevel === 'aal2' && verified.length > 0)
      } catch { if (active) setError(copy.loadFailed) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [client, copy.loadFailed, required])

  useEffect(() => {
    if (protectedAccount) successMessage.current?.focus()
    else if (!loading && factorId) codeInput.current?.focus()
  }, [protectedAccount, loading, factorId])

  async function setup() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const list = await client.auth.mfa.listFactors()
      if (list.error) throw list.error
      // Remove only this flow's unfinished setup, never a verified factor.
      for (const factor of list.data.all) if (factor.factor_type === 'totp' && factor.status === 'unverified' && factor.friendly_name === sitovFactorName) {
        const removed = await client.auth.mfa.unenroll({ factorId: factor.id })
        if (removed.error) throw removed.error
      }
      const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: sitovFactorName, issuer: 'Sitov Academy' })
      if (result.error) throw result.error
      const qr = result.data.totp.qr_code.startsWith('data:image/svg+xml') ? result.data.totp.qr_code
        : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.data.totp.qr_code)}`
      setEnrollment({ id: result.data.id, qr, secret: result.data.totp.secret }); setFactorId(result.data.id); setCode('')
      codeInput.current?.focus()
    } catch { setError(copy.setupFailed) }
    finally { lock.current = false; setBusy(false) }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current || !factorId || !/^\d{6}$/.test(code)) return
    lock.current = true; setBusy(true); setError('')
    try {
      const checked = await client.auth.mfa.challengeAndVerify({ factorId, code })
      if (checked.error) throw checked.error
      // Activating the DB flag after verification protects direct APIs and all
      // other sessions as well. There is no client-side disable operation.
      const activated = await client.rpc('sitov_enable_staff_mfa')
      if (activated.error || activated.data !== true) throw new Error('mfa_activation_failed')
      setEnrollment(null); setCode(''); setProtectedAccount(true)
    } catch { setError(copy.failed); codeInput.current?.focus() }
    finally { lock.current = false; setBusy(false) }
  }

  async function cancel() {
    if (!enrollment || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const result = await client.auth.mfa.unenroll({ factorId: enrollment.id })
      if (result.error) throw result.error
      setEnrollment(null); setFactorId(factors[0]?.id ?? ''); setCode('')
    } catch { setError(copy.setupFailed) }
    finally { lock.current = false; setBusy(false) }
  }

  return <div className={styles.sitovPanel} aria-busy={loading || busy}>
    <p className={styles.sitovRecovery}>{required ? copy.mandatory : copy.optional}</p>
    {loading ? <p role="status">{copy.loading}</p> : protectedAccount ? <section ref={successMessage} tabIndex={-1} className={styles.sitovState}>
      <p role="status">{copy.protected}</p>
      <Link href={`/${lang}/admin`} className={`${primaryButton} mt-5`}>{copy.continue}</Link>
    </section> : <>
      {!factorId && <button type="button" onClick={() => void setup()} disabled={busy} className={primaryButton}>{copy.setup}</button>}
      {enrollment && <section className={`${styles.sitovPanel} ${styles.sitovState}`} aria-label={copy.setup}>
        <p>{copy.setupHint}</p>
        {/* Supabase Auth's QR is rendered as an image, never injected SVG markup. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qr} alt={copy.qrAlt} width={240} height={240} className={styles.sitovQr} />
        <div><p className="mb-2 text-sm font-semibold">{copy.secret}</p><code className={styles.sitovKey}>{enrollment.secret}</code></div>
      </section>}
      {factorId && <form onSubmit={verify} className={`${styles.sitovPanel} ${styles.sitovState}`}>
        {factors.length > 1 && <label>{copy.factor}<select className={styles.sitovField} value={factorId} onChange={event => setFactorId(event.target.value)} disabled={busy}>
          {factors.map((factor, index) => <option value={factor.id} key={factor.id}>{factor.friendly_name || `${copy.factor} ${index + 1}`}</option>)}
        </select></label>}
        <label htmlFor="sitov-mfa-code" className="font-semibold">{copy.code}</label>
        <input id="sitov-mfa-code" ref={codeInput} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6}
          className={`${styles.sitovField} ${styles.sitovCode}`} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-describedby="sitov-mfa-code-hint sitov-mfa-error" disabled={busy} />
        <p id="sitov-mfa-code-hint" className={styles.sitovRecovery}>{copy.codeHint}</p>
        <button type="submit" disabled={busy || code.length !== 6} className={primaryButton}>{busy ? copy.working : copy.verify}</button>
        {enrollment && <button type="button" disabled={busy} onClick={() => void cancel()} className={secondaryButton}>{copy.cancel}</button>}
      </form>}
    </>}
    <p id="sitov-mfa-error" role={error ? 'alert' : 'status'} className={styles.sitovFeedback}>{error}</p>
    <p className={styles.sitovRecovery}>{copy.recovery}</p>
  </div>
}
