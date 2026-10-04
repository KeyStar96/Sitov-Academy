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
import { sitovPrepTeacherText, sitovPrepTeacherLocale, sitovPrepTeacherError } from '@/lib/exam-preparation/teacher-ui-copy'

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

function dateLabel(value: string, lang: string) {
  return new Intl.DateTimeFormat(sitovPrepTeacherLocale(lang), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value))
}

export default function ExamTeacherPanel({ lang = 'de', state, modules, workshops = [] }: { lang?: string; state: ExamTeacherState; modules: ExamModule[]; workshops?: ExamModule[] }) {
  const t = (text:string) => sitovPrepTeacherText(lang,text)
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
  return <div className={styles.stack} lang={lang}>
    {notice && !selected && <p role={notice.error ? 'alert' : 'status'} className={styles.notice} data-error={notice.error}>{notice.error ? sitovPrepTeacherError(lang,notice.text) : t(notice.text)}</p>}
    {!state.success && <p role="alert" className={styles.notice} data-error="true">{sitovPrepTeacherError(lang,state.error || t("Die Abgaben konnten nicht geladen werden. Bitte lade die Seite erneut."))}</p>}
    {!selected && <>
      <div className={styles.filters}>
        <label><span className={adminLabel}>{t("Status")}</span><select className={adminInput} value={status} onChange={event => setStatus(event.target.value)}><option value="submitted">{t("Rückmeldung ausstehend")}</option><option value="reviewed">{t("Rückmeldung gegeben")}</option><option value="all">{t("Alle Abgaben")}</option></select></label>
        <label><span className={adminLabel}>{t("Fertigkeit")}</span><select className={adminInput} value={skill} onChange={event => setSkill(event.target.value)}><option value="all">{t("Schreiben und Sprechen")}</option><option value="writing">{t("Schreiben")}</option><option value="speaking">{t("Sprechen")}</option></select></label>
        <label><span className={adminLabel}>{t("Kurs")}</span><select className={adminInput} value={course} onChange={event => setCourse(event.target.value)}><option value="all">{t("Alle Kurse")}</option>{courses.map(value => <option key={value}>{value}</option>)}<option value="none">{t("Ohne Kurszuordnung")}</option></select></label>
      </div>
      <p className={styles.muted}>{visible.length} {visible.length === 1 ? t("Abgabe") : t("Abgaben")} {t("· Sprech- und Schreibprodukte aus dem gemeinsamen B1-Lernweg.")}</p>
    </>}
    <div className={selected ? styles.stack : styles.workspace}>
      {!selected && <div className={styles.list} aria-label={t("B1-Abgaben")}>
        {visible.map(item => <PressableCard key={item.id} className={styles.item} aria-pressed={false} onClick={() => select(item.id)}>
          <span className={styles.itemTitle}><span>{people.get(item.studentId)?.name || t("Lernender")}</span>{item.kind === 'speaking' ? <Mic size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}</span>
          <span className={styles.meta}><span lang="de" translate="no">{tasks.get(item.taskId)?.title || item.taskId}</span><span>{dateLabel(item.createdAt,lang)}</span><span>{t(statusLabel[item.status])}</span></span>
        </PressableCard>)}
        {!visible.length && <div className={styles.empty}><CheckCheck size={26} className="mx-auto mb-3 text-[var(--muted)]" aria-hidden="true" /><p className="font-semibold">{t("Keine Abgaben für diese Auswahl")}</p><p className={styles.muted}>{t("Mit „Alle Abgaben“ findest du bereits besprochene Arbeiten.")}</p></div>}
      </div>}
      {selected && <div ref={detailRef} tabIndex={-1} className={styles.stack}>
        <PressableCard className={adminButton('ghost', 'md', 'justify-self-start')} onClick={() => setSelectedId(null)}><ArrowLeft size={18} aria-hidden="true" />{t("Zur Abgabenliste")}</PressableCard>
        <SubmissionDetail lang={lang} key={selected.id} submission={selected} task={task} student={people.get(selected.studentId)} submissions={state.submissions} modules={modules} onNotice={setNotice} />
      </div>}
    </div>
    {!selected && state.actorRole === 'admin' && Boolean(state.teachers?.length) && <details className={styles.fold}><summary>{t("Lehrkraft und Rückmeldezeit zuordnen")}</summary><div><TeacherAssignment lang={lang} state={state} onNotice={setNotice} /></div></details>}
  </div>
}

