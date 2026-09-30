'use client'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, FileText, Loader2, Search, ExternalLink, CheckCircle2, X } from 'lucide-react'
import { confirmRegistration, declineRegistration, saveManualInvoiceStatus } from '@/app/actions/admin-registrations'
import AdminDialog from './AdminDialog'
import { registrationLabels } from '@/lib/admin-registration-i18n'
import { formatCourseQuantity } from '@/lib/course-quantity-i18n'
import { invoiceQueue } from '@/lib/admin-invoice-queue'
import { formatProfileMonth } from '@/lib/profile-month'
import { Badge, Card, EmptyState, Notice, PageHeader, adminButton, adminChip, adminInput, adminLabel, type AdminTone } from './ui'
import type { RegistrationOverview, StaffRegistration, StaffInvoice } from '@/lib/types/admin-registrations'

const primary = adminButton('primary')
const declineControl = adminButton('danger')
const secondary = adminButton('secondary')
function displayDate(value: string|null, lang:string) {if(!value)return '—'; const date = new Date(value.includes('T')?value:`${value}T12:00:00Z`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(date)}

export default function RegistrationDesk({ initial, lang, mode, notice }: { initial: RegistrationOverview; lang:string; mode:'registrations'|'invoices'; notice?: ReactNode }) {
  const t=registrationLabels(lang)
  const router=useRouter()
  const [rows,setRows]=useState(initial.registrations)
  const [invoices,setInvoices]=useState(initial.invoices)
  const [loaded,setLoaded]=useState(initial)
  // A server refresh may carry recalculated prices after a cancellation or
  // confirmation. Keep the filter/search while adopting the fresh snapshot.
  if(loaded!==initial){setLoaded(initial);setRows(initial.registrations);setInvoices(initial.invoices)}
  const [filter,setFilter]=useState(mode==='registrations'?'pending':'outstanding')
  const [search,setSearch]=useState('')
  const [message,setMessage]=useState<string|null>(null)
  const [failed,setFailed]=useState(false)
  const [pending,startTransition]=useTransition()
  const [pendingId,setPendingId]=useState<string|null>(null)
  const [declineRow,setDeclineRow]=useState<StaffRegistration|null>(null)
  const [declineError,setDeclineError]=useState<string|null>(null)
  const month=initial.targetMonth
  const eligible=mode==='invoices'?invoiceQueue(rows,invoices,month):rows
  const counts={pending:rows.filter(row=>row.status==='pending').length,outstanding:invoiceQueue(rows,invoices,month).filter(row=>!invoices.some(invoice=>invoice.source===row.source && invoice.sourceId===row.id && invoice.status==='created' && !invoice.calendarAdjustmentAmount)).length}
  const filtered=useMemo(()=>eligible.filter(row=>{
    const invoice=invoices.find(item=>item.source===row.source && item.sourceId===row.id)
    const matches=filter==='all'||(mode==='registrations'?row.status===filter:(invoice?.status??'outstanding')===filter||(filter==='outstanding'&&!!invoice?.calendarAdjustmentAmount))
    return matches&&`${row.contact.name} ${row.contact.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())
  }),[eligible,invoices,filter,mode,search])
  function accept(row:StaffRegistration) {
    setPendingId(row.id);setMessage(null)
    startTransition(async()=>{try {const result=await confirmRegistration({source:row.source,id:row.id});if(!result.success)throw new Error('save_failed');setRows(current=>current.map(item=>item.id===row.id&&item.source===row.source?{...item,status:'confirmed'}:item));setMessage(t.accepted);setFailed(false);router.refresh()}catch {setMessage(t.save_failed);setFailed(true)}finally{setPendingId(null)}})
  }
  function decline(row:StaffRegistration) {
    if(pending)return
    setPendingId(row.id);setDeclineError(null);setMessage(null)
    startTransition(async()=>{
      try {
        const result=await declineRegistration({source:row.source,id:row.id})
        if(result.success===false){setDeclineError(result.error==='conflict'?t.decline_changed:t.save_failed);return}
        setRows(current=>current.map(item=>item.id===row.id&&item.source===row.source?{...item,status:'cancelled'}:item))
        setDeclineRow(null);setMessage(t.decline_success);setFailed(false);router.refresh()
      }catch{setDeclineError(t.save_failed)}finally{setPendingId(null)}
    })
  }
  function invoiceStatus(row:StaffRegistration,created:boolean,reference:string) {
    setPendingId(row.id);setMessage(null)
    startTransition(async()=>{try {const result=await saveManualInvoiceStatus({source:row.source,id:row.id,month,created,reference});if(!result.success)throw new Error('save_failed');setInvoices(current=>[...current.filter(item=>!(item.source===row.source&&item.sourceId===row.id)),{source:row.source,sourceId:row.id,month,status:created?'created':'outstanding',reference:created?reference:null,createdAt:created?new Date().toISOString():null}]);setMessage(t.saved);setFailed(false);router.refresh()}catch {setMessage(t.save_failed);setFailed(true)}finally{setPendingId(null)}})
  }
  const filterValues=(mode==='registrations'?['pending','confirmed','cancelled','all']:['outstanding','created','all']) as Array<'pending'|'confirmed'|'cancelled'|'all'|'outstanding'|'created'>
  const highlighted=mode==='registrations'?'pending':'outstanding'
  return <div className="min-w-0 space-y-5 [overflow-wrap:anywhere] sm:space-y-6">
    <PageHeader eyebrow={formatProfileMonth(month,lang)} title={mode==='registrations'?t.registrations_title:t.invoices_title} description={mode==='registrations'?t.registrations_intro:t.invoices_intro}
      actions={mode==='invoices'?<a href="https://www.papierkram.de/" target="_blank" rel="noopener noreferrer" className={secondary}><ExternalLink size={16} aria-hidden="true"/>{t.open_papierkram}</a>:undefined}/>
    {mode==='invoices'&&<Notice tone="info">{t.invoice_note}</Notice>}
    {notice}
    <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-end">
      <label className="block min-w-0"><span className={adminLabel}>{t.search}</span><span className="relative block"><Search aria-hidden="true" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input className={`${adminInput} pl-9`} type="search" value={search} onChange={event=>setSearch(event.target.value)}/></span></label>
      <label className="block min-w-0"><span className={adminLabel}>{t.month}</span><input type="month" className={adminInput} value={month.slice(0,7)} onChange={event=>{if(/^\d{4}-\d{2}$/.test(event.target.value))router.push(`/${lang}/admin/${mode}?month=${event.target.value}`)}}/></label>
    </div>
    <div className="admin-scroll-x -mx-1 flex gap-2 px-1" role="group" aria-label={mode==='registrations'?t.registrations_title:t.invoices_title}>{filterValues.map(value=><button key={value} type="button" onClick={()=>setFilter(value)} aria-pressed={filter===value} className={adminChip(filter===value)}>{t[value]}{value===highlighted&&<span aria-hidden="true" className="tabular-nums opacity-80">{counts[highlighted]}</span>}</button>)}</div>
    {message&&<Notice tone={failed?'danger':'success'} role={failed?'alert':'status'}>{message}</Notice>}
    {filtered.length===0?<Card><EmptyState icon={CheckCircle2} title={t.empty}/></Card>:<div className="space-y-3">{filtered.map(row=><RegistrationCard key={`${row.source}:${row.id}`} row={row} invoice={invoices.find(item=>item.source===row.source&&item.sourceId===row.id)} lang={lang} mode={mode} busy={pending&&pendingId===row.id} disabled={pending} onAccept={()=>accept(row)} onDecline={()=>{setDeclineError(null);setDeclineRow(row)}} onInvoice={(created,reference)=>invoiceStatus(row,created,reference)}/>)}</div>}
    {declineRow&&<AdminDialog title={declineRow.isTrial?t.decline_trial_title:t.decline_title} subtitle={declineRow.contact.name} dismissible={!pending} onClose={()=>{if(!pending)setDeclineRow(null)}}>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
        <p className="text-sm leading-relaxed text-[var(--muted)]">{t.decline_description}</p>
        <div className="rounded-lg bg-[var(--surface-muted)] p-4 text-sm">
          <p className="break-words font-semibold">{declineRow.contact.email}</p>
          <ul className="mt-2 space-y-1">{declineRow.courses.map(course=><li key={course.id}>{course.title}</li>)}</ul>
          <p className="mt-2 text-[var(--muted)]">{t.start}: {displayDate(declineRow.startDate,lang)}</p>
        </div>
        {declineError&&<Notice tone="danger" role="alert">{declineError}</Notice>}
      </div>
      <footer className="flex shrink-0 flex-col gap-2 border-t border-[var(--admin-line)] px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" className={secondary} disabled={pending} onClick={()=>setDeclineRow(null)}>{t.keep_pending}</button>
        <button type="button" className={declineControl} disabled={pending} aria-busy={pending} onClick={()=>decline(declineRow)}>{pending?<Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true"/>:<X size={16} aria-hidden="true"/>}{pending?t.saving:t.decline_confirm}</button>
      </footer>
    </AdminDialog>}
  </div>
}

function RegistrationCard({row,invoice,lang,mode,busy,disabled,onAccept,onDecline,onInvoice}:{row:StaffRegistration;invoice?:StaffInvoice;lang:string;mode:'registrations'|'invoices';busy:boolean;disabled:boolean;onAccept:()=>void;onDecline:()=>void;onInvoice:(created:boolean,reference:string)=>void}) {
  const t=registrationLabels(lang)
  const [reference,setReference]=useState(invoice?.reference ?? '')
  const currency=(amount:number)=>new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}).format(amount)
  const status=mode==='invoices'?(invoice?.status??'outstanding'):row.status
  const tone:AdminTone=status==='created'||status==='confirmed'?'success':status==='cancelled'||status==='rejected'?'danger':'warning'
  const kind=row.isTrial?t.trial:row.source==='registration'?t.registration:t.monthly
  return <Card as="article">
    <div className="flex min-w-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] px-4 py-3 sm:px-5"><div className="min-w-0"><p className="text-xs font-medium text-[var(--muted)]">{kind}</p><h2 className="break-words text-[0.9375rem] font-semibold">{row.contact.name}</h2><a href={`mailto:${row.contact.email}`} className="inline-flex min-h-11 items-center break-all text-sm text-[var(--muted)] underline-offset-4 hover:underline">{row.contact.email}</a></div><Badge tone={tone} className="shrink-0">{t[status]}</Badge></div>
    <div className="grid min-w-0 gap-5 px-4 py-4 sm:px-5 lg:grid-cols-2">
      <section className="min-w-0 text-sm"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t.contact}</h3><p className="leading-relaxed">{row.contact.street??t.unspecified}<br/>{[row.contact.zip,row.contact.city].filter(Boolean).join(' ')}</p>{row.contact.phone&&<a href={`tel:${row.contact.phone}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">{row.contact.phone}</a>}<dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1.5"><dt className="text-[var(--muted)]">{t.birthday}</dt><dd>{row.contact.birthDate??t.unspecified}</dd><dt className="text-[var(--muted)]">{t.start}</dt><dd>{displayDate(row.startDate,lang)}</dd>{row.createdAt&&<><dt className="text-[var(--muted)]">{t.registered}</dt><dd>{displayDate(row.createdAt,lang)}</dd></>}</dl></section>
      <section className="min-w-0 text-sm"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t.courses}</h3><ul className="divide-y divide-[var(--admin-line)] rounded-lg border border-[var(--admin-line)]">{row.courses.map(course=><li key={course.id} className="flex justify-between gap-3 px-3 py-2.5"><span className="min-w-0">{course.title}<span className="mt-0.5 block text-xs text-[var(--muted)]">{formatCourseQuantity(course.units,course.unitMinutes,lang)} · {currency(course.unitPrice)}</span></span><span className="shrink-0 font-semibold tabular-nums">{currency(course.amount)}</span></li>)}</ul>{row.totalPrice!==null&&<p className="mt-3 flex flex-wrap justify-between gap-2 text-[var(--muted)]"><span>{t.total}</span><strong className="text-base tabular-nums text-[var(--foreground)]">{currency(row.totalPrice)}</strong></p>}</section>
    </div>
    {row.consents&&mode==='registrations'&&<details className="border-t border-[var(--admin-line)] px-4 sm:px-5"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium text-[var(--muted)]">{t.consent}</summary><dl className="grid gap-2 pb-4 text-sm sm:grid-cols-2">{[['privacy',row.consents.privacy],['terms',row.consents.agb],['revocation',row.consents.revocation],['recording',row.consents.recording]].map(([key,value])=><div key={String(key)} className="flex justify-between gap-3"><dt>{t[key as 'privacy'|'terms'|'revocation'|'recording']}</dt><dd>{value===null?t.unspecified:value?t.yes:t.no}</dd></div>)}</dl></details>}
    <footer className="flex flex-col gap-3 border-t border-[var(--admin-line)] bg-[var(--surface-muted)] px-4 py-3 sm:px-5">
      {mode==='invoices'&&invoice?.status==='created'&&!!invoice.calendarAdjustmentAmount&&<Notice tone="warning" role="status">{t.calendar_correction.replace('{difference}',currency(invoice.calendarAdjustmentAmount)).replace('{total}',currency((row.totalPrice??0)+invoice.calendarAdjustmentAmount))}</Notice>}
      {mode==='registrations'&&row.status==='pending'&&<div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onDecline} disabled={disabled||invoice?.status==='created'} className={declineControl}><X size={16} aria-hidden="true"/>{t.decline}</button><button type="button" onClick={onAccept} disabled={disabled} aria-busy={busy} className={primary}>{busy?<Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true"/>:<Check size={16} aria-hidden="true"/>}{busy?t.saving:t.accept}</button></div>}
      {mode==='registrations'&&row.status==='confirmed'&&<Link href={`/${lang}/admin/invoices?month=${row.targetMonth.slice(0,7)}`} className={adminButton('secondary','sm','w-full sm:w-fit')}><FileText size={16} aria-hidden="true"/>{t.invoices_title}</Link>}
      {mode==='invoices'&&(invoice?.status==='created'?<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><p className="text-sm text-[var(--muted)]">{invoice.reference&&<strong className="mr-3 text-[var(--foreground)]">{invoice.reference}</strong>}{displayDate(invoice.createdAt,lang)}</p><button type="button" disabled={disabled} onClick={()=>onInvoice(false,'')} className={secondary}>{busy?t.saving:t.reopen}</button></div>:<form onSubmit={event=>{event.preventDefault();onInvoice(true,reference)}} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end"><label className="block min-w-0 flex-1"><span className={adminLabel}>{t.reference}</span><input className={adminInput} value={reference} maxLength={120} onChange={event=>setReference(event.target.value)}/></label><button type="submit" disabled={disabled||row.status!=='confirmed'} aria-busy={busy} className={primary}>{busy?<Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true"/>:<Check size={16} aria-hidden="true"/>}{busy?t.saving:t.save}</button></form>)}
    </footer>
  </Card>
}
