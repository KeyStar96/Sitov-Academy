'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, FileAudio, Upload } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import { adminButton, adminChip, adminInput, adminLabel, adminHint } from '@/components/admin/ui'
import { createClient } from '@/utils/supabase/client'
import { completeExamProductionUpload, createExamProductionUpload, setExamProductionStatus } from '@/app/actions/exam-audio-production'
import type { EXAM_AUDIO_ORDERS, EXAM_RECORDING_SESSIONS } from '@/lib/exam-preparation/content'
import type { ExamAudioProduction, ExamAudioProductionState, ExamProductionStatus } from '@/lib/exam-preparation/audio-production-server'
import styles from './ExamTeacher.module.css'
import { sitovPrepTeacherText, sitovPrepTeacherLocale, sitovPrepTeacherError } from '@/lib/exam-preparation/teacher-ui-copy'

type AudioOrder = typeof EXAM_AUDIO_ORDERS[number]
type RecordingSession = typeof EXAM_RECORDING_SESSIONS[number]
const statusLabel: Record<ExamProductionStatus, string> = { briefing: 'Briefing', script_review: 'Skript in Prüfung', ready_to_record: 'Aufnahmebereit', awaiting_recording: 'Aufnahme fehlt', uploaded: 'Datei hochgeladen', reviewed: 'Audio geprüft', published: 'Veröffentlicht' }
const nextAction: Record<ExamProductionStatus, string> = { briefing: 'Skript und Auftrag lesen', script_review: 'Skript fachlich prüfen', ready_to_record: 'Rohaufnahme aufnehmen', awaiting_recording: 'Rohaufnahme hochladen', uploaded: 'Schnitt und Wortzeitmarken prüfen', reviewed: 'Geprüfte Schnittfassung veröffentlichen', published: 'Freigegebene Fassung im Training' }
const checks = ['Gesamte Schnittfassung angehört; Wortlaut entspricht dem Skript.', 'Zahlen, Namen und entscheidende Informationen sind klar verständlich.', 'Alle zugeordneten Aufgaben gegen die Aufnahme gelöst; Lösungen und Belege stimmen.', 'Lautstärke, Schnitt, Pausen und Tonqualität geprüft.', 'Wortzeitmarken stammen aus der echten Schnittfassung und passen zur Wiedergabe.', 'Die Nutzung der menschlichen Stimmen ist freigegeben und dokumentiert.']
const audioAccept = '.m4a,.mp3,.wav,.ogg,.webm,audio/mp4,audio/mpeg,audio/wav,audio/ogg,audio/webm'