function SubmissionDetail({ lang, submission, task, student, submissions, modules, onNotice }: { lang: string; submission: ExamSubmission; task?: ExamTask; student?: Person; submissions: ExamSubmission[]; modules: ExamModule[]; onNotice: (value: { text: string; error: boolean }) => void }) {
  const t = (text:string) => sitovPrepTeacherText(lang,text)
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
      report('feedback', { error: !result.success, text: result.success ? t("Deine Rückmeldung wurde gespeichert. Die Originalabgabe bleibt erhalten.") : result.error || t("Die Rückmeldung konnte nicht gespeichert werden. Dein Text bleibt hier stehen.") })
      if (result.success) router.refresh()
    } catch { report('feedback', { error: true, text: t("Die Verbindung ist unterbrochen. Deine Rückmeldung bleibt hier stehen; bitte erneut speichern.") }) }
    finally { setPending(false) }
  }
  const unlock = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    try {
      const result = await unlockExamModule({ studentId: submission.studentId, moduleId: unlockModule, reason: reason.trim() })
      report('unlock', { error: !result.success, text: result.success ? t("Das Modul ist mit deiner Begründung freigeschaltet.") : result.error || t("Die Freischaltung konnte nicht gespeichert werden.") })
      if (result.success) { setReason(''); router.refresh() }
    } catch { report('unlock', { error: true, text: t("Die Verbindung ist unterbrochen. Bitte versuche die Freischaltung erneut.") }) }
    finally { setPending(false) }
  }
  return <article className={`${styles.detail} ${styles.stack}`}>
    <header><div className={styles.row}><h2 className={styles.heading}>{student?.name || t("Lernender")}</h2><span className={styles.pill}>{t(statusLabel[submission.status])}</span></div><p className={styles.meta}>{student?.course || t("Ohne Kurszuordnung")} · {dateLabel(submission.createdAt,lang)} {t("· Aufgabe Version")} {submission.taskVersion}</p></header>
    <section className={styles.inset}><h3 className={styles.sectionTitle}>{task?.title ? <span lang="de" translate="no">{task.title}</span> : t("B1-Auftrag")}</h3>{task && task.version === submission.taskVersion ? <><p className={styles.text} lang="de" translate="no">{task.instruction}</p>{task.text && <p className={`${styles.text} mt-3`} lang="de" translate="no">{task.text}</p>}{task.image?.status === 'prepared' && <Image lang="de" translate="no" unoptimized src={task.image.src} alt={task.image.alt} width={1200} height={800} className={`${styles.image} mt-3`} />}</> : <p className={styles.muted}>{t("Aufgaben-ID:")} {submission.taskId}{t(". Der Inhalt dieser älteren Aufgabenfassung ist im aktuellen Katalog nicht vorhanden. Beurteile die Abgabe anhand ihres gespeicherten Auftragsstands.")}</p>}</section>
    <SubmissionMedia lang={lang} submission={submission} />
    {submission.helped && <p className={styles.notice}>{t("Bei diesem Beitrag wurden Lernhilfen genutzt. Er kann als „Mit Hilfe gelungen“ bewertet werden und zählt als Übungsleistung.")}</p>}
    {submission.reflection && <section><h3 className={styles.sectionTitle}>{t("Selbstreflexion")}</h3><p className={styles.text} lang="" translate="no">{submission.reflection}</p></section>}
    {previous.length > 0 && <details className={styles.fold}><summary>{t("Frühere Versionen vergleichen (")}{previous.length})</summary><div className={styles.stack}>{previous.map(item => <section key={item.id} className={styles.inset}><h3 className={styles.sectionTitle}>{dateLabel(item.createdAt,lang)} {t("· Version")} {item.taskVersion}</h3><SubmissionMedia lang={lang} submission={item} />{item.feedback.map(feedback => <Feedback lang={lang} key={feedback.id} feedback={feedback} />)}</section>)}</div></details>}
    {submission.feedback.length > 0 && <details className={styles.fold} open><summary>{t("Gespeicherte Lehrkraftrückmeldung")}</summary><div className={styles.stack}>{submission.feedback.map(feedback => <Feedback lang={lang} key={feedback.id} feedback={feedback} />)}</div></details>}
    <form onSubmit={saveFeedback} className={styles.fields}>
      <header><h3 className={styles.sectionTitle}>{t("Lernfeedback geben")}</h3><p className={styles.muted}>{t("Eine gelungene Stelle, höchstens zwei Lernschwerpunkte und eine kleine Überarbeitung. Dieses Lernraster beschreibt die konkrete Arbeit.")}</p></header>
      <details className={styles.fold}><summary>{t("Eigenes Lernraster ·")} {submission.kind === 'writing' ? t("Schreiben") : t("Sprechen")}</summary><div className={styles.fields}>{rubric.map(criterion => <label key={criterion}><span className={adminLabel}>{t(criterion)}</span><select value={criterionRatings[criterion] || ''} onChange={event => setCriterionRatings(values => ({ ...values, [criterion]: event.target.value as Rating | '' }))} className={adminInput}><option value="">{t("Noch nicht bewertet")}</option>{Object.entries(ratingLabel).map(([value, label]) => <option key={value} value={value} disabled={submission.helped && value === 'independent'}>{t(label)}</option>)}</select></label>)}<p className={adminHint}>{t("Beurteile Verständlichkeit beim Sprechen anhand der Aufnahme. Ein Akzent allein ist kein Fehler.")}</p></div></details>
      <details className={styles.fold}><summary>{t("Vorlage für die Überarbeitungsaufgabe wählen")}</summary><div className={styles.row}><PressableCard className={adminButton('secondary')} onClick={() => { setPriorities([t("Alle Inhaltspunkte beantworten"), '']); setRevision(t("Ergänze den fehlenden Inhaltspunkt in einer eigenen neuen Version. Vergleiche danach beide Fassungen.")) }}>{t("Inhalt ergänzen")}</PressableCard><PressableCard className={adminButton('secondary')} onClick={() => { setPriorities([t("Den Beitrag klar gliedern"), '']); setRevision(submission.kind === 'writing' ? t("Gliedere deinen Text mit einem passenden Anfang, verbundenen Inhaltspunkten und einem Schluss. Behalte deine eigenen Aussagen.") : t("Nimm deinen Beitrag neu auf: kurzer Einstieg, zwei geordnete Gedanken und ein Schluss. Nutze nur Stichwörter als Hilfe.")) }}>{t("Klar gliedern")}</PressableCard><PressableCard className={adminButton('secondary')} onClick={() => { setPriorities([t("Die Aussage begründen"), '']); setRevision(t("Ergänze einen passenden Grund und ein eigenes Beispiel. Speichere danach eine neue Fassung.")) }}>{t("Begründung vertiefen")}</PressableCard></div><p className={adminHint}>{t("Passe die Vorlage an die konkrete Abgabe an.")}</p></details>
      <label><span className={adminLabel}>{t("Was ist konkret gelungen?")}</span><textarea required maxLength={3000} rows={3} className={adminInput} value={strengths} onChange={event => setStrengths(event.target.value)} placeholder={t("Nenne eine gelungene Stelle aus der Abgabe.")} /></label>
      <div className={styles.filters} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 15rem), 1fr))' }}>{priorities.map((value, index) => <label key={index}><span className={adminLabel}>{t("Lernschwerpunkt")} {index + 1}{index === 1 ? t(" (optional)") : ''}</span><input required={index === 0} maxLength={500} className={adminInput} value={value} onChange={event => setPriorities(items => items.map((item, position) => position === index ? event.target.value : item))} /></label>)}</div>
      <label><span className={adminLabel}>{t("Kommentar und passende Verbesserung")}</span><textarea required maxLength={6000} rows={4} className={adminInput} value={comment} onChange={event => setComment(event.target.value)} placeholder={t("Welche Inhaltspunkte fehlen? Zeige eine Verbesserung, die die Aussageabsicht erhält.")} /></label>
      <label><span className={adminLabel}>{t("Kleine Überarbeitungsaufgabe")}</span><textarea required maxLength={3000} rows={3} className={adminInput} value={revision} onChange={event => setRevision(event.target.value)} placeholder={t("Was soll in der nächsten Text- oder Aufnahmeversion verbessert werden?")} /></label>
      <label><span className={adminLabel}>{t("Lernstatus dieser Leistung")}</span><select className={adminInput} value={rating} onChange={event => setRating(event.target.value as Rating)}>{Object.entries(ratingLabel).map(([value, label]) => <option key={value} value={value} disabled={submission.helped && value === 'independent'}>{t(label)}</option>)}</select><span className={adminHint}>{t("Das Lernraster beschreibt die konkrete Leistung. „Selbstständig gelungen“ setzt einen eigenen Beitrag ohne übernommene Vorlage voraus.")}</span></label>
      <PressableCard type="submit" disabled={pending} className={adminButton('primary')}><Send size={17} aria-hidden="true" />{pending ? t("Wird gespeichert …") : t("Rückmeldung speichern")}</PressableCard>
      {actionNotice?.source === 'feedback' && <p role={actionNotice.error ? 'alert' : 'status'} className={styles.notice} data-error={actionNotice.error}>{actionNotice.error ? sitovPrepTeacherError(lang,actionNotice.text) : t(actionNotice.text)}</p>}
    </form>
    <details className={styles.fold}><summary>{t("Modul mit Begründung freischalten")}</summary><div><form onSubmit={unlock} className={styles.fields}><p className={styles.muted}>{t("Die Freischaltung ermöglicht das Weiterlernen. Sie ersetzt keinen selbstständigen Kompetenznachweis.")}</p><label><span className={adminLabel}>{t("Modul")}</span><select className={adminInput} value={unlockModule} onChange={event => setUnlockModule(event.target.value)}>{modules.map(module => <option key={module.id} value={module.id} disabled={module.releaseStatus !== 'published'}>{t(module.title)}{module.releaseStatus !== 'published' ? t(" · in Vorbereitung") : ''}</option>)}</select></label><label><span className={adminLabel}>{t("Fachliche Begründung")}</span><textarea required minLength={10} maxLength={3000} rows={3} className={adminInput} value={reason} onChange={event => setReason(event.target.value)} /></label><PressableCard type="submit" disabled={pending || !unlockModule} className={adminButton('secondary')}><Unlock size={17} aria-hidden="true" />{t("Freischaltung speichern")}</PressableCard>{actionNotice?.source === 'unlock' && <p role={actionNotice.error ? 'alert' : 'status'} className={styles.notice} data-error={actionNotice.error}>{actionNotice.error ? sitovPrepTeacherError(lang,actionNotice.text) : t(actionNotice.text)}</p>}</form></div></details>
  </article>
}

