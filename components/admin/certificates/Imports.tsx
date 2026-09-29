'use client'
import { useRef, useState, type FormEvent } from 'react'
import { getCertificateImportRows, previewCertificateImport } from '@/app/actions/certificates'
import type { CertificateImportKind, CertificateImportRow } from '@/lib/certificates/types'
import type { BackendActionError } from '@/lib/types/backend'
import { certificateReason, certificateStatus } from './i18n'
import { button, primary, control, panel, Field, Empty, Table, cell, formatDate, jsonRecord, type DeskProps } from './shared'

export default function Imports({ data, lang, c, busy, run, reload, onError }: DeskProps & { reload: () => Promise<boolean>; onError: (error: BackendActionError) => void }) {
  const [kind, setKind] = useState<CertificateImportKind>('customers')
  const [complete, setComplete] = useState(false)
  const [working, setWorking] = useState(false)
  const [batchId, setBatchId] = useState<string | null>(null)
  const [rows, setRows] = useState<CertificateImportRow[] | null>(null)
  const [visibleRows, setVisibleRows] = useState(30)
  const [historyCount, setHistoryCount] = useState(20)
  const request = useRef(0)
  const batch = data.batches.find(value => value.id === batchId)
  const disabled = busy || working

  async function inspect(id: string) {
    const current = ++request.current
    setWorking(true); setBatchId(id); setRows(null); setVisibleRows(30)
    try {
      const result = await getCertificateImportRows(id)
      if (current !== request.current) return
      if (result.success === true) setRows(result.data)
      else onError(result.error)
    } catch { onError('request_failed') }
    finally { if (current === request.current) setWorking(false) }
  }
  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const timestamp = new Date(String(formData.get('exportedAt')))
    if (!Number.isFinite(timestamp.valueOf())) { onError('invalid_input'); return }
    formData.set('exportedAt', timestamp.toISOString())
    formData.set('completeSnapshot', complete && kind === 'invoices' ? 'true' : 'false')
    formData.set('includesArchived', formData.get('includesArchived') === 'on' ? 'true' : 'false')
    setWorking(true)
    try {
      const result = await previewCertificateImport(formData)
      if (result.success === false) { onError(result.error); return }
      await reload()
      if (result.data.batch_id) await inspect(result.data.batch_id)
    } catch { onError('request_failed') }
    finally { setWorking(false) }
  }
  const summary = batch ? jsonRecord(batch.summary) : {}
  const fieldLabels: Record<string, string> = {
    customer_number: c.key, display_name: c.name, name: c.name, email: c.email, phone: lang === 'de' ? 'Telefon' : 'Phone',
    street: c.street, postal_code: c.postal, city: c.city, article_number: c.key, description: c.description,
    unit: lang === 'de' ? 'Einheit' : 'Unit', unit_price: lang === 'de' ? 'Einzelpreis' : 'Unit price',
    invoice_number: c.invoice, document_type: c.kind, source_status: c.status, payment_status: c.status, validity: c.validity,
    invoice_date: lang === 'de' ? 'Rechnungsdatum' : 'Invoice date', due_date: lang === 'de' ? 'Fälligkeit' : 'Due date',
    paid_at: lang === 'de' ? 'Letzte Zahlung' : 'Last payment', service_month: c.serviceMonth, gross_amount: c.gross,
    paid_amount: c.paidAmount, discount_amount: c.discount, article_numbers: c.products,
    subject: lang === 'de' ? 'Betreff' : 'Subject', review_reason: c.issues,
  }
  function fieldValue(key: string, value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (key === 'review_reason') return certificateReason(String(value), lang)
    if (key === 'payment_status' || key === 'validity') return certificateStatus(String(value), c)
    if (key === 'document_type') return value === 'cancellation' ? c.document_cancellation : value === 'credit_note' ? c.document_credit_note : value === 'invoice' ? c.document_invoice : c.document_unknown
    return Array.isArray(value) ? value.join(', ') : String(value)
  }
  const stats = [['total', c.total], ['ready', c.ready], ['conflicts', c.conflicts], ['errors', c.errors], ['ignored', c.ignored], ['paid', c.paid]] as const

  return <div className="space-y-6">
    <section className={panel}><h2 className="text-lg font-semibold">{c.uploadTitle}</h2><p className="mt-1 text-sm text-[var(--muted)]">{c.uploadHint}</p>
      <form onSubmit={preview} className="mt-4"><fieldset disabled={disabled} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={c.kind}><select className={control} name="kind" value={kind} onChange={event => { setKind(event.target.value as CertificateImportKind); setComplete(false) }}><option value="customers">{c.customers}</option><option value="products">{c.products}</option><option value="invoices">{c.invoices}</option></select></Field>
          <Field label={c.file}><input className={control} name="file" type="file" accept=".csv,text/csv" required /></Field>
          <Field label={c.exportedAt}><input className={control} name="exportedAt" type="datetime-local" required /></Field>
        </div>
        {kind === 'invoices' && <div className="space-y-3 rounded-lg bg-[var(--surface-muted)] p-3">
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={complete} onChange={event => setComplete(event.target.checked)} className="h-5 w-5" />{c.complete}</label>
          <p className="text-sm text-[var(--muted)]">{c.completeHint}</p>
          {complete && <div className="grid gap-3 sm:grid-cols-[10rem_1fr]"><Field label={c.year}><input className={control} name="exportYear" type="number" min={2000} max={2200} defaultValue={new Date().getFullYear()} required /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input className="h-5 w-5 shrink-0" type="checkbox" name="includesArchived" required />{c.archived}</label></div>}
        </div>}
        <button className={primary} type="submit">{working ? c.working : c.preview}</button>
      </fieldset></form>
    </section>
    {batchId && <section className={`${panel} space-y-4`} aria-busy={working}>
      <div><h2 className="text-lg font-semibold">{c.previewTitle}</h2><p className="mt-1 break-words text-sm text-[var(--muted)]">{batch?.filename} · {batch && certificateStatus(batch.status, c)}</p></div>
      {working && !rows && <p role="status">{c.working}</p>}
      {rows && <>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{stats.map(([key, label]) => <div key={key} className="rounded-lg bg-[var(--surface-muted)] p-3"><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 text-xl font-semibold">{typeof summary[key] === 'number' ? summary[key] : '—'}</dd></div>)}</dl>
        <p className="text-sm text-[var(--muted)]">{c.previewHint}</p>
        <Table caption={c.previewTitle} headings={[c.row, c.key, c.status, c.details, c.issues]}>
          {rows.slice(0, visibleRows).map(row => <tr key={row.id}>
            <td className={cell}>{row.row_number}</td><td className={cell}>{row.external_key ?? '—'}</td><td className={cell}>{certificateStatus(row.disposition, c)}</td>
            <td className={`${cell} min-w-64 max-w-md break-words`}><details><summary className="cursor-pointer py-2">{String(jsonRecord(row.normalized_data).display_name ?? jsonRecord(row.normalized_data).name ?? jsonRecord(row.normalized_data).subject ?? c.details)}</summary><dl className="space-y-1 text-xs">{Object.entries(jsonRecord(row.normalized_data)).filter(([key]) => fieldLabels[key]).map(([key, value]) => <div key={key}><dt className="font-medium">{fieldLabels[key]}</dt><dd>{fieldValue(key, value)}</dd></div>)}</dl></details></td>
            <td className={`${cell} min-w-52`}>{Array.isArray(row.issues) ? <ul>{row.issues.map((reason, index) => <li key={index}>{certificateReason(String(reason), lang)}</li>)}</ul> : '—'}</td>
          </tr>)}
        </Table>
        {rows.length > visibleRows && <button className={button} type="button" onClick={() => setVisibleRows(value => value + 50)}>{c.more} ({visibleRows}/{rows.length})</button>}
        {batch?.status === 'preview' && <button className={primary} type="button" disabled={disabled || rows.some(row => row.disposition === 'error') || rows.every(row => row.disposition === 'ignored')} onClick={async () => { if (await run({ command: 'apply_import', payload: { batch_id: batchId } })) await inspect(batchId) }}>{c.apply}</button>}
      </>}
    </section>}
    <section className={`${panel} space-y-4`}><h2 className="text-lg font-semibold">{c.history}</h2>
      {!data.batches.length ? <Empty text={c.noData} /> : <Table caption={c.history} headings={[c.file, c.kind, c.exportedAt, c.status, c.details]}>{data.batches.slice(0, historyCount).map(entry => <tr key={entry.id}>
        <td className={`${cell} break-words`}>{entry.filename}</td><td className={cell}>{certificateStatus(entry.kind, c)}</td><td className={cell}>{formatDate(entry.exported_at, lang, true)}</td><td className={cell}>{certificateStatus(entry.status, c)}</td><td className={cell}><button className={button} disabled={disabled} type="button" onClick={() => inspect(entry.id)}>{c.inspect}</button></td>
      </tr>)}</Table>}
      {data.batches.length > historyCount && <button className={button} type="button" onClick={() => setHistoryCount(value => value + 30)}>{c.more}</button>}
    </section>
  </div>
}
