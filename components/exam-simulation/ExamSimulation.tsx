'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, CircleHelp, Clock3, Headphones, Info, ListChecks, LockKeyhole, MessageCircle, Pencil, RotateCcw, Send, XCircle } from 'lucide-react'
import * as actions from '@/app/actions/exam-simulation'
import { SIMULATION_LEVELS, SIMULATION_SKILL_LABELS } from '@/lib/exam-simulation/catalogue'
import { sitovSimulationCopy, sitovSimulationDescription, sitovSimulationError, sitovSimulationHeadline, sitovSimulationNextStep } from '@/lib/exam-simulation/ui-copy'
import { sitovSimulationFeedbackCopy } from '@/lib/exam-simulation/feedback-copy'
import { sitovSimulationCriterion } from '@/lib/exam-simulation/criterion-copy'
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
const hasAnswer = (answer?:SimulationAnswer) => typeof answer==='string' ? answer.trim().length>0 : Array.isArray(answer) ? answer.some(Boolean) : !!answer && (!!answer.text.trim() || !!answer.audioPath)
const hasTaskAnswer = (task:SimulationTask,answer?:SimulationAnswer) => task.type==='speaking' ? !!answer&&typeof answer==='object'&&!Array.isArray(answer)&&!!answer.audioPath : hasAnswer(answer)
const wordCount = (text:string) => text.trim() ? text.trim().split(/\s+/u).length : 0