function SubmissionMedia({ submission, lang }: { lang: string; submission: ExamSubmission }) {
  const t = (text:string) => sitovPrepTeacherText(lang,text)
  return <section><h3 className={styles.sectionTitle}>{submission.kind === 'speaking' ? t("Eigene Aufnahme") : t("Originaltext")}</h3>{submission.text && <p className={styles.text} lang="de" translate="no">{submission.text}</p>}{submission.photoUrl && <Image unoptimized src={submission.photoUrl} alt={t("Handschriftlicher Originaltext der Abgabe")} width={900} height={1200} className={styles.image} />}{submission.mediaUrl && <audio className={styles.audio} src={submission.mediaUrl} controls preload="none">{t("Dein Browser kann die Aufnahme nicht abspielen.")}</audio>}{((submission.mediaPath && !submission.mediaUrl) || (submission.photoPath && !submission.photoUrl)) && <p className={styles.muted}>{t("Die private Datei konnte nicht geladen werden. Lade die Seite erneut, um einen neuen sicheren Wiedergabelink zu erhalten.")}</p>}</section>
}

function Feedback({ feedback, lang }: { lang: string; feedback: ExamSubmission['feedback'][number] }) {
  const t = (text:string) => sitovPrepTeacherText(lang,text)
  return <section className={styles.inset}><p className={styles.meta}>{t("Lehrkraft ·")} {dateLabel(feedback.createdAt,lang)} · {t(ratingLabel[feedback.rating])}</p><h4 className={`${styles.sectionTitle} mt-3`}>{t("Gelungen")}</h4><p className={styles.text} lang="" translate="no">{feedback.strengths}</p>{feedback.priorities.length > 0 && <><h4 className={`${styles.sectionTitle} mt-3`}>{t("Lernschwerpunkte")}</h4><ul className={styles.rubric}>{feedback.priorities.map((item, index) => <li key={index} lang="" translate="no">{item}</li>)}</ul></>}<p className={`${styles.text} mt-3`} lang="" translate="no">{feedback.text}</p><h4 className={`${styles.sectionTitle} mt-3`}>{t("Nächste Überarbeitung")}</h4><p className={styles.text} lang="" translate="no">{feedback.revision}</p>{Boolean(feedback.rubric?.length) && <details className={`${styles.fold} mt-3`}><summary>{t("Kriterien dieser Rückmeldung")}</summary><div><ul className={styles.rubric}>{feedback.rubric?.map(item => <li key={item.criterion}>{t(item.criterion)}: {t(ratingLabel[item.rating])}</li>)}</ul></div></details>}</section>
}

