'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Mic, Square, Upload, Trash2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAudioRecorder } from '@/lib/audio/useAudioRecorder'
import { createExamUpload, saveExamSubmission } from '@/app/actions/exam-preparation'
import type { ExamActionResult, ExamState, ExamSubmission, ExamTask, ExamUnit } from '@/lib/exam-preparation/types'
import PressableCard from '@/components/motion/PressableCard'
import LiveWaveform from '@/components/audio/LiveWaveform'
import styles from './ExamTrainer.module.css'

export default function ExamSubmissionEditor({ task, unit, state, previous, onSaved }: {
  task: ExamTask; unit: ExamUnit; state: ExamState; previous?: ExamSubmission; onSaved: (result: ExamActionResult) => void
}) {
  const recorder = useAudioRecorder()
  const [text, setText] = useState(previous?.text ?? '')
  const [reflection, setReflection] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()
  const uploaded = useRef<{ blob: Blob; path: string } | null>(null)
  const request = useRef<{ id: string; fingerprint: string; blob: Blob | null } | null>(null)
  const speaking = task.type === 'speaking'
  const blob = file ?? recorder.audioBlob
  const canSave = state.available && !recorder.isRecording && (speaking ? !!blob || !!previous?.mediaPath : text.trim().length > 0 || !!file)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    if (recorder.isRecording && recorder.elapsedSeconds >= 300) recorder.stop()
  }, [recorder])
  const chooseFile = (selected?: File) => {
    if (!selected) return
    if (selected.size > 20 * 1024 * 1024 || selected.size === 0) { setError('Bitte wähle eine Datei bis 20 MB. Deine bisherige Antwort bleibt erhalten.'); return }
    if (!(speaking ? ['audio/mpeg','audio/mp4','audio/x-m4a','audio/webm','audio/wav','audio/x-wav','audio/ogg'].includes(selected.type) : ['image/jpeg','image/png','image/webp'].includes(selected.type))) { setError('Dieses Dateiformat wird nicht unterstützt.'); return }
    setFile(selected); setError('')
  }
  const save = (send: boolean) => startTransition(async () => {
    setError('')
    try {
      const data = new FormData()
      const fingerprint=JSON.stringify([task.id,unit.id,text,reflection,previous?.id,send])
      if(!request.current||request.current.fingerprint!==fingerprint||request.current.blob!==blob)request.current={id:crypto.randomUUID(),fingerprint,blob}
      data.set('requestId',request.current.id)
      data.set('taskId', task.id); data.set('unitId', unit.id); data.set('text', text)
      data.set('explicitSubmit', String(send)); data.set('reflection', reflection)
      if (previous) data.set('previousId', previous.id)
      if (blob) {
        let path = uploaded.current?.blob === blob ? uploaded.current.path : null
        if (!path) {
          const mimeType = (blob.type || 'audio/wav').split(';')[0]
          const upload = await createExamUpload({ mimeType, bytes: blob.size, kind: speaking ? 'speaking' : 'photo' })
          if (!upload.success || !upload.path || !upload.token) throw new Error('upload')
          const { error: uploadError } = await createClient().storage.from('sitov-exam-submissions').uploadToSignedUrl(upload.path, upload.token, blob, { contentType: mimeType, upsert: false })
          if (uploadError) throw new Error('upload')
          path = upload.path; uploaded.current = { blob, path }
        }
        data.set(speaking ? 'audioPath' : 'photoPath', path)
      } else {if(previous?.mediaPath)data.set('audioPath',previous.mediaPath);if(previous?.photoPath)data.set('photoPath',previous.photoPath)}
      const result = await saveExamSubmission(data)
      if (!result.success) { setError(result.error ?? 'Speichern fehlgeschlagen. Bitte versuche es erneut.'); return }
      request.current=null
      onSaved(result)
    } catch { setError('Die Datei konnte nicht gespeichert werden. Deine Antwort bleibt hier erhalten. Bitte versuche es erneut.'); }
  })
  const micError = recorder.status === 'denied' ? 'Das Mikrofon ist gesperrt. Du kannst eine vorhandene Aufnahme hochladen.'
    : recorder.status === 'unsupported' ? 'Dieser Browser kann nicht aufnehmen. Lade eine Audiodatei hoch.'
      : recorder.status === 'failed' ? 'Die Aufnahme hat nicht funktioniert. Bitte starte neu oder lade eine Datei hoch.' : null
  return <div className={styles.grid} style={{gridTemplateColumns:'1fr'}}>
    {speaking ? <>
      <p className={styles.muted}>Deine Aufnahme bleibt privat. Du entscheidest selbst, ob du sie an deine Lehrkraft sendest. Hier kannst du bis zu 5 Minuten aufnehmen. Audiodateien bis 20 MB: MP3, M4A, WAV, WebM oder Ogg. Höre deine Aufnahme vor dem Senden an.</p>
      <div className={styles.actions}>
        {recorder.isRecording ? <PressableCard className="st-button st-button--danger" onClick={recorder.stop}><Square size={20} />Aufnahme stoppen · {recorder.elapsedSeconds} s</PressableCard>
          : <PressableCard className="st-button st-button--primary" disabled={pending || recorder.status === 'requesting'} onClick={async () => { setFile(null); setError(''); await recorder.start() }}><Mic size={20} />{recorder.hasRecording ? 'Neu aufnehmen' : 'Mikrofon testen / aufnehmen'}</PressableCard>}
        {recorder.isRecording && <LiveWaveform levels={recorder.levels} isActive elapsedSeconds={recorder.elapsedSeconds} ariaLabel="Lautstärke deiner Aufnahme" analyserRef={recorder.analyserRef} />}
      </div>
      {(file ? fileUrl : recorder.audioUrl ?? previous?.mediaUrl) && <audio className={styles.audio} controls src={(file ? fileUrl : recorder.audioUrl ?? previous?.mediaUrl) ?? undefined} aria-label="Eigene Aufnahme anhören" />}
      {blob && <PressableCard className={styles.link} disabled={pending || recorder.isRecording} onClick={() => {setFile(null); recorder.reset(); uploaded.current=null}}><Trash2 size={18} />Aufnahme verwerfen</PressableCard>}
      {micError && <p role="status" className={styles.warning}>{micError}</p>}
    </> : <label className={styles.label}>Dein Text<textarea className={styles.textarea} value={text} onChange={e=>setText(e.target.value)} maxLength={12000} placeholder="Schreibe hier deine eigene Antwort …" /></label>}
    <label className={styles.label}><span className={styles.row}><Upload size={18} />{speaking ? 'Vorhandene Audiodatei hochladen' : 'Handschriftlichen Text als Foto hochladen (bis 20 MB)'}</span>
      <input className={styles.input} type="file" accept={speaking ? 'audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,audio/ogg' : 'image/jpeg,image/png,image/webp'} disabled={pending || recorder.isRecording} onChange={e=>chooseFile(e.target.files?.[0])} /></label>
    {file && <p className={styles.muted}>{file.name} · {(file.size/1024/1024).toFixed(1)} MB</p>}
    {!speaking && file && fileUrl && <Image unoptimized width={640} height={480} className={styles.scene} src={fileUrl} alt="Dein handschriftlicher Text" />}
    {previous && <label className={styles.label}>Was hast du nach der Rückmeldung verändert?<textarea className={styles.textarea} value={reflection} onChange={e=>setReflection(e.target.value)} maxLength={2000} placeholder="Nenne eine Verbesserung oder deinen nächsten Lernschritt." /></label>}
    <details className={styles.details}><summary>Worauf kommt es bei dieser Aufgabe an?</summary><ul className={styles.list}>{(task.rubric ?? ['Erfülle den Auftrag.','Formuliere verständlich.','Verbinde deine Gedanken.']).map(item=><li key={item}>{item}</li>)}</ul></details>
    <p className={styles.muted}>{state.teacher ? `Rückmeldung von ${state.teacher.name}, voraussichtlich innerhalb von ${state.teacher.responseDays} Tagen.` : 'Es ist noch keine Lehrkraft zugewiesen. Du kannst deine Antwort als Entwurf speichern.'}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      <PressableCard className="st-button st-button--soft" disabled={!canSave || pending} onClick={()=>save(false)}>{pending ? 'Wird gespeichert …' : 'Als Entwurf speichern'}</PressableCard>
      {state.teacher && <PressableCard className="st-button st-button--primary" disabled={!canSave || pending} onClick={()=>save(true)}>An {state.teacher.name} senden</PressableCard>}
    </div>
  </div>
}
