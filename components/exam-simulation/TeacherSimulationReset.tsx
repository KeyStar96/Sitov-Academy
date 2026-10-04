'use client'

import { useRef, useState } from 'react'
import { resetStudentSimulationProgress } from '@/app/actions/exam-simulation'
import styles from './ExamSimulation.module.css'
import teacherStyles from './TeacherExamSimulationPanel.module.css'
import { sitovTeacherText, sitovTeacherError } from '@/lib/exam-simulation/teacher-ui-copy'

export default function TeacherSimulationReset({ lang = 'de', student, pending, preview, onBusyChange, onComplete }: {
  lang?: string
  student?: { id: string; name: string }
  pending: boolean
  preview: boolean
  onBusyChange: (busy: boolean) => void
  onComplete: () => Promise<boolean>
}) {
  const t = (text:string, values?:Record<string,string|number>) => sitovTeacherText(lang,text,values)
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
        setError(result.error ?? (result.pending ? t("Das Zurücksetzen wird noch abgeschlossen. Prüfe den Abschluss mit derselben Bestätigung erneut.") : t("Der Prüfungsfortschritt konnte nicht zurückgesetzt werden. Deine Bestätigung bleibt für einen erneuten Versuch erhalten.")))
        return
      }
      setDone(true); setConfirming(false); setName(''); requestId.current = undefined
      await onComplete()
    } catch {
      setError(t("Das Zurücksetzen konnte nicht bestätigt werden. Deine Bestätigung bleibt für einen erneuten Versuch erhalten."))
    } finally {
      setBusy(false); onBusyChange(false)
    }
  }
  if (!student) return null
  return <details className={styles.details}>
    <summary>{t("Prüfungsfortschritt zurücksetzen")}</summary>
    <p><strong>{t("Nur für")} {student.name}:</strong> {t("Dieser Schritt löscht den gesamten Fortschritt der simulierten Prüfung.")}</p>
    <ul className={styles.list}>
      <li>{t("Alle laufenden und abgeschlossenen Prüfungsdurchgänge")}</li>
      <li>{t("Alle Antworten, Ergebnisse und Lehrkraftbewertungen")}</li>
      <li>{t("Private Sprechaufnahmen dieser Prüfungsdurchgänge")}</li>
      <li>{t("Prüfungshistorie und bisher verwendete Aufgabenpakete")}</li>
    </ul>
    <p className={styles.muted}>{t("Die persönliche Prüfungsfreigabe, Niveaurechte und alle anderen Trainer bleiben erhalten. Nach dem Reset können wieder frische Prüfungsdurchgänge begonnen werden.")}</p>
    {done && <p className={styles.note} role="status">{t("Der Prüfungsfortschritt von {name} wurde vollständig zurückgesetzt.", {name:student.name})}</p>}
    {error && <p className={styles.error} role="alert">{sitovTeacherError(lang,error)}</p>}
    {!confirming ? <button type="button" className={styles.secondary} disabled={pending || preview} onClick={() => { setConfirming(true); setDone(false); setError('') }}>{t("Reset für {name} vorbereiten", {name:student.name})}</button> : <div className={teacherStyles.resetConfirmation}>
      <label className={styles.label}>{t("Name zur Reset-Bestätigung")}<input className={styles.input} value={name} disabled={busy} onChange={event => setName(event.target.value)} autoComplete="off" placeholder={student.name} /></label>
      <p className={styles.muted}>{t("Gib „{name}“ ein und bestätige anschließend die vollständige Löschung der oben genannten Prüfungsdaten.", {name:student.name})}</p>
      <div className={styles.row}><button type="button" className={teacherStyles.resetButton} disabled={busy || pending || preview || name.trim() !== student.name.trim()} onClick={reset}>{busy ? t("Prüfungsdaten werden gelöscht …") : t("Prüfungsfortschritt von {name} endgültig löschen", {name:student.name})}</button><button type="button" className={styles.link} disabled={busy} onClick={cancel}>{t("Abbrechen")}</button></div>
    </div>}
  </details>
}
