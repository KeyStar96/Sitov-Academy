'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Target, X } from 'lucide-react'
import { getVocabularyFocus, submitVocabularyFocusAnswer } from '@/app/actions/vocabulary-focus'
import { requeue, type FocusAnswerResult, type FocusItem, type FocusWord, type VocabularyFocus as FocusData } from '@/lib/vocabulary-focus'
import { vocabularyFocusCopy, type VocabularyFocusTranslator } from '@/lib/vocabulary-focus-i18n'
import { StageDots } from '@/components/progress/LearningProgressView'
import { ArticleTask, BuildTask, ChoiceTask, TypeTask } from './FocusTasks'
import { loadLearningCheckpoint, saveLearningCheckpoint, clearLearningCheckpoint } from '@/app/actions/learning-checkpoints'
import type { LearningCheckpoint } from '@/lib/learning-checkpoints'
import { restoreVocabularyFocusCheckpoint, type VocabularyFocusCheckpoint } from '@/lib/vocabulary-focus-checkpoint'
import { learningCheckpointCopy } from '@/lib/learning-checkpoint-i18n'

/**
 * Problemwörter (Phase 11.3): oben der Stand (fällig, in Training,
 * gemeistert) mit „Training starten", darunter alle Problemwörter mit Grund
 * und Stufe. Die Runde zeigt eine Aufgabe nach der anderen; eine falsche
 * Antwort holt das Wort in derselben Runde noch einmal zurück (einmal).
 */
type Attempt = VocabularyFocusCheckpoint['queue'][number]
type Feedback = { answer: string; data: FocusAnswerResult; dueLabel: string | null; again: boolean }
type Outcome = { key: string; word: string; correct: boolean }

const shuffle = <T,>(values: readonly T[]) => {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]]
  }
  return copy
}
const berlinDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(date)
/** „morgen" statt eines Datums, wenn die nächste Wiederholung morgen (Berlin) ist. */
function dueLabelFor(dueAt: string | null | undefined, tomorrow: string, date: (value: string) => string) {
  if (!dueAt) return null
  return berlinDay(new Date(dueAt)) === berlinDay(new Date(Date.now() + 86400000)) ? tomorrow : date(dueAt)
}

