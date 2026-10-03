'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, CheckCheck, FileText, Mic, Send, Unlock } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import { adminButton, adminInput, adminLabel, adminHint } from '@/components/admin/ui'
import { assignExamTeacher, reviewExamSubmission, unlockExamModule } from '@/app/actions/exam-preparation'
import type { ExamModule, ExamSubmission, ExamTask } from '@/lib/exam-preparation/types'
import styles from './ExamTeacher.module.css'

type Rating = 'practice' | 'assisted' | 'independent'
type Person = { id: string; name: string; course: string | null }
export interface ExamTeacherState {
  success: boolean; error?: string; submissions: ExamSubmission[]; students: Person[]
  assignments: { studentId: string; teacherId: string; responseDays: number }[]
  teachers?: { id: string; name: string }[]; actorRole?: 'admin' | 'teacher'
}
const statusLabel = { draft: 'Entwurf', submitted: 'Rückmeldung ausstehend', reviewed: 'Rückmeldung gegeben' }
const ratingLabel: Record<Rating, string> = { practice: 'Noch üben', assisted: 'Mit Hilfe gelungen', independent: 'Selbstständig gelungen' }
const writingRubric = ['Inhaltspunkte beantwortet', 'Ansprache und Register passen', 'Verständlicher Zusammenhang', 'Passende sprachliche Mittel', 'Sprachliche Korrektheit']
const speakingRubric = ['Auftrag erfüllt', 'Verständlich gesprochen', 'Zusammenhängend gesprochen', 'Passende sprachliche Mittel', 'Auf Fragen oder Partner reagiert']

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value))
}

export default function ExamTeacherPanel({ state, modules, workshops = [] }: { state: ExamTeacherState; modules: ExamModule[]; workshops?: ExamModule[] }) {
  const [status, setStatus] = useState('submitted')
  const [skill, setSkill] = useState('all')
  const [course, setCourse] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const people = new Map(state.students.map(person => [person.id, person]))
  const tasks = useMemo(() => new Map([...modules, ...workshops].flatMap(module => module.units.flatMap(unit => [...unit.tasks, ...(unit.variants ?? []).flat()])).map(task => [task.id, task])), [modules, workshops])
  const courses = [...new Set(state.students.map(person => person.course).filter((value): value is string => Boolean(value)))].sort()
  const visible = state.submissions.filter(item => (status === 'all' || item.status === status) && (skill === 'all' || item.kind === skill) && (course === 'all' || (course === 'none' ? !people.get(item.studentId)?.course : people.get(item.studentId)?.course === course)))
  const selected = state.submissions.find(item => item.id === selectedId)
  const task = selected ? tasks.get(selected.taskId) : undefined
  const select = (id: string) => {
    setSelectedId(id)
    setNotice(null)
    requestAnimationFrame(() => { if (window.matchMedia('(max-width: 999px)').matches) detailRef.current?.focus({ preventScroll: false }) })
  }
  return <div className={styles.stack}>
    {notice && !selected && <p role={notice.error ? 'alert' : 'status'} className={styles.notice} data-error={notice.error}>{notice.text}</p>}
    {!state.success && <p role="alert" className={styles.notice} data-error="true">{state.error || 'Die Abgaben konnten nicht geladen werden. Bitte lade die Seite erneut.'}</p>}
    {!selected && <>
      <div className={styles.filters}>
        <label><span className={adminLabel}>Status</span><select className={adminInput} value={status} onChange={event => setStatus(event.target.value)}><option value="submitted">Rückmeldung ausstehend</option><option value="reviewed">Rückmeldung gegeben</option><option value="all">Alle Abgaben</option></select></label>
        <label><span className={adminLabel}>Fertigkeit</span><select className={adminInput} value={skill} onChange={event => setSkill(event.target.value)}><option value="all">Schreiben und Sprechen</option><option value="writing">Schreiben</option><option value="speaking">Sprechen</option></select></label>
        <label><span className={adminLabel}>Kurs</span><select className={adminInput} value={course} onChange={event => setCourse(event.target.value)}><option value="all">Alle Kurse</option>{courses.map(value => <option key={value}>{value}</option>)}<option value="none">Ohne Kurszuordnung</option></select></label>
      </div>
      <p className={styles.muted}>{visible.length} {visible.length === 1 ? 'Abgabe' : 'Abgaben'} · Sprech- und Schreibprodukte aus dem gemeinsamen B1-Lernweg.</p>
    </>}
    <div className={selected ? styles.stack : styles.workspace}>
      {!selected && <div className={styles.list} aria-label="B1-Abgaben">
        {visible.map(item => <PressableCard key={item.id} className={styles.item} aria-pressed={false} onClick={() => select(item.id)}>
          <span className={styles.itemTitle}><span>{people.get(item.studentId)?.name || 'Lernender'}</span>{item.kind === 'speaking' ? <Mic size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}</span>
          <span className={styles.meta}><span>{tasks.get(item.taskId)?.title || item.taskId}</span><span>{dateLabel(item.createdAt)}</span><span>{statusLabel[item.status]}</span></span>
        </PressableCard>)}
        {!visible.length && <div className={styles.empty}><CheckCheck size={26} className="mx-auto mb-3 text-[var(--muted)]" aria-hidden="true" /><p className="font-semibold">Keine Abgaben für diese Auswahl</p><p className={styles.muted}>Mit „Alle Abgaben“ findest du bereits besprochene Arbeiten.</p></div>}
      </div>}
      {selected && <div ref={detailRef} tabIndex={-1} className={styles.stack}>
        <PressableCard className={adminButton('ghost', 'md', 'justify-self-start')} onClick={() => setSelectedId(null)}><ArrowLeft size={18} aria-hidden="true" />Zur Abgabenliste</PressableCard>
        <SubmissionDetail key={selected.id} submission={selected} task={task} student={people.get(selected.studentId)} submissions={state.submissions} modules={modules} onNotice={setNotice} />
      </div>}
    </div>
    {!selected && state.actorRole === 'admin' && Boolean(state.teachers?.length) && <details className={styles.fold}><summary>Lehrkraft und Rückmeldezeit zuordnen</summary><div><TeacherAssignment state={state} onNotice={setNotice} /></div></details>}
  </div>
}

