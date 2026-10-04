'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, CircleHelp, Clock3, Headphones, Info, ListChecks, LockKeyhole, MessageCircle, Pencil, RotateCcw, Send, XCircle } from 'lucide-react'
import * as actions from '@/app/actions/exam-simulation'
import { SIMULATION_LEVELS, SIMULATION_SKILL_LABELS } from '@/lib/exam-simulation/catalogue'
import { normalizeSimulationFormAnswer } from '@/lib/exam-simulation/answers'
import type { SimulationActionResult, SimulationAnswer, SimulationLevel, SimulationProfile, SimulationSession, SimulationSkill, SimulationState, SimulationTask, SimulationTaskFeedback } from '@/lib/exam-simulation/types'
import { EASE_OUT_SOFT, MOTION, useReducedMotionSafe } from '@/lib/motion'
import PressableCard from '@/components/motion/PressableCard'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import ProgressRing from '@/components/ui/ProgressRing'
import SimulationRecording from './SimulationRecording'
import styles from './ExamSimulation.module.css'

const skillIcons = { reading:BookOpen, language:ListChecks, listening:Headphones, writing:Pencil, speaking:MessageCircle }
const mainSkills: SimulationSkill[] = ['reading','listening','writing','speaking']
const levelDescriptions = { A1:'Erste Schritte', A2:'Vertrauter Alltag', B1:'Selbstständig im Alltag', B2:'Sicher argumentieren', C1:'Komplexe Themen', C2:'Sehr differenziert' }
const hasAnswer = (answer?:SimulationAnswer) => typeof answer==='string' ? answer.trim().length>0 : Array.isArray(answer) ? answer.some(Boolean) : !!answer && (!!answer.text.trim() || !!answer.audioPath)
const hasTaskAnswer = (task:SimulationTask,answer?:SimulationAnswer) => task.type==='speaking' ? !!answer&&typeof answer==='object'&&!Array.isArray(answer)&&!!answer.audioPath : hasAnswer(answer)
const percentageFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })
const wordCount = (text:string) => text.trim() ? text.trim().split(/\s+/u).length : 0