export default function VocabularyFocus({ initial, lang, level, learnerId, checkpoint }: { initial: FocusData | null; lang: string; level: string; learnerId?: string | null; checkpoint?: LearningCheckpoint | null }) {
  const t = vocabularyFocusCopy(lang)
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [loadFailed, setLoadFailed] = useState(initial === null)
  const [loading, setLoading] = useState(false)
  const [restored] = useState(() => restoreVocabularyFocusCheckpoint(checkpoint?.state, initial, lang))
  const [queue, setQueue] = useState<Attempt[] | null>(restored?.queue ?? null)
  const [index, setIndex] = useState(restored?.index ?? 0)
  const [feedback, setFeedback] = useState<Feedback | null>(restored?.feedback as Feedback ?? null)
  const [outcomes, setOutcomes] = useState<Outcome[]>(restored?.outcomes ?? [])
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const checkpointCopy = learningCheckpointCopy(lang)
  // Fehlermeldung; `retry`: die Antwort, die mit derselben Anfrage-ID erneut gesendet werden kann.
  const [error, setError] = useState<{ message: string; retry: string | null } | null>(null)
  const pending = useRef<{ key: string; requestId: string; answer: string } | null>(restored?.pending ?? null)
  const requeued = useRef(new Set<string>(restored?.requeued ?? []))
  const actor = useRef(learnerId ?? null)
  const revision = useRef(checkpoint?.revision ?? 0)
  const state = useRef<VocabularyFocusCheckpoint | null>(restored)
  const saving = useRef<Promise<void>>(Promise.resolve())
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // Nach Start und „Weiter“ springt der Fokus auf die Aufgabe (Screenreader, Tastatur).
  const focusTask = useRef(false)
  const date = (value: string) => new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(value))

  async function persist(snapshot: VocabularyFocusCheckpoint) {
    state.current = snapshot
    const task = saving.current.catch(() => undefined).then(async () => {
      if (!actor.current) {
        const loaded = await loadLearningCheckpoint('vocabulary_focus', level)
        if (!loaded.ok) throw new Error('checkpoint_load_failed')
        actor.current = loaded.learnerId
        revision.current = loaded.checkpoint?.revision ?? 0
      }
      const saved = await saveLearningCheckpoint('vocabulary_focus', level, snapshot, revision.current, actor.current)
      if (!saved.ok || !saved.checkpoint) {
        if (saved.ok === false && saved.error === 'conflict' && mounted.current) setConflict(true)
        throw new Error('checkpoint_save_failed')
      }
      revision.current = saved.checkpoint.revision
    })
    saving.current = task
    return task
  }

  async function reload() {
    setLoading(true)
    const result = await getVocabularyFocus(level, lang).catch(() => null)
    setLoading(false)
    if (result?.success) { setData(result.data); setLoadFailed(false); return result.data }
    setLoadFailed(true)
    return null
  }
  async function start(source: FocusData | null = data) {
    if (busy) return
    if (!source?.items.length) return
    setBusy(true)
    const saved = state.current && state.current.index < state.current.queue.length ? state.current : null
    const nextState: VocabularyFocusCheckpoint = saved ?? { version: 1, language: lang as VocabularyFocusCheckpoint['language'],
      queue: source.items.map(item => ({ key: `${item.cardId}:0`, item })), index: 0, feedback: null, outcomes: [], requeued: [], pending: null }
    try {
      await persist(nextState)
      if (!mounted.current) return
      requeued.current = new Set(nextState.requeued); pending.current = nextState.pending
      setQueue(nextState.queue); setIndex(nextState.index); setFeedback(nextState.feedback as Feedback)
      setOutcomes(nextState.outcomes); setError(null); focusTask.current = true
    } catch { if (mounted.current) setLoadFailed(true) }
    finally { if (mounted.current) setBusy(false) }
  }
  async function finish() {
    if (busy) return
    try { await saving.current }
    catch { setError({ message: t('failed'), retry: null }); return }
    setQueue(null); setFeedback(null); setError(null)
    await reload()
    router.refresh()
  }

  async function answer(value: string) {
    if (!queue || busy || feedback || conflict || !state.current) return
    const attempt = queue[index]
    const requestId = pending.current?.key === attempt.key && pending.current.answer === value ? pending.current.requestId : crypto.randomUUID()
    pending.current = { key: attempt.key, requestId, answer: value }
    setBusy(true); setError(null)
    let result: Awaited<ReturnType<typeof submitVocabularyFocusAnswer>>
    try {
      await persist({ ...state.current, pending: pending.current })
      result = await submitVocabularyFocusAnswer({ requestId, cardId: attempt.item.cardId, format: attempt.item.format, answer: value, lang, expectedLearnerId: actor.current })
    }
    catch { result = { success: false, error: 'failed' } }
    if (result.success === false) {
      if (result.error === 'not_due' || result.error === 'not_found') { pending.current = null; await next(true); if (mounted.current) { setBusy(false); setError({ message: t('not_due'), retry: null }) }; return }
      if (mounted.current) { setBusy(false); setError({ message: t('failed'), retry: value }) }
      return
    }
    pending.current = null
    const dueLabel = dueLabelFor(result.data.dueAt, t('tomorrow'), date)
    const again = !result.data.correct && !requeued.current.has(attempt.item.cardId)
    if (again) {
      requeued.current.add(attempt.item.cardId)
      const item = attempt.item.format === 'choice' ? { ...attempt.item, options: shuffle(attempt.item.options) }
        : attempt.item.format === 'build' ? { ...attempt.item, letters: shuffle(attempt.item.letters) } : attempt.item
      state.current = { ...state.current, queue: requeue(state.current.queue, index, { key: `${attempt.item.cardId}:1`, item }) }
    }
    const nextFeedback = { answer: value, data: result.data, dueLabel, again }
    const nextState = { ...state.current, pending: null, feedback: nextFeedback, requeued: [...requeued.current],
      outcomes: [...state.current.outcomes, { key: attempt.key, word: result.data.solution.display, correct: result.data.correct }] }
    try {
      await persist(nextState)
      if (mounted.current) { setQueue(nextState.queue); setOutcomes(nextState.outcomes); setFeedback(nextFeedback) }
    } catch {
      // The pending receipt in the account can recover this grade after a reload.
      if (mounted.current) { setFeedback(nextFeedback); setError({ message: t('failed'), retry: null }) }
    } finally { if (mounted.current) setBusy(false) }
  }
  async function next(fromAnswer = false) {
    if (!state.current || conflict || (busy && !fromAnswer)) return
    setBusy(true)
    const previousState = state.current
    const nextState = { ...state.current, feedback: null, pending: null, index: state.current.index + 1 }
    try {
      await persist(nextState)
      if (nextState.index >= nextState.queue.length && actor.current) {
        const cleared = await clearLearningCheckpoint('vocabulary_focus', level, revision.current, actor.current)
        if (!cleared.ok || !cleared.checkpoint) {
          if (cleared.ok === false && cleared.error === 'conflict' && mounted.current) setConflict(true)
          throw new Error('checkpoint_clear_failed')
        }
        revision.current = cleared.checkpoint.revision
      }
      if (mounted.current) { setFeedback(null); setIndex(nextState.index); focusTask.current = true }
    } catch { state.current = previousState; if (mounted.current) setError({ message: t('failed'), retry: null }) }
    finally { if (mounted.current) setBusy(false) }
  }

  const recoveryStarted = useRef(false)
  useEffect(() => {
    if (!restored?.pending || recoveryStarted.current) return
    recoveryStarted.current = true
    void answer(restored.pending.answer)
  }, [])

  if (queue) {
    const total = queue.length
    if (index >= total) return <Summary t={t} outcomes={outcomes} loading={loading} onReload={async () => { const fresh = await reload(); router.refresh(); if (fresh?.items.length) start(fresh); else setQueue(null) }} onBack={() => void finish()} />
    const attempt = queue[index]
    const item = attempt.item
    const taskProps = { t, disabled: busy, result: feedback ? { answer: feedback.answer, data: feedback.data } : null, onAnswer: (value: string) => void answer(value) }
    return <section className="st-focus-card space-y-5" aria-labelledby="focus-task-heading">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-[var(--muted)]">{t('progress', { current: index + 1, total })}</p>
        <button type="button" disabled={busy} className="st-link-pill st-press" onClick={() => void finish()}><X size={18} aria-hidden="true" />{t('end')}</button>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={index} aria-label={t('progress', { current: index + 1, total })}>
        <div className="h-full rounded-full bg-[var(--success)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${index / total * 100}%` }} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="focus-task-heading" ref={node => { if (node && focusTask.current) { focusTask.current = false; node.focus() } }} tabIndex={-1} className="text-sm font-bold uppercase tracking-wider text-[var(--accent-text)] outline-none">{t(`format_${item.format}`)}</h2>
          <p className="mt-2 break-words text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{item.prompt}</p>
        </div>
        <StageDots stage={item.stage} label={t('stage', { value: item.stage })} />
      </div>
      {item.format === 'article' && <ArticleTask key={attempt.key} item={item} {...taskProps} />}
      {item.format === 'choice' && <ChoiceTask key={attempt.key} item={item} {...taskProps} />}
      {item.format === 'build' && <BuildTask key={attempt.key} item={item} {...taskProps} />}
      {item.format === 'type' && <TypeTask key={attempt.key} item={item} {...taskProps} />}
      {error && <div role="alert" className="st-focus-feedback flex flex-wrap items-center justify-between gap-3" data-tone="danger">
        <span className="text-base">{conflict ? checkpointCopy.conflict : error.message}</span>
        {conflict ? <button type="button" className="st-button st-button--soft st-press" onClick={() => window.location.reload()}>{checkpointCopy.reload}</button>
          : error.retry && <button type="button" className="st-button st-button--soft st-press" disabled={busy} onClick={() => error.retry && void answer(error.retry)}>{t('retry')}</button>}
      </div>}
      <div aria-live="polite">{feedback && <FeedbackPanel t={t} feedback={feedback} last={index + 1 >= queue.length} disabled={busy} onNext={() => void next()} />}</div>
    </section>
  }

  return <Overview t={t} data={data} loadFailed={loadFailed} loading={loading} date={date} onStart={() => start()} onReload={() => void reload()} />
}