export default function ExamSimulation({lang,initial,catalog,initialLevel,preview=false}: {
  lang:string; initial:SimulationState; catalog:SimulationProfile[]; initialLevel?:string; preview?:boolean
}) {
  const copy=sitovSimulationCopy(lang)
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
    if(!result.success) {setError(sitovSimulationError(lang,result.error));return false}
    if(result.session){setSession(result.session);if(result.session.status==='completed')setHistory(old=>[result.session!,...old.filter(run=>run.id!==result.session!.id)])}
    if(result.state){setSession(result.state.active ?? result.session ?? null);setHistory(result.state.history)}
    setError('');return true
  }
  const start=(profile:SimulationProfile) => startTransition(async()=>{
    setError('')
    try {
      const input={level:profile.level,provider:profile.provider,mode:'exam' as const,requestId:crypto.randomUUID()}
      accept(await (preview?actions.startPreviewExamSimulation(input):actions.startExamSimulation(input)))
    } catch {setError(copy.t('errorStart'))}
  })
  const reset=()=>{setSession(null);setLevel(null);setError('')}
  if(initial.accessLocked&&!preview) return <SitovMotionStage className={styles.root} lang={copy.lang}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>Sitov Academy</span><h1 ref={heading} tabIndex={-1}>{copy.t('title')}</h1></div><LockKeyhole size={44} aria-hidden="true"/></header>
    <section className={styles.panel} role="status"><h2>{copy.t('gateTitle')}</h2><p>{copy.t('gateBody')}</p><p className={styles.muted}>{copy.t('gateHint')}</p></section>
    <a className={styles.link} href={`/${lang}/dashboard/exam-preparation`}><BookOpen size={18} aria-hidden="true"/>{copy.t('preparation')}</a>
  </SitovMotionStage>
  if(session) return <div className={styles.root} lang={copy.lang}>
    {preview&&<p className={styles.tag}>{copy.t('preview')}</p>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {session.status==='completed' ? <SimulationResults session={session} pending={pending} onNew={()=>{
      const profile=catalog.find(p=>p.id===session.profileId)
      if(profile)start(profile);else reset()
    }} onChoose={reset} onRefresh={preview?undefined:()=>startTransition(async()=>{try{const next=await actions.getSimulationState();if(!next.available){setError(sitovSimulationError(lang,next.error,'errorReviews'));return}const current=next.history.find(run=>run.id===session.id);if(current)accept({success:true,session:current});setHistory(next.history)}catch{setError(copy.t('errorReviews'))}})} lang={lang} preview={preview}/> : <SimulationRunner key={session.id} lang={lang} session={session} preview={preview} onChange={accept} onError={setError}/>}
  </div>
  return <SitovMotionStage className={styles.root} lang={copy.lang}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>Sitov Academy</span><h1 ref={heading} tabIndex={-1}>{copy.t('title')}</h1>{stage!=='start'&&<p>{copy.t('chooseLevel')}</p>}</div><SimulationGraphic/></header>
    <StepIndicator lang={lang} current={stage==='level'?0:1}/>
    {preview&&<p className={styles.tag}>{copy.t('uiPreview')}</p>}
    {!initial.available&&!preview&&<p className={styles.note} role="status"><Info size={20}/>{sitovSimulationError(lang,initial.error,'errorUnavailable')}</p>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <motion.div className={styles.stage} key={stage} initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:MOTION.slow,ease:EASE_OUT_SOFT}}>
      {!selected ? <>
        <h2 className={styles.srOnly}>{copy.t('examLevel')}</h2>
        <div className={`${styles.grid} ${styles.levels}`}>{SIMULATION_LEVELS.map(item=><PressableCard key={item} className={styles.card} onClick={()=>{setLevel(item);setError('')}} aria-label={`${item} – ${copy.level(item)}`}><strong className={styles.levelCode}>{item}</strong><small>{copy.level(item)}</small><ArrowRight className={styles.cardArrow} size={20} aria-hidden="true"/></PressableCard>)}</div>
      </> : <>
        <PressableCard className={styles.link} onClick={()=>setLevel(null)}><ArrowLeft size={18} aria-hidden="true"/>{copy.t('changeLevel')}</PressableCard>
        <section className={styles.panel}><div><span className={styles.eyebrow}>{copy.t('ready')}</span><h2>{copy.t('selectedExam',{level:selected.level})}</h2></div>
          <div className={styles.row}><span className={styles.tag}><Clock3 size={16} aria-hidden="true"/>{copy.t('minutes',{count:selected.practiceMinutes})}</span><span className={styles.tag}><RotateCcw size={16} aria-hidden="true"/>{copy.t('newTasks')}</span></div>
          <p>{copy.t('skillsIntro')}</p><p className={styles.note} data-sitov-exam-language-notice=""><Info size={20} aria-hidden="true"/><span><strong>{copy.t('germanNoticeTitle')}</strong><br/>{copy.t('germanNotice')}</span></p>
          {!selected.fullExamReleased&&<p className={styles.note} role="status">{selected.blockers.some(note=>note.includes('Niveau-Freigabe'))?copy.t('levelLocked'):copy.t('preparing')}</p>}
          <PressableCard className={styles.primary} disabled={pending||(!initial.available&&!preview)||!selected.available||!selected.fullExamReleased} onClick={()=>start(selected)}>{pending?copy.t('assembling'):copy.t('startExam')}<ArrowRight size={22} aria-hidden="true"/></PressableCard>
          <p className={styles.muted}>{copy.t('startHint')}</p>
        </section>
        <details className={styles.details}><summary>{copy.t('how')}</summary><p>{copy.lang==='de'?selected.description:copy.t('profileDescription')}</p><div className={styles.skillPlan}>{mainSkills.map(skill=>{const Icon=skillIcons[skill];return <div key={skill}><Icon size={22} aria-hidden="true"/><span><strong>{copy.skill(skill)}</strong><small>{skill==='writing'||skill==='speaking'?copy.t('teacherAssessment'):copy.t('automaticAssessment')}</small></span></div>})}</div><p>{copy.t('privacy')}</p><p><strong>{copy.t('assessment')}</strong> {copy.lang==='de'?selected.passRule:copy.t('passRule')}</p><p className={styles.muted}>{copy.t('examDisclaimer')}</p></details>
      </>}
    </motion.div>
    {history.length>0&&<details className={styles.details}><summary>{copy.t('history',{count:history.length})}</summary><div className={styles.reviewOverview}>{history.map(run=><button key={run.id} onClick={()=>setSession(run)}><span><strong>{copy.t('title')} · {run.level}</strong><small className={styles.muted}> · {new Date(run.completedAt??run.startedAt).toLocaleDateString(copy.locale)}</small></span><ArrowRight size={18} aria-hidden="true"/></button>)}</div></details>}
    <a className={styles.link} href={`/${lang}/${preview?'sitov-preview':'dashboard'}/exam-preparation`}><BookOpen size={18} aria-hidden="true"/>{copy.t('preparation')}</a>
  </SitovMotionStage>
}

