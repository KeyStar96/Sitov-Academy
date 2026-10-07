'use client'

import { useState } from 'react'
import { CheckCircle2, LockKeyhole, RefreshCw, UserPlus } from 'lucide-react'
import type { SimulationTeacherState } from '@/lib/exam-simulation/server'
import { SIMULATION_OFFERED_LEVELS } from '@/lib/exam-simulation/catalogue'
import { FeedbackCard } from './ExamSimulation'
import styles from './ExamSimulation.module.css'
import teacherStyles from './TeacherExamSimulationPanel.module.css'
import { sitovTeacherText } from '@/lib/exam-simulation/teacher-ui-copy'
import { sitovSimulationCopy, sitovSimulationHeadline, sitovSimulationDescription } from '@/lib/exam-simulation/ui-copy'

/** Exam grants always use their own offered levels, independent from trainer sublevels. */
type SitovExamAccessLevel = (typeof SIMULATION_OFFERED_LEVELS)[number]

export default function TeacherExamSimulationPanel({ lang = 'de', state, studentId, accessLevel, pending, preview = false, onStudentChange, onLevelChange, onFeatureChange, onLevelAccessChange, onAssignStudent, onRefresh }: {
  lang?: string
  state: SimulationTeacherState
  studentId: string
  accessLevel: SitovExamAccessLevel
  pending: boolean
  preview?: boolean
  onStudentChange: (studentId: string) => void
  onLevelChange: (level: SitovExamAccessLevel) => void
  onFeatureChange: (enabled: boolean) => void
  onLevelAccessChange: (enabled: boolean) => void
  onAssignStudent: (studentId: string) => void
  onRefresh: () => void
}) {
  const t = (text:string, values?:Record<string,string|number>) => sitovTeacherText(lang,text,values)
  const [search, setSearch] = useState('')
  const [candidateId, setCandidateId] = useState('')
  const candidates = (state.unassignedStudents ?? []).filter(item => item.name.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  const candidate = candidates.find(item => item.id === candidateId) ?? candidates[0]
  const student = state.students.find(item => item.id === studentId)
  const assignment = state.assignments.find(item => item.studentId === studentId)
  const teacher = state.teachers.find(item => item.id === assignment?.teacherId)
  const featureEnabled = state.featureGrants.some(grant => grant.studentId === studentId)
  const levelEnabled = state.levelGrants.some(grant => grant.studentId === studentId && grant.level === accessLevel)
  return <>
  <section className={styles.panel} aria-labelledby="sitov-simulation-access-title">
    <div className={teacherStyles.accessHeading}><h2 id="sitov-simulation-access-title">{t("Freigaben verwalten")}</h2><button type="button" className={styles.link} disabled={pending || preview} onClick={onRefresh}><RefreshCw size={18} aria-hidden="true"/>{t("Aktualisieren")}</button></div>
    <p className={styles.muted}>{t("Alle Lernenden sind zunächst gesperrt, unabhängig von ihrem Niveau. Öffne die simulierte Prüfung gezielt für einen Teilnehmenden.")}</p>
    <div className={teacherStyles.accessCounts} aria-label={t("Freigabeübersicht")}><span><strong>{state.students.length}</strong> {state.actorRole === 'admin' ? t("Lernende") : t("zugeordnete Lernende")}</span><span><strong>{state.students.filter(item=>state.featureGrants.some(grant=>grant.studentId===item.id)).length}</strong> {t("freigegeben")}</span><span><strong>{state.students.filter(item=>!state.featureGrants.some(grant=>grant.studentId===item.id)).length}</strong> {t("gesperrt")}</span></div>
    {!state.students.length ? <p className={styles.note}>{state.actorRole === 'admin' ? t("Es sind noch keine Lernenden vorhanden.") : (state.unassignedStudents?.length ? t("Dir sind noch keine Lernenden zugeordnet. Wähle unten einen Teilnehmenden und übernimm die Prüfungsbetreuung direkt.") : t("Dir sind noch keine Lernenden zugeordnet. Die Administration kann eine bestehende Prüfungszuordnung ändern."))}</p> : <>
      <label className={styles.label}>{t("Teilnehmender für die Prüfung")}<select className={styles.select} value={studentId} disabled={pending || !state.success} onChange={event => onStudentChange(event.target.value)}>{state.students.map(item => <option key={item.id} value={item.id}>{item.name} · {state.featureGrants.some(grant => grant.studentId === item.id) ? t("Freigegeben") : t("Gesperrt")}</option>)}</select></label>
      <p className={teacherStyles.accessStatus} data-enabled={featureEnabled}>{featureEnabled ? <CheckCircle2 size={22} aria-hidden="true" /> : <LockKeyhole size={22} aria-hidden="true" />}<span><strong>{student?.name}: {featureEnabled ? t("Prüfung freigegeben") : t("Prüfung gesperrt")}</strong><small>{featureEnabled ? t("Der Prüfungsbereich ist geöffnet. Gib jedes Prüfungsniveau unten separat frei.") : t("Trainer-Freigaben öffnen keine simulierte Prüfung. Öffne zuerst den Prüfungsbereich und anschließend das gewünschte Prüfungsniveau.")}</small></span></p>
      {state.actorRole === 'admin' && <p className={styles.muted}>{t("Prüfungslehrkraft:")} {teacher?.name ?? t("Noch nicht zugeordnet")}</p>}
      <button type="button" className={featureEnabled ? styles.secondary : styles.primary} disabled={pending || preview || !state.success || !student} onClick={() => onFeatureChange(!featureEnabled)}>{pending ? t("Wird gespeichert …") : featureEnabled ? t("Prüfung für {name} sperren", {name:student?.name ?? ""}) : t("Prüfung für {name} freigeben", {name:student?.name ?? ""})}</button>
      <details className={styles.details} open><summary>{t("Prüfungsniveaus separat freigeben")}</summary><p className={styles.muted}>{t("A1 bis C1 besitzen eigene Prüfungsfreigaben. Änderungen an Trainer-Niveaus ändern diese Freigaben nicht.")}</p>
        <label className={styles.label}>{t("Prüfungsniveau")}<select className={styles.select} value={accessLevel} disabled={pending || !featureEnabled} onChange={event => onLevelChange(event.target.value as SitovExamAccessLevel)}>{SIMULATION_OFFERED_LEVELS.map(level=><option key={level} value={level}>{level} · {t("Simulierte Prüfung")}</option>)}</select></label>
        <p className={styles.muted}>{accessLevel}: {levelEnabled ? t("Niveau freigegeben") : t("Niveau noch gesperrt")}</p>
        <button type="button" className={styles.secondary} disabled={pending || preview || !featureEnabled || !state.success} onClick={() => onLevelAccessChange(!levelEnabled)}>{levelEnabled ? t("{level}-Freigabe entfernen", {level:accessLevel}) : t("{level} freigeben", {level:accessLevel})}</button>
      </details>
    </>}
  </section>
  {state.actorRole === 'teacher' && !!state.unassignedStudents?.length && <section className={`${styles.panel} ${teacherStyles.assignmentPanel}`} aria-labelledby="sitov-simulation-assignment-title">
    <span className={styles.eyebrow}><UserPlus size={18} aria-hidden="true"/>{t("Prüfungsbetreuung übernehmen")}</span>
    <h2 id="sitov-simulation-assignment-title">{t("Weitere Lernende freigeben")}</h2>
    <p className={styles.muted}>{state.unassignedStudents.length === 1 ? t("Für einen Teilnehmenden ist noch keine Prüfungslehrkraft hinterlegt. Mit der Freigabe wirst du die zuständige Lehrkraft für Prüfungen und Bewertungen.") : t("Für {count} Teilnehmende ist noch keine Prüfungslehrkraft hinterlegt. Mit der Freigabe wirst du die zuständige Lehrkraft für Prüfungen und Bewertungen.", {count:state.unassignedStudents.length})}</p>
    <label className={styles.label}>{t("Lernende suchen")}<input className={styles.input} type="search" value={search} disabled={pending} onChange={event=>{setSearch(event.target.value);setCandidateId('')}} placeholder={t("Name eingeben")}/></label>
    {candidate ? <><label className={styles.label}>{t("Teilnehmender ohne Prüfungslehrkraft")}<select className={styles.select} value={candidate.id} disabled={pending || !state.success} onChange={event=>setCandidateId(event.target.value)}>{candidates.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button type="button" className={styles.primary} disabled={pending || preview || !state.success} onClick={()=>onAssignStudent(candidate.id)}><UserPlus size={20} aria-hidden="true"/>{pending ? t("Wird gespeichert …") : t("Übernehmen und für {name} freigeben", {name:candidate.name})}</button></> : <p className={styles.note}>{t("Keine Lernenden mit diesem Namen gefunden.")}</p>}
    <p className={teacherStyles.assignmentNote}>{t("Bestehende Zuordnungen zu anderen Lehrkräften kann die Administration verwalten. Antworten, Prüfungsergebnisse und Lernfortschritt bleiben erhalten.")}</p>
  </section>}
  </>
}

export function SimulationResultsPanel({ state, lang='de' }: { state: SimulationTeacherState; lang?:string }) {
  const t = (text:string, values?:Record<string,string|number>) => sitovTeacherText(lang,text,values)
  const copy = sitovSimulationCopy(lang)
  const [studentId, setStudentId] = useState('all')
  const [runId, setRunId] = useState('')
  const runs = state.runs.filter(run => studentId === 'all' || run.studentId === studentId)
  const active = runs.find(run => run.session.id === runId) ?? runs[0]
  const result = active?.session.result
  const percentage = (value: number | null) => value === null ? t("Bewertung offen") : `${(Math.floor(value * 10) / 10).toLocaleString(copy.locale, { maximumFractionDigits: 1 })} %`
  const runDate = (value?: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString(copy.locale, { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }) : t("Abgeschlossener Durchgang")
  return <section className={styles.panel} aria-labelledby="sitov-simulation-results-title">
    <h2 id="sitov-simulation-results-title">{t("Antworten und Ergebnisse")}</h2>
    <p className={styles.muted}>{t("Hier siehst du abgeschlossene Prüfungen mit allen Antworten, Lösungen und Lehrkraft-Rückmeldungen.")}</p>
    <label className={styles.label}>{t("Ergebnisse nach Teilnehmendem filtern")}<select className={styles.select} value={studentId} onChange={event => { setStudentId(event.target.value); setRunId('') }}><option value="all">{t("Alle zugeordneten Lernenden")}</option>{state.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
    {!active ? <p className={styles.note}>{t("Noch keine abgeschlossene Prüfung vorhanden. Nach der persönlichen Freigabe erscheinen die Ergebnisse deiner Lernenden hier.")}</p> : <>
      <label className={styles.label}>{t("Ergebnis auswählen")}<select className={styles.select} value={active.session.id} onChange={event => setRunId(event.target.value)}>{runs.map(run => <option key={run.session.id} value={run.session.id}>{run.studentName} · {run.session.level} · {runDate(run.session.completedAt)}</option>)}</select></label>
      <h3>{active.studentName} · {active.session.level}</h3>
      {result ? <>
        <p className={teacherStyles.resultStatus} data-status={result.status}><strong>{sitovSimulationHeadline(lang,result)}</strong><span>{sitovSimulationDescription(lang,result)}</span></p>
        {result.pendingTeacherTasks > 0 && <p className={styles.muted}>{result.pendingTeacherTasks === 1 ? t("Eine Leistung wartet auf eine fachliche Bewertung.") : t("{count} Leistungen warten auf eine fachliche Bewertung.", {count:result.pendingTeacherTasks})}</p>}
        <dl className={teacherStyles.skillResults}>{result.skills.map(skill => <div key={skill.skill}><dt>{copy.skill(skill.skill)}</dt><dd>{skill.pendingTeacherTasks > 0 ? t("Bewertung offen") : percentage(skill.percentage)}{skill.pendingTeacherTasks > 0 && <small>{skill.pendingTeacherTasks} {skill.pendingTeacherTasks === 1 ? t("Bewertung offen") : t("Bewertungen offen")}</small>}</dd></div>)}</dl>
        <details className={styles.details}><summary>{t("Alle {count} Antworten ansehen", {count:result.feedback.length})}</summary><div className={teacherStyles.feedbackList}>{result.feedback.map(feedback => <FeedbackCard lang={lang} key={feedback.taskId} feedback={feedback} task={active.session.tasks.find(task => task.id === feedback.taskId)} />)}</div></details>
      </> : <p className={styles.note}>{t("Für diesen gespeicherten Durchgang ist noch keine Auswertung verfügbar.")}</p>}
    </>}
  </section>
}