export default function ExamSimulation({lang,initial,catalog,initialLevel,preview=false}: {
  lang:string; initial:SimulationState; catalog:SimulationProfile[]; initialLevel?:string; preview?:boolean
}) {
  const [level,setLevel] = useState<SimulationLevel|null>(SIMULATION_LEVELS.includes(initialLevel as SimulationLevel) ? initialLevel as SimulationLevel : null)
  const selected=catalog.find(profile=>profile.level===level&&profile.provider==='sitov')??null
  const [session,setSession] = useState(initial.active)
  const [history,setHistory] = useState(initial.history)
  const [error,setError] = useState('')
  const [pending,startTransition] = useTransition()
  const heading=useRef<HTMLHeadingElement>(null)
  const reduced=useReducedMotionSafe()
  const stage=session ? session.status==='completed'?'result':'run' : selected?'start':'level'
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})},[stage])
  const accept=(result:SimulationActionResult) => {
    if(!result.success) {setError(result.error ?? 'Das hat gerade nicht funktioniert. Bitte versuche es erneut.');return false}
    if(result.session){setSession(result.session);if(result.session.status==='completed')setHistory(old=>[result.session!,...old.filter(run=>run.id!==result.session!.id)])}
    if(result.state){setSession(result.state.active ?? result.session ?? null);setHistory(result.state.history)}
    setError('');return true
  }
  const start=(profile:SimulationProfile) => startTransition(async()=>{
    setError('')
    try {
      const input={level:profile.level,provider:profile.provider,mode:'exam' as const,requestId:crypto.randomUUID()}
      accept(await (preview?actions.startPreviewExamSimulation(input):actions.startExamSimulation(input)))
    } catch {setError('Der Durchgang konnte nicht gestartet werden. Bitte versuche es erneut.')}
  })
  const reset=()=>{setSession(null);setLevel(null);setError('')}
  if(initial.accessLocked&&!preview) return <SitovMotionStage className={styles.root} lang="de" translate="no">
    <header className={styles.hero}><div><span className={styles.eyebrow}>Sitov Academy</span><h1 ref={heading} tabIndex={-1}>Simulierte Prüfung</h1></div><LockKeyhole size={44} aria-hidden="true"/></header>
    <section className={styles.panel} role="status"><h2>Deine Lehrkraft schaltet dich frei</h2><p>Die Simulierte Prüfung ist für dein Konto noch gesperrt. Bitte wende dich an deine Lehrkraft.</p><p className={styles.muted}>Nach der Freigabe kannst du hier deine vollständige Prüfung beginnen.</p></section>
    <a className={styles.link} href={`/${lang}/dashboard/exam-preparation`}><BookOpen size={18} aria-hidden="true"/>Zur Prüfungsvorbereitung</a>
  </SitovMotionStage>
  if(session) return <div className={styles.root} lang="de" translate="no">
    {preview&&<p className={styles.tag}>Vorschau · keine gespeicherte Prüfungsleistung</p>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {session.status==='completed' ? <SimulationResults session={session} pending={pending} onNew={()=>{
      const profile=catalog.find(p=>p.id===session.profileId)
      if(profile)start(profile);else reset()
    }} onChoose={reset} onRefresh={preview?undefined:()=>startTransition(async()=>{try{const next=await actions.getSimulationState();if(!next.available){setError(next.error??'Die Bewertungen konnten nicht geladen werden.');return}const current=next.history.find(run=>run.id===session.id);if(current)accept({success:true,session:current});setHistory(next.history)}catch{setError('Die Bewertungen konnten nicht geladen werden. Versuche es erneut.')}})} lang={lang} preview={preview}/> : <SimulationRunner key={session.id} session={session} preview={preview} onChange={accept} onError={setError}/>}
  </div>
  return <SitovMotionStage className={styles.root} lang="de" translate="no">
    <header className={styles.hero}><div><span className={styles.eyebrow}>Sitov Academy</span><h1 ref={heading} tabIndex={-1}>Simulierte Prüfung</h1>{stage!=='start'&&<p>Wähle dein Niveau. Alle vier Fertigkeiten in einer Prüfung.</p>}</div><SimulationGraphic/></header>
    <StepIndicator current={stage==='level'?0:1}/>
    {preview&&<p className={styles.tag}>Oberflächenvorschau · keine gespeicherte Prüfungsleistung</p>}
    {!initial.available&&!preview&&<p className={styles.note} role="status"><Info size={20}/>{initial.error ?? 'Dein Prüfungsbereich ist gerade nicht verfügbar.'}</p>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <motion.div className={styles.stage} key={stage} initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:MOTION.slow,ease:EASE_OUT_SOFT}}>
      {!selected ? <>
        <h2 className={styles.srOnly}>Dein Prüfungsniveau</h2>
        <div className={`${styles.grid} ${styles.levels}`}>{SIMULATION_LEVELS.map(item=><PressableCard key={item} className={styles.card} onClick={()=>{setLevel(item);setError('')}} aria-label={`${item} – ${levelDescriptions[item]}`}><strong className={styles.levelCode}>{item}</strong><small>{levelDescriptions[item]}</small><ArrowRight className={styles.cardArrow} size={20} aria-hidden="true"/></PressableCard>)}</div>
      </> : <>
        <PressableCard className={styles.link} onClick={()=>setLevel(null)}><ArrowLeft size={18} aria-hidden="true"/>Niveau ändern</PressableCard>
        <section className={styles.panel}><div><span className={styles.eyebrow}>2. Bereit zum Start</span><h2>Deine simulierte Prüfung · {selected.level}</h2></div>
          <div className={styles.row}><span className={styles.tag}><Clock3 size={16} aria-hidden="true"/>{selected.practiceMinutes} Minuten</span><span className={styles.tag}><RotateCcw size={16} aria-hidden="true"/>Neue Aufgaben</span></div>
          <p>Lesen, Hören, Schreiben und Sprechen – in einer gemeinsamen Prüfung für dein Niveau.</p>
          {!selected.fullExamReleased&&<p className={styles.note} role="status">{selected.blockers.some(note=>note.includes('Niveau-Freigabe'))?'Für dieses Niveau fehlt deine Freigabe. Bitte wende dich an deine Lehrkraft.':'Diese Prüfung wird noch vorbereitet. Du kannst starten, sobald alle Aufgaben und Hörteile geprüft sind.'}</p>}
          <PressableCard className={styles.primary} disabled={pending||(!initial.available&&!preview)||!selected.available||!selected.fullExamReleased} onClick={()=>start(selected)}>{pending?'Aufgaben werden zusammengestellt …':'Prüfung starten'}<ArrowRight size={22} aria-hidden="true"/></PressableCard>
          <p className={styles.muted}>Eine Aufgabe nach der anderen. Die Lösungen erscheinen am Schluss.</p>
        </section>
        <details className={styles.details}><summary>So läuft die Prüfung ab</summary><p>{selected.description}</p><div className={styles.skillPlan}>{mainSkills.map(skill=>{const Icon=skillIcons[skill];return <div key={skill}><Icon size={22} aria-hidden="true"/><span><strong>{SIMULATION_SKILL_LABELS[skill]}</strong><small>{skill==='writing'||skill==='speaking'?'Bewertung durch Lehrkraft':'Automatische Auswertung'}</small></span></div>})}</div><p>Texte und private Aufnahmen werden für die Rückmeldung deiner Lehrkraft gespeichert.</p><p><strong>Deine Einschätzung:</strong> {selected.passRule}</p><p className={styles.muted}>Die Simulation verbindet Aufgabenarten verschiedener Institute. Die genaue Reihenfolge und Bewertung deiner echten Prüfung können abweichen.</p></details>
      </>}
    </motion.div>
    {history.length>0&&<details className={styles.details}><summary>Deine bisherigen Durchgänge ({history.length})</summary><div className={styles.reviewOverview}>{history.map(run=><button key={run.id} onClick={()=>setSession(run)}><span><strong>{run.title}</strong><small className={styles.muted}> · {new Date(run.completedAt??run.startedAt).toLocaleDateString('de-DE')}</small></span><ArrowRight size={18} aria-hidden="true"/></button>)}</div></details>}
    <a className={styles.link} href={`/${lang}/${preview?'sitov-preview':'dashboard'}/exam-preparation`}><BookOpen size={18} aria-hidden="true"/>Zur Prüfungsvorbereitung</a>
  </SitovMotionStage>
}