function SimulationGraphic() {
  const reduced=useReducedMotionSafe()
  return <div className={styles.graphic} aria-hidden="true">{mainSkills.map((skill,index)=>{const Icon=skillIcons[skill];return <motion.span key={skill} initial={false} animate={reduced?{y:0}:{y:[0,-5,0]}} transition={{duration:MOTION.slower,delay:index*.1,ease:EASE_OUT_SOFT}}><Icon size={25}/></motion.span>})}</div>
}
function StepIndicator({current,lang}:{current:number;lang:string}) {
  const copy=sitovSimulationCopy(lang)
  return <ol className={styles.steps} aria-label={copy.t('journey')}>{[copy.t('level'),copy.t('start')].map((label,index)=><li key={label} aria-current={current===index?'step':undefined}>{index>0&&<span className={styles.stepLine} aria-hidden="true"/>}<span className={styles.stepNumber} aria-hidden="true">{current>index?<Check size={14}/>:index+1}</span>{label}</li>)}</ol>
}

function SimulationRunner({session,preview,onChange,onError,lang}:{lang:string;session:SimulationSession;preview:boolean;onChange:(result:SimulationActionResult)=>boolean;onError:(text:string)=>void}) {
  const copy=sitovSimulationCopy(lang)
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
    }catch{onError(copy.t('errorSave'))}
  })
  const finish=()=>startTransition(async()=>{
    try {const input={runId:session.id,requestId:crypto.randomUUID()};onChange(await (preview?actions.finishPreviewExamSimulation(input):actions.finishExamSimulation(input)))}
    catch{onError(copy.t('errorResults'))}
  })
  const answered=session.tasks.filter(item=>hasTaskAnswer(item,session.answers[item.id])).length
  if(!task)return <p className={styles.error} role="alert">{copy.t('errorNoTasks')}</p>
  const Icon=skillIcons[task.skill]
  return <SitovMotionStage className={`${styles.root} ${styles.runner}`}>
    <header className={styles.runHead}><div className={`${styles.row} ${styles.between}`}><h1>{session.level} · {copy.t('title')}</h1><span className={styles.timer} data-expiring={remaining<300}><Clock3 size={18} aria-hidden="true"/>{now?`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:copy.t('timerLoading')}</span></div><div className={`${styles.row} ${styles.between}`}><span className={styles.row}><Icon size={18} aria-hidden="true"/>{copy.skill(task.skill)} · {copy.t('taskCount',{count:index+1,total:session.tasks.length})}</span><span className={styles.muted}>{copy.t('answered',{count:answered})}</span></div><div className={styles.runTools}><div className={styles.meter} role="progressbar" aria-label={copy.t('answeredTasks')} aria-valuemin={0} aria-valuemax={session.tasks.length} aria-valuenow={answered}><motion.span initial={false} animate={{scaleX:answered/session.tasks.length}} transition={{duration:reduced?0:MOTION.slow}}/></div><button className={styles.link} aria-label={copy.t('taskOverview')} onClick={()=>save(()=>setOverview(value=>!value))} disabled={pending||recordingBusy||expired}><ListChecks size={18} aria-hidden="true"/>{copy.t('overview')}</button></div></header>
    {session.mode!=='exam'&&<p className={styles.muted}>{copy.t('startHint')}</p>}
    {overview&&<section className={styles.panel} aria-label={copy.t('taskOverview')}><p>{copy.t('reopen')}</p><div className={styles.questionGrid}>{session.tasks.map((item,i)=><button key={item.id} data-answered={hasTaskAnswer(item,session.answers[item.id])} aria-current={i===index?'true':undefined} aria-label={copy.t('taskState',{count:i+1,state:copy.t(hasTaskAnswer(item,session.answers[item.id])?'stateAnswered':'stateOpen')})} onClick={()=>changeIndex(i)}>{i+1}</button>)}</div></section>}
    {confirmFinish||expired ? <section className={styles.panel}><h2>{expired?copy.t('timeOver'):copy.t('finishQuestion')}</h2><p>{copy.t('answeredOf',{count:answered,total:session.tasks.length})} {session.tasks.length-answered>0?copy.t('unansweredCount'):''}</p><p className={styles.muted}>{copy.t('finishHint')}</p><PressableCard className={styles.primary} disabled={pending} onClick={finish}>{pending?copy.t('assessing'):copy.t('finish')}<Send size={20} aria-hidden="true"/></PressableCard>{!expired&&<PressableCard className={styles.secondary} onClick={()=>setConfirmFinish(false)}>{copy.t('continue')}</PressableCard>}</section> : <>
      <motion.section key={task.id} className={styles.panel} initial={reduced?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{duration:reduced?0:MOTION.base,ease:EASE_OUT_SOFT}}>
        <header className={styles.taskHeader} lang="de" translate="no" data-audio-question={!!task.audio&&['choice','true-false'].includes(task.type)}><h2 ref={heading} tabIndex={-1}>{task.audio&&task.type==='true-false'?task.text:task.audio&&task.type==='choice'?task.instruction:task.title}</h2>{(!task.audio||!['choice','true-false'].includes(task.type))&&<p>{task.instruction}</p>}</header>
        <div className={styles.taskBody} data-split={!!task.text&&['choice','true-false'].includes(task.type)}>
          {task.image&&<Image className={styles.taskImage} lang="de" translate="no" src={task.image.src} alt={task.image.alt} width={1536} height={1024} sizes="(max-width: 700px) calc(100vw - 40px), 720px"/>}
          {task.text&&!(task.audio&&task.type==='true-false')&&<div className={styles.text} lang="de" translate="no">{task.text}</div>}
          <div className={styles.answers}>
            {task.audio&&<><audio ref={audio} className={styles.audio} controls src={task.audio.src} preload="none" aria-label={copy.t('examAudio')} onError={()=>setAudioFailed(true)} onCanPlay={()=>setAudioFailed(false)} onPlay={()=>{
              const fresh=(audioPlays[task.id]??0)===0||audio.current?.currentTime===0
              if(fresh&&(audioPlays[task.id]??0)>=task.audio!.plays){audio.current?.pause();return}
              if(fresh)setAudioPlays(old=>({...old,[task.id]:(old[task.id]??0)+1}))
            }}/><p className={styles.muted}>{copy.t('audioPlays',{count:task.audio.plays})}</p>{audioFailed&&<p role="alert" className={styles.error}>{copy.t('errorAudio')}</p>}{audioFailed&&<button className={styles.secondary} onClick={()=>audio.current?.load()}>{copy.t('reloadAudio')}</button>}</>}
            {['choice','true-false'].includes(task.type)&&<div className={styles.answers} role="radiogroup" aria-label={copy.t('answer')}>{(task.options??[{id:'true',text:'Richtig'},{id:'false',text:'Falsch'}]).map((option,i,options)=><PressableCard key={option.id} role="radio" aria-checked={draft===option.id} tabIndex={draft===option.id||(!options.some(item=>item.id===draft)&&i===0)?0:-1} className={styles.option} onClick={()=>setDraft(option.id)} onKeyDown={event=>{if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(event.key)){event.preventDefault();const next=(i+(event.key==='ArrowRight'||event.key==='ArrowDown'?1:-1)+options.length)%options.length;setDraft(options[next].id);(event.currentTarget.parentElement?.children[next] as HTMLElement)?.focus()}}} disabled={pending||expired}><span className={styles.optionCode} aria-hidden={task.type==='true-false'||undefined}>{draft===option.id?<Check size={18} aria-hidden="true"/>:task.type==='true-false'?'':String.fromCharCode(65+i)}</span><span lang="de" translate="no">{option.text}</span></PressableCard>)}</div>}
            {task.type==='matching'&&task.prompts?.map((prompt,i)=><label className={styles.label} key={prompt.id}><span lang="de" translate="no">{prompt.text}</span><select className={styles.select} value={Array.isArray(draft)?draft[i]??'':''} disabled={pending||expired} onChange={e=>{const next=Array.isArray(draft)?[...draft]:Array(task.prompts?.length??0).fill('');next[i]=e.target.value;setDraft(next)}}><option value="">{copy.t('choose')}</option>{task.options?.map(option=><option key={option.id} value={option.id} disabled={Array.isArray(draft)&&draft.some((value,index)=>index!==i&&value===option.id)} lang="de" translate="no">{option.text}</option>)}</select></label>)}
            {task.type==='ordering'&&<><p className={styles.muted}>{copy.t('orderingHint')}</p>{task.options?.map(option=><PressableCard className={styles.option} key={option.id} aria-pressed={Array.isArray(draft)&&draft.includes(option.id)} disabled={pending||expired} onClick={()=>{const old=Array.isArray(draft)?draft:[];setDraft(old.includes(option.id)?old.filter(id=>id!==option.id):[...old,option.id])}}><span className={styles.optionCode}>{Array.isArray(draft)&&draft.includes(option.id)?draft.indexOf(option.id)+1:'–'}</span><span lang="de" translate="no">{option.text}</span></PressableCard>)}</>}
            {task.type==='form'&&task.fields?.map((field,i)=><label className={styles.label} key={field.id}><span lang="de" translate="no">{field.label}</span><input lang="de" translate="no" className={styles.input} value={Array.isArray(draft)?draft[i]??'':''} maxLength={300} disabled={pending||expired} autoComplete="off" onChange={event=>{const next=Array.isArray(draft)?[...draft]:Array(task.fields?.length??0).fill('');next[i]=event.target.value;setDraft(next)}}/></label>)}
            {task.type==='writing'&&<><label className={styles.label}>{copy.t('yourText')}<textarea lang="de" translate="no" className={styles.textarea} value={typeof draft==='object'&&!Array.isArray(draft)?draft.text:typeof draft==='string'?draft:''} maxLength={12000} disabled={pending||expired} onChange={e=>setDraft({text:e.target.value})} placeholder={copy.t('textPlaceholder')}/></label><p className={styles.muted}>{copy.t('wordCount',{count:wordCount(typeof draft==='object'&&!Array.isArray(draft)?draft.text:typeof draft==='string'?draft:'')})}</p></>}
            {task.interactionRequired&&<p className={styles.note} lang="de" translate="no"><MessageCircle size={20} aria-hidden="true"/>Sprich mit einem Partner. Beantworte mindestens zwei Rückfragen. Beide Stimmen müssen hörbar sein.</p>}
            {task.type==='speaking'&&<SimulationRecording lang={lang} key={task.id} runId={session.id} taskId={task.id} value={draft} preview={preview} disabled={pending||expired} onChange={setDraft} onBusy={setRecordingBusy}/>}
            {task.criteria?.length&&<details className={styles.details}><summary>{copy.t('criteria')}</summary><ul className={styles.list}>{task.criteria.map(criterion=><li key={criterion} lang="de" translate="no">{criterion}</li>)}</ul></details>}
          </div>
        </div>
      </motion.section>
      <div className={styles.foot}><PressableCard className={styles.secondary} disabled={index===0||pending||recordingBusy||expired} onClick={()=>save(()=>changeIndex(index-1))}><ArrowLeft size={20} aria-hidden="true"/>{copy.t('back')}</PressableCard><PressableCard className={styles.primary} aria-label={pending?copy.t('saving'):index===session.tasks.length-1?copy.t('toResults'):copy.t('saveNext')} disabled={pending||recordingBusy||expired||audioFailed||!hasTaskAnswer(task,draft)||(task.type==='ordering'&&(!Array.isArray(draft)||draft.length!==task.options?.length))} onClick={()=>save(()=>index<session.tasks.length-1?changeIndex(index+1):setConfirmFinish(true))}>{pending?copy.t('saving'):index===session.tasks.length-1?copy.t('toResults'):copy.t('next')}<ArrowRight size={20} aria-hidden="true"/></PressableCard></div>
      <div className={`${styles.row} ${styles.between}`}>{!hasTaskAnswer(task,draft)&&<button className={styles.link} disabled={pending||recordingBusy||expired} onClick={()=>save(()=>index<session.tasks.length-1?changeIndex(index+1):setConfirmFinish(true))}>{copy.t('skip')}</button>}<button className={styles.link} disabled={pending||recordingBusy} onClick={()=>save(()=>setConfirmFinish(true))}>{copy.t('endAttempt')}</button></div>
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
  const copy=sitovSimulationCopy(lang)
  const percentageFormat=new Intl.NumberFormat(copy.locale,{maximumFractionDigits:1})
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
  if(!result)return <p className={styles.error} role="alert">{copy.t('errorResultPending')}</p>
  const closed=result.feedback.filter(item=>!productiveTaskIds.has(item.taskId))
  const correct=closed.filter(item=>item.correct===true).length
  const scored=closed.length
  const percentage=scored?correct/scored:0
  const skillResults=[...result.skills,...mainSkills.filter(skill=>!result.skills.some(item=>item.skill===skill)).map(skill=>({skill,title:SIMULATION_SKILL_LABELS[skill],points:0,maxPoints:0,percentage:null,pendingTeacherTasks:0,correctTasks:0,wrongTasks:0}))]
  return <>
    <header className={styles.resultHero}><ProgressRing value={percentage} size={96} stroke={8} tone={percentage>=.7?'success':'accent'} label={copy.t('resultRing',{count:correct,total:scored})}><span className={styles.ringScore}>{correct}/{scored}</span></ProgressRing><div><span className={styles.eyebrow}>{copy.t('title')} · {session.level} · {copy.t('results')}</span><h1 ref={resultHeading} tabIndex={-1}>{sitovSimulationHeadline(lang,result)}</h1><p>{result.examPass===true?copy.t('passedBody'):result.pendingTeacherTasks>0?copy.t('pendingBody'):copy.t('practiceBody')}</p></div></header>
    <p className={styles.muted}>{copy.t('ringHint')}</p>
    {result.pendingTeacherTasks>0&&onRefresh&&<PressableCard className={styles.secondary} disabled={pending} onClick={onRefresh}><RotateCcw size={18} aria-hidden="true"/>{pending?copy.t('loadingReviews'):copy.t('refreshReviews')}</PressableCard>}
    <div className={styles.scoreCards}>{skillResults.map(skill=>{const Icon=skillIcons[skill.skill];return <div className={styles.scoreCard} key={skill.skill} data-tone={skill.pendingTeacherTasks?'pending':(skill.percentage??0)<70?'practice':'success'}><span className={styles.row}><Icon size={21} aria-hidden="true"/><strong>{copy.skill(skill.skill)}</strong></span><strong>{skill.pendingTeacherTasks?copy.t('pendingReview'):skill.percentage===null?copy.t('notIncluded'):`${percentageFormat.format(skill.percentage)} %`}</strong><div className={styles.meter} role="img" aria-label={`${copy.skill(skill.skill)}: ${skill.pendingTeacherTasks?copy.t('pendingReview'):skill.percentage===null?copy.t('noAutomatic'):`${percentageFormat.format(skill.percentage)} ${copy.t('percent')}`}`}><motion.span initial={reduced?false:{scaleX:0}} animate={{scaleX:skill.pendingTeacherTasks?0:(skill.percentage??0)/100}} transition={{duration:reduced?0:MOTION.slower,ease:EASE_OUT_SOFT}}/></div><small>{skill.pendingTeacherTasks?copy.lang==='de'?`${skill.pendingTeacherTasks} Antwort${skill.pendingTeacherTasks===1?'':'en'} für die Lehrkraft`:copy.t('teacherAnswers',{count:skill.pendingTeacherTasks}):skill.maxPoints?copy.t('points',{count:skill.points,total:skill.maxPoints}):copy.t('tasksMissing')}</small></div>})}</div>
    <details className={styles.details}><summary>{copy.t('howAssessed')}</summary><p>{sitovSimulationDescription(lang,result)}</p></details>
    {session.coverage.missing.length>0&&<p className={styles.note}><Info size={21} aria-hidden="true"/><span><strong>{copy.t('incompleteResult')}</strong> {copy.lang==='de'?session.coverage.note:copy.t('missingCoverage')}</span></p>}
    <section className={styles.panel}><h2>{copy.t('understandAnswers')}</h2><div className={styles.filters} aria-label={copy.t('filterResults')}>{([{id:'all',label:copy.t('all')},{id:'correct',label:copy.t('correct')},{id:'wrong',label:copy.t('practise')},{id:'open',label:copy.t('teacher')}] as const).map(item=><PressableCard key={item.id} aria-pressed={filter===item.id} onClick={()=>{setFilter(item.id);setIndex(0)}}>{item.label} ({result.feedback.filter(f=>item.id==='all'||(item.id==='correct'?f.correct===true:item.id==='wrong'?f.correct===false:productiveTaskIds.has(f.taskId))).length})</PressableCard>)}</div>
      {feedback ? <><div className={`${styles.row} ${styles.between}`}><span className={styles.muted}>{copy.t('answerCount',{count:index+1,total:filtered.length})}</span><div className={styles.row}><button className={styles.secondary} aria-label={copy.t('previousAnswer')} disabled={index===0} onClick={()=>setIndex(i=>i-1)}><ArrowLeft size={18}/></button><button className={styles.secondary} aria-label={copy.t('nextAnswer')} disabled={index>=filtered.length-1} onClick={()=>setIndex(i=>i+1)}><ArrowRight size={18}/></button></div></div><FeedbackCard feedback={feedback} task={task} lang={lang}/></> : <p className={styles.muted}>{copy.t('noAnswers')}</p>}
    </section>
    <section className={styles.panel}><h2>{copy.t('nextStep')}</h2><ul className={styles.list}>{result.nextSteps.map(step=><li key={step}>{sitovSimulationNextStep(lang,step)}</li>)}</ul><div className={styles.row}><PressableCard className={styles.primary} disabled={pending} onClick={onNew}><RotateCcw size={20} aria-hidden="true"/>{pending?copy.t('choosingNew'):copy.t('newAttempt')}</PressableCard><a className={styles.secondary} href={`/${lang}/${preview?'sitov-preview':'dashboard'}/exam-preparation`}>{copy.t('targetedPreparation')}<ArrowRight size={18} aria-hidden="true"/></a></div><PressableCard className={styles.link} onClick={onChoose}><ArrowLeft size={18} aria-hidden="true"/>{copy.t('changeLevel')}</PressableCard></section>
  </>
}
export function FeedbackCard({feedback,task,lang='de'}:{feedback:SimulationTaskFeedback;task?:SimulationTask;lang?:string}) {
  const copy=sitovSimulationCopy(lang)
  const Icon=feedback.teacherReview?MessageCircle:feedback.correct===true?CheckCircle2:feedback.correct===false?XCircle:CircleHelp
  const prefix=feedback.explanation.match(/^(Die passende Aussage ist: |Das Hauptthema ist: |Die Aussage stimmt\. |Die Aussage stimmt nicht\. )([\s\S]*)$/)
  const conditionalKey=feedback.explanation==='Keine mündliche Aufnahme eingereicht. Ein Vorbereitungstext ersetzt diese Leistung nicht.'?'missingSpeaking':feedback.explanation==='Kein Text eingereicht. Diese Leistung wurde mit null Punkten erfasst.'?'missingWriting':feedback.explanation==='Für diese Gesprächsaufgabe fehlt die Bestätigung einer echten Interaktion. Positive Punkte allein belegen keine ausreichende Gesprächsleistung.'?'missingInteraction':null
  const translated=prefix?null:conditionalKey?copy.t(conditionalKey):sitovSimulationFeedbackCopy(lang,feedback.explanation)
  const explanation=translated??(prefix?copy.t(prefix[1].startsWith('Die passende')?'solutionPhrase':prefix[1].startsWith('Das Hauptthema')?'mainThemePhrase':prefix[1].startsWith('Die Aussage stimmt nicht')?'falseStatement':'trueStatement'):copy.lang==='de'?feedback.explanation:copy.t('explanationFallback'))
  return <article className={styles.feedback} data-correct={String(feedback.correct)} lang={copy.lang}>
    <div className={styles.feedbackStatus}><Icon size={23} aria-hidden="true"/>{copy.t(feedback.teacherReview?'teacherFeedback':feedback.correct===true?'correctFeedback':feedback.correct===false?'practiseFeedback':'teacherWillAssess')}</div>
    <h3 lang="de" translate="no">{feedback.title}</h3>
    {task?.instruction&&<p lang="de" translate="no">{task.instruction}</p>}
    <AnswerComparison task={task} feedback={feedback} lang={lang}/>
    {feedback.answer&&typeof feedback.answer==='object'&&!Array.isArray(feedback.answer)&&feedback.answer.audioUrl&&<audio className={styles.audio} controls src={feedback.answer.audioUrl} aria-label={copy.t('listenOwn')}/>}
    <p>{explanation}{prefix&&!translated&&<><br/><span lang="de" translate="no">{prefix[2]}</span></>}</p>
    {feedback.evidence&&<p className={styles.evidence}><strong>{copy.t('evidence')}</strong><br/><span lang="de" translate="no">{feedback.evidence}</span></p>}
    {feedback.teacherReview&&<p className={styles.evidence}><strong>{copy.t('points',{count:feedback.teacherReview.score,total:feedback.teacherReview.maxPoints})}</strong><br/><span lang="" translate="no">{feedback.teacherReview.comment}</span></p>}
    {task?.text&&<details className={styles.details}><summary>{copy.t('showTask')}</summary><p className={styles.text} lang="de" translate="no">{task.text}</p></details>}
    {feedback.criteria?.length&&<ul className={styles.list}>{feedback.criteria.map(criterion=><li key={criterion}>{sitovSimulationCriterion(lang,criterion)}</li>)}</ul>}
  </article>
}

function AnswerValue({task,answer,lang}:{task?:SimulationTask;answer:SimulationAnswer|null|undefined;lang:string}) {
  const copy=sitovSimulationCopy(lang)
  if(!answer||(typeof answer==='object'&&!Array.isArray(answer)&&!answer.audioPath&&!answer.text))return <span>{copy.t('unanswered')}</span>
  if(typeof answer==='object'&&!Array.isArray(answer)&&answer.audioPath)return <span>{copy.t('recordingSubmitted')}</span>
  return <span lang="de" translate="no">{answerLabel(task,answer)}</span>
}

function AnswerComparison({task,feedback,lang}:{task?:SimulationTask;feedback:SimulationTaskFeedback;lang:string}) {
  const copy=sitovSimulationCopy(lang)
  const expected=feedback.expectedAnswer
  if(Array.isArray(expected)) {
    const answers=Array.isArray(feedback.answer)?feedback.answer:[]
    const label=(value:string)=>task?.options?.find(option=>option.id===value)?.text??value
    return <ol className={styles.answerRows}>{expected.map((value,index)=>{
      const answer=answers[index]??''
      const normalize=(entry:string)=>task?.type==='form'?normalizeSimulationFormAnswer(entry,task.fields?.[index]?.id??task.fields?.[index]?.label):entry
      const correct=normalize(label(answer))===normalize(label(value))
      const Icon=correct?CheckCircle2:XCircle
      const sourceLabel=task?.fields?.[index]?.label??task?.prompts?.[index]?.text
      return <li key={index} data-correct={correct}><strong className={styles.row}><Icon size={20} aria-hidden="true"/>{sourceLabel?<span lang="de" translate="no">{sourceLabel}</span>:copy.t('part',{count:index+1})}<span className={styles.srOnly}>{copy.t(correct?'correct':'practise')}</span></strong><div className={styles.comparison}><div><small>{copy.t('answer')}</small>{answer?<span lang="de" translate="no">{label(answer)}</span>:copy.t('unanswered')}</div><div><small>{copy.t('solution')}</small><span lang="de" translate="no">{label(value)}</span></div></div></li>
    })}</ol>
  }
  return <div className={styles.comparison}><div><small>{copy.t('answer')}</small><AnswerValue task={task} answer={feedback.answer} lang={lang}/></div>{expected!==undefined&&<div><small>{copy.t('solution')}</small><AnswerValue task={task} answer={expected} lang={lang}/></div>}</div>
}