function TeacherAssignment({ state, onNotice, lang }: { lang: string; state: ExamTeacherState; onNotice: (value: { text: string; error: boolean }) => void }) {
  const t = (text:string) => sitovPrepTeacherText(lang,text)
  const router = useRouter()
  const [studentId, setStudentId] = useState(state.students[0]?.id || '')
  const [teacherId, setTeacherId] = useState(state.teachers?.[0]?.id || '')
  const [responseDays, setResponseDays] = useState(5)
  const [pending, setPending] = useState(false)
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setPending(true)
    try {
      const result = await assignExamTeacher({ studentId, teacherId, responseDays })
      onNotice({ error: !result.success, text: result.success ? t("Die Lehrkraftzuordnung wurde gespeichert.") : result.error || t("Die Zuordnung konnte nicht gespeichert werden.") })
      if (result.success) router.refresh()
    } catch { onNotice({ error: true, text: t("Die Zuordnung konnte nicht gespeichert werden. Bitte versuche es erneut.") }) }
    finally { setPending(false) }
  }
  const current = state.assignments.find(item => item.studentId === studentId)
  return <form onSubmit={save} className={styles.fields}><div className={styles.filters}><label><span className={adminLabel}>{t("Lernender")}</span><select required className={adminInput} value={studentId} onChange={event => setStudentId(event.target.value)}>{state.students.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label><span className={adminLabel}>{t("Zuständige Lehrkraft")}</span><select required className={adminInput} value={teacherId} onChange={event => setTeacherId(event.target.value)}>{state.teachers?.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label><span className={adminLabel}>{t("Rückmeldung innerhalb von Tagen")}</span><input type="number" required min={1} max={30} className={adminInput} value={responseDays} onChange={event => setResponseDays(Number(event.target.value))} /></label></div>{current && <p className={styles.muted}>{t("Aktuell:")} {state.teachers?.find(person => person.id === current.teacherId)?.name || t("Lehrkraft")} · {current.responseDays} {t("Tage")}</p>}<PressableCard type="submit" disabled={pending || !studentId || !teacherId} className={adminButton('primary')}>{pending ? t("Wird gespeichert …") : t("Lehrkraft verbindlich zuordnen")}</PressableCard></form>
}