function SimulationGraphic() {
  const reduced=useReducedMotionSafe()
  return <div className={styles.graphic} aria-hidden="true">{mainSkills.map((skill,index)=>{const Icon=skillIcons[skill];return <motion.span key={skill} initial={false} animate={reduced?{y:0}:{y:[0,-5,0]}} transition={{duration:MOTION.slower,delay:index*.1,ease:EASE_OUT_SOFT}}><Icon size={25}/></motion.span>})}</div>
}
function StepIndicator({current}:{current:number}) {
  return <ol className={styles.steps} aria-label="Dein Weg zur Prüfung">{['Niveau','Start'].map((label,index)=><li key={label} aria-current={current===index?'step':undefined}>{index>0&&<span className={styles.stepLine} aria-hidden="true"/>}<span className={styles.stepNumber} aria-hidden="true">{current>index?<Check size={14}/>:index+1}</span>{label}</li>)}</ol>
}

function SimulationRunner({session,preview,onChange,onError}:{session:SimulationSession;preview:boolean;onChange:(result:SimulationActionResult)=>boolean;onError:(text:string)=>void}) {
  const [index,setIndex]=useState(()=>Math.max(0,session.tasks.findIndex(task=>!hasTaskAnswer(task,session.answers[task.id]))))
  const [draft,setDraft]=useState<SimulationAnswer>(session.answers[session.tasks[index]?.id]??'')
  const [overview,setOverview]=useState(false)
  const [confirmFinish,setConfirmFinish]=useState(false)
  const [pending,startTransition]=useTransition()
  const [now,setNow]=useState(0)
  const [audioFailed,setAudioFailed]=useState(false)
  const [recordingBusy,setRecordingBusy]=useState(false)
  const [audioPlays,setAudioPlays]=useState<Record<string,number>>({})
  const heading=useRef<HTMLHeadingElement>(null)
  const audio=useRef<HTMLAudioElement>(null)
  const request=useRef<{fingerprint:string;id:string}|null>(null)
  const reduced=useReducedMotionSafe()
  const task=session.tasks[index]
  const remaining=Math.max(0,Math.ceil((new Date(session.expiresAt).getTime()-now)/1000))
  const expired=now>0&&remaining===0
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return ()=>clearInterval(timer)},[])
  useEffect(()=>{heading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})},[index])
  const changeIndex=(next:number)=>{setIndex(next);setDraft(session.answers[session.tasks[next]?.id]??'');setAudioFailed(false);setOverview(false);setConfirmFinish(false);onError('');request.current=null}
  const save=(after:()=>void)=>startTransition(async()=>{
    if(!task)return
    onError('')
    try {
      if(hasAnswer(draft)||(session.answers[task.id]!==undefined&&JSON.stringify(draft)!==JSON.stringify(session.answers[task.id]))) {
        const fingerprint=JSON.stringify([task.id,draft])
        if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,id:crypto.randomUUID()}
        const input={runId:session.id,taskId:task.id,answer:draft,requestId:request.current.id}
        const result=await (preview?actions.savePreviewSimulationAnswer(input):actions.saveSimulationAnswer(input))
        if(!onChange(result))return
      }
      after()
    }catch{onError('Deine Antwort konnte nicht gespeichert werden. Sie bleibt hier erhalten. Versuche es erneut.')}
  })
  const finish=()=>startTransition(async()=>{
    try {const input={runId:session.id,requestId:crypto.randomUUID()};onChange(await (preview?actions.finishPreviewExamSimulation(input):actions.finishExamSimulation(input)))}
    catch{onError('Die Auswertung konnte nicht geladen werden. Deine gespeicherten Antworten bleiben erhalten.')}
  })
  const answered=session.tasks.filter(item=>hasTaskAnswer(item,session.answers[item.id])).length
  if(!task)return <p className={styles.error} role="alert">Dieser Durchgang enthält keine Aufgaben. Bitte lade die Seite erneut.</p>
  const Icon=skillIcons[task.skill]
  return <SitovMotionStage className={`${styles.root} ${styles.runner}`}>
    <header className={styles.runHead}><div className={`${styles.row} ${styles.between}`}><h1>{session.level} · Simulierte Prüfung</h1><span className={styles.timer} data-expiring={remaining<300}><Clock3 size={18} aria-hidden="true"/>{now?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:'Zeit wird geladen'}</span></div><div className={`${styles.row} ${styles.between}`}><span className={styles.row}><Icon size={18} aria-hidden="true"/>{SIMULATION_SKILL_LABELS[task.skill]} · Aufgabe {index+1}/{session.tasks.length}</span><span className={styles.muted}>{answered} beantwortet</span></div><div className={styles.runTools}><div className={styles.meter} role="progressbar" aria-label="Beantwortete Aufgaben" aria-valuemin={0} aria-valuemax={session.tasks.length} aria-valuenow={answered}><motion.span initial={false} animate={{scaleX:answered/session.tasks.length}} transition={{duration:reduced?0:MOTION.slow}}/></div><button className={styles.link} aria-label="Aufgabenübersicht" onClick={()=>save(()=>setOverview(value=>!value))} disabled={pending||recordingBusy||expired}><ListChecks size={18} aria-hidden="true"/>Übersicht</button></div></header>
    {session.mode!=='exam'&&<p className={styles.muted}>Lösungen und Rückmeldungen erscheinen am Schluss.</p>}
    {overview&&<section className={styles.panel} aria-label="Aufgabenübersicht"><p>Du kannst eine Aufgabe erneut öffnen.</p><div className={styles.questionGrid}>{session.tasks.map((item,i)=><button key={item.id} data-answered={hasTaskAnswer(item,session.answers[item.id])} aria-current={i===index?'true':undefined} aria-label={`Aufgabe ${i+1}: ${hasTaskAnswer(item,session.answers[item.id])?'beantwortet':'offen'}`} onClick={()=>changeIndex(i)}>{i+1}</button>)}</div></section>}
    {confirmFinish||expired ? <section className={styles.panel}><h2>{expired?'Die Bearbeitungszeit ist vorbei.':'Durchgang abschließen?'}</h2><p>{answered} von {session.tasks.length} Aufgaben beantwortet. {session.tasks.length-answered>0?'Offene Aufgaben zählen als nicht beantwortet.':''}</p><p className={styles.muted}>Nach dem Abschluss siehst du deine Lösungen und die Erklärungen. Schreiben und Sprechen bewertet deine Lehrkraft.</p><PressableCard className={styles.primary} disabled={pending} onClick={finish}>{pending?'Wird ausgewertet …':'Abschließen und auswerten'}<Send size={20} aria-hidden="true"/></PressableCard>{!expired&&<PressableCard className={styles.secondary} onClick={()=>setConfirmFinish(false)}>Weiter bearbeiten</PressableCard>}</section> : <>
      <motion.section key={task.id} className={styles.panel} initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:MOTION.base,ease:EASE_OUT_SOFT}}>
        <header className={styles.taskHeader} data-audio-question={!!task.audio&&['choice','true-false'].includes(task.type)}><h2 ref={heading} tabIndex={-1}>{task.audio&&task.type==='true-false'?task.text:task.audio&&task.type==='choice'?task.instruction:task.title}</h2>{(!task.audio||!['choice','true-false'].includes(task.type))&&<p>{task.instruction}</p>}</header>
        <div className={styles.taskBody} data-split={!!task.text&&['choice','true-false'].includes(task.type)}>
          {task.image&&<Image className={styles.taskImage} src={task.image.src} alt={task.image.alt} width={1536} height={1024} sizes="(max-width: 700px) calc(100vw - 40px), 720px"/>}
          {task.text&&!(task.audio&&task.type==='true-false')&&<div className={styles.text}>{task.text}</div>}
          <div className={styles.answers}>
            {task.audio&&<><audio ref={audio} className={styles.audio} controls src={task.audio.src} preload="none" aria-label="Prüfungshörtext" onError={()=>setAudioFailed(true)} onCanPlay={()=>setAudioFailed(false)} onPlay={()=>{
              const fresh=(audioPlays[task.id]??0)===0||audio.current?.currentTime===0
              if(fresh&&(audioPlays[task.id]??0)>=task.audio!.plays){audio.current?.pause();return}
              if(fresh)setAudioPlays(old=>({...old,[task.id]:(old[task.id]??0)+1}))
            }}/><p className={styles.muted}>Je Aufgabe {task.audio.plays} Mal hören.</p>{audioFailed&&<p role="alert" className={styles.error}>Der Hörtext lädt nicht. Bitte lade ihn erneut, bevor du antwortest.</p>}{audioFailed&&<button className={styles.secondary} onClick={()=>audio.current?.load()}>Hörtext erneut laden</button>}</>}
            {['choice','true-false'].includes(task.type)&&<div className={styles.answers} role="radiogroup" aria-label="Deine Antwort">{(task.options??[{id:'true',text:'Richtig'},{id:'false',text:'Falsch'}]).map((option,i,options)=><PressableCard key={option.id} role="radio" aria-checked={draft===option.id} tabIndex={draft===option.id||(!options.some(item=>item.id===draft)&&i===0)?0:-1} className={styles.option} onClick={()=>setDraft(option.id)} onKeyDown={event=>{if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)){event.preventDefault();const next=(i+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+options.length)%options.length;setDraft(options[next].id);(event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus()}}} disabled={pending||expired}><span className={styles.optionCode} aria-hidden={task.type==='true-false'||undefined}>{draft===option.id?<Check size={18} aria-hidden="true"/>:task.type==='true-false'?'':String.fromCharCode(65+i)}</span><span>{option.text}</span></PressableCard>)}</div>}
            {task.type==='matching'&&task.prompts?.map((prompt,i)=><label className={styles.label} key={prompt.id}>{prompt.text}<select className={styles.select} value={Array.isArray(draft)?draft[i]??'':''} disabled={pending||expired} onChange={e=>{const next=Array.isArray(draft)?[...draft]:Array(task.prompts?.length??0).fill('');next[i]=e.target.value;setDraft(next)}}><option value="">Bitte wählen</option>{task.options?.map(option=><option key={option.id} value={option.id} disabled={Array.isArray(draft)&&draft.some((value,index)=>index!==i&&value===option.id)}>{option.text}</option>)}</select></label>)}
            {task.type==='ordering'&&<><p className={styles.muted}>Wähle die Textteile in der richtigen Reihenfolge. Erneutes Antippen entfernt einen Teil.</p>{task.options?.map(option=><PressableCard className={styles.option} key={option.id} aria-pressed={Array.isArray(draft)&&draft.includes(option.id)} disabled={pending||expired} onClick={()=>{const old=Array.isArray(draft)?draft:[];setDraft(old.includes(option.id)?old.filter(id=>id!==option.id):[...old,option.id])}}><span className={styles.optionCode}>{Array.isArray(draft)&&draft.includes(option.id)?draft.indexOf(option.id)+1:'–'}</span>{option.text}</PressableCard>)}</>}
            {task.type==='form'&&task.fields?.map((field,i)=><label className={styles.label} key={field.id}>{field.label}<input className={styles.input} value={Array.isArray(draft)?draft[i]??'':''} maxLength={300} disabled={pending||expired} autoComplete="off" onChange={event=>{const next=Array.isArray(draft)?[...draft]:Array(task.fields?.length??0).fill('');next[i]=event.target.value;setDraft(next)}}/></label>)}
            {task.type==='writing'&&<><label className={styles.label}>Dein Text<textarea className={styles.textarea} value={typeof draft==='object'&&!Array.isArray(draft)?draft.text:typeof draft==='string'?draft:''} maxLength={12000} disabled={pending||expired} onChange={e=>setDraft({text:e.target.value})} placeholder="Schreibe deine Antwort hier …"/></label><p className={styles.muted}>{wordCount(typeof draft==='object'&&!Array.isArray(draft)?draft.text:typeof draft==='string'?draft:'')} Wörter · Bewertung durch deine Lehrkraft</p></>}
            {task.interactionRequired&&<p className={styles.note}><MessageCircle size={20} aria-hidden="true"/>Sprich mit einem Partner. Beantworte mindestens zwei Rückfragen. Beide Stimmen müssen hörbar sein.</p>}
            {task.type==='speaking'&&<SimulationRecording key={task.id} runId={session.id} taskId={task.id} value={draft} preview={preview} disabled={pending||expired} onChange={setDraft} onBusy={setRecordingBusy}/>}
            {task.criteria?.length&&<details className={styles.details}><summary>Worauf wird bei der Bewertung geachtet?</summary><ul className={styles.list}>{task.criteria.map(criterion=><li key={criterion}>{criterion}</li>)}</ul></details>}
          </div>
        </div>
      </motion.section>
      <div className={styles.foot}><PressableCard className={styles.secondary} disabled={index===0||pending||recordingBusy||expired} onClick={()=>save(()=>changeIndex(index-1))}><ArrowLeft size={20} aria-hidden="true"/>Zurück</PressableCard><PressableCard className={styles.primary} aria-label={pending?'Wird gespeichert …':index===session.tasks.length-1?'Zur Auswertung':'Speichern & weiter'} disabled={pending||recordingBusy||expired||audioFailed||!hasTaskAnswer(task,draft)||(task.type==='ordering'&&(!Array.isArray(draft)||draft.length!==task.options?.length))} onClick={()=>save(()=>index<session.tasks.length-1?changeIndex(index+1):setConfirmFinish(true))}>{pending?'Wird gespeichert …':index===session.tasks.length-1?'Zur Auswertung':'Weiter'}<ArrowRight size={20} aria-hidden="true"/></PressableCard></div>
      <div className={`${styles.row} ${styles.between}`}>{!hasTaskAnswer(task,draft)&&<button className={styles.link} disabled={pending||recordingBusy||expired} onClick={()=>save(()=>index<session.tasks.length-1?changeIndex(index+1):setConfirmFinish(true))}>Ohne Antwort weiter</button>}<button className={styles.link} disabled={pending||recordingBusy} onClick={()=>save(()=>setConfirmFinish(true))}>Durchgang beenden</button></div>
    </>}
  </SitovMotionStage>
}

