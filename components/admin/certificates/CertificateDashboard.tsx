'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { executeCertificateCommand, getCertificateAdminData } from '@/app/actions/certificates'
import type { BackendActionError } from '@/lib/types/backend'
import type { CertificateAdminData } from '@/lib/certificates/types'
import { administrationCopy } from '@/lib/admin-administration-i18n'
import { certificateAdminCopy } from './i18n'
import { type CommandRunner } from './shared'
import { CERTIFICATE_TABS, type CertificateTab } from './tabs'
import { Notice, PageHeader, adminButton, adminChip } from '../ui'
import Imports from './Imports'
import Reconcile from './Reconcile'
import Attendance from './Attendance'
import Issues from './Issues'


/**
 * Zertifikats-Werkzeuge im Bereich „Verwaltung“, aufgeteilt auf zwei Seiten:
 * `view="imports"` – CSV-Importe (Upload → Vorschau → Übernahme, Verlauf),
 * `view="certificates"` – Abgleich & Zuordnungen, Teilnahme, Bescheinigungen.
 * Daten, Befehle und Neuladen teilen sich beide Ansichten.
 */
export default function CertificateDashboard({ initialData, lang, view = 'certificates', initialTab = 'resolve' }: {
  initialData: CertificateAdminData
  lang: string
  view?: 'imports' | 'certificates'
  initialTab?: CertificateTab
}) {
  const c = certificateAdminCopy(lang)
  const a = administrationCopy(lang)
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<CertificateTab>(initialTab)
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
  const refresh = <button className={adminButton('secondary')} type="button" disabled={busy} onClick={async () => { setBusy(true); setNotice(null); await reload(); setBusy(false) }}><RefreshCw size={16} aria-hidden="true" />{c.refresh}</button>
  return <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
    <PageHeader
      title={view === 'imports' ? a.importsTitle : a.certificatesTitle}
      description={view === 'imports' ? a.importsIntro : a.certificatesIntro}
      actions={refresh}
    />
    {view === 'certificates' && <div className="admin-scroll-x -mx-1 flex gap-2 px-1" role="tablist" aria-label={c.title}>{CERTIFICATE_TABS.map(value => <button key={value} id={`certificate-tab-${value}`} type="button" role="tab" aria-selected={tab === value} aria-controls="certificate-panel" tabIndex={tab === value ? 0 : -1} className={adminChip(tab === value)} onClick={() => { setTab(value); setNotice(null) }} onKeyDown={event => { const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; const index = event.key === 'Home' ? 0 : event.key === 'End' ? CERTIFICATE_TABS.length - 1 : (CERTIFICATE_TABS.indexOf(value) + offset + CERTIFICATE_TABS.length) % CERTIFICATE_TABS.length; if (offset || event.key === 'Home' || event.key === 'End') { event.preventDefault(); setTab(CERTIFICATE_TABS[index]); document.getElementById(`certificate-tab-${CERTIFICATE_TABS[index]}`)?.focus() } }}>{c[value]}</button>)}</div>}
    {notice && <Notice tone={notice.error ? 'warning' : 'success'} role={notice.error ? 'alert' : 'status'}>{notice.text}</Notice>}
    {busy && <p role="status" className="text-sm text-[var(--muted)]">{c.working}</p>}
    {view === 'imports' ? (
      <div aria-busy={busy} className="space-y-5">
        <Imports {...props} reload={reload} onError={onError} />
        <Notice tone="info" action={<Link href={`/${lang}/admin/finance/certificates`} className={adminButton('secondary', 'sm', 'w-full sm:w-auto')}>{a.toCertificates}<ArrowRight size={15} aria-hidden="true" /></Link>}>{a.importsNext}</Notice>
      </div>
    ) : (
      <div id="certificate-panel" role="tabpanel" aria-labelledby={`certificate-tab-${tab}`} aria-busy={busy}>
        {tab === 'resolve' && <Reconcile {...props} />}
        {tab === 'attendance' && <Attendance {...props} />}
        {tab === 'certificates' && <Issues {...props} onError={onError} />}
      </div>
    )}
  </div>
}
