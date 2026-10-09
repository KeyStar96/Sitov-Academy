'use client'

import { useEffect, useId, useRef, useState } from 'react'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import PressableCard from '@/components/motion/PressableCard'
import { toUiLocale } from '@/lib/locale-routing'
import { sitovPronunciationPretestCopy, sitovPretestErrorCopy, sitovPretestText } from '@/lib/sitov-pronunciation-pretest-i18n'
import {
  sitovPronunciationPretestCatalogEntrySchema, sitovPronunciationPretestAttemptResponseSchema,
  sitovPronunciationPretestAttemptWithTasksSchema, sitovPronunciationPretestAttemptSchema,
  sitovPronunciationPretestCompletedAttemptSchema,
  type SitovPronunciationPretestActionResult as ActionResult,
  type SitovPronunciationPretestCatalogEntry as Entry,
  type SitovPronunciationPretestAttemptWithTasks as OpenAttempt,
  type SitovPronunciationPretestCompletedAttempt as Completed,
  type SitovPronunciationPretestAttempt as Attempt,
  type SitovPronunciationPretestAnswersInput as AnswersInput,
  type SitovPronunciationPretestStartInput as StartInput,
  type SitovPronunciationPretestError as ErrorCode,
} from '@/lib/sitov-pronunciation-pretest-contract'
import styles from './SitovPronunciationPretest.module.css'

export interface SitovPronunciationPretestProps {
  entry: Entry
  lang: string
  onStart: (input: StartInput) => Promise<ActionResult<OpenAttempt>>
  onResume: (attemptId: string) => Promise<ActionResult<OpenAttempt | Completed>>
  onSave: (input: AnswersInput) => Promise<ActionResult<Attempt>>
  onSubmit: (input: AnswersInput) => Promise<ActionResult<Completed>>
  /** Must reauthorize the exact current text on the server before loading it. */
  onOpenText: (textId: string) => Promise<ActionResult<null>>
  onRefresh: () => void
  autoStart?: boolean
}

type Operation = { kind: 'start'; input: StartInput } | { kind: 'resume'; id: string }
  | { kind: 'save' | 'submit'; input: AnswersInput } | { kind: 'open' }

/** Scope changes remount local answers and retire outstanding requests. */
export default function SitovPronunciationPretest(props: SitovPronunciationPretestProps) {
  return <SitovPretestSession key={`${props.entry.textId}:${props.entry.textVersion}:${props.entry.testVersion}`} {...props} />
}