function FeedbackPanel({ t, feedback, last, disabled, onNext }: { t: VocabularyFocusTranslator; feedback: Feedback; last: boolean; disabled: boolean; onNext: () => void }) {
  const { data } = feedback
  const detail = data.correct
    ? data.status === 'mastered' ? t('mastered_now') : feedback.dueLabel ? t('stage_up', { value: data.stage, date: feedback.dueLabel }) : null
    : feedback.again ? t('again_later') : null
  return <div className="st-focus-feedback st-pop space-y-3" data-tone={data.correct ? 'success' : 'danger'}>
    <p className="flex items-center gap-2 text-lg font-bold" style={{ color: data.correct ? 'var(--success)' : 'var(--danger)' }}>
      {data.correct ? <Check size={22} aria-hidden="true" /> : <X size={22} aria-hidden="true" />}{t(data.correct ? 'correct' : 'wrong')}
    </p>
    {!data.correct && <p className="text-lg text-[var(--foreground)]">{t('solution', { solution: '' })}<strong lang="de">{data.solution.display}</strong></p>}
    {data.feedback && <p className="text-base text-[var(--foreground)]">{t(data.feedback)}</p>}
    {detail && <p className="text-base text-[var(--muted)]">{detail}</p>}
    <div className="flex justify-end">
      {/* Der Weiter-Knopf bekommt den Fokus: Enter führt direkt zur nächsten Aufgabe. */}
      <button type="button" disabled={disabled} className="st-button st-button--primary st-press" autoFocus onClick={onNext}>{t(last ? 'finish' : 'next')}</button>
    </div>
  </div>
}

