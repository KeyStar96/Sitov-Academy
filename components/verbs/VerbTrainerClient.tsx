'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, Check, CheckCheck, CircleHelp, Flame, Layers3, LoaderCircle, LockKeyhole, Plus, RotateCcw, Search, Sparkles, Target, Trash2, X, Zap } from 'lucide-react'
import { nextSitovVerbExercise, setSitovVerbBox, submitSitovVerbAnswer } from '@/app/actions/verbs'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'
import { SITOV_VERB_TRAINER_LEVELS, SITOV_VERB_REVIEW_LEVELS, type SitovVerbTense } from '@/lib/verbs/types'
import { getSitovVerbTenses } from '@/lib/verbs/engine'
import type { SitovVerbPublicExercise, SitovVerbReviewResult, SitovVerbTrainerState } from '@/lib/verbs/contracts'
import { toUiLocale } from '@/lib/locale-routing'
import styles from './VerbTrainer.module.css'

export interface SitovVerbTrainerActions {
  next: typeof nextSitovVerbExercise
  box: typeof setSitovVerbBox
  answer: typeof submitSitovVerbAnswer
}
const sitovActions: SitovVerbTrainerActions = { next: nextSitovVerbExercise, box: setSitovVerbBox, answer: submitSitovVerbAnswer }
type View = 'automatic' | 'targeted' | 'box'
const sitovRoundLength = 10

/** Each continuous decoration pauses out of view, in a hidden tab, and under reduced motion. */
function SitovVerbStage({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const stage = ref.current
    if (!stage || !window.matchMedia || typeof IntersectionObserver === 'undefined') return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let visible = true
    let frame = 0
    const update = () => { stage.dataset.live = String(visible && !document.hidden && !motion.matches) }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update() }, { threshold: .05 })
    observer.observe(stage.querySelector('header') ?? stage)
    update()
    document.addEventListener('visibilitychange', update)
    motion.addEventListener?.('change', update)
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || motion.matches) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const bounds = stage.getBoundingClientRect()
        stage.style.setProperty('--sitov-x', `${100 * (event.clientX - bounds.left) / bounds.width}%`)
        stage.style.setProperty('--sitov-y', `${100 * (event.clientY - bounds.top) / bounds.height}%`)
        stage.dataset.pointer = 'true'
      })
    }
    const leave = () => { stage.dataset.pointer = 'false'; cancelAnimationFrame(frame) }
    stage.addEventListener('pointermove', move); stage.addEventListener('pointerleave', leave)
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', update); motion.removeEventListener?.('change', update)
      stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', leave)
    }
  }, [])
  return <div ref={ref} className={className}>{children}</div>
}