function SubmissionDetail({ submission, task, student, submissions, modules, onNotice }: { submission: ExamSubmission; task?: ExamTask; student?: Person; submissions: ExamSubmission[]; modules: ExamModule[]; onNotice: (value: { text: string; error: boolean }) => void }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [strengths, setStrengths] = useState('')
  const [priorities, setPriorities] = useState(['', ''])
  const [comment, setComment] = useState('')
  const [revision, setRevision] = useState('')
  const [rating, setRating] = useState<Rating>(submission.helped ? 'assisted' : 'practice')
  const [criterionRatings, setCriterionRatings] = useState<Record<string, Rating | ''>>({})
  const publishedModules = modules.filter(module => module.releaseStatus === 'published')
  const [unlockModule, setUnlockModule] = useState(publishedModules[1]?.id ?? publishedModules[0]?.id ?? '')
  const [reason, setReason] = useState('')
  const [actionNotice, setActionNotice] = useState<{ text: string; error: boolean; source: 'feedback' | 'unlock' } | null>(null)
  const report = (source: 'feedback' | 'unlock', value: { text: string; error: boolean }) => { setActionNotice({ ...value, source }); onNotice(value) }
  const rubric = task?.version === submission.taskVersion && task.rubric?.length ? task.rubric : submission.kind === 'writing' ? writingRubric : speakingRubric
  const previous: ExamSubmission[] = []
  const seen = new Set([submission.id])
  let previousId = submission.previousId
  while (previousId && !seen.has(previousId)) {
    seen.add(previousId)
    const item = submissions.find(candidate => candidate.id === previousId && candidate.studentId === submission.studentId)
    if (!item) break
    previous.push(item)
    previousId = item.previousId
  }
  const saveFeedback = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const result = await reviewExamSubmission({ submissionId: submission.id, text: comment.trim(), strengths: strengths.trim(), priorities: priorities.map(value => value.trim()).filter(Boolean), revision: revision.trim(), rating, rubric: rubric.filter(criterion => criterionRatings[criterion]).map(criterion => ({ criterion, rating: criterionRatings[criterion] as Rating })) })
      report('feedback', { error: !result.success, text: result.success ? 'Deine Rückmeldung wurde gespeichert. Die Originalabgabe bleibt erhalten.' : result.error || 'Die Rückmeldung konnte nicht gespeichert werden. Dein Text bleibt hier stehen.' })
      if (result.success) router.refresh()
    } catch { report('feedback', { error: true, text: 'Die Verbindung ist unterbrochen. Deine Rückmeldung bleibt hier stehen; bitte erneut speichern.' }) }
    finally { setPending(false) }
  }
  const unlock = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const result = await unlockExamModule({ studentId: submission.studentId, moduleId: unlockModule, reason: reason.trim() })
      report('unlock', { error: !result.success, text: result.success ? 'Das Modul ist mit deiner Begründung freigeschaltet.' : result.error || 'Die Freischaltung konnte nicht gespeichert werden.' })
      if (result.success) { setReason(''); router.refresh() }
    } catch { report('unlock', { error: true, text: 'Die Verbindung ist unterbrochen. Bitte versuche die Freischaltung erneut.' }) }
    finally { setPending(false) }
  }
  return <article className={`${styles.detail} ${styles.stack}`}>
    <header><div className={styles.row}><h2 className={styles.heading}>{student?.name || 'Lernender'}</h2><span className={styles.pill}>{statusLabel[submission.status]}</span></div><p className={styles.meta}>{student?.course || 'Ohne Kurszuordnung'} · {dateLabel(submission.createdAt)} · Aufgabe Version {submission.taskVersion}</p></header>
    <section className={styles.inset}><h3 className={styles.sectionTitle}>{task?.title || 'B1-Auftrag'}</h3>{task && task.version === submission.taskVersion ? <><p className={styles.text}>{task.instruction}</p>{task.text && <p className={`${styles.text} mt-3`}>{task.text}</p>}{task.image?.status === 'prepared' && <Image unoptimized src={task.image.src} alt={task.image.alt} width={1200} height={800} className={`${styles.image} mt-3`} />}</> : <p className={styles.muted}>Aufgaben-ID: {submission.taskId}. Der Inhalt dieser älteren Aufgabenfassung ist im aktuellen Katalog nicht vorhanden. Beurteile die Abgabe anhand ihres gespeicherten Auftragsstands.</p>}</section>
    <SubmissionMedia submission={submission} />
    {submission.helped && <p className={styles.notice}>Bei diesem Beitrag wurden Lernhilfen genutzt. Er kann als „Mit Hilfe gelungen“ bewertet werden und zählt als Übungsleistung.</p>}
    {submission.reflection && <section><h3 className={styles.sectionTitle}>Selbstreflexion</h3><p className={styles.text}>{submission.reflection}</p></section>}
    {previous.length > 0 && <details className={styles.fold}><summary>Frühere Versionen vergleichen ({previous.length})</summary><div className={styles.stack}>{previous.map(item => <section key={item.id} className={styles.inset}><h3 className={styles.sectionTitle}>{dateLabel(item.createdAt)} · Version {item.taskVersion}</h3><SubmissionMedia submission={item} />{item.feedback.map(feedback => <Feedback key={feedback.id} feedback={feedback} />)}</section>)}</div></details>}
    {submission.feedback.length > 0 && <details className={styles.fold} open><summary>Gespeicherte Lehrkraftrückmeldung</summary><div className={styles.stack}>{submission.feedback.map(feedback => <Feedback key={feedback.id} feedback={feedback} />)}</div></details>}
    <form onSubmit={saveFeedback} className={styles.fields}>
      <header><h3 className={styles.sectionTitle}>Lernfeedback geben</h3><p className={styles.muted}>Eine gelungene Stelle, höchstens zwei Lernschwerpunkte und eine kleine Überarbeitung. Dieses Lernraster beschreibt die konkrete Arbeit.</p></header>
      <details className={styles.fold}><summary>Eigenes Lernraster · {submission.kind === 'writing' ? 'Schreiben' : 'Sprechen'}</summary><div className={styles.fields}>{rubric.map(criterion => <label key={criterion}><span className={adminLabel}>{criterion}</span><select value={criterionRatings[criterion] || ''} onChange={event => setCriterionRatings(values => ({ ...values, [criterion]: event.target.value as Rating | '' }))} className={adminInput}><option value="">Noch nicht bewertet</option>{Object.entries(ratingLabel).map(([value, label]) => <option key={value} value={value} disabled={submission.helped && value === 'independent'}>{label}</option>)}</select></label>)}<p className={adminHint}>Beurteile Verständlichkeit beim Sprechen anhand der Aufnahme. Ein Akzent allein ist kein Fehler.</p></div></details>
      <details className={styles.fold}><summary>Vorlage für die Überarbeitungsaufgabe wählen</summary><div className={styles.row}><PressableCard className={adminButton('secondary')} onClick={() => { setPriorities(['Alle Inhaltspunkte beantworten', '']); setRevision('Ergänze den fehlenden Inhaltspunkt in einer eigenen neuen Version. Vergleiche danach beide Fassungen.') }}>Inhalt ergänzen</PressableCard><PressableCard className={adminButton('secondary')} onClick={() => { setPriorities(['Den Beitrag klar gliedern', '']); setRevision(submission.kind === 'writing' ? 'Gliedere deinen Text mit einem passenden Anfang, verbundenen Inhaltspunkten und einem Schluss. Behalte deine eigenen Aussagen.' : 'Nimm deinen Beitrag neu auf: kurzer Einstieg, zwei geordnete Gedanken und ein Schluss. Nutze nur Stichwörter als Hilfe.') }}>Klar gliedern</PressableCard><PressableCard className={adminButton('secondary')} onClick={() => { setPriorities(['Die Aussage begründen', '']); setRevision('Ergänze einen passenden Grund und ein eigenes Beispiel. Speichere danach eine neue Fassung.') }}>Begründung vertiefen</PressableCard></div><p className={adminHint}>Passe die Vorlage an die konkrete Abgabe an.</p></details>
      <label><span className={adminLabel}>Was ist konkret gelungen?</span><textarea required maxLength={3000} rows={3} className={adminInput} value={strengths} onChange={event => setStrengths(event.target.value)} placeholder="Nenne eine gelungene Stelle aus der Abgabe." /></label>
      <div className={styles.filters} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))' }}>{priorities.map((value, index) => <label key={index}><span className={adminLabel}>Lernschwerpunkt {index + 1}{index === 1 ? ' (optional)' : ''}</span><input required={index === 0} maxLength={500} className={adminInput} value={value} onChange={event => setPriorities(items => items.map((item, position) => position === index ? event.target.value : item))} /></label>)}</div>
      <label><span className={adminLabel}>Kommentar und passende Verbesserung</span><textarea required maxLength={6000} rows={4} className={adminInput} value={comment} onChange={event => setComment(event.target.value)} placeholder="Welche Inhaltspunkte fehlen? Zeige eine Verbesserung, die die Aussageabsicht erhält." /></label>
      <label><span className={adminLabel}>Kleine Überarbeitungsaufgabe</span><textarea required maxLength={3000} rows={3} className={adminInput} value={revision} onChange={event => setRevision(event.target.value)} placeholder="Was soll in der nächsten Text- oder Aufnahmeversion verbessert werden?" /></label>
      <label><span className={adminLabel}>Lernstatus dieser Leistung</span><select className={adminInput} value={rating} onChange={event => setRating(event.target.value as Rating)}>{Object.entries(ratingLabel).map(([value, label]) => <option key={value} value={value} disabled={submission.helped && value === 'independent'}>{label}</option>)}</select><span className={adminHint}>Das Lernraster beschreibt die konkrete Leistung. „Selbstständig gelungen“ setzt einen eigenen Beitrag ohne übernommene Vorlage voraus.</span></label>
      <PressableCard type="submit" disabled={pending} className={adminButton('primary')}><Send size={17} aria-hidden="true" />{pending ? 'Wird gespeichert …' : 'Rückmeldung speichern'}</PressableCard>
      {actionNotice?.source === 'feedback' && <p role={actionNotice.error ? 'alert' : 'status'} className={styles.notice} data-error={actionNotice.error}>{actionNotice.text}</p>}
    </form>
    <details className={styles.fold}><summary>Modul mit Begründung freischalten</summary><div><form onSubmit={unlock} className={styles.fields}><p className={styles.muted}>Die Freischaltung ermöglicht das Weiterlernen. Sie ersetzt keinen selbstständigen Kompetenznachweis.</p><label><span className={adminLabel}>Modul</span><select className={adminInput} value={unlockModule} onChange={event => setUnlockModule(event.target.value)}>{modules.map(module => <option key={module.id} value={module.id} disabled={module.releaseStatus !== 'published'}>{module.title}{module.releaseStatus !== 'published' ? ' · in Vorbereitung' : ''}</option>)}</select></label><label><span className={adminLabel}>Fachliche Begründung</span><textarea required minLength={10} maxLength={3000} rows={3} className={adminInput} value={reason} onChange={event => setReason(event.target.value)} /></label><PressableCard type="submit" disabled={pending || !unlockModule} className={adminButton('secondary')}><Unlock size={17} aria-hidden="true" />Freischaltung speichern</PressableCard>{actionNotice?.source === 'unlock' && <p role={actionNotice.error ? 'alert' : 'status'} className={styles.notice} data-error={actionNotice.error}>{actionNotice.text}</p>}</form></div></details>
  </article>
}

