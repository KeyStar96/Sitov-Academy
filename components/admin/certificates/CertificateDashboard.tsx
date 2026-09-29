'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { executeCertificateCommand, getCertificateAdminData } from '@/app/actions/certificates'
import type { BackendActionError } from '@/lib/types/backend'
import type { CertificateAdminData } from '@/lib/certificates/types'
import { certificateAdminCopy } from './i18n'
import { button, primary, type CommandRunner } from './shared'
import Imports from './Imports'
import Reconcile from './Reconcile'
import Attendance from './Attendance'
import Issues from './Issues'

type Tab = 'imports' | 'resolve' | 'attendance' | 'certificates'
const tabs: Tab[] = ['imports', 'resolve', 'attendance', 'certificates']
export default function CertificateDashboard({ initialData, lang }: { initialData: CertificateAdminData; lang: string }) {
  const c = certificateAdminCopy(lang)
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<Tab>('imports')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  function onError(error: BackendActionError) {
    setNotice({ error: true, text: error === 'conflict' || error === 'month_changed' ? c.stale : error === 'invalid_input' ? c.invalid : error === 'not_authenticated' || error === 'not_authorized' ? c.denied : c.failed })
  }
  async function reload(): Promise<boolean> {
    try {
      const result = await getCertificateAdminData()
      if (result.success === false) { onError(result.error); return false }
      setData(result.data)
      return true
    } catch { onError('request_failed'); return false }
  }
  const run: CommandRunner = async command => {
    if (busy) return false
    setBusy(true); setNotice(null)
    try {
      const result = await executeCertificateCommand(command)
      if (result.success === false) { onError(result.error); return false }
      if (await reload()) setNotice({ error: false, text: c.saved })
      return true
    } catch { onError('request_failed'); return false }
    finally { setBusy(false) }
  }
  const props = { data, lang, c, busy, run }
  return <div className="min-w-0 space-y-6 text-[var(--foreground)]">
    <header className="space-y-3"><Link href={`/${lang}/admin/finance`} className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"><ArrowLeft size={16} aria-hidden="true" />{c.back}</Link><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c.title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{c.intro}</p></div><button className={button} type="button" disabled={busy} onClick={async () => { setBusy(true); setNotice(null); await reload(); setBusy(false) }}><RefreshCw size={16} aria-hidden="true" />{c.refresh}</button></div></header>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={c.title}>{tabs.map(value => <button key={value} id={`certificate-tab-${value}`} type="button" role="tab" aria-selected={tab === value} aria-controls="certificate-panel" tabIndex={tab === value ? 0 : -1} className={tab === value ? primary : button} onClick={() => { setTab(value); setNotice(null) }} onKeyDown={event => { const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(value) + offset + tabs.length) % tabs.length; if (offset || event.key === 'Home' || event.key === 'End') { event.preventDefault(); setTab(tabs[index]); document.getElementById(`certificate-tab-${tabs[index]}`)?.focus() } }}>{c[value]}</button>)}</div>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${notice.error ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100' : 'border-[var(--border)] bg-[var(--surface)]'}`}>{notice.text}</p>}
    {busy && <p role="status" className="text-sm text-[var(--muted)]">{c.working}</p>}
    <div id="certificate-panel" role="tabpanel" aria-labelledby={`certificate-tab-${tab}`} aria-busy={busy}>
      {tab === 'imports' && <Imports {...props} reload={reload} onError={onError} />}
      {tab === 'resolve' && <Reconcile {...props} />}
      {tab === 'attendance' && <Attendance {...props} />}
      {tab === 'certificates' && <Issues {...props} onError={onError} />}
    </div>
  </div>
}