export default function VerbTrainerClient({ initialState, lang, actions = sitovActions }: {
  initialState: SitovVerbTrainerState; lang: string; actions?: SitovVerbTrainerActions
}) {
  const copy = getSitovVerbCopy(lang)
  const locale = toUiLocale(lang)
  const [view, setView] = useState<View>('automatic')
  const [selectedIds, setSelectedIds] = useState(initialState.selectedIds)
  const [progress, setProgress] = useState(initialState.progress)
  const [tenses, setTenses] = useState(initialState.tenses)
  const [search, setSearch] = useState('')
  const [poolLevel, setPoolLevel] = useState('all')
  const [onlySelected, setOnlySelected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exercise, setExercise] = useState<SitovVerbPublicExercise | null>(null)
  const [answer, setAnswer] = useState<string[]>([])
  const [review, setReview] = useState<SitovVerbReviewResult | null>(null)
  const [round, setRound] = useState<{ total: number; correct: number; finished: boolean } | null>(null)
  const [noTasks, setNoTasks] = useState(false)
  const [sessionTenses, setSessionTenses] = useState<SitovVerbTense[]>(initialState.tenses)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<HTMLElement>(null)
  const sessionActive = !!round
  const nextRef = useRef<HTMLButtonElement>(null)
  const completionRef = useRef<HTMLHeadingElement>(null)
  const focusedBlank = useRef(0)
  const lockedOperation = useRef(false)
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedVerbs = initialState.verbs.filter(verb => selected.has(verb.id))
  const now = Date.now()
  const activeProgress = progress.filter(item => selectedVerbs.some(verb => verb.id === item.verbId && getSitovVerbTenses(initialState.level, verb).includes(item.tense)))
  const mastered = activeProgress.filter(item => item.box >= 6).length
  const due = activeProgress.filter(item => !item.nextReviewAt || Date.parse(item.nextReviewAt) <= now).length
  const fresh = selectedVerbs.reduce((count, verb) => count + getSitovVerbTenses(initialState.level, verb).filter(tense =>
    !progress.some(item => item.verbId === verb.id && item.tense === tense)).length, 0)
  const visibleVerbs = initialState.verbs.filter(verb => (poolLevel === 'all' || verb.level === poolLevel)
    && (!onlySelected || selected.has(verb.id))
    && `${verb.infinitive} ${verb.translations[locale]}`.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale).trim()))
  const currentVerb = exercise && initialState.verbs.find(verb => verb.id === exercise.verbId)
  const permissionError = !!error && /denied|access|authoriz|not_authenticated/.test(error)
  const message = error && (permissionError ? copy.denied : copy.failed)
  const exerciseKind = exercise && (exercise.kind === 'perfect' ? copy.perfectTask : copy[exercise.kind])

  useEffect(() => {
    if (sessionActive) sessionRef.current?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }, [sessionActive])
  useEffect(() => { if (exercise && !review) inputRef.current?.focus({ preventScroll: true }) }, [exercise, review])
  useEffect(() => { if (review) nextRef.current?.focus({ preventScroll: true }) }, [review])
  useEffect(() => { if (round?.finished) completionRef.current?.focus() }, [round?.finished])

  async function changeBox(verbIds: string[], add: boolean) {
    if (lockedOperation.current || !verbIds.length) return
    lockedOperation.current = true; setBusy(true); setError(null)
    try {
      const result = await actions.box({ level: initialState.level, verbIds, selected: add })
      if (result.error) setError(result.error)
      else setSelectedIds(result.data.selectedIds)
    } catch { setError('save_failed') }
    finally { lockedOperation.current = false; setBusy(false) }
  }

  async function loadExercise(chosen: SitovVerbTense[], excludeVerbId?: string) {
    if (lockedOperation.current) return
    lockedOperation.current = true; setBusy(true); setError(null); setNoTasks(false)
    try {
      const result = await actions.next({ level: initialState.level, tenses: chosen, excludeVerbId }, lang)
      if (result.error) { setError(result.error); return }
      setReview(null)
      if (!result.data) { setNoTasks(true); setExercise(null); return }
      setExercise(result.data); setAnswer(Array(result.data.parts.length - 1).fill('')); focusedBlank.current = 0
    } catch { setError('load_failed') }
    finally { lockedOperation.current = false; setBusy(false) }
  }

  async function start(automatic = false) {
    const chosen = !automatic && view === 'targeted' ? tenses : initialState.tenses
    if (!chosen.length || !selectedVerbs.length) return
    setRound({ total: 0, correct: 0, finished: false }); setSessionTenses(chosen)
    await loadExercise(chosen)
  }

  async function submit(reveal = false) {
    if (!exercise || review || lockedOperation.current) return
    lockedOperation.current = true; setBusy(true); setError(null)
    try {
      const result = await actions.answer({ exerciseId: exercise.exerciseId, answer: reveal ? answer.map(() => '') : answer })
      if (result.error) { setError(result.error); return }
      setReview(result.data)
      setProgress(items => [...items.filter(item => item.verbId !== result.data.progress.verbId || item.tense !== result.data.progress.tense), result.data.progress])
      setRound(value => ({ total: (value?.total ?? 0) + 1, correct: (value?.correct ?? 0) + Number(result.data.correct), finished: false }))
    } catch { setError('save_failed') }
    finally { lockedOperation.current = false; setBusy(false) }
  }

  async function next() {
    if ((round?.total ?? 0) >= sitovRoundLength) { finish(); return }
    await loadExercise(sessionTenses, exercise?.verbId)
  }
  function finish() { setRound(value => value && { ...value, finished: true }); setExercise(null); setReview(null); setNoTasks(false); setError(null) }
  function home() { setRound(null); setExercise(null); setReview(null); setNoTasks(false); setError(null) }
  function onSubmit(event: FormEvent) { event.preventDefault(); if (review) void next(); else void submit() }
  function chooseView(value: View) { setView(value); setError(null) }

  return <SitovVerbStage className={styles.sitovTrainer}>
    <header className={styles.sitovHero} data-active={sessionActive}>
      {!sessionActive && <button type="button" className={styles.sitovHeroAction} disabled={busy} aria-label={`${copy.title} ${selectedVerbs.length ? copy.start : copy.manage}`}
        onClick={() => { if (selectedVerbs.length) { setView('automatic'); void start(true) } else chooseView('box') }} />}
      <div className={styles.sitovAurora} aria-hidden="true" />
      <div className={styles.sitovHeroText}>
        <p className={styles.sitovEyebrow}><Sparkles size={17} aria-hidden="true" />{copy.eyebrow}<span>{initialState.level}</span></p>
        <h1>{copy.title}</h1>{!sessionActive && <><p className={styles.sitovIntro}>{copy.intro}</p>
          <span className={styles.sitovHeroCta} aria-hidden="true">{busy ? <LoaderCircle size={19} className={styles.sitovSpinner} /> : <Zap size={19} />}{busy ? copy.loading : selectedVerbs.length ? copy.start : copy.manage}<ArrowRight size={19} /></span></>}
      </div>
      {!sessionActive && <div className={styles.sitovOrbit} aria-hidden="true">
        <div className={styles.sitovOrbitRing} /><div className={styles.sitovOrbitRingInner} />
        <span className={styles.sitovOrbitCore}><Zap size={30} strokeWidth={1.8} /></span>
        <span className={styles.sitovWord} data-word="1">fahren</span><span className={styles.sitovWord} data-word="2">fährt</span><span className={styles.sitovWord} data-word="3">gefahren</span>
        <span className={styles.sitovOrbitSpark} /><span className={styles.sitovOrbitSpark} data-second="true" />
      </div>}
    </header>

    {!sessionActive && <section className={styles.sitovStats} aria-label={copy.summary}>
      {[{ label: copy.selected, value: selectedVerbs.length, icon: Layers3 }, { label: copy.due, value: due + fresh, icon: Flame },
        { label: copy.mastered, value: mastered, icon: CheckCheck }, { label: copy.pool, value: initialState.verbs.length, icon: Sparkles }].map(({ label, value, icon: Icon }) =>
        <div key={label}><Icon size={18} aria-hidden="true" /><strong key={value}>{value}</strong><span>{label}</span></div>)}
    </section>}

    {message && <div className={styles.sitovError} role="alert"><CircleHelp size={20} aria-hidden="true" /><span>{message}</span>
      {permissionError && <button type="button" onClick={() => window.location.reload()}>{copy.reload}</button>}</div>}

    {round ? <section ref={sessionRef} className={styles.sitovSession} aria-label={copy.round}>
      {round.finished ? <div className={styles.sitovComplete}>
        <div className={styles.sitovVictory} aria-hidden="true"><CheckCheck size={42} />{Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--sitov-i': index } as CSSProperties} />)}</div>
        <p className={styles.sitovEyebrow}>{copy.round}</p><h2 ref={completionRef} tabIndex={-1}>{copy.complete}</h2><p>{copy.completeHint}</p>
        <strong className={styles.sitovScore}>{round.correct}<span> / {round.total}</span></strong><p>{copy.right}</p>
        <div className={styles.sitovActions}><button className={styles.sitovPrimary} disabled={busy} onClick={() => { setRound({ total: 0, correct: 0, finished: false }); void loadExercise(sessionTenses) }}><RotateCcw size={18} />{copy.again}</button>
          <button className={styles.sitovSecondary} onClick={home}>{copy.back}</button></div>
      </div> : <>
        <div className={styles.sitovRoundHead}><span>{copy.round}<strong>{Math.min(round.total + (review ? 0 : 1), sitovRoundLength)} / {sitovRoundLength}</strong></span>
          <button disabled={busy} onClick={finish} className={styles.sitovExit}><X size={17} aria-hidden="true" />{copy.finish}</button></div>
        <div className={styles.sitovRoundTrack} role="progressbar" aria-label={copy.round} aria-valuemin={0} aria-valuemax={sitovRoundLength} aria-valuenow={round.total}>
          <span style={{ width: `${round.total * 10}%` }} /></div>
        {noTasks ? <div className={styles.sitovEmpty}><Layers3 size={38} /><h2>{copy.noTasks}</h2><p>{copy.noTasksHint}</p><button className={styles.sitovSecondary} onClick={home}>{copy.back}</button></div>
          : exercise ? <form onSubmit={onSubmit} className={styles.sitovTask} key={exercise.exerciseId} data-result={review ? review.correct ? 'correct' : 'incorrect' : 'waiting'}>
            <div className={styles.sitovTaskTags}><span>{copy[exercise.tense]}</span><span>{exerciseKind}</span></div>
            <h2 className={styles.sitovInfinitive} lang="de">{exercise.infinitive}</h2><p className={styles.sitovTranslation}>{exercise.translation}</p>
            {currentVerb?.note && <details className={styles.sitovNote}><summary>{copy.note}</summary><p lang="de">{currentVerb.note}</p></details>}
            <p className={styles.sitovPrompt} lang="de">{exercise.prompt}</p>
            <div className={styles.sitovSentence} lang="de">{exercise.parts.map((part, index) => <span key={index}>
              {part}{index < exercise.parts.length - 1 && <input ref={index === 0 ? inputRef : undefined} aria-label={`${copy.answer} ${index + 1}`} value={answer[index] ?? ''}
                onFocus={() => { focusedBlank.current = index }} onChange={event => setAnswer(values => values.map((value, pos) => pos === index ? event.target.value : value))}
                disabled={busy || !!review} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={100} size={Math.max(8, Math.min(22, (answer[index]?.length ?? 0) + 2))} />}
            </span>)}</div>
            {!review && <div className={styles.sitovCharacters} aria-label={copy.umlauts}>{['ä', 'ö', 'ü', 'ß'].map(char => <button key={char} type="button" disabled={busy} onClick={() => {
              const index = focusedBlank.current; setAnswer(values => values.map((value, pos) => pos === index ? value + char : value))
              document.querySelector<HTMLInputElement>(`[aria-label="${copy.answer} ${index + 1}"]`)?.focus({ preventScroll: true })
            }}>{char}</button>)}</div>}
            {review ? <div className={styles.sitovFeedback} role="status"><span className={styles.sitovFeedbackIcon}>{review.correct ? <Check size={24} /> : <RotateCcw size={24} />}</span>
              <div><strong>{review.correct ? copy.correct : copy.incorrect}</strong><span>{copy.solution}: <b lang="de">{review.solution}</b></span></div>
              {review.correct && <div className={styles.sitovCelebration} aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--sitov-i': index } as CSSProperties} />)}</div>}
            </div> : null}
            <div className={styles.sitovActions}>{review ? <button ref={nextRef} className={styles.sitovPrimary} disabled={busy} type="submit">{busy ? <LoaderCircle className={styles.sitovSpinner} size={19} /> : <ArrowRight size={19} />}{round.total >= sitovRoundLength ? copy.finish : copy.next}</button>
              : <><button className={styles.sitovPrimary} disabled={busy || answer.some(value => !value.trim())} type="submit">{busy ? <LoaderCircle className={styles.sitovSpinner} size={19} /> : <Check size={19} />}{busy ? copy.saving : copy.check}</button>
                <button className={styles.sitovSecondary} disabled={busy} type="button" onClick={() => void submit(true)}>{copy.reveal}</button></>}</div>
          </form> : <div className={styles.sitovEmpty} role="status">{busy ? <><LoaderCircle className={styles.sitovSpinner} size={30} /><p>{copy.loading}</p></> : <button className={styles.sitovPrimary} onClick={() => void loadExercise(sessionTenses)}>{copy.retry}</button>}</div>}
      </>}
    </section> : <>
      <nav className={styles.sitovTabs} aria-label={copy.eyebrow}>{([{ id: 'automatic', icon: Zap }, { id: 'targeted', icon: Target }, { id: 'box', icon: Layers3 }] as const).map(({ id, icon: Icon }) =>
        <button key={id} type="button" aria-pressed={view === id} onClick={() => chooseView(id)}><Icon size={19} aria-hidden="true" /><span>{copy[id]}</span></button>)}</nav>
      {view === 'box' ? <section className={styles.sitovBox}>
        <div className={styles.sitovSectionHead}><div><h2>{copy.boxTitle}</h2><p>{copy.boxHint}</p></div><span className={styles.sitovRetained}><CheckCheck size={16} />{copy.retained}</span></div>
        <div className={styles.sitovLevels} aria-label={copy.availableLevels}><button aria-pressed={poolLevel === 'all'} onClick={() => setPoolLevel('all')}>{copy.all}</button>
          {SITOV_VERB_TRAINER_LEVELS.filter(level => !SITOV_VERB_REVIEW_LEVELS.includes(level)).map(level => { const available = initialState.authorizedLevels.includes(level); return <button key={level} aria-pressed={poolLevel === level} disabled={!available} title={available ? level : copy.levelLocked} onClick={() => setPoolLevel(level)}>{!available && <LockKeyhole size={13} aria-hidden="true" />}{level}</button> })}</div>
        <div className={styles.sitovFilters}><label className={styles.sitovSearch}><Search size={19} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search} aria-label={copy.search} /></label>
          <label className={styles.sitovOnly}><input type="checkbox" checked={onlySelected} onChange={event => setOnlySelected(event.target.checked)} />{copy.onlySelected}</label></div>
        <div className={styles.sitovBoxToolbar}><span>{visibleVerbs.length} / {initialState.verbs.length}</span><button disabled={busy || !visibleVerbs.some(verb => !selected.has(verb.id))} onClick={() => void changeBox(visibleVerbs.filter(verb => !selected.has(verb.id)).map(verb => verb.id), true)}><Plus size={17} />{busy ? copy.saving : copy.addVisible}</button></div>
        {!visibleVerbs.length && <p className={styles.sitovEmpty}>{copy.noResults}</p>}
        <ul className={styles.sitovVerbList}>{visibleVerbs.map(verb => <li key={verb.id} data-selected={selected.has(verb.id)}>
          <div className={styles.sitovVerbRow}><div><span className={styles.sitovLevel}>{verb.level}</span><strong lang="de">{verb.infinitive}</strong><p>{verb.translations[locale]}</p></div>
            <button className={styles.sitovAdd} disabled={busy} aria-label={`${selected.has(verb.id) ? copy.remove : copy.add}: ${verb.infinitive}`} aria-pressed={selected.has(verb.id)} onClick={() => void changeBox([verb.id], !selected.has(verb.id))}>
              {selected.has(verb.id) ? <Trash2 size={18} /> : <Plus size={19} />}<span>{selected.has(verb.id) ? copy.added : copy.add}</span></button></div>
          {selected.has(verb.id) && <div className={styles.sitovFormProgress} aria-label={copy.progress}>{getSitovVerbTenses(initialState.level, verb).map(tense => {
            const item = progress.find(item => item.verbId === verb.id && item.tense === tense)
            const tone = !item?.attempts ? 'new' : item.box >= 6 ? 'secure' : 'learning'
            return <span key={tense} data-tone={tone}><i aria-hidden="true" />{copy[tense]}<b>{tone === 'new' ? copy.newForm : tone === 'secure' ? copy.secure : copy.learning}</b></span>
          })}</div>}
        </li>)}</ul>
      </section> : <section className={styles.sitovLaunch} key={view}>
        <div className={styles.sitovLaunchIcon} aria-hidden="true">{view === 'automatic' ? <Zap size={32} /> : <Target size={32} />}</div>
        <h2>{copy[view === 'automatic' ? 'automaticTitle' : 'targetedTitle']}</h2><p>{copy[view === 'automatic' ? 'automaticHint' : 'targetedHint']}</p>
        {view === 'targeted' ? <fieldset className={styles.sitovTenses}><legend className="sr-only">{copy.targeted}</legend>{initialState.tenses.map(tense => <label key={tense} data-selected={tenses.includes(tense)}>
          <input type="checkbox" checked={tenses.includes(tense)} onChange={() => setTenses(values => values.includes(tense) ? values.filter(value => value !== tense) : [...values, tense])} />{copy[tense]}</label>)}</fieldset>
          : <div className={styles.sitovTensePills}>{initialState.tenses.map(tense => <span key={tense}>{copy[tense]}</span>)}</div>}
        {initialState.level.startsWith('A2') && <p className={styles.sitovSmall}>{copy.formsHint}</p>}
        {!selectedVerbs.length ? <div className={styles.sitovEmpty}><h3>{copy.empty}</h3><p>{copy.emptyHint}</p><button className={styles.sitovPrimary} onClick={() => chooseView('box')}><Plus size={19} />{copy.manage}</button></div>
          : <div className={styles.sitovActions}><button className={styles.sitovPrimary} disabled={busy || (view === 'targeted' && !tenses.length)} onClick={() => void start()}>{view === 'automatic' ? copy.start : copy.practice}<ArrowRight size={20} /></button>
            <button className={styles.sitovSecondary} onClick={() => chooseView('box')}>{copy.manage}</button></div>}
        {view === 'targeted' && !tenses.length && <p role="status" className={styles.sitovSmall}>{copy.chooseTense}</p>}
      </section>}
      <aside className={styles.sitovCarryover}><Layers3 size={25} aria-hidden="true" /><div><strong>{copy.cumulative}</strong><p>{copy.cumulativeHint}</p></div><span aria-hidden="true">A1 <ArrowRight size={15} /> C1</span></aside>
    </>}
  </SitovVerbStage>
}
