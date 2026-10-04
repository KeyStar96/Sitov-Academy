'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, BookOpen, Check, Headphones, Map, MessageCircle, Pencil, BarChart3, ChevronRight, Lightbulb } from 'lucide-react'
import { getExamHint, getExamState, getExamCheckpointFeedback, submitExamAnswer, markExamFeedbackViewed, deleteExamSubmission, activateExamFallback } from '@/app/actions/exam-preparation'
import { EXAM_SKILL_LABELS } from '@/lib/exam-preparation/profiles'
import { getExamProgress, getExamUnitProgress, isExamUnitAvailable } from '@/lib/exam-preparation/progression'
import type { ExamActionResult, ExamModule, ExamSkill, ExamState, ExamSubmission, ExamTask, ExamUnit } from '@/lib/exam-preparation/types'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import ExamGraphics from './ExamGraphics'
import ExamSubmissionEditor from './ExamSubmissionEditor'
import ExamProgressCard from './ExamProgressCard'
import ExamWordBox from './ExamWordBox'
import styles from './ExamTrainer.module.css'

const AREAS = [
  {id:'path',label:'Lernen',icon:Map},
  {id:'submissions',label:'Meine Beiträge',icon:MessageCircle},
  {id:'progress',label:'Fortschritt',icon:BarChart3},
] as const
/** Keep existing deep links valid while the visible navigation has only three choices. */
type Area = 'path' | 'practice' | 'submissions' | 'exam' | 'progress'
const skillIcon = (skill: ExamSkill) => skill === 'listening' ? Headphones : skill === 'speaking' ? MessageCircle : skill === 'writing' ? Pencil : BookOpen

