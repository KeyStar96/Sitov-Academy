'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Target, X } from 'lucide-react'
import { getVocabularyFocus, submitVocabularyFocusAnswer } from '@/app/actions/vocabulary-focus'
import { requeue, type FocusAnswerResult, type FocusItem, type FocusWord, type VocabularyFocus as FocusData } from '@/lib/vocabulary-focus'
import { vocabularyFocusCopy, type VocabularyFocusTranslator } from '@/lib/vocabulary-focus-i18n'
import { StageDots } from '@/components/progress/LearningProgressView'
import { ArticleTask, BuildTask, ChoiceTask, TypeTask } from './FocusTasks'

/**
 * Problemwörter (Phase 11.3): oben der Stand (fällig, in Training,
 * gemeistert) mit „Training starten", darunter alle Problemwörter mit Grund
 * und Stufe. Die Runde zeigt eine Aufgabe nach der anderen; eine falsche
 * Antwort holt das Wort in derselben Runde noch einmal zurück (einmal).
 */
type Attempt = { key: string; item: FocusItem }
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

export default function VocabularyFocus({ initial, lang, level }: { initial: FocusData | null; lang: string; level: string }) {
  const t = vocabularyFocusCopy(lang)
  const router = useRouter()
  const [data, setData] = useState(initial)
  const [loadFailed, setLoadFailed] = useState(initial === null)
  const [loading, setLoading] = useState(false)
  const [queue, setQueue] = useState<Attempt[] | null>(null)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [busy, setBusy] = useState(false)
  // Fehlermeldung; `retry`: die Antwort, die mit derselben Anfrage-ID erneut gesendet werden kann.
  const [error, setError] = useState<{ message: string; retry: string | null } | null>(null)
  const pending = useRef<{ key: string; requestId: string; answer: string } | null>(null)
  const requeued = useRef(new Set<string>())
  // Nach Start und „Weiter“ springt der Fokus auf die Aufgabe (Screenreader, Tastatur).
  const focusTask = useRef(false)
  const date = (value: string) => new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(value))

  async function reload() {
    setLoading(true)
    const result = await getVocabularyFocus(level, lang).catch(() => null)
    setLoading(false)
    if (result?.success) { setData(result.data); setLoadFailed(false); return result.data }
    setLoadFailed(true)
    return null
  }
  function start(source: FocusData | null = data) {
    if (!source?.items.length) return
    requeued.current = new Set()
    pending.current = null
    setQueue(source.items.map(item => ({ key: `${item.cardId}:0`, item })))
    setIndex(0); setFeedback(null); setOutcomes([]); setError(null)
    focusTask.current = true
  }
  async function finish() {
    setQueue(null); setFeedback(null); setError(null)
    await reload()
    router.refresh()
  }

  async function answer(value: string) {
    if (!queue || busy || feedback) return
    const attempt = queue[index]
    const requestId = pending.current?.key === attempt.key && pending.current.answer === value ? pending.current.requestId : crypto.randomUUID()
    pending.current = { key: attempt.key, requestId, answer: value }
    setBusy(true); setError(null)
    let result: Awaited<ReturnType<typeof submitVocabularyFocusAnswer>>
    try { result = await submitVocabularyFocusAnswer({ requestId, cardId: attempt.item.cardId, format: attempt.item.format, answer: value, lang }) }
    catch { result = { success: false, error: 'failed' } }
    setBusy(false)
    if (result.success === false) {
      if (result.error === 'not_due' || result.error === 'not_found') { pending.current = null; next(); setError({ message: t('not_due'), retry: null }); return }
      setError({ message: t('failed'), retry: value })
      return
    }
    pending.current = null
    const dueLabel = dueLabelFor(result.data.dueAt, t('tomorrow'), date)
    const again = !result.data.correct && !requeued.current.has(attempt.item.cardId)
    if (again) {
      requeued.current.add(attempt.item.cardId)
      const item = attempt.item.format === 'choice' ? { ...attempt.item, options: shuffle(attempt.item.options) }
        : attempt.item.format === 'build' ? { ...attempt.item, letters: shuffle(attempt.item.letters) } : attempt.item
      setQueue(current => current && requeue(current, index, { key: `${attempt.item.cardId}:1`, item }))
    }
    setOutcomes(current => [...current, { key: attempt.key, word: result.data.solution.display, correct: result.data.correct }])
    setFeedback({ answer: value, data: result.data, dueLabel, again })
  }
  function next() {
    setFeedback(null)
    setIndex(current => current + 1)
    focusTask.current = true
  }

  if (queue) {
    const total = queue.length
    if (index >= total) return <Summary t={t} outcomes={outcomes} loading={loading} onReload={async () => { const fresh = await reload(); router.refresh(); if (fresh?.items.length) start(fresh); else setQueue(null) }} onBack={() => void finish()} />
    const attempt = queue[index]
    const item = attempt.item
    const taskProps = { t, disabled: busy, result: feedback ? { answer: feedback.answer, data: feedback.data } : null, onAnswer: (value: string) => void answer(value) }
    return <section className="st-focus-card space-y-5" aria-labelledby="focus-task-heading">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-[var(--muted)]">{t('progress', { current: index + 1, total })}</p>
        <button type="button" className="st-link-pill st-press" onClick={() => void finish()}><X size={18} aria-hidden="true" />{t('end')}</button>
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
        <span className="text-base">{error.message}</span>
        {error.retry && <button type="button" className="st-button st-button--soft st-press" disabled={busy} onClick={() => error.retry && void answer(error.retry)}>{t('retry')}</button>}
      </div>}
      <div aria-live="polite">{feedback && <FeedbackPanel t={t} feedback={feedback} last={index + 1 >= queue.length} onNext={next} />}</div>
    </section>
  }

  return <Overview t={t} data={data} loadFailed={loadFailed} loading={loading} date={date} onStart={() => start()} onReload={() => void reload()} />
}

function FeedbackPanel({ t, feedback, last, onNext }: { t: VocabularyFocusTranslator; feedback: Feedback; last: boolean; onNext: () => void }) {
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
      <button type="button" className="st-button st-button--primary st-press" autoFocus onClick={onNext}>{t(last ? 'finish' : 'next')}</button>
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
