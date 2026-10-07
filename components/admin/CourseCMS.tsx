'use client'
import {useMemo,useState,useTransition,type ReactNode} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {Plus,Pencil,CalendarDays,CalendarX2,Loader2,Trash2,BookOpen,Power,PowerOff} from 'lucide-react'
import AdminDialog from './AdminDialog'
import {Badge,Card,EmptyState,Notice,PageHeader,adminButton,adminChip,adminInput,adminLabel} from './ui'
import {courseCmsCopy} from '@/lib/course-cms-i18n'
import {courseEditorSchema,type CourseEditor} from '@/lib/business-courses'
import {saveCourse} from '@/app/actions/course-cms'

const fresh=():CourseEditor=>({slug:`course-${crypto.randomUUID().slice(0,8)}`,title:'',description:'',type:'presence',category:'german',level:'',unit_price:0,unit_minutes:45,start_date:'',end_date:'',trial_lessons:true,sort_order:110,archived:false,schedules:[],translations:[],exceptions:[]})
const checkbox='h-5 w-5 shrink-0 accent-[var(--accent-strong)]'
const checkRow='flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-line)] px-3 text-sm font-medium has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60'

function Field({label,children,className}:{label:string;children:ReactNode;className?:string}){
 return <label className={`block min-w-0 ${className??''}`}><span className={adminLabel}>{label}</span>{children}</label>
}
function EditorSection({title,children}:{title:string;children:ReactNode}){
 return <section className="space-y-4"><h3 className="text-sm font-semibold text-[var(--foreground)]">{title}</h3>{children}</section>
}
function berlinToday(){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin'}).format(new Date())}

/**
 * Kurse: sachliche Liste mit Filter „Aktiv/Inaktiv“ und Editor im Dialog. Ein inaktiver Kurs
 * (`courses.archived_at`) verschwindet aus Startseite und Kursanmeldung und ist nicht neu buchbar;
 * der Schalter an jeder Zeile stellt ihn ohne Umweg über den Editor um.
 * Ausfälle werden nicht mehr hier, sondern unter „Kursausfälle“ gepflegt;
 * die Server-Action übernimmt beim Speichern stets die gespeicherten Ausfälle.
 */
export default function CourseCMS({initial,lang,failed}:{initial:CourseEditor[];lang:string;failed:boolean}){
 const t=courseCmsCopy(lang),router=useRouter()
 const [editor,setEditor]=useState<CourseEditor|null>(null)
 const [view,setView]=useState<'active'|'archived'>('active')
 const [error,setError]=useState(false),[saving,startTransition]=useTransition()
 const [switching,setSwitching]=useState<string|null>(null),[switchFailed,setSwitchFailed]=useState(false),[,startSwitch]=useTransition()
 const set=<K extends keyof CourseEditor>(key:K,value:CourseEditor[K])=>setEditor(current=>current?{...current,[key]:value}:null)
 const cancellationsHref=`/${lang}/admin/courses/cancellations`
 const today=useMemo(berlinToday,[])
 const counts={active:initial.filter(course=>!course.archived).length,archived:initial.filter(course=>course.archived).length}
 const visible=initial.filter(course=>view==='archived'?course.archived:!course.archived)
 const money=(value:number)=>new Intl.NumberFormat(lang,{style:'currency',currency:'EUR'}).format(value)
 const weekday=(day:number,style:'long'|'short'='long')=>new Intl.DateTimeFormat(lang,{weekday:style,timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,day)))
 const languageName=(locale:string)=>new Intl.DisplayNames(lang,{type:'language'}).of(locale)??locale

 function open(course:CourseEditor){setError(false);setEditor(structuredClone(course))}
 function save(){
  if(!editor||saving)return
  setError(false)
  const parsed=courseEditorSchema.safeParse(editor)
  if(!parsed.success){setError(true);return}
  startTransition(async()=>{try{const result=await saveCourse(parsed.data);if(!result.success)throw new Error('save_failed');setEditor(null);router.refresh()}catch{setError(true)}})
 }
 /** Stellt einen gespeicherten Kurs um; alle übrigen Kursdaten gehen unverändert zurück. */
 function toggle(course:CourseEditor){
  if(!course.id||switching)return
  const parsed=courseEditorSchema.safeParse({...course,archived:!course.archived})
  setSwitchFailed(!parsed.success)
  if(!parsed.success)return
  setSwitching(course.id)
  startSwitch(async()=>{try{const result=await saveCourse(parsed.data);if(!result.success)throw new Error('save_failed');router.refresh()}catch{setSwitchFailed(true)}finally{setSwitching(null)}})
 }

 return <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
  <PageHeader title={t.title} description={t.intro} actions={<button type="button" className={adminButton('primary')} onClick={()=>open(fresh())}><Plus size={17} aria-hidden="true"/>{t.add}</button>}/>
  <div className="admin-scroll-x -mx-1 flex gap-2 px-1" role="group" aria-label={t.filterLabel}>
   {(['active','archived'] as const).map(value=><button key={value} type="button" aria-pressed={view===value} onClick={()=>setView(value)} className={adminChip(view===value)}>
    {value==='active'?t.active:t.archived}<span className="tabular-nums opacity-80">{counts[value]}</span>
   </button>)}
  </div>
  <Notice tone="info" action={<Link href={cancellationsHref} className={adminButton('secondary','sm','w-full sm:w-auto')}><CalendarX2 size={16} aria-hidden="true"/>{t.cancellationsLink}</Link>}>{t.cancellationsHint}</Notice>
  {switchFailed&&<Notice tone="warning" role="alert">{t.switchFailed}</Notice>}
  {failed?<Notice tone="warning" role="alert" action={<button type="button" onClick={()=>router.refresh()} className={adminButton('secondary','sm')}>{t.reload}</button>}>{t.failed}</Notice>
  :visible.length===0?<Card><EmptyState icon={BookOpen} title={view==='archived'?t.emptyArchived:t.empty}/></Card>
  :<Card as="div"><ul className="divide-y divide-[var(--admin-line)]">{visible.map(course=>{
    const upcoming=course.exceptions.filter(item=>item.date>=today).length
    return <li key={course.id??course.slug} className="flex min-w-0 items-start gap-3 p-4">
     <div className="min-w-0 flex-1">
      <h2 className="break-words text-[0.9375rem] font-semibold">{course.title}</h2>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
       {course.level&&<Badge tone="info">{course.level}</Badge>}
       <Badge>{t[course.type]}</Badge>
       <Badge>{t[course.category]}</Badge>
       {course.archived&&<Badge tone="warning">{t.archived}</Badge>}
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">{t.perUnit.replace('{price}',money(course.unit_price)).replace('{minutes}',String(course.unit_minutes))}</p>
      {course.schedules.length?<ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">{course.schedules.map((s,i)=><li key={i} className="inline-flex items-center gap-1.5 tabular-nums"><CalendarDays size={14} aria-hidden="true" className="text-[var(--muted)]"/><span><abbr title={weekday(s.weekday)} className="no-underline">{weekday(s.weekday,'short')}</abbr> {s.start_time}–{s.end_time}</span></li>)}</ul>
      :<p className="mt-1.5 text-sm">{t.noTimes}</p>}
      {upcoming>0&&<Link href={cancellationsHref} className="mt-2 inline-flex min-h-11 items-center"><Badge tone="warning"><CalendarX2 size={13} aria-hidden="true"/>{t.upcomingCancellations.replace('{count}',String(upcoming))}</Badge></Link>}
     </div>
     <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
      {course.id&&<button type="button" className={adminButton(course.archived?'primary':'secondary','sm')} disabled={switching!==null} aria-busy={switching===course.id} onClick={()=>toggle(course)}
       aria-label={(course.archived?t.activateAria:t.deactivateAria).replace('{title}',course.title)} title={switching===course.id?t.switching:undefined}>
       {switching===course.id?<Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true"/>:course.archived?<Power size={16} aria-hidden="true"/>:<PowerOff size={16} aria-hidden="true"/>}
       <span className="hidden sm:inline">{course.archived?t.activate:t.deactivate}</span>
      </button>}
      <button type="button" className={adminButton('secondary','sm')} onClick={()=>open(course)} aria-label={t.editAria.replace('{title}',course.title)}><Pencil size={16} aria-hidden="true"/><span className="hidden sm:inline">{t.edit}</span></button>
     </div>
    </li>})}</ul></Card>}
  {editor&&<AdminDialog title={editor.id?t.edit:t.add} subtitle={editor.title} onClose={()=>setEditor(null)} dismissible={!saving}>
   <form onSubmit={e=>{e.preventDefault();save()}} className="flex min-h-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6" data-lenis-prevent>
     <fieldset disabled={saving} className="min-w-0 space-y-7">
      <EditorSection title={t.sectionBasics}>
       <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.name} className="sm:col-span-2"><input required className={adminInput} value={editor.title} maxLength={180} onChange={e=>set('title',e.target.value)}/></Field>
        <Field label={t.type}><select className={adminInput} value={editor.type} onChange={e=>set('type',e.target.value==='online'?'online':'presence')}><option value="presence">{t.presence}</option><option value="online">{t.online}</option></select></Field>
        <Field label={t.category}><select className={adminInput} value={editor.category} onChange={e=>{const category=e.target.value as CourseEditor['category'];setEditor(current=>current?{...current,category,...(category==='private'?{schedules:[],trial_lessons:false}:{})}:null)}}>{(['german','speaking','online','private'] as const).map(value=><option key={value} value={value}>{t[value]}</option>)}</select></Field>
        <Field label={t.level}><input className={adminInput} value={editor.level} maxLength={30} onChange={e=>set('level',e.target.value)}/></Field>
        <Field label={t.slug}><input required className={adminInput} value={editor.slug} pattern="[a-z0-9][a-z0-9_-]{1,99}" onChange={e=>set('slug',e.target.value)}/></Field>
        <Field label={t.description} className="sm:col-span-2"><textarea className={`${adminInput} min-h-28`} rows={4} maxLength={3000} value={editor.description} onChange={e=>set('description',e.target.value)}/></Field>
       </div>
      </EditorSection>
      <EditorSection title={t.sectionPricing}>
       <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.price}><input required className={adminInput} type="number" inputMode="decimal" min={0} step="0.01" value={editor.unit_price} onChange={e=>set('unit_price',Number(e.target.value))}/></Field>
        <Field label={t.minutes}><input required className={adminInput} type="number" inputMode="numeric" min={15} max={180} value={editor.unit_minutes} onChange={e=>set('unit_minutes',Number(e.target.value))}/></Field>
        <Field label={t.start}><input className={adminInput} type="date" value={editor.start_date} onChange={e=>set('start_date',e.target.value)}/></Field>
        <Field label={t.end}><input className={adminInput} type="date" value={editor.end_date} min={editor.start_date} onChange={e=>set('end_date',e.target.value)}/></Field>
        <Field label={t.order}><input required className={adminInput} type="number" inputMode="numeric" min={0} value={editor.sort_order} onChange={e=>set('sort_order',Number(e.target.value))}/></Field>
       </div>
      </EditorSection>
      <EditorSection title={t.sectionOptions}>
       <div className="grid gap-2 sm:grid-cols-2">
        <label className={checkRow}><input type="checkbox" className={checkbox} disabled={editor.category==='private'} checked={editor.trial_lessons} onChange={e=>set('trial_lessons',e.target.checked)}/>{t.trial}</label>
        <label className={checkRow}><input type="checkbox" className={checkbox} checked={editor.archived} onChange={e=>set('archived',e.target.checked)}/>{t.archive}</label>
       </div>
       <p className="text-sm text-[var(--muted)]">{t.archiveHint}</p>
      </EditorSection>
      <EditorSection title={t.schedules}>
       {editor.category==='private'?<p className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted)]">{t.noTimes}</p>:<>
        {editor.schedules.map((s,index)=><div key={index} className="grid gap-3 rounded-lg border border-[var(--admin-line)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
         <Field label={t.weekday}><select className={adminInput} value={s.weekday} onChange={e=>set('schedules',editor.schedules.map((item,i)=>i===index?{...item,weekday:Number(e.target.value)}:item))}>{[1,2,3,4,5,6,7].map(day=><option key={day} value={day}>{weekday(day)}</option>)}</select></Field>
         {(['start_time','end_time'] as const).map(key=><Field key={key} label={key==='start_time'?t.from:t.until}><input required type="time" className={adminInput} value={s[key]} onChange={e=>set('schedules',editor.schedules.map((item,i)=>i===index?{...item,[key]:e.target.value}:item))}/></Field>)}
         <button type="button" className={adminButton('ghost','md','justify-self-start text-[var(--danger)]')} onClick={()=>set('schedules',editor.schedules.filter((_,i)=>i!==index))}><Trash2 size={16} aria-hidden="true"/>{t.remove}</button>
        </div>)}
        <button type="button" className={adminButton('secondary')} onClick={()=>set('schedules',[...editor.schedules,{weekday:1,start_time:'09:00',end_time:'10:30'}])}><Plus size={16} aria-hidden="true"/>{t.addTime}</button>
       </>}
      </EditorSection>
      <EditorSection title={t.translations}>
       <p className="text-sm text-[var(--muted)]">{t.translationHint}</p>
       <div className="divide-y divide-[var(--admin-line)] overflow-hidden rounded-lg border border-[var(--admin-line)]">{(['en','ru','uk','tr'] as const).map(locale=>{const translation=editor.translations.find(item=>item.locale===locale)??{locale,title:'',description:''};const change=(field:'title'|'description',value:string)=>{const next={...translation,[field]:value};set('translations',[...editor.translations.filter(item=>item.locale!==locale),...(next.title?[next]:[])])};return <details key={locale} className="group px-3"><summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">{languageName(locale)}<span aria-hidden="true" className="text-[var(--muted)] transition-transform group-open:rotate-90">›</span></summary><div className="space-y-3 pb-4"><Field label={`${t.name} (${languageName(locale)})`}><input className={adminInput} value={translation.title} onChange={e=>change('title',e.target.value)}/></Field><Field label={`${t.description} (${languageName(locale)})`}><textarea className={`${adminInput} min-h-24`} rows={3} value={translation.description} onChange={e=>change('description',e.target.value)}/></Field></div></details>})}</div>
      </EditorSection>
      <Notice tone="info" action={<Link href={cancellationsHref} className={adminButton('secondary','sm','w-full sm:w-auto')}>{t.cancellationsLink}</Link>}>{t.cancellationsHint}</Notice>
     </fieldset>
    </div>
    <footer className="shrink-0 space-y-3 border-t border-[var(--admin-line)] bg-[var(--surface)] px-4 py-3 sm:px-6">
     {error&&<p role="alert" className="text-sm font-medium text-[var(--danger)]">{t.error}</p>}
     <div className="flex gap-3 sm:justify-end"><button type="button" disabled={saving} className={adminButton('secondary','md','flex-1 sm:flex-none')} onClick={()=>setEditor(null)}>{t.cancel}</button><button type="submit" disabled={saving} className={adminButton('primary','md','flex-1 sm:flex-none')}>{saving&&<Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true"/>}{saving?t.saving:t.save}</button></div>
    </footer>
   </form>
  </AdminDialog>}
 </div>
}