export default function ExamTrainer({ lang, initial, modules, workshops, initialArea = 'path', boxLevel, preview = false }: {
  lang: string; initial: ExamState; modules: ExamModule[]; workshops: ExamModule[]; initialLevel?: string; initialArea?: Area; boxLevel: string | null; preview?: boolean
}) {
  const [state,setState] = useState(initial)
  const [area,setArea] = useState<Area>(initialArea)
  const [activeUnit,setActiveUnit] = useState<ExamUnit|null>(null)
  const [skill,setSkill] = useState<ExamSkill>('listening')
  const [practiceCount,setPracticeCount]=useState(4)
  const [error,setError] = useState('')
  const [pending,startTransition] = useTransition()
  const [revision,setRevision] = useState<ExamSubmission|undefined>()
  const simulationHref = `/${lang}/${preview ? 'sitov-preview' : 'dashboard'}/exam-simulation?level=B1`
  const all = [...modules,...workshops]
  const progress = getExamProgress(state,modules,workshops)
  const refresh = async (result?: ExamActionResult) => {
    if (result?.state) setState(result.state)
    else if (!preview) setState(await getExamState())
  }
  const openUnit = (unit: ExamUnit, previous?: ExamSubmission) => {setRevision(previous);setActiveUnit(unit);setError('');window.scrollTo({top:0,behavior:'instant'})}
  if (activeUnit) return <ExamUnitRunner key={`${activeUnit.id}-${revision?.id ?? ''}`} unit={activeUnit} state={state} revision={revision} preview={preview}
    onClose={()=>{setActiveUnit(null);setRevision(undefined)}} onChange={refresh} boxLevel={boxLevel} lang={lang} />
  return <SitovMotionStage className={styles.root} lang="de" translate="no">
    <header className={styles.hero}><div><span className={styles.eyebrow}>Sitov Academy · B1</span>
      <h1>Prüfungsvorbereitung</h1><p>Schritt für Schritt üben und Rückmeldung verstehen.</p></div><ExamGraphics /></header>
    <>
      {(!state.available||preview) && <p className={preview ? styles.previewNotice : styles.warning} role="status">{preview ? 'Vorschau · Eingaben werden nicht gespeichert.' : state.error ?? 'Der Prüfungsfortschritt ist gerade nicht verfügbar. Bitte lade die Seite erneut.'}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <nav className={styles.menu} aria-label="B1-Prüfungstraining">{AREAS.map(item=><PressableCard key={item.id} onClick={()=>setArea(item.id)} aria-pressed={area===item.id||(item.id==='path'&&['practice','exam'].includes(area))}><item.icon size={20} aria-hidden="true" />{item.label}</PressableCard>)}</nav>
      <SitovMotionStage key={area} className={styles.root}>
      {area==='path' && <>
        <section className={styles.panel}><div className={styles.row}><h2>Dein nächster Schritt</h2><span className={styles.badge}>{progress.completedUnits} Einheiten bearbeitet</span></div>
          <p className={styles.muted}>Beginne mit deiner nächsten Einheit.</p>
          {(()=>{const next=modules.flatMap(m=>m.units).find(u=>u.releaseStatus==='published'&&isExamUnitAvailable(u,state,modules)&&getExamUnitProgress(u,state).completed!==true)
            return next ? <PressableCard onClick={()=>openUnit(next)} className="st-button st-button--primary mt-4">Weiterlernen: {next.title}<ArrowRight size={20} /></PressableCard> : <p className={styles.warning}>Deine nächsten Inhalte werden vorbereitet. Du kannst inzwischen gezielt üben oder deine Beiträge verbessern.</p>})()}
          <PressableCard className="st-button st-button--soft mt-3" onClick={()=>setArea('practice')}><Headphones size={20} aria-hidden="true" />Eine Fertigkeit üben<ArrowRight size={20} aria-hidden="true" /></PressableCard>
        </section>
        {modules.filter(m=>m.releaseStatus==='published').map(module=><details key={module.id} className={styles.details} open={(progress.modules.find(m=>m.moduleId===module.id)?.failedVariants??0)>=2 || undefined}><summary>{module.order}. {module.title}</summary>
          <p className={`${styles.muted} mb-3`}>{module.description}</p><div className={styles.grid} style={{gridTemplateColumns:'1fr'}}>{module.units.map(unit=>{
            const available=isExamUnitAvailable(unit,state,modules)&&unit.releaseStatus==='published'
            const up=getExamUnitProgress(unit,state)
            return <PressableCard key={unit.id} className={styles.unit} disabled={!available} onClick={()=>openUnit(unit)}><span className={styles.number}>{unit.order}</span><span><strong>{unit.title}</strong>
              <small>{!available ? unit.releaseStatus==='draft' ? 'Die Aufgaben werden vorbereitet.' : 'Öffnet nach dem vorherigen Lerncheck. Hören, Lesen, Schreiben und Sprechen gehören dazu.' : `${up.independent?'Selbstständig geschafft':up.completed?'Bearbeitet':up.completedTasks>0?'In Arbeit':'Offen'} · ca. ${unit.estimatedMinutes} Minuten`}</small></span><ChevronRight size={20} /></PressableCard>
          })}</div>{(()=>{const mp=progress.modules.find(m=>m.moduleId===module.id);return (mp?.failedVariants??0)>=2&&<div className="mt-3"><p className={styles.warning}>Zwei neue Lernchecks waren noch schwer. Bearbeite drei Förderübungen und einen neuen Transferauftrag. Danach kannst du weiterlernen; dieser Bereich bleibt zum Wiederholen markiert.</p>{module.fallbackUnits?.map(u=><PressableCard key={u.id} className={`${styles.unit} mt-3`} onClick={()=>openUnit(u)} disabled={!isExamUnitAvailable(u,state,modules)}><span><strong>{u.title}</strong><small>Neue Aufgabe für deinen nächsten Schritt</small></span><ChevronRight size={20}/></PressableCard>)}<PressableCard className="st-button st-button--soft mt-3" disabled={pending||!state.available||!mp?.canActivateFallback} onClick={()=>startTransition(async()=>{try{const r=await activateExamFallback({moduleId:module.id,confirmed:true});if(r.success)await refresh(r);else setError(r.error??'Es fehlen noch Förderübungen oder der Transferauftrag.')}catch{setError('Der nächste Schritt konnte nicht freigeschaltet werden. Bitte versuche es erneut.')}})}>Ich möchte weiterlernen</PressableCard></div>})()}
        </details>)}
        {modules.some(m=>m.releaseStatus==='draft')&&<details className={styles.details}><summary>Der weitere B1-Lernweg · {modules.filter(m=>m.releaseStatus==='draft').length} Module in Vorbereitung</summary><ul className={styles.list}>{modules.filter(m=>m.releaseStatus==='draft').map(m=><li key={m.id}><strong>{m.title}</strong><p>{m.description}</p></li>)}</ul></details>}
        <PressableCard href={simulationHref} className={styles.link}>Zur simulierten Prüfung<ArrowRight size={20} aria-hidden="true" /></PressableCard>
      </>}
      {area==='practice' && <>
        <PressableCard className={styles.link} onClick={()=>setArea('path')}><ArrowLeft size={18} aria-hidden="true" />Zurück zum Lernen</PressableCard>
        <section className={styles.panel}><h2>Was möchtest du üben?</h2><div className={styles.filters}>{(Object.keys(EXAM_SKILL_LABELS) as ExamSkill[]).map(s=><PressableCard key={s} aria-pressed={skill===s} onClick={()=>{setSkill(s);setPracticeCount(4)}}>{EXAM_SKILL_LABELS[s]}</PressableCard>)}</div></section>
        <div className={styles.grid}>{all.flatMap(m=>m.units).filter(u=>u.releaseStatus==='published'&&u.kind!=='checkpoint'&&u.tasks.some(t=>t.skill===skill)).slice(0,practiceCount).map(u=>{
          const Icon=skillIcon(skill);return <PressableCard key={u.id} onClick={()=>openUnit({...u,tasks:u.tasks.filter(t=>t.skill===skill)})} className={styles.card}><Icon size={24} /><strong>{u.title}</strong><span>{u.description}</span><span>Gezielt {EXAM_SKILL_LABELS[skill].toLowerCase()} üben</span></PressableCard>
        })}</div>
        {all.flatMap(m=>m.units).filter(u=>u.releaseStatus==='published'&&u.kind!=='checkpoint'&&u.tasks.some(t=>t.skill===skill)).length>practiceCount&&<PressableCard className="st-button st-button--soft" onClick={()=>setPracticeCount(n=>n+4)}>Weitere Übungen anzeigen</PressableCard>}
        <details className={styles.details}><summary>Weitere Aufgabenformen üben</summary><div className={styles.grid}>{workshops.map(w=><details key={w.id} className={styles.details}><summary>{w.title}</summary><p className={`${styles.muted} mb-3`}>{w.description}</p>{w.units.map(u=><PressableCard key={u.id} className={`${styles.unit} mb-2`} disabled={u.releaseStatus!=='published'} onClick={()=>openUnit(u)}><span><strong>{u.title}</strong><small>{u.releaseStatus==='published' ? 'Schritt für Schritt üben' : 'In Vorbereitung'}</small></span><ChevronRight size={20} /></PressableCard>)}</details>)}</div></details>
      </>}
      {area==='submissions' && <section className={styles.panel}><h2>Meine Beiträge</h2><p className={`${styles.muted} mb-4`}>Hier findest du deine Texte, Aufnahmen und die Rückmeldungen deiner Lehrkraft.</p>
        {!state.submissions.length && <p className={styles.warning}>Hier findest du bald deine Texte, Aufnahmen und Rückmeldungen. Sprechen beginnt schon in der ersten Einheit.</p>}
        <div className={styles.grid}>{state.submissions.filter(s=>!state.submissions.some(next=>next.previousId===s.id)).map(s=><SubmissionCard key={s.id} submission={s} all={state.submissions} onRevise={()=>{const u=all.flatMap(m=>m.units).find(u=>u.id===s.unitId);if(u)openUnit(u,s)}}
          onDelete={()=>startTransition(async()=>{const r=await deleteExamSubmission({submissionId:s.id});if(r.success)await refresh(r);else setError(r.error??'Löschen fehlgeschlagen.')})} pending={pending} />)}</div>
        <PressableCard className="st-button st-button--soft mt-4" onClick={()=>{setSkill('speaking');setArea('practice')}}><MicLabel />Eine Sprechaufgabe wählen</PressableCard>
      </section>}
      {area==='exam' && <>
        <PressableCard className={styles.link} onClick={()=>setArea('path')}><ArrowLeft size={18} aria-hidden="true" />Zurück zum Lernen</PressableCard>
        <section className={styles.panel}><h2>Deinen Prüfungsstand prüfen</h2><p className={styles.muted}>Wähle in der simulierten Prüfung dein Niveau und dein Prüfungsformat.</p>
          <PressableCard href={simulationHref} className="st-button st-button--primary mt-4">Zur simulierten Prüfung<ArrowRight size={20} aria-hidden="true" /></PressableCard>
        </section>
      </>}
      {area==='progress'&&<ExamProgressCard lang={lang} state={state} modules={modules} workshops={workshops} />}
      </SitovMotionStage>
    </>
  </SitovMotionStage>
}

function MicLabel(){return <MessageCircle size={20} aria-hidden="true" />}
function SubmissionCard({submission:s,all,onRevise,onDelete,pending}: {submission:ExamSubmission;all:ExamSubmission[];onRevise:()=>void;onDelete:()=>void;pending:boolean}){
  const original=all.find(old=>old.id===s.previousId)
  return <article className={styles.card}><div className={styles.row}><strong>{s.kind==='writing'?'Dein Text':'Deine Aufnahme'}</strong><span className={styles.badge}>{s.status==='draft'?'Entwurf':s.status==='submitted'?'Rückmeldung ausstehend':'Rückmeldung da'}</span></div>
    {s.text&&<p className={styles.text}>{s.text}</p>}{s.mediaUrl&&<audio controls className={styles.audio} src={s.mediaUrl} aria-label="Gespeicherte Aufnahme"/>}{s.photoUrl&&<Image unoptimized width={640} height={480} className={styles.scene} src={s.photoUrl} alt="Dein handschriftlicher Text"/>}
    {original&&<details className={styles.details}><summary>Vorherige Version vergleichen</summary>{original.text&&<p className={styles.text}>{original.text}</p>}{original.mediaUrl&&<audio controls src={original.mediaUrl} className={styles.audio}/ >}{original.photoUrl&&<Image unoptimized width={640} height={480} className={styles.scene} src={original.photoUrl} alt="Vorherige handschriftliche Version"/>}</details>}
    {s.feedback.map(f=><div className={styles.feedback} key={f.id}><strong>Rückmeldung deiner Lehrkraft</strong><p>{f.strengths}</p><p>{f.text}</p><ul className={styles.list}>{f.priorities.map(p=><li key={p}>{p}</li>)}</ul><p>{f.revision}</p></div>)}
    <div className={styles.actions}><PressableCard className="st-button st-button--soft" onClick={onRevise}>Überarbeiten</PressableCard><PressableCard className={styles.link} onClick={onDelete} disabled={pending}>Löschen</PressableCard></div>
  </article>
}

function ExamUnitRunner({ unit, state, revision, preview, onClose, onChange, boxLevel, lang }: {
  unit:ExamUnit;state:ExamState;revision?:ExamSubmission;preview:boolean;onClose:()=>void;onChange:(r?:ExamActionResult)=>Promise<void>;boxLevel:string|null;lang:string
}){
  const checkpoint=unit.kind==='checkpoint'
  const groups=[unit.tasks,...(unit.variants??[])]
  const wasSubmitted=(t:ExamTask)=>['writing','speaking'].includes(t.type)?state.submissions.some(s=>s.taskId===t.id&&s.taskVersion===t.version):state.attempts.some(a=>a.taskId===t.id&&a.taskVersion===t.version)
  const [variant]=useState(()=>{
    if(!checkpoint)return 0
    const pendingGroup=groups.findIndex(tasks=>tasks.some(wasSubmitted)&&(!tasks.every(wasSubmitted)||tasks.some(t=>state.attempts.some(a=>a.taskId===t.id&&!a.feedbackViewed))))
    return pendingGroup>=0?pendingGroup:groups.findIndex(tasks=>!tasks.some(wasSubmitted))
  })
  const tasks=groups[Math.max(0,variant)]
  const [index,setIndex]=useState(()=>revision?Math.max(0,tasks.findIndex(t=>t.id===revision.taskId)):checkpoint?(()=>{const missing=tasks.findIndex(t=>!wasSubmitted(t));return missing<0?tasks.length:missing})():0)
  const [answer,setAnswer]=useState<string|string[]>('')
  const [result,setResult]=useState<ExamActionResult|null>(null)
  const [helped,setHelped]=useState(false)
  const [hints,setHints]=useState<string[]>([])
  const [error,setError]=useState('')
  const [audioFailed,setAudioFailed]=useState(false)
  const audioPlayer=useRef<HTMLAudioElement|null>(null)
  const [pending,startTransition]=useTransition()
  const [done,setDone]=useState(index>=tasks.length)
  const [checkResults,setCheckResults]=useState<ExamActionResult[]>([])
  const [checkpointLoaded,setCheckpointLoaded]=useState(false)
  const started=useRef(0)
  useEffect(()=>{started.current=Date.now()},[])
  const request=useRef<{id:string;fingerprint:string}|null>(null)
  const task=tasks[index]
  const closed=task&&!['writing','speaking'].includes(task.type)
  const hasAnswer=Array.isArray(answer)?answer.length>0&&answer.every(a=>a.length>0):answer.trim().length>0
  const showHint=()=>startTransition(async()=>{try{const r=await getExamHint({taskId:task.id,unitId:unit.id});if(r.success){if(!result)setHelped(true);setHints([...(r.hints??[]),...(r.transcript?[r.transcript]:[])])}else setError(r.error??'Die Hilfe ist gerade nicht verfügbar.')}catch{setError('Die Hilfe konnte nicht geladen werden. Deine Antwort bleibt erhalten.')}})
  const next=()=>{request.current=null;setAnswer('');setResult(null);setHints([]);setHelped(false);setError('');setAudioFailed(false);started.current=Date.now();if(index+1>=tasks.length)setDone(true);else setIndex(index+1);window.scrollTo({top:0,behavior:'instant'})}
  if(checkpoint&&variant<0)return <section className={styles.panel}><h1 className="text-2xl font-bold mb-3">Du kennst diese Lerncheckvarianten schon</h1><p className={styles.muted}>Neue unabhängige Aufgaben werden vorbereitet. Du kannst gezielt weiterüben oder deine Lehrkraft um einen nächsten Schritt bitten.</p><PressableCard className="st-button st-button--soft mt-4" onClick={onClose}>Zur Übersicht</PressableCard></section>
  if(done||!task)return <section className={`${styles.panel} ${styles.root}`}><h1 className="text-2xl font-bold">Ende dieses Lernschritts</h1><p className={styles.muted}>Deine gespeicherten Antworten bleiben erhalten. Geschlossene Antworten und eigene Beiträge werden getrennt betrachtet. Überarbeite deinen Text oder deine Aufnahme nach der Rückmeldung.</p>
    {checkpoint&&!checkpointLoaded&&<PressableCard className="st-button st-button--primary" disabled={pending} onClick={()=>startTransition(async()=>{try{const r=await getExamCheckpointFeedback({unitId:unit.id,variant});if(r.success){setCheckResults(r.results??[]);setCheckpointLoaded(true)}else setError(r.error??'Die Rückmeldung konnte nicht geladen werden.')}catch{setError('Die Rückmeldung konnte nicht geladen werden. Bitte versuche es erneut.')}})}>Lerncheck abgeschlossen · Rückmeldungen ansehen</PressableCard>}
    {checkpoint&&checkpointLoaded&&<><strong>{checkResults.filter(r=>r.attempt?.correct).length}/{checkResults.length} geschlossene Antworten richtig</strong>{checkResults.map((r,i)=><div className={styles.feedback} key={r.attempt?.id??i}><strong>Aufgabe {i+1}: {r.attempt?.correct?'Richtig':'Noch üben'}</strong><p>{r.feedback?.explanation}</p><p>{r.feedback?.evidence}</p></div>)}</>}
    {error&&<p role="alert" className={styles.error}>{error}</p>}{(!checkpoint||checkpointLoaded)&&<PressableCard className="st-button st-button--primary" disabled={pending} onClick={()=>startTransition(async()=>{try{for(const r of checkResults){if(r.attempt){const viewed=await markExamFeedbackViewed({attemptId:r.attempt.id});if(!viewed.success){setError(viewed.error??'Die Rückmeldung konnte nicht gespeichert werden.');return}}}if(checkpoint)await onChange();onClose()}catch{setError('Die Rückmeldung konnte nicht gespeichert werden. Bitte versuche es erneut.')}})}>{checkpoint?'Rückmeldungen gelesen · Zur Übersicht':'Zurück zur Übersicht'}<ArrowRight size={20}/></PressableCard>}</section>
  const missing=task.releaseStatus!=='published'||(task.audio&&!task.audio.src)||(task.image&&task.image.status!=='prepared')
  return <SitovMotionStage className={`${styles.root} ${styles.task}`}>
    <div className={styles.row}><PressableCard className={styles.link} onClick={onClose} disabled={pending}><ArrowLeft size={18}/>Zur Übersicht</PressableCard><span className={styles.badge}>{index+1} / {tasks.length}</span></div>
    <div className={styles.meter} role="progressbar" aria-label="Schritt in der Einheit" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={index}><span style={{width:`${index/tasks.length*100}%`}}/></div>
    <header><span className={styles.eyebrow}>{EXAM_SKILL_LABELS[task.skill]} · {checkpoint?'Neuer Lerncheck':unit.title}</span><h1 className="mt-2">{task.title}</h1></header><p>{task.instruction}</p>
    {checkpoint&&<p className={styles.muted}>Ohne Hilfen. Die Rückmeldung erscheint nach deinem Lerncheck.</p>}
    {missing?<div className={styles.warning}><strong>Dieses Medium wird noch vorbereitet.</strong><p>Die Aufgabe öffnet erst nach Aufnahme und Prüfung. Hier zählt noch kein Versuch.</p><PressableCard className="st-button st-button--soft mt-3" onClick={next}>Nächste Aufgabe</PressableCard></div>:<>
      {task.text&&<div className={styles.text}>{task.text}</div>}
      {task.image&&<Image width={1536} height={1024} sizes="(max-width: 700px) calc(100vw - 40px), 720px" className={styles.scene} src={task.image.src} alt={task.image.alt}/>}
      {task.audio&&<audio ref={audioPlayer} className={styles.audio} src={task.audio.src} controls preload="none" aria-label="Hörtext abspielen" onCanPlay={()=>{if(audioFailed){setAudioFailed(false);setError('')}}} onError={()=>{setAudioFailed(true);setError('Der Hörtext konnte nicht geladen werden. Lade ihn erneut, bevor du antwortest. Deine Auswahl bleibt erhalten.')}}/>}
      {audioFailed&&<PressableCard className="st-button st-button--soft" onClick={()=>audioPlayer.current?.load()}>Hörtext erneut laden</PressableCard>}
      {closed&&!result&&<>
        {(task.type==='choice'||task.type==='true-false')&&<div className={styles.options} role="group" aria-label="Deine Antwort">{(task.options??[{id:'true',text:'Richtig'},{id:'false',text:'Falsch'}]).map((o,i)=><PressableCard key={o.id} className={styles.option} aria-pressed={answer===o.id} onClick={()=>setAnswer(o.id)}><b>{String.fromCharCode(65+i)}</b>{o.text}</PressableCard>)}</div>}
        {task.type==='short-text'&&<label className={styles.label}>Deine Antwort<input className={styles.input} value={typeof answer==='string'?answer:''} onChange={e=>setAnswer(e.target.value)} maxLength={2000}/></label>}
        {task.type==='ordering'&&<div className={styles.options}>{(task.options??[]).map(o=><PressableCard key={o.id} className={styles.option} aria-pressed={Array.isArray(answer)&&answer.includes(o.id)} onClick={()=>setAnswer(old=>{const a=Array.isArray(old)?old:[];return a.includes(o.id)?a.filter(id=>id!==o.id):[...a,o.id]})}><b>{Array.isArray(answer)&&answer.includes(o.id)?answer.indexOf(o.id)+1:'–'}</b>{o.text}</PressableCard>)}<p className={styles.muted}>Tippe die Teile in der passenden Reihenfolge an. Tippe erneut, um einen Teil zu entfernen.</p></div>}
        {task.type==='matching'&&(task.prompts??[]).map((p,i)=><label className={styles.label} key={p.id}>{p.text}<select className={styles.select} value={Array.isArray(answer)?answer[i]??'':''} onChange={e=>setAnswer(old=>{const a=Array.isArray(old)?[...old]:Array(task.prompts?.length??0).fill('');a[i]=e.target.value;return a})}><option value="">Bitte zuordnen …</option>{task.options?.map(o=><option value={o.id} key={o.id}>{o.text}</option>)}</select></label>)}
        {!checkpoint&&!task.audio&&<PressableCard className={styles.link} disabled={pending||!state.available} onClick={showHint}><Lightbulb size={18}/>Hilfe ansehen (wird vermerkt)</PressableCard>}
        {hints.length>0&&<div className={styles.warning}>{hints.map(h=><p key={h}>{h}</p>)}</div>}
        <PressableCard className="st-button st-button--primary" disabled={preview||pending||audioFailed||!state.available||!hasAnswer||(task.type==='ordering'&&(!Array.isArray(answer)||answer.length!==task.options?.length))} onClick={()=>startTransition(async()=>{
          try {setError('');const fingerprint=JSON.stringify([task.id,answer,helped]);if(request.current?.fingerprint!==fingerprint)request.current={id:crypto.randomUUID(),fingerprint};const r=await submitExamAnswer({taskId:task.id,unitId:unit.id,answer,helped,seconds:Math.min(1800,Math.round((Date.now()-started.current)/1000)),mode:checkpoint?'checkpoint':'practice',variant,requestId:request.current.id});if(r.success){setResult(r);if(checkpoint)setCheckResults(old=>[...old,r]);await onChange(r)}else setError(r.error??'Deine Antwort konnte nicht gespeichert werden.')}
          catch {setError('Speichern fehlgeschlagen. Deine Antwort bleibt erhalten. Bitte versuche es erneut.')}
        })}>{pending?'Wird gespeichert …':checkpoint?'Antwort speichern':'Antwort prüfen'}<Check size={20}/></PressableCard>
      </>}
      {closed&&result&&<div className={styles.feedback} data-correct={checkpoint?undefined:String(result.attempt?.correct)} role="status">
        <strong>{checkpoint?'Antwort gespeichert':result.attempt?.correct?'Das passt.':'Schau dir die entscheidende Stelle an.'}</strong>
        {!checkpoint&&<><p>{result.feedback?.explanation}</p>{result.feedback?.evidence&&<p><strong>Beleg:</strong> {result.feedback.evidence}</p>}{helped&&<p className={styles.muted}>Du hast mit Hilfe geübt. Das zählt als Bearbeitung.</p>}</>}
        {!checkpoint&&task.audio&&<><PressableCard className={styles.link} disabled={pending} onClick={showHint}><BookOpen size={18}/>Hörtext nach deiner Antwort mitlesen</PressableCard>{hints.length>0&&<div className={styles.text}>{hints.map(h=><p key={h}>{h}</p>)}</div>}</>}
        <PressableCard className="st-button st-button--primary" disabled={pending} onClick={()=>startTransition(async()=>{try{if(result.attempt&&!checkpoint){const r=await markExamFeedbackViewed({attemptId:result.attempt.id});if(!r.success){setError(r.error??'Die Rückmeldung konnte nicht gespeichert werden.');return}await onChange(r)}next()}catch{setError('Die Rückmeldung konnte nicht gespeichert werden. Bitte versuche es erneut.')}})}>{checkpoint?'Weiter':'Rückmeldung gelesen · Weiter'}<ArrowRight size={20}/></PressableCard>
      </div>}
      {!closed&&!result&&<ExamSubmissionEditor task={task} unit={unit} state={{...state,available:state.available&&!preview}} previous={revision} onSaved={r=>{setResult(r);void onChange(r)}}/>}
      {!closed&&result&&<div className={styles.feedback} role="status"><strong>{result.submission?.status==='submitted'?'Dein Beitrag wurde eingereicht.':'Dein Entwurf ist gespeichert.'}</strong><p>Nach deiner Rückmeldung kannst du den Beitrag verbessern. Du findest alle Versionen unter „Meine Beiträge“.</p><PressableCard className="st-button st-button--primary" onClick={next}>Weiter<ArrowRight size={20}/></PressableCard></div>}
      {task.words?.length>0&&!checkpoint&&<ExamWordBox words={task.words??[]} lang={lang} level={boxLevel}/>}
    </>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
  </SitovMotionStage>
}
