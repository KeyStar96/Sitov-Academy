'use client'
import { useState, type FormEvent } from 'react'
import type { CertificateAdminData } from '@/lib/certificates/types'
import { certificateReason, certificateStatus } from './i18n'
import { button, primary, control, panel, Field, Empty, monthEnd, personName, courseName, type DeskProps } from './shared'

export default function Reconcile(props: DeskProps) {
  const { data, c } = props
  const [section, setSection] = useState<'customers' | 'products' | 'invoices'>('customers')
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [limit, setLimit] = useState(30)
  const [invoiceId, setInvoiceId] = useState('')
  const query = search.trim().toLowerCase()
  const customers = data.customers.filter(row => (showAll || row.review_status !== 'resolved') && `${row.display_name} ${row.email} ${row.customer_number}`.toLowerCase().includes(query))
  // Course mappings remain editable after import, including resolved services.
  const products = data.products.filter(row => `${row.name} ${row.article_number}`.toLowerCase().includes(query))
  // All invoices remain selectable so late payments and allocation corrections can be inspected.
  const invoices = data.invoices.filter(row => `${row.invoice_number} ${row.customer_number} ${data.customers.find(customer => customer.id === row.external_customer_id)?.display_name ?? ''}`.toLowerCase().includes(query))
  const selectedInvoice = invoices.find(row => row.id === invoiceId) ?? invoices.find(row => row.review_reason || row.validity === 'review') ?? invoices[0]
  const sections = ['customers', 'products', 'invoices'] as const
  return <div className="space-y-4">
    <div className={`${panel} space-y-4`}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={c.resolve}>{sections.map(value => <button type="button" className={section === value ? primary : button} aria-pressed={section === value} key={value} onClick={() => { setSection(value); setLimit(30) }}>{c[value]}</button>)}</div>
      <div className="grid gap-3 md:grid-cols-2"><Field label={c.search}><input className={control} type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(30) }} /></Field>{section === 'customers' && <label className="flex min-h-11 items-center gap-3 self-end text-sm"><input className="h-5 w-5" type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} />{c.showAll}</label>}</div>
    </div>
    {section === 'customers' && <>{!customers.length && <Empty text={c.noData} />}{customers.slice(0, limit).map(row => <Customer key={`${row.id}:${row.person_id}`} row={row} {...props} />)}{customers.length > limit && <button type="button" className={button} onClick={() => setLimit(value => value + 30)}>{c.more} ({limit}/{customers.length})</button>}</>}
    {section === 'products' && <>{!products.length && <Empty text={c.noData} />}{products.slice(0, limit).map(row => <Product key={`${row.id}:${data.productCourses.filter(map => map.product_id === row.id).map(map => `${map.course_id}:${map.version}`).join(',')}`} row={row} {...props} />)}{products.length > limit && <button type="button" className={button} onClick={() => setLimit(value => value + 30)}>{c.more} ({limit}/{products.length})</button>}</>}
    {section === 'invoices' && <>
      <Field label={c.invoice}><select className={control} value={selectedInvoice?.id ?? ''} onChange={event => setInvoiceId(event.target.value)}><option value="">{c.select}</option>{invoices.map(row => <option key={row.id} value={row.id}>{row.invoice_number} · {data.customers.find(customer => customer.id === row.external_customer_id)?.display_name ?? row.customer_number} · {certificateStatus(row.payment_status, c)}</option>)}</select></Field>
      {selectedInvoice ? <Invoice key={`${selectedInvoice.id}:${selectedInvoice.source_revision}`} invoice={selectedInvoice} {...props} /> : <Empty text={c.noData} />}
    </>}
  </div>
}