function SubmissionMedia({ submission }: { submission: ExamSubmission }) {
  return <section><h3 className={styles.sectionTitle}>{submission.kind === 'speaking' ? 'Eigene Aufnahme' : 'Originaltext'}</h3>{submission.text && <p className={styles.text}>{submission.text}</p>}{submission.photoUrl && <Image unoptimized src={submission.photoUrl} alt="Handschriftlicher Originaltext der Abgabe" width={900} height={1200} className={styles.image} />}{submission.mediaUrl && <audio className={styles.audio} src={submission.mediaUrl} controls preload="none">Dein Browser kann die Aufnahme nicht abspielen.</audio>}{((submission.mediaPath && !submission.mediaUrl) || (submission.photoPath && !submission.photoUrl)) && <p className={styles.muted}>Die private Datei konnte nicht geladen werden. Lade die Seite erneut, um einen neuen sicheren Wiedergabelink zu erhalten.</p>}</section>
}

function Feedback({ feedback }: { feedback: ExamSubmission['feedback'][number] }) {
  return <section className={styles.inset}><p className={styles.meta}>Lehrkraft · {dateLabel(feedback.createdAt)} · {ratingLabel[feedback.rating]}</p><h4 className={`${styles.sectionTitle} mt-3`}>Gelungen</h4><p className={styles.text}>{feedback.strengths}</p>{feedback.priorities.length > 0 && <><h4 className={`${styles.sectionTitle} mt-3`}>Lernschwerpunkte</h4><ul className={styles.rubric}>{feedback.priorities.map((item, index) => <li key={index}>{item}</li>)}</ul></>}<p className={`${styles.text} mt-3`}>{feedback.text}</p><h4 className={`${styles.sectionTitle} mt-3`}>Nächste Überarbeitung</h4><p className={styles.text}>{feedback.revision}</p>{Boolean(feedback.rubric?.length) && <details className={`${styles.fold} mt-3`}><summary>Kriterien dieser Rückmeldung</summary><div><ul className={styles.rubric}>{feedback.rubric?.map(item => <li key={item.criterion}>{item.criterion}: {ratingLabel[item.rating]}</li>)}</ul></div></details>}</section>
}

