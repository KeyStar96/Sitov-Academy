'use client'

import { useRef, useState } from 'react'
import { resetStudentSimulationProgress } from '@/app/actions/exam-simulation'
import styles from './ExamSimulation.module.css'
import teacherStyles from './TeacherExamSimulationPanel.module.css'

export default function TeacherSimulationReset({ student, pending, preview, onBusyChange, onComplete }: {
  student?: { id: string; name: string }
  pending: boolean
  preview: boolean
  onBusyChange: (busy: boolean) => void
  onComplete: () => Promise<boolean>
}) {
  const [confirming, setConfirming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const requestId = useRef<string | undefined>(undefined)
  const cancel = () => { setConfirming(false); setName(''); setError(''); requestId.current = undefined }
  const reset = async () => {
    if (!student || preview || busy || pending || !confirming || name.trim() !== student.name.trim()) return
    requestId.current ??= crypto.randomUUID()
    setBusy(true); onBusyChange(true); setError('')
    try {
      const result = await resetStudentSimulationProgress({ studentId: student.id, requestId: requestId.current })
      if (!result.success) {
        setError(result.error ?? (result.pending ? 'Das Zurücksetzen wird noch abgeschlossen. Prüfe den Abschluss mit derselben Bestätigung erneut.' : 'Der Prüfungsfortschritt konnte nicht zurückgesetzt werden. Deine Bestätigung bleibt für einen erneuten Versuch erhalten.'))
        return
      }
      setDone(true); setConfirming(false); setName(''); requestId.current = undefined
      await onComplete()
    } catch {
      setError('Das Zurücksetzen konnte nicht bestätigt werden. Deine Bestätigung bleibt für einen erneuten Versuch erhalten.')
    } finally {
      setBusy(false); onBusyChange(false)
    }
  }
  if (!student) return null
  return <details className={styles.details}>
    <summary>Prüfungsfortschritt zurücksetzen</summary>
    <p><strong>Nur für {student.name}:</strong> Dieser Schritt löscht den gesamten Fortschritt der simulierten Prüfung.</p>
    <ul className={styles.list}>
      <li>Alle laufenden und abgeschlossenen Prüfungsdurchgänge</li>
      <li>Alle Antworten, Ergebnisse und Lehrkraftbewertungen</li>
      <li>Private Sprechaufnahmen dieser Prüfungsdurchgänge</li>
      <li>Prüfungshistorie und bisher verwendete Aufgabenpakete</li>
    </ul>
    <p className={styles.muted}>Die persönliche Prüfungsfreigabe, Niveaurechte und alle anderen Trainer bleiben erhalten. Nach dem Reset können wieder frische Prüfungsdurchgänge begonnen werden.</p>
    {done && <p className={styles.note} role="status">Der Prüfungsfortschritt von {student.name} wurde vollständig zurückgesetzt.</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {!confirming ? <button type="button" className={styles.secondary} disabled={pending || preview} onClick={() => { setConfirming(true); setDone(false); setError('') }}>Reset für {student.name} vorbereiten</button> : <div className={teacherStyles.resetConfirmation}>
      <label className={styles.label}>Name zur Reset-Bestätigung<input className={styles.input} value={name} disabled={busy} onChange={event => setName(event.target.value)} autoComplete="off" placeholder={student.name} /></label>
      <p className={styles.muted}>Gib „{student.name}“ ein und bestätige anschließend die vollständige Löschung der oben genannten Prüfungsdaten.</p>
      <div className={styles.row}><button type="button" className={teacherStyles.resetButton} disabled={busy || pending || preview || name.trim() !== student.name.trim()} onClick={reset}>{busy ? 'Prüfungsdaten werden gelöscht …' : `Prüfungsfortschritt von ${student.name} endgültig löschen`}</button><button type="button" className={styles.link} disabled={busy} onClick={cancel}>Abbrechen</button></div>
    </div>}
  </details>
}
