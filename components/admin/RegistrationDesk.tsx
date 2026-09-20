'use client'
import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, FileText, Loader2, Search, UserRound, ExternalLink, CheckCircle2, X } from 'lucide-react'
import { confirmRegistration, declineRegistration, saveManualInvoiceStatus } from '@/app/actions/admin-registrations'
import AdminDialog from './AdminDialog'
import { registrationLabels } from '@/lib/admin-registration-i18n'
import { formatCourseQuantity } from '@/lib/course-quantity-i18n'
import { invoiceQueue } from '@/lib/admin-invoice-queue'
import { formatProfileMonth } from '@/lib/profile-month'
import type { RegistrationOverview, StaffRegistration, StaffInvoice } from '@/lib/types/admin-registrations'

const control = 'min-h-12 min-w-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'
const primary = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-[var(--accent-foreground)] transition-opacity hover:bg-[var(--accent-hover)] disabled:opacity-50'
const declineControl = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-300 bg-[var(--surface)] px-5 py-3 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950'
function displayDate(value: string|null, lang:string) {if(!value)return '—'; const date = new Date(value.includes('T')?value:`${value}T12:00:00Z`);return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat(lang,{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(date)}

export default function RegistrationDesk({ initial, lang, mode }: { initial: RegistrationOverview; lang:string; mode:'registrations'|'invoices' }) {
  const t=registrationLabels(lang)
  const router=useRouter()
  const [rows,setRows]=useState(initial.registrations)
  const [invoices,setInvoices]=useState(initial.invoices)
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
  const counts={pending:rows.filter(row=>row.status==='pending').length,outstanding:invoiceQueue(rows,invoices,month).filter(row=>!invoices.some(invoice=>invoice.source===row.source && invoice.sourceId===row.id && invoice.status==='created')).length}
  const filtered=useMemo(()=>eligible.filter(row=>{
    const invoice=invoices.find(item=>item.source===row.source && item.sourceId===row.id)
    const matches=filter==='all'||(mode==='registrations'?row.status===filter:(invoice?.status??'outstanding')===filter)
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
  return <div className="mx-auto w-full min-w-0 max-w-6xl space-y-7 [overflow-wrap:anywhere]">
    <header className="flex flex-col gap-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="max-w-2xl"><p className="mb-3 text-sm font-semibold tracking-wider text-[var(--violet)]">{formatProfileMonth(month,lang)}</p><h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">{mode==='registrations'?t.registrations_title:t.invoices_title}</h1><p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{mode==='registrations'?t.registrations_intro:t.invoices_intro}</p></div>
        {mode==='invoices'&&<a href="https://www.papierkram.de/" target="_blank" rel="noopener noreferrer" className={`${control} inline-flex shrink-0 items-center justify-center gap-2`}><ExternalLink size={18} aria-hidden="true"/>{t.open_papierkram}</a>}
      </div>
      <nav className="flex flex-wrap gap-3" aria-label={t.registrations_title}>
        <Link href={`/${lang}/admin/registrations`} className={`${control} inline-flex items-center gap-2 ${mode==='registrations'?'border-[var(--violet)] font-bold':''}`} aria-current={mode==='registrations'?'page':undefined}><UserRound size={18} aria-hidden="true"/>{t.registrations_title}<span className="rounded-full bg-[var(--canvas)] px-2">{counts.pending}</span></Link>
        <Link href={`/${lang}/admin/invoices?month=${month.slice(0,7)}`} className={`${control} inline-flex items-center gap-2 ${mode==='invoices'?'border-[var(--violet)] font-bold':''}`} aria-current={mode==='invoices'?'page':undefined}><FileText size={18} aria-hidden="true"/>{t.invoices_title}<span className="rounded-full bg-[var(--canvas)] px-2">{counts.outstanding}</span></Link>
      </nav>
      {mode==='invoices'&&<p className="rounded-2xl bg-[var(--canvas)] px-4 py-3 text-sm leading-relaxed text-[var(--muted)]">{t.invoice_note}</p>}
    </header>
    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
      <label className="min-w-0 flex-1"><span className="mb-2 block text-sm font-semibold text-[var(--muted)]">{t.search}</span><span className="relative block"><Search aria-hidden="true" size={20} className="pointer-events-none absolute left-4 top-4 text-[var(--muted)]"/><input className={`${control} w-full pl-12`} type="search" value={search} onChange={event=>setSearch(event.target.value)}/></span></label>
      <label className="min-w-0 sm:w-52"><span className="mb-2 block text-sm font-semibold text-[var(--muted)]">{t.month}</span><input type="month" className={`${control} w-full`} value={month.slice(0,7)} onChange={event=>{if(/^\d{4}-\d{2}$/.test(event.target.value))router.push(`/${lang}/admin/${mode}?month=${event.target.value}`)}}/></label>
    </div>
    <div className="flex flex-wrap gap-2" aria-label={mode==='registrations'?t.registrations_title:t.invoices_title}>{(mode==='registrations'?['pending','confirmed','cancelled','all']:['outstanding','created','all']).map(value=><button key={value} type="button" onClick={()=>setFilter(value)} aria-pressed={filter===value} className={`${control} ${filter===value?'border-[var(--violet)] bg-[var(--violet)]/10 font-bold':''}`}>{t[value as 'pending'|'confirmed'|'cancelled'|'all'|'outstanding'|'created']}</button>)}</div>
    {message&&<p role={failed?'alert':'status'} className={`rounded-2xl border px-5 py-4 ${failed?'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200':'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>{message}</p>}
    {filtered.length===0?<div className="rounded-3xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]"><CheckCircle2 className="mx-auto mb-4 text-[var(--violet)]" size={36} aria-hidden="true"/><p>{t.empty}</p></div>:<div className="space-y-5">{filtered.map(row=><RegistrationCard key={`${row.source}:${row.id}`} row={row} invoice={invoices.find(item=>item.source===row.source&&item.sourceId===row.id)} lang={lang} mode={mode} busy={pending&&pendingId===row.id} disabled={pending} onAccept={()=>accept(row)} onDecline={()=>{setDeclineError(null);setDeclineRow(row)}} onInvoice={(created,reference)=>invoiceStatus(row,created,reference)}/>)}</div>}
    {declineRow&&<AdminDialog title={declineRow.isTrial?t.decline_trial_title:t.decline_title} subtitle={declineRow.contact.name} dismissible={!pending} onClose={()=>{if(!pending)setDeclineRow(null)}}>
      <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5 sm:p-6">
        <p className="text-base leading-relaxed text-[var(--muted)]">{t.decline_description}</p>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--canvas)] p-4">
          <p className="break-words font-semibold">{declineRow.contact.email}</p>
          <ul className="mt-3 space-y-2">{declineRow.courses.map(course=><li key={course.id}>{course.title}</li>)}</ul>
          <p className="mt-3 text-[var(--muted)]">{t.start}: {displayDate(declineRow.startDate,lang)}</p>
        </div>
        {declineError&&<p role="alert" className="rounded-xl border border-red-300 p-4 text-red-700 dark:border-red-800 dark:text-red-300">{declineError}</p>}
      </div>
      <footer className="flex shrink-0 flex-col gap-3 border-t border-[var(--border)] p-5 sm:flex-row sm:justify-end sm:p-6">
        <button type="button" className={control} disabled={pending} onClick={()=>setDeclineRow(null)}>{t.keep_pending}</button>
        <button type="button" className={declineControl} disabled={pending} aria-busy={pending} onClick={()=>decline(declineRow)}>{pending?<Loader2 size={18} className="animate-spin" aria-hidden="true"/>:<X size={18} aria-hidden="true"/>}{pending?t.saving:t.decline_confirm}</button>
      </footer>
    </AdminDialog>}
  </div>
}

function RegistrationCard({row,invoice,lang,mode,busy,disabled,onAccept,onDecline,onInvoice}:{row:StaffRegistration;invoice?:StaffInvoice;lang:string;mode:'registrations'|'invoices';busy:boolean;disabled:boolean;onAccept:()=>void;onDecline:()=>void;onInvoice:(created:boolean,reference:string)=>void}) {
  const t=registrationLabels(lang)
  const [reference,setReference]=useState(invoice?.reference ?? '')
  const currency=(amount:number)=>new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}).format(amount)
  const status=mode==='invoices'?(invoice?.status??'outstanding'):row.status
  return <article className="min-w-0 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
    <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div className="min-w-0"><p className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{row.isTrial?t.trial:row.source==='registration'?t.registration:t.monthly}</p><h2 className="text-xl font-bold text-[var(--foreground)]">{row.contact.name}</h2><a href={`mailto:${row.contact.email}`} className="inline-flex min-h-12 items-center text-[var(--muted)] underline underline-offset-4">{row.contact.email}</a></div><span className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${status==='created'||status==='confirmed'?'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':status==='cancelled'||status==='rejected'?'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200':'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>{t[status]}</span></div>
    <div className="grid min-w-0 gap-6 p-5 sm:p-7 lg:grid-cols-2">
      <section className="min-w-0"><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{t.contact}</h3><p className="leading-relaxed text-[var(--foreground)]">{row.contact.street??t.unspecified}<br/>{[row.contact.zip,row.contact.city].filter(Boolean).join(' ')}</p>{row.contact.phone&&<a href={`tel:${row.contact.phone}`} className="inline-flex min-h-12 items-center text-[var(--foreground)] underline underline-offset-4">{row.contact.phone}</a>}<dl className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"><dt className="text-[var(--muted)]">{t.birthday}</dt><dd>{row.contact.birthDate??t.unspecified}</dd><dt className="text-[var(--muted)]">{t.start}</dt><dd>{displayDate(row.startDate,lang)}</dd>{row.createdAt&&<><dt className="text-[var(--muted)]">{t.registered}</dt><dd>{displayDate(row.createdAt,lang)}</dd></>}</dl></section>
      <section className="min-w-0"><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">{t.courses}</h3><ul className="space-y-2">{row.courses.map(course=><li key={course.id} className="flex justify-between gap-3 rounded-xl bg-[var(--canvas)] p-3 text-[var(--foreground)]"><span>{course.title}<span className="mt-1 block text-sm text-[var(--muted)]">{formatCourseQuantity(course.units,course.unitMinutes,lang)} · {currency(course.unitPrice)}</span></span><span className="shrink-0 font-semibold">{currency(course.amount)}</span></li>)}</ul>{row.totalPrice!==null&&<p className="mt-4 flex flex-wrap justify-between gap-2 text-sm text-[var(--muted)]"><span>{t.total}</span><strong className="text-base text-[var(--foreground)]">{currency(row.totalPrice)}</strong></p>}</section>
    </div>
    {row.consents&&mode==='registrations'&&<details className="border-t border-[var(--border)] px-5 sm:px-7"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-[var(--muted)]">{t.consent}</summary><dl className="grid gap-3 pb-5 text-sm sm:grid-cols-2">{[['privacy',row.consents.privacy],['terms',row.consents.agb],['revocation',row.consents.revocation],['recording',row.consents.recording]].map(([key,value])=><div key={String(key)} className="flex justify-between gap-3"><dt>{t[key as 'privacy'|'terms'|'revocation'|'recording']}</dt><dd>{value===null?t.unspecified:value?t.yes:t.no}</dd></div>)}</dl></details>}
    <footer className="flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--canvas)]/50 p-5 sm:p-7">
      {mode==='registrations'&&row.status==='pending'&&<div className="flex flex-wrap gap-3"><button type="button" onClick={onAccept} disabled={disabled} aria-busy={busy} className={primary}>{busy?<Loader2 className="animate-spin" size={18}/>:<Check size={18} aria-hidden="true"/>}{busy?t.saving:t.accept}</button><button type="button" onClick={onDecline} disabled={disabled||invoice?.status==='created'} className={declineControl}><X size={18} aria-hidden="true"/>{t.decline}</button></div>}
      {mode==='registrations'&&row.status==='confirmed'&&<Link href={`/${lang}/admin/invoices`} className={`${control} inline-flex w-fit items-center gap-2`}><FileText size={18} aria-hidden="true"/>{t.invoices_title}</Link>}
      {mode==='invoices'&&(invoice?.status==='created'?<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><p className="text-sm text-[var(--muted)]">{invoice.reference&&<strong className="mr-3 text-[var(--foreground)]">{invoice.reference}</strong>}{displayDate(invoice.createdAt,lang)}</p><button type="button" disabled={disabled} onClick={()=>onInvoice(false,'')} className={control}>{busy?t.saving:t.reopen}</button></div>:<form onSubmit={event=>{event.preventDefault();onInvoice(true,reference)}} className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end"><label className="min-w-0 flex-1"><span className="mb-2 block text-sm font-semibold text-[var(--muted)]">{t.reference}</span><input className={`${control} w-full`} value={reference} maxLength={120} onChange={event=>setReference(event.target.value)}/></label><button type="submit" disabled={disabled||row.status!=='confirmed'} aria-busy={busy} className={primary}>{busy?<Loader2 className="animate-spin" size={18}/>:<Check size={18} aria-hidden="true"/>}{busy?t.saving:t.save}</button></form>)}
    </footer>
  </article>
}