function Customer({ row, data, c, lang, busy, run }: DeskProps & { row: CertificateAdminData['customers'][number] }) {
  const [mode, setMode] = useState('existing')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const text = (name: string) => String(fields.get(name) ?? '').trim()
    await run({ command: 'resolve_customer', payload: mode === 'existing'
      ? { id: row.id, person_id: text('person_id') }
      : { id: row.id, display_name: text('display_name'), email: text('email'), street: text('street'), postal_code: text('postal_code'), city: text('city') } })
  }
  return <details className={panel}><summary className="cursor-pointer py-1 font-semibold">{row.display_name} <span className="text-sm font-normal text-[var(--muted)]">· {row.customer_number} · {row.email || certificateReason('missing_email', lang)}</span></summary>
    {row.review_reason && <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">{certificateReason(row.review_reason, lang)}</p>}
    {row.person_id ? <p className="mt-3 text-sm">{c.confirmed}: {personName(data, row.person_id)}</p> : <form className="mt-4" onSubmit={save}><fieldset disabled={busy} className="space-y-4">
      <div className="flex flex-wrap gap-4">{[['existing', c.existingPerson], ['new', c.newPerson]].map(([value, label]) => <label className="flex min-h-11 items-center gap-2 text-sm" key={value}><input type="radio" name={`mode-${row.id}`} checked={mode === value} onChange={() => setMode(value)} />{label}</label>)}</div>
      {mode === 'existing' ? <Field label={c.person}><select name="person_id" className={control} required defaultValue=""><option value="">{c.select}</option>{data.people.map(person => <option key={person.id} value={person.id}>{person.display_name} · {person.email}</option>)}</select></Field> : <>
        <p className="text-sm text-[var(--muted)]">{c.createPersonHint}</p><div className="grid gap-3 sm:grid-cols-2">
          <Field label={c.name}><input className={control} name="display_name" maxLength={160} defaultValue={row.display_name} required /></Field><Field label={c.email}><input className={control} type="email" name="email" maxLength={254} defaultValue={row.email ?? ''} required /></Field>
          <Field label={c.street}><input className={control} name="street" maxLength={250} defaultValue={row.street ?? ''} /></Field><Field label={c.postal}><input className={control} name="postal_code" maxLength={30} defaultValue={row.postal_code ?? ''} /></Field><Field label={c.city}><input className={control} name="city" maxLength={160} defaultValue={row.city ?? ''} /></Field>
        </div>
      </>}
      <button className={primary} type="submit">{mode === 'existing' ? c.connect : c.newPerson}</button>
    </fieldset></form>}
  </details>
}

function Product({ row, data, c, lang, busy, run }: DeskProps & { row: CertificateAdminData['products'][number] }) {
  const existing = data.productCourses.filter(map => map.product_id === row.id)
  const [selected, setSelected] = useState(existing.map(map => map.course_id))
  return <details className={panel}><summary className="cursor-pointer py-1 font-semibold">{row.name} <span className="text-sm font-normal text-[var(--muted)]">· {row.article_number} · {certificateStatus(row.review_status, c)}</span></summary>
    <form className="mt-4" onSubmit={async event => { event.preventDefault(); const fields = new FormData(event.currentTarget); await run({ command: 'map_product', payload: { id: row.id, course_ids: selected, title: String(fields.get('title')).trim(), description: String(fields.get('description')).trim() } }) }}><fieldset disabled={busy} className="space-y-4">
      <p className="text-sm text-[var(--muted)]">{c.productHint}</p>
      <fieldset className="grid gap-2 md:grid-cols-2"><legend className="mb-2 text-sm font-medium">{c.course}</legend>{data.courses.map(course => <label className="flex min-h-11 items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-sm" key={course.id}><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={selected.includes(course.id)} onChange={event => setSelected(values => event.target.checked ? [...values, course.id] : values.filter(value => value !== course.id))} /><span>{courseName(data, course.id, lang)}<span className="block text-xs text-[var(--muted)]">{course.end_date ? ` · ${c.end}: ${course.end_date}` : ''}</span></span></label>)}</fieldset>
      <Field label={c.titleText}><input className={control} name="title" maxLength={180} defaultValue={existing[0]?.certificate_title ?? row.name} required /></Field>
      <Field label={c.description}><textarea className={control} rows={4} name="description" maxLength={6000} defaultValue={existing[0]?.certificate_description ?? ''} /></Field>
      <button className={primary} type="submit" disabled={!selected.length}>{c.productMap}</button>
    </fieldset></form>
  </details>
}