function Summary({ t, outcomes, loading, onReload, onBack }: { t: VocabularyFocusTranslator; outcomes: Outcome[]; loading: boolean; onReload: () => void; onBack: () => void }) {
  const correct = outcomes.filter(outcome => outcome.correct).length
  return <section className="st-focus-card space-y-5 text-center" aria-labelledby="focus-summary-title">
    <h2 id="focus-summary-title" className="text-2xl font-bold text-[var(--foreground)]">{t('done_title')}</h2>
    <p className="text-lg text-[var(--muted)]">{t('done_score', { correct, total: outcomes.length })}</p>
    <ul className="mx-auto max-w-md space-y-2 text-left">{outcomes.map(outcome => <li key={outcome.key} className="flex items-center gap-2 text-base" lang="de">
      {outcome.correct ? <Check size={18} aria-hidden="true" className="shrink-0 text-[var(--success)]" /> : <X size={18} aria-hidden="true" className="shrink-0 text-[var(--danger)]" />}
      <span className="sr-only">{outcome.correct ? '✓' : '✗'}</span>{outcome.word}
    </li>)}</ul>
    <div className="flex flex-col-reverse justify-center gap-2 sm:flex-row">
      <button type="button" className="st-button st-button--soft st-press" disabled={loading} onClick={onBack}>{t('back')}</button>
      <button type="button" className="st-button st-button--primary st-press" disabled={loading} onClick={onReload}>{t('reload')}</button>
    </div>
  </section>
}

