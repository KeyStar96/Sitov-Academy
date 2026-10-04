'use client'

import { useState } from 'react'
import { CheckCircle2, LockKeyhole } from 'lucide-react'
import type { SimulationTeacherState } from '@/lib/exam-simulation/server'
import type { SimulationLevel } from '@/lib/exam-simulation/types'
import { FeedbackCard } from './ExamSimulation'
import styles from './ExamSimulation.module.css'
import teacherStyles from './TeacherExamSimulationPanel.module.css'

type AdvancedLevel = Extract<SimulationLevel, 'B2' | 'C1' | 'C2'>

export default function TeacherExamSimulationPanel({ state, studentId, accessLevel, pending, preview = false, onStudentChange, onLevelChange, onFeatureChange, onLevelAccessChange }: {
  state: SimulationTeacherState
  studentId: string
  accessLevel: AdvancedLevel
  pending: boolean
  preview?: boolean
  onStudentChange: (studentId: string) => void
  onLevelChange: (level: AdvancedLevel) => void
  onFeatureChange: (enabled: boolean) => void
  onLevelAccessChange: (enabled: boolean) => void
}) {
  const student = state.students.find(item => item.id === studentId)
  const featureEnabled = state.featureGrants.some(grant => grant.studentId === studentId)
  const levelEnabled = state.levelGrants.some(grant => grant.studentId === studentId && grant.level === accessLevel)
  return <section className={styles.panel} aria-labelledby="sitov-simulation-access-title">
    <h2 id="sitov-simulation-access-title">Prüfung einzeln freigeben</h2>
    <p className={styles.muted}>Alle Lernenden sind zunächst gesperrt, unabhängig von ihrem Niveau. Öffne die simulierte Prüfung gezielt für einen Teilnehmenden.</p>
    {!state.students.length ? <p className={styles.note}>{state.actorRole === 'admin' ? 'Es sind noch keine Lernenden vorhanden.' : 'Dir sind noch keine Lernenden zugeordnet. Die Administration kann die Zuordnung im Prüfungsbereich vornehmen.'}</p> : <>
      <label className={styles.label}>Teilnehmender für die Prüfung<select className={styles.select} value={studentId} disabled={pending || !state.success} onChange={event => onStudentChange(event.target.value)}>{state.students.map(item => <option key={item.id} value={item.id}>{item.name} · {state.featureGrants.some(grant => grant.studentId === item.id) ? 'Freigegeben' : 'Gesperrt'}</option>)}</select></label>
      <p className={teacherStyles.accessStatus} data-enabled={featureEnabled}>{featureEnabled ? <CheckCircle2 size={22} aria-hidden="true" /> : <LockKeyhole size={22} aria-hidden="true" />}<span><strong>{student?.name}: {featureEnabled ? 'Prüfung freigegeben' : 'Prüfung gesperrt'}</strong><small>{featureEnabled ? 'Der Prüfungsbereich ist geöffnet. Die bestehenden Niveaurechte bestimmen die erreichbaren Prüfungen.' : 'Auch freigegebene Lernniveaus öffnen die simulierte Prüfung erst nach dieser persönlichen Freigabe.'}</small></span></p>
      <button type="button" className={featureEnabled ? styles.secondary : styles.primary} disabled={pending || preview || !state.success || !student} onClick={() => onFeatureChange(!featureEnabled)}>{pending ? 'Wird gespeichert …' : featureEnabled ? `Prüfung für ${student?.name} sperren` : `Prüfung für ${student?.name} freigeben`}</button>
      <details className={styles.details}><summary>Zusätzliche Niveaurechte: B2, C1 und C2</summary><p className={styles.muted}>Erst die persönliche Prüfungsfreigabe, dann das passende Niveau. A1 bis B1 verwenden die vorhandenen Lernniveaurechte.</p>
        <label className={styles.label}>Prüfungsniveau<select className={styles.select} value={accessLevel} disabled={pending || !featureEnabled} onChange={event => onLevelChange(event.target.value as AdvancedLevel)}><option>B2</option><option>C1</option><option>C2</option></select></label>
        <p className={styles.muted}>{accessLevel}: {levelEnabled ? 'Niveau freigegeben' : 'Niveau noch gesperrt'}</p>
        <button type="button" className={styles.secondary} disabled={pending || preview || !featureEnabled || !state.success} onClick={() => onLevelAccessChange(!levelEnabled)}>{levelEnabled ? `${accessLevel}-Freigabe entfernen` : `${accessLevel} freigeben`}</button>
      </details>
    </>}
  </section>
}