function Invoice({ invoice, ...props }: DeskProps & { invoice: CertificateAdminData['invoices'][number] }) {
  const { data, c, lang, busy, run } = props
  const [relatedId, setRelatedId] = useState('')
  const [relation, setRelation] = useState<'cancels' | 'replaces'>('replaces')
  const customer = data.customers.find(row => row.id === invoice.external_customer_id)
  const allowedProducts = data.products.filter(product => invoice.article_numbers.includes(product.article_number) && product.review_status === 'resolved')
  const allowedCourses = data.courses.filter(course => data.productCourses.some(mapping => mapping.course_id === course.id && allowedProducts.some(product => product.id === mapping.product_id)))
  const allocations = data.allocations.filter(row => row.invoice_id === invoice.id)
  const currency = (value: number) => new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR' }).format(value)
  const relatedOptions = data.invoices.filter(row => row.id !== invoice.id && row.external_customer_id === invoice.external_customer_id)
  return <div className="space-y-4">
    <section className={`${panel} space-y-4`}><div><h2 className="text-lg font-semibold">{invoice.invoice_number} · {customer?.display_name ?? invoice.customer_number}</h2><p className="mt-1 text-sm text-[var(--muted)]">{c.invoiceHint}</p></div>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[[c.status, certificateStatus(invoice.payment_status, c)], [c.gross, currency(invoice.gross_amount)], [c.paidAmount, currency(invoice.paid_amount)], [c.discount, currency(invoice.discount_amount)]].map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--muted)]">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>)}</dl>
      <p className="break-words text-sm">{c.products}: {invoice.article_numbers.join(', ') || '—'}</p>
      {invoice.review_reason && <p className="text-sm text-amber-800 dark:text-amber-200">{certificateReason(invoice.review_reason, lang)}</p>}
      <form onSubmit={async event => { event.preventDefault(); const fields = new FormData(event.currentTarget); await run({ command: 'resolve_invoice', payload: { id: invoice.id, service_month: `${fields.get('month')}-01`, validity: fields.get('validity') as 'valid' | 'cancelled' | 'replaced' | 'review' } }) }}><fieldset disabled={busy} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label={c.serviceMonth}><input className={control} name="month" type="month" defaultValue={invoice.service_month?.slice(0, 7) ?? ''} required /></Field><Field label={c.validity}><select className={control} name="validity" defaultValue={invoice.validity}>{['valid', 'cancelled', 'replaced', 'review'].map(status => <option key={status} value={status}>{certificateStatus(status, c)}</option>)}</select></Field><button className={primary} type="submit">{c.save}</button>
      </fieldset></form>
    </section>
    <section className={`${panel} space-y-4`}><h3 className="font-semibold">{c.relations}</h3><p className="text-sm text-[var(--muted)]">{c.relationHint}</p>
      {data.invoiceRelations.filter(row => row.original_invoice_id === invoice.id || row.related_invoice_id === invoice.id).map(row => <p className="text-sm" key={row.id}>{data.invoices.find(item => item.id === row.related_invoice_id)?.invoice_number} → {data.invoices.find(item => item.id === row.original_invoice_id)?.invoice_number}: {row.relation_type === 'replaces' ? c.replaces : c.cancels} · <strong className={row.confirmed ? '' : 'text-[var(--danger)]'}>{row.confirmed ? c.confirmed : c.review}</strong></p>)}
      <form onSubmit={async event => { event.preventDefault(); if (await run({ command: 'relate_invoice', payload: { original: invoice.id, related: relatedId, type: relation } })) setRelatedId('') }}><fieldset disabled={busy} className="space-y-3"><p className="text-sm">{c.original}: <strong>{invoice.invoice_number}</strong></p><div className="grid gap-3 md:grid-cols-2">
        <Field label={c.related}><select className={control} value={relatedId} onChange={event => setRelatedId(event.target.value)} required><option value="">{c.select}</option>{relatedOptions.map(row => <option key={row.id} value={row.id}>{row.invoice_number} · {row.invoice_date} · {row.document_type === 'cancellation' ? c.document_cancellation : row.document_type === 'credit_note' ? c.document_credit_note : row.document_type === 'unknown' ? c.document_unknown : c.document_invoice} · {currency(row.gross_amount)}</option>)}</select></Field><Field label={c.relation}><select className={control} value={relation} onChange={event => setRelation(event.target.value as 'cancels' | 'replaces')}><option value="replaces">{c.replaces}</option><option value="cancels">{c.cancels}</option></select></Field>
      </div><button className={button} type="submit" disabled={!relatedId}>{c.relate}</button></fieldset></form>
    </section>
    <section className={`${panel} space-y-4`}><h3 className="font-semibold">{c.allocations}</h3><p className="text-sm text-[var(--muted)]">{c.allocationHint}</p>
      {!customer?.person_id || !invoice.service_month || !allowedCourses.length ? <p className="text-sm text-amber-800 dark:text-amber-200">{c.noMappedCourses}</p> : <>
        {allocations.map(row => <Allocation key={`${row.id}:${row.source_revision}`} allocation={row} invoice={invoice} allowedCourses={allowedCourses} {...props} />)}
        {!['cancelled', 'replaced'].includes(invoice.validity) && <details className="rounded-lg border border-[var(--border)] p-3"><summary className="cursor-pointer py-2 text-sm font-medium">{c.addAllocation}</summary><Allocation invoice={invoice} allowedCourses={allowedCourses} {...props} /></details>}
      </>}
    </section>
  </div>
}
function Allocation({ allocation, invoice, allowedCourses, data, c, lang, busy, run }: DeskProps & { allocation?: CertificateAdminData['allocations'][number]; invoice: CertificateAdminData['invoices'][number]; allowedCourses: CertificateAdminData['courses'] }) {
  const [course, setCourse] = useState(allocation?.course_id ?? '')
  const [start, setStart] = useState(allocation?.start_date ?? invoice.service_month ?? '')
  const [end, setEnd] = useState(allocation?.end_date ?? (invoice.service_month ? monthEnd(invoice.service_month) : ''))
  const [status, setStatus] = useState<'confirmed' | 'excluded'>(allocation?.status === 'excluded' ? 'excluded' : 'confirmed')
  return <form className="space-y-3 rounded-lg border border-[var(--border)] p-3" onSubmit={async event => { event.preventDefault(); await run({ command: 'allocate', payload: { ...(allocation ? { id: allocation.id } : {}), invoice_id: invoice.id, course_id: course, start, end, status } }) }}><fieldset disabled={busy} className="space-y-3">
    {allocation && <p className="text-sm font-medium">{courseName(data, allocation.course_id, lang)} · {certificateStatus(allocation.status, c)}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label={c.course}><select className={control} value={course} onChange={event => setCourse(event.target.value)} required><option value="">{c.select}</option>{allowedCourses.map(row => <option key={row.id} value={row.id}>{courseName(data, row.id, lang)}</option>)}</select></Field><Field label={c.start}><input className={control} type="date" min={invoice.service_month ?? undefined} max={invoice.service_month ? monthEnd(invoice.service_month) : undefined} value={start} onChange={event => setStart(event.target.value)} required /></Field><Field label={c.end}><input className={control} type="date" min={start} max={invoice.service_month ? monthEnd(invoice.service_month) : undefined} value={end} onChange={event => setEnd(event.target.value)} required /></Field><Field label={c.status}><select className={control} value={status} onChange={event => setStatus(event.target.value as 'confirmed' | 'excluded')}><option value="confirmed">{c.include}</option><option value="excluded">{c.exclude}</option></select></Field></div>
    <button className={button} type="submit">{allocation ? c.update : c.addAllocation}</button>
  </fieldset></form>
}