function Overview({ t, data, loadFailed, loading, date, onStart, onReload }: {
  t: VocabularyFocusTranslator; data: FocusData | null; loadFailed: boolean; loading: boolean
  date: (value: string) => string; onStart: () => void; onReload: () => void
}) {
  const summary = data?.summary
  const active = data?.words.filter(word => word.status === 'active') ?? []
  const mastered = data?.words.filter(word => word.status === 'mastered') ?? []
  // Nichts fällig: wann es weitergeht – oder ein Lob, wenn alles gemeistert ist.
  const status = !summary || data!.items.length ? null
    : summary.nextDueAt ? t('next_due', { date: date(summary.nextDueAt) }) : summary.active + summary.mastered > 0 ? t('none_due') : null
  return <div className="space-y-6">
    <section className="st-focus-card" aria-labelledby="focus-title">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]"><Target size={24} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h1 id="focus-title" className="st-path-hero__title">{t('title')}</h1>
          <p className="st-path-hero__text">{t('intro')}</p>
        </div>
      </div>
      {loadFailed ? <div role="alert" className="st-focus-feedback mt-5 flex flex-wrap items-center justify-between gap-3" data-tone="danger">
        <span>{t('load_failed')}</span><button type="button" className="st-button st-button--soft st-press" disabled={loading} onClick={onReload}>{t('retry')}</button></div>
        : summary && <>
          <dl className="mt-5 grid grid-cols-3 gap-2">
            {([['due', summary.due], ['active', summary.active], ['mastered', summary.mastered]] as const).map(([key, value]) => <div key={key} className="rounded-2xl bg-[var(--surface-muted)] p-3 text-center">
              <dt className="text-sm font-semibold text-[var(--muted)]">{t(key)}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums" style={key === 'due' && value ? { color: 'var(--accent-text)' } : key === 'mastered' && value ? { color: 'var(--success)' } : undefined}>{value}</dd>
            </div>)}
          </dl>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {status && <p className="text-base text-[var(--muted)]">{status}</p>}
            {data!.items.length > 0 && <button type="button" className="st-button st-button--primary st-press sm:ml-auto" onClick={onStart}>{t('start_count', { count: data!.items.length })}</button>}
          </div>
        </>}
      <p className="mt-5 border-t border-[var(--border)] pt-4 text-base leading-relaxed text-[var(--muted)]">{t('rule')}</p>
    </section>
    {data && summary && summary.active + summary.mastered === 0 && <div className="st-empty st-empty--hero"><h2>{t('empty_title')}</h2><p>{t('empty_text')}</p></div>}
    {active.length > 0 && <section aria-labelledby="focus-active-title">
      <h2 id="focus-active-title" className="st-section-title mb-3">{t('list_active')}</h2>
      <ul className="space-y-2" aria-label={t('list_label')}>{active.map(word => <WordRow key={word.cardId} word={word} t={t} date={date} />)}</ul>
    </section>}
    {mastered.length > 0 && <details className="st-focus-card">
      <summary className="flex min-h-12 cursor-pointer items-center text-lg font-bold text-[var(--foreground)]">{t('list_mastered', { count: mastered.length })}</summary>
      <ul className="mt-3 space-y-2">{mastered.map(word => <WordRow key={word.cardId} word={word} t={t} date={date} />)}</ul>
    </details>}
  </div>
}

function WordRow({ word, t, date }: { word: FocusWord; t: VocabularyFocusTranslator; date: (value: string) => string }) {
  return <li className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
    <div className="min-w-0">
      <p className="break-words text-lg font-bold text-[var(--foreground)]" lang="de">{word.article && <span className="font-semibold text-[var(--muted)]">{word.article} </span>}{word.word}</p>
      {word.translation && <p className="text-base text-[var(--muted)]">{word.translation}</p>}
      <p className="mt-1.5 flex flex-wrap gap-1.5">{word.reasons.map(reason => <span key={reason} className="st-focus-chip" data-reason={reason}>{t(`reason_${reason}`)}</span>)}</p>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <StageDots stage={word.stage} label={word.status === 'mastered' ? t('mastered') : t('stage', { value: word.stage })} />
      <span className="text-sm font-semibold text-[var(--muted)]">{word.status === 'mastered' ? t('mastered') : word.due ? t('due_now') : word.dueAt ? t('due_on', { date: date(word.dueAt) }) : t('due_now')}</span>
    </div>
  </li>
}