function answerLabel(task:SimulationTask|undefined,answer:SimulationAnswer|null|undefined):string {
  if(!answer)return 'Nicht beantwortet'
  if(task?.type==='true-false'&&typeof answer==='string')return answer==='true'?'Richtig':answer==='false'?'Falsch':answer
  if(typeof answer==='object'&&!Array.isArray(answer))return answer.audioPath?'Audioaufnahme eingereicht':answer.text||'Nicht beantwortet'
  const label=(value:string)=>task?.options?.find(option=>option.id===value)?.text??value
  return Array.isArray(answer)?answer.map((value,index)=>`${task?.fields?.[index]?.label??task?.prompts?.[index]?.text??`${index+1}.`} ${label(value)}`).join('\n'):label(answer)
}
function SimulationResults({session,pending,onNew,onChoose,onRefresh,lang,preview}:{session:SimulationSession;pending:boolean;onNew:()=>void;onChoose:()=>void;onRefresh?:()=>void;lang:string;preview:boolean}) {
  const result=session.result
  const [filter,setFilter]=useState<'all'|'correct'|'wrong'|'open'>('all')
  const [index,setIndex]=useState(0)
  const reduced=useReducedMotionSafe()
  const resultHeading=useRef<HTMLHeadingElement>(null)
  useEffect(()=>{resultHeading.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'})},[])
  const productiveTaskIds=new Set(session.tasks.filter(task=>['writing','speaking'].includes(task.type)).map(task=>task.id))
  const filtered=result?.feedback.filter(item=>filter==='all'||(filter==='correct'?item.correct===true:filter==='wrong'?item.correct===false:productiveTaskIds.has(item.taskId)))??[]
  const feedback=filtered[index]
  const task=session.tasks.find(item=>item.id===feedback?.taskId)
  if(!result)return <p className={styles.error} role="alert">Die Auswertung ist noch nicht verfügbar. Bitte lade die Seite erneut.</p>
  const closed=result.feedback.filter(item=>!productiveTaskIds.has(item.taskId))
  const correct=closed.filter(item=>item.correct===true).length
  const scored=closed.length
  const percentage=scored?correct/scored:0
  const skillResults=[...result.skills,...mainSkills.filter(skill=>!result.skills.some(item=>item.skill===skill)).map(skill=>({skill,title:SIMULATION_SKILL_LABELS[skill],points:0,maxPoints:0,percentage:null,pendingTeacherTasks:0,correctTasks:0,wrongTasks:0}))]
  return <>
    <header className={styles.resultHero}><ProgressRing value={percentage} size={96} stroke={8} tone={percentage>=.7?'success':'accent'} label={`${correct} von ${scored} geschlossenen Aufgaben richtig`}><span className={styles.ringScore}>{correct}/{scored}</span></ProgressRing><div><span className={styles.eyebrow}>{session.title} · Auswertung</span><h1 ref={resultHeading} tabIndex={-1}>{result.headline}</h1><p>{result.examPass===true?'Du hast diese vollständige Sitov-Prüfung bestanden.':result.pendingTeacherTasks>0?'Sieh dir deine Stärken und Fehler an. Deine Lehrkraft ergänzt noch offene Bewertungen.':'Sieh dir deine Stärken und die Aufgaben zum Weiterüben an.'}</p></div></header>
    <p className={styles.muted}>Der Ring zeigt die vollständig richtig gelösten geschlossenen Aufgaben. Offene Antworten werden separat bewertet.</p>
    {result.pendingTeacherTasks>0&&onRefresh&&<PressableCard className={styles.secondary} disabled={pending} onClick={onRefresh}><RotateCcw size={18} aria-hidden="true"/>{pending?'Bewertungen werden geladen …':'Bewertungen aktualisieren'}</PressableCard>}
    <div className={styles.scoreCards}>{skillResults.map(skill=>{const Icon=skillIcons[skill.skill];return <div className={styles.scoreCard} key={skill.skill} data-tone={skill.pendingTeacherTasks?'pending':(skill.percentage??0)<70?'practice':'success'}><span className={styles.row}><Icon size={21} aria-hidden="true"/><strong>{skill.title}</strong></span><strong>{skill.pendingTeacherTasks?'Bewertung offen':skill.percentage===null?'Noch nicht enthalten':`${percentageFormat.format(skill.percentage)} %`}</strong><div className={styles.meter} role="img" aria-label={skill.pendingTeacherTasks?`${skill.title}: Bewertung offen`:skill.percentage===null?`${skill.title}: keine automatische Bewertung`:`${skill.title}: ${percentageFormat.format(skill.percentage)} Prozent`}><motion.span initial={reduced?false:{scaleX:0}} animate={{scaleX:skill.pendingTeacherTasks?0:(skill.percentage??0)/100}} transition={{duration:reduced?0:MOTION.slower,ease:EASE_OUT_SOFT}}/></div><small>{skill.pendingTeacherTasks?`${skill.pendingTeacherTasks} Antwort${skill.pendingTeacherTasks===1?'':'en'} für die Lehrkraft`:skill.maxPoints?`${skill.points} von ${skill.maxPoints} Punkten`:'Geprüfte Aufgaben fehlen noch'}</small></div>})}</div>
    <details className={styles.details}><summary>Wie wird bewertet?</summary><p>{result.description}</p></details>
    {session.coverage.missing.length>0&&<p className={styles.note}><Info size={21} aria-hidden="true"/><span><strong>Die gesamte Prüfung ist noch nicht bewertet.</strong> {session.coverage.note}</span></p>}
    <section className={styles.panel}><h2>Deine Antworten verstehen</h2><div className={styles.filters} aria-label="Auswertung filtern">{([{id:'all',label:'Alle'},{id:'correct',label:'Richtig'},{id:'wrong',label:'Noch üben'},{id:'open',label:'Lehrkraft'}] as const).map(item=><PressableCard key={item.id} aria-pressed={filter===item.id} onClick={()=>{setFilter(item.id);setIndex(0)}}>{item.label} ({result.feedback.filter(f=>item.id==='all'||(item.id==='correct'?f.correct===true:item.id==='wrong'?f.correct===false:productiveTaskIds.has(f.taskId))).length})</PressableCard>)}</div>
      {feedback ? <><div className={`${styles.row} ${styles.between}`}><span className={styles.muted}>Antwort {index+1} von {filtered.length}</span><div className={styles.row}><button className={styles.secondary} aria-label="Vorherige Antwort" disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ArrowLeft size={18}/></button><button className={styles.secondary} aria-label="Nächste Antwort" disabled={index>=filtered.length-1} onClick={()=>setIndex(i=>i+1)}><ArrowRight size={18}/></button></div></div><FeedbackCard feedback={feedback} task={task}/></> : <p className={styles.muted}>Hier gibt es keine Antworten in dieser Gruppe.</p>}
    </section>
    <section className={styles.panel}><h2>Dein nächster Schritt</h2><ul className={styles.list}>{result.nextSteps.map(step=><li key={step}>{step}</li>)}</ul><div className={styles.row}><PressableCard className={styles.primary} disabled={pending} onClick={onNew}><RotateCcw size={20} aria-hidden="true"/>{pending?'Neue Aufgaben werden gewählt …':'Neuer Durchgang'}</PressableCard><a className={styles.secondary} href={`/${lang}/${preview?'sitov-preview':'dashboard'}/exam-preparation`}>Gezielt vorbereiten<ArrowRight size={18} aria-hidden="true"/></a></div><PressableCard className={styles.link} onClick={onChoose}><ArrowLeft size={18} aria-hidden="true"/>Niveau ändern</PressableCard></section>
  </>
}
export function FeedbackCard({feedback,task}:{feedback:SimulationTaskFeedback;task?:SimulationTask}) {
  const Icon=feedback.teacherReview?MessageCircle:feedback.correct===true?CheckCircle2:feedback.correct===false?XCircle:CircleHelp
  return <article className={styles.feedback} data-correct={String(feedback.correct)}><div className={styles.feedbackStatus}><Icon size={23} aria-hidden="true"/>{feedback.teacherReview?'Rückmeldung deiner Lehrkraft':feedback.correct===true?'Richtig gelöst':feedback.correct===false?'Hier kannst du noch üben':'Deine Lehrkraft bewertet diese Antwort'}</div><h3>{feedback.title}</h3>{task?.instruction&&<p>{task.instruction}</p>}<AnswerComparison task={task} feedback={feedback}/>{feedback.answer&&typeof feedback.answer==='object'&&!Array.isArray(feedback.answer)&&feedback.answer.audioUrl&&<audio className={styles.audio} controls src={feedback.answer.audioUrl} aria-label="Deine Aufnahme anhören"/>}<p>{feedback.explanation}</p>{feedback.evidence&&<p className={styles.evidence}><strong>Die entscheidende Stelle:</strong><br/>{feedback.evidence}</p>}{feedback.teacherReview&&<p className={styles.evidence}><strong>{feedback.teacherReview.score} von {feedback.teacherReview.maxPoints} Punkten</strong><br/>{feedback.teacherReview.comment}</p>}{task?.text&&<details className={styles.details}><summary>Aufgabentext noch einmal ansehen</summary><p className={styles.text}>{task.text}</p></details>}{feedback.criteria?.length&&<ul className={styles.list}>{feedback.criteria.map(criterion=><li key={criterion}>{criterion}</li>)}</ul>}</article>
}

function AnswerComparison({task,feedback}:{task?:SimulationTask;feedback:SimulationTaskFeedback}) {
  const expected=feedback.expectedAnswer
  if(Array.isArray(expected)) {
    const answers=Array.isArray(feedback.answer)?feedback.answer:[]
    const label=(value:string)=>task?.options?.find(option=>option.id===value)?.text??value
    return <ol className={styles.answerRows}>{expected.map((value,index)=>{
      const answer=answers[index]??''
      const normalize=(entry:string)=>task?.type==='form'?normalizeSimulationFormAnswer(entry,task.fields?.[index]?.id??task.fields?.[index]?.label):entry
      const correct=normalize(label(answer))===normalize(label(value))
      const Icon=correct?CheckCircle2:XCircle
      return <li key={index} data-correct={correct}><strong className={styles.row}><Icon size={20} aria-hidden="true"/>{task?.fields?.[index]?.label??task?.prompts?.[index]?.text??`Teil ${index+1}`}<span className={styles.srOnly}>{correct?'Richtig':'Noch üben'}</span></strong><div className={styles.comparison}><div><small>Deine Antwort</small>{answer?label(answer):'Nicht beantwortet'}</div><div><small>Passende Lösung</small>{label(value)}</div></div></li>
    })}</ol>
  }
  return <div className={styles.comparison}><div><small>Deine Antwort</small>{answerLabel(task,feedback.answer)}</div>{expected!==undefined&&<div><small>Passende Lösung</small>{answerLabel(task,expected)}</div>}</div>
}
