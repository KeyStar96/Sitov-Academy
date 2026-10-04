'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react'
import { assignExamTeacher } from '@/app/actions/exam-preparation'
import { getSimulationTeacherState, grantSimulationFeature, grantSimulationLevel, reviewExamSimulationTask, sitovAssignSimulationStudent } from '@/app/actions/exam-simulation'
import type { SimulationTeacherState } from '@/lib/exam-simulation/server'
import PressableCard from '@/components/motion/PressableCard'
import { FeedbackCard } from './ExamSimulation'
import styles from './ExamSimulation.module.css'
import TeacherExamSimulationPanel, { SimulationResultsPanel } from './TeacherExamSimulationPanel'
import TeacherSimulationReset from './TeacherSimulationReset'
import teacherStyles from './TeacherExamSimulationPanel.module.css'
import { sitovTeacherText, sitovTeacherError } from '@/lib/exam-simulation/teacher-ui-copy'
import { sitovSimulationCopy } from '@/lib/exam-simulation/ui-copy'
import { sitovSimulationCriterion } from '@/lib/exam-simulation/criterion-copy'

export default function ExamSimulationTeacher({initial,lang,preview=false}:{initial:SimulationTeacherState;lang:string;preview?:boolean}) {
  const t = (text:string, values?:Record<string,string|number>) => sitovTeacherText(lang,text,values)
  const copy = sitovSimulationCopy(lang)
  const [state,setState]=useState(initial)
  const [view,setView]=useState<'access'|'reviews'|'results'>('access')
  const [selected,setSelected]=useState('')
  const [score,setScore]=useState('')
  const [interactionConfirmed,setInteractionConfirmed]=useState(false)
  const [comment,setComment]=useState('')
  const [error,setError]=useState('')
  const [saved,setSaved]=useState(false)
  const [transitionPending,startTransition]=useTransition()
  const [resetPending,setResetPending]=useState(false)
  const pending=transitionPending||resetPending
  const [studentId,setStudentId]=useState(initial.students[0]?.id??'')
  const [teacherId,setTeacherId]=useState(initial.teachers[0]?.id??'')
  const [accessLevel,setAccessLevel]=useState<'B2'|'C1'|'C2'>('B2')
  const [failedRecording,setFailedRecording]=useState('')
  const waiting=state.runs.flatMap(run=>run.session.tasks.filter(task=>{
    const answer=run.session.answers[task.id]
    const evidence=task.type==='speaking'?answer&&typeof answer==='object'&&!Array.isArray(answer)&&!!answer.audioPath:typeof answer==='string'?!!answer.trim():answer&&typeof answer==='object'&&!Array.isArray(answer)&&!!answer.text.trim()
    return ['writing','speaking'].includes(task.type)&&evidence&&!run.session.result?.feedback.find(item=>item.taskId===task.id)?.teacherReview
  }).map(task=>({run,task,key:`${run.session.id}:${task.id}`})))
  const active=waiting.find(item=>item.key===selected)??waiting[0]
  const answer=active?.run.session.answers[active.task.id]
  const productive=answer&&typeof answer==='object'&&!Array.isArray(answer)?answer:null
  const feedback=active?.run.session.result?.feedback.find(item=>item.taskId===active.task.id)
  const refresh=async()=>{const next=await getSimulationTeacherState();if(next.success){setState(next);if(!next.students.some(student=>student.id===studentId))setStudentId(next.students[0]?.id??'');return true}setError(next.error??t("Die Prüfungsdaten konnten nicht geladen werden."));return false}
  const changeFeatureAccess=(enabled:boolean)=>startTransition(async()=>{
    if(preview)return
    setError('');setSaved(false)
    try{const result=await grantSimulationFeature({studentId,enabled});if(!result.success){setError(result.error??t("Die Prüfungsfreigabe konnte nicht geändert werden."));return}if(await refresh())setSaved(true)}catch{setError(t("Die Prüfungsfreigabe konnte nicht geändert werden."))}
  })
  const changeLevelAccess=(enabled:boolean)=>startTransition(async()=>{
    if(preview)return
    setError('');setSaved(false)
    try{const result=await grantSimulationLevel({studentId,level:accessLevel,enabled});if(!result.success){setError(result.error??t("Die Niveau-Freigabe konnte nicht geändert werden."));return}if(await refresh())setSaved(true)}catch{setError(t("Die Niveau-Freigabe konnte nicht geändert werden."))}
  })
  const assignStudent=(id:string)=>startTransition(async()=>{
    if(preview)return
    setError('');setSaved(false)
    try{
      const result=await sitovAssignSimulationStudent({studentId:id})
      if(!result.success){setError(result.error??t("Die Prüfungszuordnung konnte nicht gespeichert werden."));return}
      if(await refresh()){setStudentId(id);setSaved(true)}
    }catch{setError(t("Die Prüfungszuordnung konnte nicht gespeichert werden."))}
  })
  const save=()=>startTransition(async()=>{
    if(!active||preview)return
    setError('');setSaved(false)
    try {
      const result=await reviewExamSimulationTask({runId:active.run.session.id,taskId:active.task.id,score:Number(score),comment,interactionConfirmed:active.task.interactionRequired?interactionConfirmed:undefined,requestId:crypto.randomUUID()})
      if(!result.success){setError(result.error??t("Die Bewertung konnte nicht gespeichert werden."));return}
      await refresh();setScore('');setInteractionConfirmed(false);setComment('');setSelected('');setSaved(true)
    }catch{setError(t("Die Bewertung konnte nicht gespeichert werden. Deine Eingaben bleiben erhalten."))}
  })
  return <div className={styles.root} lang={lang}>
    <header className={styles.hero}><div><span className={styles.eyebrow}>{t("Sitov Academy · Lehrkraft")}</span><h1>{t("Simulierte Prüfung")}</h1><p>{t("Lernende einzeln freigeben, Antworten bewerten und Prüfungsergebnisse ansehen.")}</p></div></header>
    {preview&&<p className={styles.muted}>{t("Vorschau mit fiktiven Lernenden. Freigaben und Bewertungen können hier nicht gespeichert werden.")}</p>}
    <div className={teacherStyles.views} role="group" aria-label={t("Prüfungsbereich")}>{([{id:'access',label:t("Freigaben")},{id:'reviews',label:t("Antworten bewerten")},{id:'results',label:t("Ergebnisse")}] as const).map(item=><button type="button" key={item.id} aria-pressed={view===item.id} disabled={pending} onClick={()=>{setView(item.id);setSaved(false);setError('')}}>{item.label}</button>)}</div>
    {(!state.success||error)&&<p className={styles.error} role="alert">{sitovTeacherError(lang,error||state.error)}</p>}
    {saved&&<p className={styles.note} role="status"><CheckCircle2 size={22}/>{t("Die Änderung ist gespeichert.")}</p>}
    {view==='access'&&<TeacherExamSimulationPanel lang={lang} state={state} studentId={studentId} accessLevel={accessLevel} pending={pending} preview={preview} onStudentChange={id=>{setStudentId(id);setSaved(false);setError('')}} onLevelChange={setAccessLevel} onFeatureChange={changeFeatureAccess} onLevelAccessChange={changeLevelAccess} onAssignStudent={assignStudent} onRefresh={()=>startTransition(async()=>{setError('');setSaved(false);await refresh()})}/>}
    {view==='access'&&<TeacherSimulationReset lang={lang} key={studentId} student={state.students.find(student=>student.id===studentId)} pending={pending} preview={preview} onBusyChange={setResetPending} onComplete={async()=>{setSelected('');setScore('');setComment('');setInteractionConfirmed(false);return refresh()}}/>}
    {view==='results'&&<SimulationResultsPanel lang={lang} state={state}/>}
    {view==='reviews'&&<section className={styles.panel}><div className={`${styles.row} ${styles.between}`}><h2>{waiting.length} {waiting.length === 1 ? t("offene Bewertung") : t("offene Bewertungen")}</h2><button className={styles.link} disabled={pending||preview} onClick={()=>startTransition(async()=>{setScore('');setInteractionConfirmed(false);setComment('');setSelected('');setFailedRecording('');setSaved(false);await refresh()})}>{t("Aktualisieren")}</button></div>
      {active ? <><label className={styles.label}>{t("Abgabe auswählen")}<select className={styles.select} value={active.key} disabled={pending} onChange={event=>{setSelected(event.target.value);setScore('');setInteractionConfirmed(false);setComment('');setSaved(false);setError('')}}>{waiting.map(item=><option value={item.key} key={item.key}>{item.run.studentName} · {item.run.session.level} · {copy.skill(item.task.skill)} · {item.task.title}</option>)}</select></label>
        <h3 lang="de" translate="no">{active.task.title}</h3><p lang="de" translate="no">{active.task.instruction}</p>{active.task.image&&<Image unoptimized className={styles.taskImage} src={active.task.image.src} alt={active.task.image.alt} width={640} height={340}/>}
        {active.task.audio&&<audio className={styles.audio} controls src={active.task.audio.src} aria-label={t("Hörimpuls der Aufgabe")}/>}{active.task.text&&<p className={styles.text} lang="de" translate="no">{active.task.text}</p>}
        <div className={styles.text}><strong>{t("Antwort von")} {active.run.studentName}</strong><br/><span lang="de" translate="no">{productive?.text||(typeof answer==='string'?answer:'')}</span>{!productive?.text&&typeof answer!=='string'&&t('Keine schriftliche Antwort')}</div>
        {productive&&'audioUrl' in productive&&productive.audioUrl&&<audio className={styles.audio} controls src={String(productive.audioUrl)} aria-label={t("Private Sprechaufnahme anhören")} onError={()=>setFailedRecording(active.key)} onCanPlay={()=>setFailedRecording('')}/>}
        {active.task.type==='speaking'&&!productive?.audioPath&&<p className={styles.note}>{t("Eine Sprechbewertung braucht eine Aufnahme. Ein geschriebenes Sprechskript ist dafür kein Nachweis.")}</p>}
        {active.task.type==='speaking'&&productive?.audioPath&&(!productive.audioUrl||failedRecording===active.key)&&<p className={styles.error} role="alert">{t("Die Aufnahme ist gerade nicht verfügbar. Bitte aktualisiere die Abgaben, bevor du diese Sprechleistung bewertest.")}</p>}
        {active.task.criteria?.length&&<><h3>{t("Bewertungskriterien")}</h3><ul className={styles.list}>{active.task.criteria.map(criterion=><li key={criterion}>{sitovSimulationCriterion(lang,criterion)}</li>)}</ul></>}
        {active.task.interactionRequired&&<label className={styles.confirmation}><input type="checkbox" checked={interactionConfirmed} disabled={pending} onChange={event=>setInteractionConfirmed(event.target.checked)}/><span>{t("Ich habe eine tatsächliche Gesprächsleistung geprüft: Der Teilnehmende reagiert auf seinen Gesprächspartner und beteiligt sich am Dialog.")}</span></label>}
        <label className={styles.label}>{t("Punkte (0 bis {count})", {count:active.task.maxPoints})}<input className={styles.input} type="number" min={0} max={active.task.maxPoints} step={1} value={score} disabled={pending} onChange={event=>setScore(event.target.value)}/></label>
        <label className={styles.label}>{t("Stärken und nächster Übungsschritt")}<textarea className={styles.textarea} maxLength={5000} value={comment} disabled={pending} onChange={event=>setComment(event.target.value)} placeholder={t("Was ist gelungen? Was sollte der Teilnehmende konkret üben?")}/></label>
        <PressableCard className={styles.primary} onClick={save} disabled={pending||preview||(active.task.interactionRequired&&Number(score)>0&&!interactionConfirmed)||score===''||!Number.isFinite(Number(score))||Number(score)<0||Number(score)>active.task.maxPoints||comment.trim().length<3||(active.task.type==='speaking'&&(!productive?.audioUrl||failedRecording===active.key))}><MessageCircle size={20}/>{pending?t("Wird gespeichert …"):t("Bewertung speichern")}</PressableCard>
        {feedback?.teacherReview&&<FeedbackCard lang={lang} feedback={feedback} task={active.task}/>}</> : <p className={styles.muted}>{t("Alle eingereichten Antworten sind bewertet. Neue abgeschlossene Durchgänge erscheinen hier.")}</p>}
    </section>}
    {view==='access'&&state.actorRole==='admin'&&<details className={styles.details} open><summary>{t("Prüfungslehrkraft verwalten")}</summary><p className={styles.muted}>{t("Ordne einen Teilnehmenden einer Lehrkraft zu oder ändere die bestehende Zuständigkeit. Die persönliche Prüfungsfreigabe bleibt erhalten.")}</p><label className={styles.label}>{t("Teilnehmender")}<select className={styles.select} value={studentId} disabled={pending||preview} onChange={event=>setStudentId(event.target.value)}>{state.students.map(student=><option key={student.id} value={student.id}>{student.name}</option>)}</select></label><label className={styles.label}>{t("Lehrkraft")}<select className={styles.select} value={teacherId} disabled={pending||preview} onChange={event=>setTeacherId(event.target.value)}>{state.teachers.map(teacher=><option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label><PressableCard className={styles.secondary} disabled={pending||preview||!studentId||!teacherId} onClick={()=>startTransition(async()=>{setError('');setSaved(false);try{const result=await assignExamTeacher({studentId,teacherId,responseDays:7});if(result.success){if(await refresh())setSaved(true)}else setError(result.error??t("Die Zuordnung konnte nicht gespeichert werden."))}catch{setError(t("Die Zuordnung konnte nicht gespeichert werden."))}})}>{t("Zuordnung speichern")}<ArrowRight size={18}/></PressableCard></details>}

    <Link className={styles.link} href={`/${lang}/admin/exam-preparation`}><ArrowRight size={18}/>{t("Abgaben aus der Prüfungsvorbereitung")}</Link>
  </div>
}