function TeacherAssignment({ state, onNotice }: { state: ExamTeacherState; onNotice: (value: { text: string; error: boolean }) => void }) {
  const router = useRouter()
  const [studentId, setStudentId] = useState(state.students[0]?.id || '')
  const [teacherId, setTeacherId] = useState(state.teachers?.[0]?.id || '')
  const [responseDays, setResponseDays] = useState(5)
  const [pending, setPending] = useState(false)
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setPending(true)
    try {
      const result = await assignExamTeacher({ studentId, teacherId, responseDays })
      onNotice({ error: !result.success, text: result.success ? 'Die Lehrkraftzuordnung wurde gespeichert.' : result.error || 'Die Zuordnung konnte nicht gespeichert werden.' })
      if (result.success) router.refresh()
    } catch { onNotice({ error: true, text: 'Die Zuordnung konnte nicht gespeichert werden. Bitte versuche es erneut.' }) }
    finally { setPending(false) }
  }
  const current = state.assignments.find(item => item.studentId === studentId)
  return <form onSubmit={save} className={styles.fields}><div className={styles.filters}><label><span className={adminLabel}>Lernender</span><select required className={adminInput} value={studentId} onChange={event => setStudentId(event.target.value)}>{state.students.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label><span className={adminLabel}>Zuständige Lehrkraft</span><select required className={adminInput} value={teacherId} onChange={event => setTeacherId(event.target.value)}>{state.teachers?.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label><span className={adminLabel}>Rückmeldung innerhalb von Tagen</span><input type="number" required min={1} max={30} className={adminInput} value={responseDays} onChange={event => setResponseDays(Number(event.target.value))} /></label></div>{current && <p className={styles.muted}>Aktuell: {state.teachers?.find(person => person.id === current.teacherId)?.name || 'Lehrkraft'} · {current.responseDays} Tage</p>}<PressableCard type="submit" disabled={pending || !studentId || !teacherId} className={adminButton('primary')}>{pending ? 'Wird gespeichert …' : 'Lehrkraft verbindlich zuordnen'}</PressableCard></form>
}
