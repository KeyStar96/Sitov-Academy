'use client'
import { useEffect, useState, useTransition } from 'react'
import { getSitovStaffBillingSettings, saveSitovStaffBillingPrice, turnOffSitovStaffBilling } from '@/app/actions/sitov-commercial-access'
import type { SitovBillingSettings as BillingState, SitovBillingResult } from '@/lib/access/sitov-billing-staff'
import { getSitovBillingAdminCopy } from '@/lib/admin-i18n'
import { ACCESS_LEVELS, type AccessLevel } from '@/lib/access/levels'
import PressableCard from '@/components/motion/PressableCard'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import { adminButton, adminInput } from './ui'
import styles from './SitovBillingSettings.module.css'

export default function SitovBillingSettings({ lang, initial }: { lang: string; initial: SitovBillingResult<BillingState> }) {
  const copy = getSitovBillingAdminCopy(lang)
  const [settings, setSettings] = useState(initial.ok ? initial.data : null)
  const [level, setLevel] = useState<AccessLevel>('A1.1')
  const [status, setStatus] = useState<'error' | 'stale' | 'saved' | null>(initial.ok ? null : 'error')
  const [pending, startTransition] = useTransition()
  const [pricePending,setPricePending]=useState(false)
  const busy=pending || pricePending
  function reload() {
    setStatus(null)
    startTransition(async () => {
      try {
        const result = await getSitovStaffBillingSettings()
        if (result.ok === false) { setStatus('error'); return }
        setSettings(result.data)
      } catch { setStatus('error') }
    })
  }
  function disable() {
    if (!settings || pending) return
    setStatus(null)
    startTransition(async () => {
      try {
        const result = await turnOffSitovStaffBilling({ revision: settings.revision })
        if (result.ok === false) { setStatus(result.error === 'revision_conflict' ? 'stale' : 'error'); return }
        setSettings({ ...settings, enabled: false, revision: result.data.revision }); setStatus('saved')
      } catch { setStatus('error') }
    })
  }
  const product = settings?.products.find(p => p.level === level)
  return <section className={styles.panel} aria-labelledby="sitov-billing-title" aria-busy={busy}>
    <h1 id="sitov-billing-title" className="text-xl font-semibold">{copy.title}</h1>
    {settings && <>
      <p role="status" className="font-semibold">{settings.enabled ? copy.on : copy.off}</p>
      <p>{copy.provider}</p>
      {settings.enabled && <PressableCard type="button" disabled={busy || status === 'stale'} onClick={disable} className={adminButton('secondary','md')}>{copy.disable}</PressableCard>}
      <label className="block">{copy.level}<select value={level} disabled={busy} onChange={e => setLevel(e.target.value as AccessLevel)} className={adminInput}>{ACCESS_LEVELS.map(value => <option key={value}>{value}</option>)}</select></label>
      {product && <SitovBillingPrice key={`${product.level}:${product.revision}`} lang={lang} product={product} disabled={busy || status === 'stale'}
        onBusyChange={setPricePending} onSaved={(amount_minor,currency,revision) => { setSettings(current => current ? { ...current, products: current.products.map(p => p.level === level ? { ...p,amount_minor,currency,revision } : p) } : current); setStatus('saved') }}
        onError={error => setStatus(error === 'revision_conflict' ? 'stale' : 'error')} onEditing={() => setStatus(null)} />}
    </>}
    {pending && <p role="status">{copy.loading}</p>}
    {status && <p role={status === 'saved' ? 'status' : 'alert'}>{copy[status]}</p>}
    {(status === 'error' || status === 'stale' || !settings) && <PressableCard type="button" disabled={busy} onClick={reload} className={adminButton('secondary','md')}>{copy.retry}</PressableCard>}
    <SitovTrainerHelp title={copy.help}><p>{copy.info}</p></SitovTrainerHelp>
  </section>
}
function SitovBillingPrice({ lang, product, disabled, onSaved, onError, onEditing, onBusyChange }: {
  lang: string; product: BillingState['products'][number]; disabled: boolean
  onSaved: (amount: number,currency: string,revision: number) => void; onError: (error: string) => void; onEditing: () => void; onBusyChange: (value: boolean) => void
}) {
  const copy=getSitovBillingAdminCopy(lang)
  const [amount,setAmount]=useState(product.amount_minor === null ? '' : String(product.amount_minor))
  const [currency,setCurrency]=useState(product.currency ?? '')
  const [pending,startTransition]=useTransition()
  useEffect(() => { onBusyChange(pending); return () => onBusyChange(false) },[pending,onBusyChange])
  const valid=/^[1-9]\d*$/.test(amount) && Number.isSafeInteger(Number(amount)) && /^[A-Z]{3}$/.test(currency)
  return <form onSubmit={event => {
    event.preventDefault()
    if (!valid || disabled || pending) return
    onEditing()
    startTransition(async () => {
      try {
        const result=await saveSitovStaffBillingPrice({level:product.level,amountMinor:Number(amount),currency,revision:product.revision})
        if (result.ok === false) { onError(result.error);return }
        onSaved(Number(amount),currency,result.data.revision)
      } catch { onError('unavailable') }
    })
  }} className="space-y-4" aria-busy={pending}>
    {product.amount_minor === null && <p>{copy.noPrice}</p>}
    <fieldset disabled={disabled || pending} className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">{product.level}</legend>
      <label>{copy.amount}<input className={adminInput} inputMode="numeric" pattern="[1-9][0-9]*" required value={amount} onChange={e => { setAmount(e.target.value);onEditing() }} /></label>
      <label>{copy.currency}<input className={adminInput} maxLength={3} pattern="[A-Z]{3}" required autoCapitalize="characters" value={currency} onChange={e => { setCurrency(e.target.value.toUpperCase());onEditing() }} /></label>
    </fieldset>
    <PressableCard type="submit" disabled={!valid || disabled || pending} className={adminButton('primary','md','w-full')}>{pending ? copy.loading : copy.save}</PressableCard>
  </form>
}