export function SimulationResultsPanel({ state }: { state: SimulationTeacherState }) {
  const [studentId, setStudentId] = useState('all')
  const [runId, setRunId] = useState('')
  const runs = state.runs.filter(run => studentId === 'all' || run.studentId === studentId)
  const active = runs.find(run => run.session.id === runId) ?? runs[0]
  const result = active?.session.result
  const percentage = (value: number | null) => value === null ? 'Bewertung offen' : `${(Math.floor(value * 10) / 10).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
  const runDate = (value?: string) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }) : 'Abgeschlossener Durchgang'
  return <section className={styles.panel} aria-labelledby="sitov-simulation-results-title">
    <h2 id="sitov-simulation-results-title">Antworten und Ergebnisse</h2>
    <p className={styles.muted}>Hier siehst du abgeschlossene Prüfungen mit allen Antworten, Lösungen und Lehrkraft-Rückmeldungen.</p>
    <label className={styles.label}>Ergebnisse nach Teilnehmendem filtern<select className={styles.select} value={studentId} onChange={event => { setStudentId(event.target.value); setRunId('') }}><option value="all">Alle zugeordneten Lernenden</option>{state.students.map(student => <option key={student.id} value={student.id}>{student.name}</option>)}</select></label>
    {!active ? <p className={styles.note}>Noch keine abgeschlossene Prüfung vorhanden. Nach der persönlichen Freigabe erscheinen die Ergebnisse deiner Lernenden hier.</p> : <>
      <label className={styles.label}>Ergebnis auswählen<select className={styles.select} value={active.session.id} onChange={event => setRunId(event.target.value)}>{runs.map(run => <option key={run.session.id} value={run.session.id}>{run.studentName} · {run.session.level} · {runDate(run.session.completedAt)}</option>)}</select></label>
      <h3>{active.studentName} · {active.session.level}</h3>
      {result ? <>
        <p className={teacherStyles.resultStatus} data-status={result.status}><strong>{result.headline}</strong><span>{result.description}</span></p>
        {result.pendingTeacherTasks > 0 && <p className={styles.muted}>{result.pendingTeacherTasks} {result.pendingTeacherTasks === 1 ? 'Leistung wartet' : 'Leistungen warten'} auf eine fachliche Bewertung.</p>}
        <dl className={teacherStyles.skillResults}>{result.skills.map(skill => <div key={skill.skill}><dt>{skill.title}</dt><dd>{skill.pendingTeacherTasks > 0 ? 'Bewertung offen' : percentage(skill.percentage)}{skill.pendingTeacherTasks > 0 && <small>{skill.pendingTeacherTasks} {skill.pendingTeacherTasks === 1 ? 'Bewertung offen' : 'Bewertungen offen'}</small>}</dd></div>)}</dl>
        <details className={styles.details}><summary>Alle {result.feedback.length} Antworten ansehen</summary><div className={teacherStyles.feedbackList}>{result.feedback.map(feedback => <FeedbackCard key={feedback.taskId} feedback={feedback} task={active.session.tasks.find(task => task.id === feedback.taskId)} />)}</div></details>
      </> : <p className={styles.note}>Für diesen gespeicherten Durchgang ist noch keine Auswertung verfügbar.</p>}
    </>}
  </section>
}