function SitovPretestSession({ entry: rawEntry, lang, onStart, onResume, onSave, onSubmit, onOpenText, onRefresh, autoStart }: SitovPronunciationPretestProps) {
  const entry = sitovPronunciationPretestCatalogEntrySchema.safeParse(rawEntry)
  const copy = sitovPronunciationPretestCopy(lang)
  const [open, setOpen] = useState<OpenAttempt | null>(null)
  const [completed, setCompleted] = useState<Completed | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState<{ code: ErrorCode; retryable: boolean } | null>(null)
  const [pending, setPending] = useState<Operation | null>(null)
  const active = useRef(true)
  const requestBusy = useRef(false)
  const taskTitle = useRef<HTMLLegendElement>(null)
  const startAction = useRef<HTMLButtonElement>(null)
  const headingId = useId()
  const openAttemptId = open?.attempt.id
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => { if (autoStart) startAction.current?.click() }, [autoStart])
  useEffect(() => { if (openAttemptId) taskTitle.current?.focus({ preventScroll: true }) }, [index, openAttemptId])

  const scopeMatches = (value: { textId: string; textVersion: string; testVersion: string | null }) => entry.success
    && value.textId === entry.data.textId && value.textVersion === entry.data.textVersion && value.testVersion === entry.data.testVersion
  const blocked = !entry.success || entry.data.status === 'locked' || completed?.attempt.status === 'outdated'
    || error?.code === 'version_conflict' || error?.code === 'not_found' || error?.code === 'authoring_not_ready'
  const result = completed?.result
  const canOpen = !blocked && (result?.passed ? Boolean(result.proof) : !completed && entry.success && entry.data.status === 'passed')
  const attemptId = open?.attempt.id ?? (entry.success ? entry.data.attempt?.id : undefined)
  const resumeExisting = !completed && entry.success && Boolean(attemptId)
    && (entry.data.status === 'in_progress' || entry.data.status === 'failed')

  async function run(operation: Operation) {
    if (!entry.success || requestBusy.current || blocked) return
    requestBusy.current = true; setBusy(true); setError(null); setPending(operation)
    try {
      const response = operation.kind === 'start' ? await onStart(operation.input)
        : operation.kind === 'resume' ? await onResume(operation.id)
        : operation.kind === 'save' ? await onSave(operation.input)
        : operation.kind === 'submit' ? await onSubmit(operation.input)
        : await onOpenText(entry.data.textId)
      if (!active.current) return
      if (response.ok === false) { setError({ code: response.error, retryable: response.retryable }); return }
      if (operation.kind === 'open') { setPending(null); return }
      if (operation.kind === 'save') {
        const parsed = sitovPronunciationPretestAttemptSchema.safeParse(response.data)
        if (!parsed.success || !scopeMatches(parsed.data) || parsed.data.id !== open?.attempt.id || parsed.data.status !== 'in_progress'
          || parsed.data.revision <= operation.input.revision || Object.keys(parsed.data.answers).length !== Object.keys(operation.input.answers).length
          || Object.entries(operation.input.answers).some(([id, option]) => parsed.data.answers[id] !== option)) {
          setError({ code: 'attempt_conflict', retryable: false }); return
        }
        const validated = sitovPronunciationPretestAttemptWithTasksSchema.safeParse({ attempt: parsed.data, tasks: open.tasks })
        if (!validated.success) { setError({ code: 'attempt_conflict', retryable: false }); return }
        setOpen(validated.data); setAnswers(parsed.data.answers); setNotice(copy.saved)
        setIndex(value => Math.min(value + 1, validated.data.tasks.length - 1))
      } else {
        const parsed = operation.kind === 'start' ? sitovPronunciationPretestAttemptWithTasksSchema.safeParse(response.data)
          : operation.kind === 'submit' ? sitovPronunciationPretestCompletedAttemptSchema.safeParse(response.data)
          : sitovPronunciationPretestAttemptResponseSchema.safeParse(response.data)
        if (!parsed.success || !scopeMatches(parsed.data.attempt) || (operation.kind === 'resume' && parsed.data.attempt.id !== operation.id)
          || (operation.kind === 'submit' && parsed.data.attempt.id !== operation.input.attemptId)) {
          setError({ code: 'version_conflict', retryable: false }); return
        }
        if ('tasks' in parsed.data) {
          setOpen(parsed.data); setCompleted(null); setAnswers(parsed.data.attempt.answers)
          const next = parsed.data.tasks.findIndex(task => !parsed.data.attempt.answers[task.id])
          setIndex(next < 0 ? parsed.data.tasks.length - 1 : next); setNotice(copy.saved)
        } else { setCompleted(parsed.data); setOpen(null); setNotice('') }
      }
      setPending(null)
    } catch { if (active.current) setError({ code: 'retryable_failure', retryable: true }) }
    finally { requestBusy.current = false; if (active.current) setBusy(false) }
  }

  function start() { void run({ kind: 'start', input: { textId: rawEntry.textId, requestId: crypto.randomUUID() } }) }
  function save(kind: 'save' | 'submit') {
    if (open) void run({ kind, input: { attemptId: open.attempt.id, revision: open.attempt.revision, answers: { ...answers }, requestId: crypto.randomUUID() } })
  }
  const task = open?.tasks[index]
  const answered = open?.tasks.filter(row => Boolean(answers[row.id])).length ?? 0

  return <SitovMotionStage className={styles.sitovPanel} lang={toUiLocale(lang)} aria-labelledby={headingId}>
    <header><span>{copy.title} · {rawEntry.level}</span><h2 id={headingId} lang="de" translate="no">{rawEntry.title}</h2></header>
    {blocked && <p role="status">{completed?.attempt.status === 'outdated' || error?.code === 'version_conflict' || (entry.success && entry.data.lockedReason === 'version_changed') ? copy.changed : copy.unavailable}</p>}
    {task && open && !blocked && <>
      <p>{sitovPretestText(copy.progress, { current: index + 1, total: open.tasks.length })}</p>
      <progress aria-label={copy.title} value={answered} max={open.tasks.length} />
      <p>{copy.instruction}</p>
      <fieldset disabled={busy || Boolean(error)} className={styles.sitovTask}>
        <legend ref={taskTitle} tabIndex={-1} lang="de" translate="no">{task.promptDe}</legend>
        {task.fragmentDe && <p lang="de" translate="no">{task.fragmentDe}</p>}
        {task.options.map(option => <label key={option.id} className={styles.sitovOption} data-selected={answers[task.id] === option.id}>
          <input type="radio" name={`sitov-pretest-${open.attempt.id}-${task.id}`} checked={answers[task.id] === option.id}
            onChange={() => { setAnswers(value => ({ ...value, [task.id]: option.id })); setNotice(copy.unsaved) }} />
          <span lang="de" translate="no">{option.textDe}</span>
        </label>)}
      </fieldset>
      <div className={styles.sitovFeedback} role="status" aria-live="polite">{busy ? copy.working : notice}</div>
      <div className={styles.sitovActions}>
        <PressableCard disabled={busy || Boolean(error) || index === 0} onClick={() => setIndex(value => value - 1)}>{copy.previous}</PressableCard>
        <PressableCard disabled={busy || Boolean(error) || !answers[task.id] || (index === open.tasks.length - 1 && answered !== open.tasks.length)}
          onClick={() => save(index === open.tasks.length - 1 ? 'submit' : 'save')}>
          {index === open.tasks.length - 1 ? copy.submit : copy.next}
        </PressableCard>
      </div>
    </>}
    {result && !blocked && <div role="status"><h3>{result.passed ? copy.passed : copy.failed}</h3>
      <p>{sitovPretestText(copy.score, { correct: result.correct, total: result.total })}</p>
      {!result.passed && result.learningLinks.length > 0 && <nav aria-label={copy.learning} className={styles.sitovActions}>
        {result.learningLinks.slice(0, 3).map(link => <PressableCard key={`${link.kind}:${link.targetId}`} href={link.href.replace(/^\/(de|en|ru|uk|tr)\//, `/${toUiLocale(lang)}/`)}>{copy[link.kind]}</PressableCard>)}
      </nav>}
    </div>}
    {error && <div role="alert"><p>{sitovPretestErrorCopy(lang, error.code)}</p>
      {error.retryable && pending && !blocked && <PressableCard disabled={busy} onClick={() => void run(pending)}>{copy.retry}</PressableCard>}
      {!error.retryable && attemptId && !blocked && <PressableCard disabled={busy} onClick={() => void run({ kind: 'resume', id: attemptId })}>{copy.resume}</PressableCard>}
      {!error.retryable && !attemptId && !blocked && <PressableCard onClick={onRefresh}>{copy.refresh}</PressableCard>}
    </div>}
    {blocked ? <PressableCard onClick={onRefresh}>{copy.refresh}</PressableCard> : !open && !error && <PressableCard ref={startAction} disabled={busy}
      onClick={() => canOpen ? void run({ kind: 'open' }) : resumeExisting && attemptId ? void run({ kind: 'resume', id: attemptId }) : start()}>
      {busy ? copy.loading : canOpen ? copy.open : resumeExisting ? copy.resume : result ? copy.retry : copy.start}
    </PressableCard>}
    <section aria-label={copy.helpTitle}><SitovTrainerHelp title={copy.help}><h3>{copy.helpTitle}</h3><p>{copy.helpBody}</p></SitovTrainerHelp></section>
  </SitovMotionStage>
}