function mimeFor(file: File) {
  const known = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm']
  const type = file.type.split(';')[0]
  if (known.includes(type)) return type
  const extension = file.name.split('.').pop()?.toLowerCase()
  return ({ mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm' } as Record<string, string>)[extension ?? ''] || ''
}

export default function ExamAudioProductionPanel({ lang = 'de', orders, sessions, state }: { lang?: string; orders: AudioOrder[]; sessions: RecordingSession[]; state: ExamAudioProductionState }) {
  const t = (text: string, values?: Record<string, string | number>) => sitovPrepTeacherText(lang,text,values)
  const [filter, setFilter] = useState('all')
  const [session, setSession] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const selected = orders.find(order => order.audioId === selectedId)
  const productions = new Map(state.productions.map(item => [item.audioId, item]))
  const currentStatus = (id: string): ExamProductionStatus => {
    const item = productions.get(id)
    return item?.scriptMatches ? item.status : 'awaiting_recording'
  }
  const visible = orders.filter(order => (filter === 'all' || currentStatus(order.audioId) === filter) && (session === 'all' || order.session === Number(session)))
  const select = (id: string) => {
    setSelectedId(id)
    requestAnimationFrame(() => detailRef.current?.focus({ preventScroll: false }))
  }
  return <div className={styles.stack} lang={lang}>
    {!state.success && <p role="alert" className={styles.notice} data-error="true">{sitovPrepTeacherError(lang,state.error || t("Der Produktionsstand konnte nicht geladen werden."))}</p>}
    {!selected && <>
      <p className={styles.muted}>{t("Acht eigene Hörpakete für den B1-Pilot. Skripte und Aufgaben gehören zusammen. Die realen Aufnahmen werden nach dem Schnitt geprüft und ausdrücklich veröffentlicht.")}</p>
      <details className={styles.fold}><summary>{t("Drei konkrete Aufnahmesitzungen")}</summary><div className={styles.sessions}>{sessions.map(item => <section key={item.id} className={styles.session}><h2 className={styles.sectionTitle}>{t(item.title)}</h2><p className={styles.meta}>{t(item.duration)} · {item.audioIds.join(', ')}</p><ol className={`${styles.rubric} mt-3`}>{item.steps.map((step, index) => <li key={index}>{t(step)}</li>)}</ol></section>)}</div></details>
      <div className={styles.filters}>
        <label><span className={adminLabel}>{t("Produktionsstatus")}</span><select className={adminInput} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{t("Alle Aufträge")}</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
        <label><span className={adminLabel}>{t("Aufnahmesitzung")}</span><select className={adminInput} value={session} onChange={event => setSession(event.target.value)}><option value="all">{t("Alle Sitzungen")}</option>{sessions.map(item => <option key={item.id} value={item.id}>{t("Sitzung {count}", {count:item.id})}</option>)}</select></label>
      </div>
      <div className={styles.list}>{visible.map(order => <PressableCard key={order.audioId} className={styles.item} onClick={() => select(order.audioId)} aria-pressed={false}><span className={styles.itemTitle}><span>{t(order.title)}</span><FileAudio size={19} aria-hidden="true" /></span><span className={styles.meta}><span>{order.audioId}</span><span>{t("Sitzung {count}", {count:order.session})}</span><span>{t(order.targetDuration)}</span><span>{t(statusLabel[currentStatus(order.audioId)])}</span></span><span className={`${styles.muted} mt-2 block`}>{t(nextAction[currentStatus(order.audioId)])}</span></PressableCard>)}</div>
      {!visible.length && <div className={styles.empty}><p>{t("Keine Aufnahmeaufträge für diese Auswahl.")}</p></div>}
    </>}
    {selected && <div ref={detailRef} tabIndex={-1} className={styles.stack}><PressableCard className={adminButton('ghost', 'md', 'justify-self-start')} onClick={() => setSelectedId(null)}><ArrowLeft size={18} aria-hidden="true" />{t("Zum Aufnahmeplan")}</PressableCard><ProductionDetail lang={lang} key={selected.audioId} order={selected} production={productions.get(selected.audioId)} available={state.success} /></div>}
  </div>
}

function ProductionDetail({ lang, order, production, available }: { lang: string; order: AudioOrder; production?: ExamAudioProduction; available: boolean }) {
  const t = (text: string, values?: Record<string, string | number>) => sitovPrepTeacherText(lang,text,values)
  const router = useRouter()
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [pending, setPending] = useState(false)
  const [checked, setChecked] = useState<boolean[]>(checks.map(() => false))
  const [reviewNote, setReviewNote] = useState('')
  const [earlyStatus, setEarlyStatus] = useState<ExamProductionStatus>('script_review')
  const current = production?.scriptMatches ? production : undefined
  const status = current?.status ?? 'awaiting_recording'
  const [phase, setPhase] = useState<'briefing' | 'upload' | 'review'>(current?.status === 'reviewed' || current?.status === 'published' ? 'review' : current?.rawUrl ? 'upload' : 'briefing')
  const articleRef = useRef<HTMLElement>(null)
  const navigatePhase = (next: typeof phase) => { articleRef.current?.querySelectorAll('audio').forEach(audio => audio.pause()); setPhase(next) }
  const changeStatus = async (next: ExamProductionStatus) => {
    if (pending) return
    setPending(true); setNotice(null)
    try {
      const result = await setExamProductionStatus({ audioId: order.audioId, status: next, ...(next === 'reviewed' ? { reviewNote, checks: checked } : {}) })
      setNotice({ error: !result.success, text: result.success ? t("Produktionsstand gespeichert: {status}.", {status:t(statusLabel[next])}) : result.error || t("Der Produktionsstand konnte nicht gespeichert werden.") })
      if (result.success) router.refresh()
    } catch { setNotice({ error: true, text: t("Die Verbindung ist unterbrochen. Deine Eingaben bleiben hier; bitte erneut speichern.") }) }
    finally { setPending(false) }
  }
  return <article ref={articleRef} className={`${styles.detail} ${styles.stack}`}>
    <header><div className={styles.row}><h2 className={styles.heading}>{t(order.title)}</h2><span className={styles.pill}>{t(statusLabel[status])}</span></div><p className={styles.meta}>{order.audioId} {t("· B1 ·")} {t(order.targetDuration)} {t("· Sitzung")} {order.session} {t("· Menschliche Aufnahme")}</p></header>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={styles.notice} data-error={notice.error}>{notice.error ? sitovPrepTeacherError(lang,notice.text) : t(notice.text)}</p>}
    {production && !production.scriptMatches && <p className={styles.notice}>{t("Das Skript wurde verändert. Die gespeicherte ältere Aufnahme bleibt intern erhalten; für diese Fassung sind eine neue Aufnahme und Freigabe nötig.")}</p>}
    <div className={styles.tabs} role="group" aria-label={t("Produktionsschritte")}>
      {([['briefing', t("1. Auftrag")], ['upload', t("2. Dateien")], ['review', t("3. Freigabe")]] as const).map(([value, label]) => <PressableCard key={value} className={adminChip(phase === value)} aria-pressed={phase === value} onClick={() => navigatePhase(value)}>{t(label)}</PressableCard>)}
    </div>
    <div hidden={phase !== 'briefing'} style={phase !== 'briefing' ? { display: 'none' } : undefined} className={styles.stack}>
    <section className={styles.inset}><h3 className={styles.sectionTitle}>{t("Lernziel und Einsatz")}</h3><p className={styles.text}>{t(order.learningGoal)}</p><p className={`${styles.muted} mt-2`}>{t(order.profileScope)}</p><p className={`${styles.muted} mt-2`}>{t("Dateiname:")} {order.filename}</p></section>
    <section><h3 className={styles.sectionTitle}>{t("Rollen und Regie")}</h3><ul className={styles.rubric}>{order.roles.map(role => <li key={role}>{t(role)}</li>)}</ul><p className={`${styles.text} mt-3`}>{t(order.notes)}</p></section>
    <details open className={styles.fold}><summary>{t("Vollständiges finales Skript")}</summary><div><pre className={styles.pre} lang="de" translate="no">{order.script}</pre></div></details>
    <details className={styles.fold}><summary>{t("Aufgaben, Lösungen und Belegstellen (")}{order.tasks.length})</summary><div className={styles.stack}>{order.tasks.map(task => <section key={task.id} className={styles.solution}><h3 className={styles.sectionTitle} lang="de" translate="no">{task.title}</h3><p className={styles.text} lang="de" translate="no">{task.instruction}</p>{task.options && <ul className={`${styles.rubric} mt-2`}>{task.options.map(option => <li key={option.id} lang="de" translate="no">{option.id}: {option.text}</li>)}</ul>}<p className={`${styles.muted} mt-2`}>{t("Lösung:")} {task.correctAnswer ? <span lang="de" translate="no">{Array.isArray(task.correctAnswer) ? task.correctAnswer.join(', ') : task.correctAnswer}</span> : t("Offener Auftrag nach Lernraster")}</p><p className={styles.muted}>{t("Beleg:")} {order.solutions.find(solution => solution.taskId === task.id)?.evidence || task.evidence ? <span lang="de" translate="no">{order.solutions.find(solution => solution.taskId === task.id)?.evidence || task.evidence}</span> : t("Inhaltlich anhand der Aufnahme prüfen.")}</p><p className={styles.meta}>{task.id} {t("· Version")} {task.version}</p></section>)}</div></details>
    <details className={styles.fold}><summary>{t("Aufnahme, Schnitt und Upload vorbereiten")}</summary><div><ol className={styles.rubric}>{order.productionSteps.map((step, index) => <li key={index}>{t(step)}</li>)}</ol><p className={`${styles.muted} mt-3`}>{t("Ruhiger Raum, gleicher Mikrofonabstand, keine Hintergrundmusik. Zwei Sekunden Ruhe am Anfang und Ende. Bei Versprechern pausieren und den ganzen Satz wiederholen.")}</p></div></details>
    {!current?.rawUrl && <section className={styles.fields}><h3 className={styles.sectionTitle}>{t("Vorbereitung dokumentieren")}</h3><label><span className={adminLabel}>{t("Nächster Produktionsstand")}</span><select className={adminInput} value={earlyStatus} onChange={event => setEarlyStatus(event.target.value as ExamProductionStatus)}>{(['briefing', 'script_review', 'ready_to_record', 'awaiting_recording'] as const).map(value => <option key={value} value={value}>{t(statusLabel[value])}</option>)}</select></label><PressableCard disabled={!available || pending} className={adminButton('secondary')} onClick={() => void changeStatus(earlyStatus)}>{pending ? t("Wird gespeichert …") : t("Produktionsstand speichern")}</PressableCard></section>}
    <PressableCard className={adminButton('primary')} onClick={() => navigatePhase('upload')}>{t("Zu Aufnahme und Upload")}</PressableCard>
    </div>
    <div hidden={phase !== 'upload'} style={phase !== 'upload' ? { display: 'none' } : undefined} className={styles.stack}>
    <section className={styles.fields}><h3 className={styles.sectionTitle}>{t("1. Rohaufnahme")}</h3>{production?.rawUrl && <div className={styles.inset}><p className={styles.muted}>{production.rawFilename}{!production.scriptMatches ? t(" · ältere Skriptfassung") : ''}</p><audio controls preload="none" src={production.rawUrl} className={styles.audio} /></div>}<ProductionUpload lang={lang} order={order} kind="raw" available={available} onNotice={setNotice} onSaved={() => router.refresh()} />{current?.preparedUrl && <p className={adminHint}>{t("Eine neue Rohaufnahme setzt Schnittfassung und Freigabe zurück. Der nächste Stand wird erneut geprüft.")}</p>}</section>
    <section className={styles.fields}><h3 className={styles.sectionTitle}>{t("2. Schnittfassung mit echten Wortzeitmarken")}</h3>{production?.preparedUrl && <div className={styles.inset}><p className={styles.muted}>{production.preparedFilename} · {t("{count} Wortzeitmarken", {count:production.wordTimings?.length ?? 0})}{!production.scriptMatches ? t(" · ältere Skriptfassung") : ''}</p><audio controls preload="none" src={production.preparedUrl} className={styles.audio} /></div>}<p className={styles.muted}>{t("Bereite Schnittfassung und Wortzeitmarken lokal auf dem Mac vor. Lade danach die endgültige Audiodatei und die dazugehörige JSON-Datei hoch. Ein Eintrag")} <code>{'{"start": 0.0, "end": 0.4}'}</code> {t("pro gesprochenem Wort, in Sekunden. Sprecherkennungen und Regie werden nicht eingesprochen.")}</p><ProductionUpload lang={lang} order={order} kind="prepared" available={available && Boolean(current?.rawUrl)} onNotice={setNotice} onSaved={() => router.refresh()} />{!current?.rawUrl && <p className={adminHint}>{t("Die Rohaufnahme des aktuellen Skripts wird zuerst benötigt.")}</p>}</section>
    {current?.preparedUrl && <PressableCard className={adminButton('primary')} onClick={() => navigatePhase('review')}>{t("Schnittfassung fachlich prüfen")}</PressableCard>}
    </div>
    <div hidden={phase !== 'review'} style={phase !== 'review' ? { display: 'none' } : undefined} className={styles.stack}>
    {current?.preparedUrl && <audio controls preload="none" src={current.preparedUrl} className={styles.audio} />}
    <section><h3 className={styles.sectionTitle}>{t("3. Fachlich freigeben")}</h3>{current?.reviewNote && <div className={`${styles.inset} mb-3`}><h4 className={styles.sectionTitle}>{t("Dokumentierte Freigabe")}</h4><p className={styles.text} lang="" translate="no">{current.reviewNote}</p><p className={styles.meta}>{current.reviewedAt ? new Intl.DateTimeFormat(sitovPrepTeacherLocale(lang), { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(new Date(current.reviewedAt)) : ''}</p></div>}{status !== 'published' && <form className={styles.fields} onSubmit={event => { event.preventDefault(); void changeStatus('reviewed') }}><div>{checks.map((check, index) => <label key={index} className={styles.check}><input type="checkbox" checked={checked[index]} required disabled={!available || !current?.preparedUrl || pending} onChange={event => setChecked(values => values.map((value, position) => position === index ? event.target.checked : value))} /><span>{t(check)}</span></label>)}</div><label><span className={adminLabel}>{t("Freigabevermerk, Version und Nutzungsfreigabe")}</span><textarea required minLength={10} maxLength={4000} rows={3} className={adminInput} value={reviewNote} onChange={event => setReviewNote(event.target.value)} placeholder={t("Wer hat welche Fassung geprüft? Wo ist die Zustimmung zur Stimmnutzung dokumentiert?")} /></label><PressableCard type="submit" disabled={!available || !current?.preparedUrl || pending || checked.some(value => !value)} className={adminButton('secondary')}><Check size={18} aria-hidden="true" />{pending ? t("Wird gespeichert …") : t("Audio geprüft bestätigen")}</PressableCard></form>}</section>
    {status === 'reviewed' && <section className={styles.fields}><h3 className={styles.sectionTitle}>{t("4. Für den B1-Trainer veröffentlichen")}</h3><p className={styles.muted}>{t("Die freigegebene Schnittfassung wird mit ihren Aufgaben verbunden. Rohaufnahmen bleiben im Inhaltsbereich.")}</p><PressableCard disabled={!available || pending} className={adminButton('primary')} onClick={() => void changeStatus('published')}>{pending ? t("Wird veröffentlicht …") : t("Geprüfte Audiofassung veröffentlichen")}</PressableCard></section>}
    {status === 'published' && <p role="status" className={styles.notice} data-error="false">{t("Diese Aufnahme ist nach fachlicher Prüfung veröffentlicht.")}</p>}
    </div>
  </article>
}

function ProductionUpload({ lang, order, kind, available, onNotice, onSaved }: { lang: string; order: AudioOrder; kind: 'raw' | 'prepared'; available: boolean; onNotice: (value: { text: string; error: boolean }) => void; onSaved: () => void }) {
  const t = (text: string, values?: Record<string, string | number>) => sitovPrepTeacherText(lang,text,values)
  const [file, setFile] = useState<File | null>(null)
  const [timings, setTimings] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [stage, setStage] = useState('')
  const completedPath = useRef<{ path: string; file: File } | null>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const timingsInput = useRef<HTMLInputElement>(null)
  const upload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file || pending) return
    setPending(true)
    try {
      const mime = mimeFor(file)
      if (!mime || file.size <= 0 || file.size > 20 * 1024 * 1024) throw new Error(t("Bitte wähle eine unterstützte Audiodatei bis 20 MB."))
      let wordTimings: unknown
      if (kind === 'prepared') {
        if (!timings || timings.size > 256 * 1024) throw new Error(t("Bitte wähle die passende JSON-Datei mit Wortzeitmarken (bis 256 KB)."))
        try {
          const parsed: unknown = JSON.parse(await timings.text())
          wordTimings = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' && 'wordTimings' in parsed) ? parsed.wordTimings : undefined
          if (!Array.isArray(wordTimings)) throw new Error('invalid')
        } catch { throw new Error(t("Die JSON-Datei benötigt eine Liste aus {start,end}-Einträgen oder ein Objekt mit der Liste „wordTimings“.")) }
      }
      let path = completedPath.current?.file === file ? completedPath.current.path : undefined
      if (!path) {
        setStage(t("Privaten Upload vorbereiten …"))
        const ticket = await createExamProductionUpload({ audioId: order.audioId, kind, contentType: mime, size: file.size })
        if (!ticket.success || !ticket.path || !ticket.token || !ticket.bucket) throw new Error(ticket.error || t("Der Upload konnte nicht vorbereitet werden."))
        setStage(t("Audiodatei wird hochgeladen …"))
        const { error } = await createClient().storage.from(ticket.bucket).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: mime, cacheControl: '3600' })
        if (error) throw new Error(t("Die Audiodatei konnte nicht hochgeladen werden. Die ausgewählte Datei bleibt für einen neuen Versuch erhalten."))
        path = ticket.path
        completedPath.current = { path, file }
      }
      setStage(t("Upload und Zeitmarken speichern …"))
      const result = await completeExamProductionUpload({ audioId: order.audioId, kind, path, filename: file.name, wordTimings })
      if (!result.success) throw new Error(result.error || t("Der Upload konnte nicht abgeschlossen werden."))
      onNotice({ error: false, text: kind === 'raw' ? t("Die Rohaufnahme wurde privat gespeichert. Als Nächstes: Schnittfassung mit Wortzeitmarken hochladen.") : t("Die Schnittfassung und Wortzeitmarken wurden gespeichert. Als Nächstes: Aufnahme gegen Skript und Aufgaben prüfen.") })
      completedPath.current = null
      if (audioInput.current) audioInput.current.value = ''
      if (timingsInput.current) timingsInput.current.value = ''
      setFile(null); setTimings(null); onSaved()
    } catch (error) { onNotice({ error: true, text: error instanceof Error ? error.message : t("Der Upload konnte nicht abgeschlossen werden. Bitte versuche es erneut.") }) }
    finally { setPending(false); setStage('') }
  }
  return <form className={styles.fields} onSubmit={upload}><label><span className={adminLabel}>{kind === 'raw' ? t("Rohdatei auswählen oder ersetzen") : t("Schnittdatei auswählen oder ersetzen")}</span><input ref={audioInput} className={styles.file} type="file" accept={audioAccept} required disabled={!available || pending} onChange={event => { setFile(event.target.files?.[0] ?? null); completedPath.current = null }} /><span className={adminHint}>{t("M4A, MP3, WAV, OGG oder WebM · maximal 20 MB. Upload direkt in den privaten Medienspeicher.")}</span></label>{kind === 'prepared' && <label><span className={adminLabel}>{t("Wortzeitmarken der Schnittfassung (.json)")}</span><input ref={timingsInput} className={styles.file} type="file" accept=".json,application/json" required disabled={!available || pending} onChange={event => setTimings(event.target.files?.[0] ?? null)} /></label>}<PressableCard type="submit" className={adminButton('secondary')} disabled={!available || !file || pending || (kind === 'prepared' && !timings)}><Upload size={17} aria-hidden="true" />{pending ? stage : kind === 'raw' ? t("Rohaufnahme hochladen") : t("Schnittfassung und Zeitmarken hochladen")}</PressableCard>{pending && <p role="status" className={styles.muted}>{t("Bitte lasse diese Ansicht bis zum Abschluss des Uploads geöffnet.")}</p>}</form>
}
