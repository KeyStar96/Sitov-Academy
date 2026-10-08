'use client'

import type { SitovTargetResult } from '@/lib/learning/sitov-learning-target-server'
import { sitovLearningTargetCopy } from '@/lib/learning/sitov-learning-target-i18n'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, CheckCheck, CircleHelp, Layers3, LoaderCircle, LockKeyhole, Plus, RotateCcw, Search, Settings2, Target, Trash2, X, Zap } from 'lucide-react'
import { checkSitovVerbRetry, nextSitovVerbExercise, setSitovVerbBox, submitSitovVerbAnswer } from '@/app/actions/verbs'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'
import { SITOV_VERB_TRAINER_LEVELS, SITOV_VERB_REVIEW_LEVELS, type SitovVerbTense } from '@/lib/verbs/types'
import { getSitovVerbTenses } from '@/lib/verbs/engine'
import { buildSitovVerbLearningBox, sitovVerbBoxValue, type SitovVerbBoxKey } from '@/lib/verbs/learning-box'
import { getSitovVerbBoxCopy, sitovVerbBoxText } from '@/lib/verbs/learning-box-i18n'
import type { SitovVerbPublicExercise, SitovVerbReviewResult, SitovVerbTrainerState } from '@/lib/verbs/contracts'
import { toUiLocale } from '@/lib/locale-routing'
import VerbLearningBox from './VerbLearningBox'
import SitovTrainerHero from '@/components/motion/SitovTrainerHero'
import SitovTrainerTabs from '@/components/motion/SitovTrainerTabs'
import { sitovTrainerUiCopy } from '@/lib/sitov-trainer-ui-i18n'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovVerbScene from './SitovVerbScene'
import SoftErrorBadge from '@/components/exercises/SoftErrorBadge'
import { useVocabularyRoundSize } from '@/lib/sitov-trainer-preferences'
import { DEFAULT_ROUND_SIZE, roundLimit } from '@/lib/vocabulary-rounds'
import styles from './VerbTrainer.module.css'

export interface SitovVerbTrainerActions {
  next: typeof nextSitovVerbExercise
  box: typeof setSitovVerbBox
  answer: typeof submitSitovVerbAnswer
  retry: typeof checkSitovVerbRetry
}
const sitovActions: SitovVerbTrainerActions = { next: nextSitovVerbExercise, box: setSitovVerbBox, answer: submitSitovVerbAnswer, retry: checkSitovVerbRetry }
type View = 'automatic' | 'targeted' | 'box'

export default function VerbTrainerClient({ initialState, lang, actions = sitovActions, sitovTarget }: {
  sitovTarget?: SitovTargetResult<string> | null
  initialState: SitovVerbTrainerState; lang: string; actions?: SitovVerbTrainerActions
}) {
  const copy = getSitovVerbCopy(lang)
  const boxCopy = getSitovVerbBoxCopy(lang)
  const uiCopy = sitovTrainerUiCopy(lang)
  const locale = toUiLocale(lang)
  const [chosenRoundSize] = useVocabularyRoundSize()
  const [sitovRoundLength, setRoundLength] = useState<number>(Number(DEFAULT_ROUND_SIZE))
  const [view, setView] = useState<View>(sitovTarget?.target ? 'box' : 'automatic')
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
  const [deferredForms, setDeferredForms] = useState(false)
  const [sessionTenses, setSessionTenses] = useState<SitovVerbTense[]>(initialState.tenses)
  const [sessionBox, setSessionBox] = useState<number | undefined>()
  const [isRetry, setIsRetry] = useState(false)
  const retries = useRef<SitovVerbPublicExercise[]>([])
  const sessionVerbIds = useRef<string[] | undefined>(undefined)
  const dueRoundFinished = useRef(false)
  const sitovTargetRef = useRef<HTMLLIElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionRef = useRef<HTMLElement>(null)
  const sessionActive = !!round
  const nextRef = useRef<HTMLButtonElement>(null)
  const completionRef = useRef<HTMLHeadingElement>(null)
  const focusedBlank = useRef(0)
  const lockedOperation = useRef(false)
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedVerbs = initialState.verbs.filter(verb => selected.has(verb.id))
  const boxState = useMemo(() => ({ ...initialState, selectedIds, progress }), [initialState, selectedIds, progress])
  const boxCards = useMemo(() => new Map(buildSitovVerbLearningBox(boxState).cards.map(card => [card.verb.id, card])), [boxState])
  const visibleVerbs = initialState.verbs.filter(verb => (!sitovTarget?.target || verb.id === sitovTarget.target) && (poolLevel === 'all' || verb.level === poolLevel)
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
    if (lockedOperation.current || !verbIds.length) return false
    lockedOperation.current = true; setBusy(true); setError(null)
    try {
      const result = await actions.box({ level: initialState.level, verbIds, selected: add })
      if (result.error) { setError(result.error); return false }
      setSelectedIds(result.data.selectedIds)
      return true
    } catch { setError('save_failed'); return false }
    finally { lockedOperation.current = false; setBusy(false) }
  }

  function showExercise(value: SitovVerbPublicExercise, retry = false) {
    setExercise(value); setIsRetry(retry); setReview(null); setNoTasks(false)
    setAnswer(Array(value.parts.length - 1).fill('')); focusedBlank.current = 0
  }
  function loadRetry() {
    const value = retries.current.shift()
    if (!value) return false
    showExercise(value, true)
    return true
  }
  async function loadExercise(chosen: SitovVerbTense[], excludeVerbId?: string, box?: number, endWhenEmpty = false) {
    if (lockedOperation.current) return
    lockedOperation.current = true; setBusy(true); setError(null); setNoTasks(false); setDeferredForms(false)
    try {
      const result = await actions.next({ level: initialState.level, tenses: chosen, excludeVerbId,
        ...(box == null ? {} : { box }), ...(sessionVerbIds.current ? { verbIds: sessionVerbIds.current } : {}) }, lang)
      if (result.error) { setError(result.error); return }
      setReview(null)
      if (!result.data) {
        if (endWhenEmpty && loadRetry()) { dueRoundFinished.current = true; return }
        setExercise(null)
        if (endWhenEmpty && (round?.total ?? 0) > 0) { setRound(value => value && { ...value, finished: true }); setNoTasks(false) }
        else {
          setNoTasks(true)
          setDeferredForms(buildSitovVerbLearningBox(boxState).cards.some(card =>
            (!sessionVerbIds.current || sessionVerbIds.current.includes(card.verb.id))
            && card.forms.some(form => form.due && chosen.includes(form.tense))))
        }
        return
      }
      showExercise(result.data)
    } catch { setError('load_failed') }
    finally { lockedOperation.current = false; setBusy(false) }
  }

  async function start(automatic = false, phase?: SitovVerbBoxKey, chosenOverride?: SitovVerbTense[], exactVerbId?: string) {
    const chosen = chosenOverride ?? (!automatic && view === 'targeted' ? tenses : initialState.tenses)
    if (!chosen.length || !selectedVerbs.length) return
    const box = phase == null ? undefined : sitovVerbBoxValue(phase)
    const members = buildSitovVerbLearningBox(boxState).cards.filter(card => (!exactVerbId || card.verb.id === exactVerbId) && (phase == null || card.key === phase))
    sessionVerbIds.current = phase == null && !exactVerbId ? undefined : members.map(card => card.verb.id)
    const dueCount = members.reduce((count, card) => count + card.forms.filter(form => form.due && chosen.includes(form.tense)).length, 0)
    setRoundLength(roundLimit(chosenRoundSize, dueCount))
    retries.current = []; dueRoundFinished.current = false; setIsRetry(false)
    setRound({ total: 0, correct: 0, finished: false }); setSessionTenses(chosen); setSessionBox(box)
    await loadExercise(chosen, undefined, box)
  }

  async function submit(reveal = false) {
    if (!exercise || review || lockedOperation.current) return
    lockedOperation.current = true; setBusy(true); setError(null)
    try {
      const submitAnswer = isRetry ? actions.retry : actions.answer
      const result = await submitAnswer({ exerciseId: exercise.exerciseId, answer: reveal ? answer.map(() => '') : answer })
      if (result.error) { setError(result.error); return }
      setReview(result.data)
      setProgress(items => [...items.filter(item => item.verbId !== result.data.progress.verbId || item.tense !== result.data.progress.tense), result.data.progress])
      if (!result.data.correct) retries.current.push(exercise)
      if (!isRetry) setRound(value => ({ total: (value?.total ?? 0) + 1, correct: (value?.correct ?? 0) + Number(result.data.correct), finished: false }))
    } catch { setError('save_failed') }
    finally { lockedOperation.current = false; setBusy(false) }
  }

  async function next() {
    if (isRetry || dueRoundFinished.current || (round?.total ?? 0) >= sitovRoundLength) {
      if (!loadRetry()) finish()
      return
    }
    await loadExercise(sessionTenses, exercise?.verbId, sessionBox, true)
  }
  function finish() { retries.current = []; setIsRetry(false); setRound(value => value && { ...value, finished: true }); setExercise(null); setReview(null); setNoTasks(false); setError(null) }
  function home() { retries.current = []; dueRoundFinished.current = false; setIsRetry(false); setRound(null); setExercise(null); setReview(null); setNoTasks(false); setError(null) }
  function onSubmit(event: FormEvent) { event.preventDefault(); if (review) void next(); else void submit() }
  function chooseView(value: View) { setView(value); setError(null) }

  useEffect(() => {
    if (sitovTarget?.target && view === 'box') sitovTargetRef.current?.focus({ preventScroll: true })
  }, [sitovTarget, view])
  if (sitovTarget?.error) return <div role="alert" data-sitov-target-view className={styles.sitovBox}><p>{sitovLearningTargetCopy(lang)[sitovTarget.error]}</p><button className={styles.sitovPrimary} onClick={() => window.location.reload()}>{sitovLearningTargetCopy(lang).retry}</button></div>
  return <div data-sitov-target-view={sitovTarget?.target ? true : undefined} className={styles.sitovLayout}>
    {!sessionActive && !sitovTarget?.target && <SitovTrainerTabs label={copy.eyebrow} mode="verbs"
      items={([{ id: 'automatic', icon: Zap }, { id: 'box', icon: Layers3 }, { id: 'targeted', icon: Target }] as const).map(({ id, icon }) => ({
        id, icon, label: copy[id], selected: view === id, onClick: () => chooseView(id), disabled: busy,
      }))} />}
    <SitovMotionStage className={styles.sitovTrainer}>
    {(sessionActive || view !== 'box') && <SitovTrainerHero mode="verbs" eyebrow={copy.eyebrow} level={initialState.level}
      title={!sessionActive && view === 'targeted' ? copy.targetedTitle : copy.title}
      compact={sessionActive} graphic={!sessionActive ? <SitovVerbScene /> : undefined}
      description={!sessionActive && !selectedVerbs.length ? copy.empty
        : !sessionActive && view === 'automatic' ? <div className={styles.sitovTensePills}>
            {initialState.tenses.map(tense => <span key={tense}>{copy[tense]}</span>)}
          </div> : undefined}
      options={!sessionActive && view === 'targeted' ? <>
        <fieldset className={styles.sitovTenses}><legend className="sr-only">{copy.targeted}</legend>
          {initialState.tenses.map(tense => <label key={tense} data-selected={tenses.includes(tense)}>
            <input type="checkbox" checked={tenses.includes(tense)} disabled={busy}
              onChange={() => setTenses(values => values.includes(tense) ? values.filter(value => value !== tense) : [...values, tense])} />{copy[tense]}
          </label>)}
        </fieldset>
        {!tenses.length && <p role="status" className={styles.sitovSmall}>{copy.chooseTense}</p>}
      </> : undefined}
      action={!sessionActive ? {
        label: !selectedVerbs.length ? copy.manage : view === 'targeted' ? copy.practice : uiCopy.practice,
        disabled: busy || (selectedVerbs.length > 0 && view === 'targeted' && !tenses.length), busy,
        onClick: () => { if (selectedVerbs.length) void start(); else chooseView('box') },
      } : undefined} />}

    {!sessionActive && view !== 'box' && <VerbLearningBox state={boxState} lang={lang} busy={busy}
      onPractice={phase => void start(true, phase)} onRemove={id => changeBox([id], false)} />}

    {message && <div className={styles.sitovError} role="alert"><CircleHelp size={20} aria-hidden="true" /><span>{message}</span>
      {permissionError && <button type="button" onClick={() => window.location.reload()}>{copy.reload}</button>}</div>}

    {round ? <section ref={sessionRef} className={styles.sitovSession} aria-label={copy.round}>
      {round.finished ? <div className={styles.sitovComplete}>
        <div className={styles.sitovVictory} aria-hidden="true"><CheckCheck size={42} />{Array.from({ length: 12 }, (_, index) => <span key={index} style={{ '--sitov-i': index } as CSSProperties} />)}</div>
        <p className={styles.sitovEyebrow}>{copy.round}</p><h2 ref={completionRef} tabIndex={-1}>{copy.complete}</h2><p>{copy.completeHint}</p>
        <strong className={styles.sitovScore}>{round.correct}<span> / {round.total}</span></strong><p>{copy.right}</p>
        <div className={styles.sitovActions}><button className={styles.sitovPrimary} disabled={busy} onClick={() => void start(true, sessionBox == null ? undefined : sessionBox === 7 ? 'learned' : sessionBox as SitovVerbBoxKey, sessionTenses)}><RotateCcw size={18} />{copy.again}</button>
          <button className={styles.sitovSecondary} onClick={home}>{copy.back}</button></div>
      </div> : <>
        <div className={styles.sitovRoundHead}><span>{copy.round}<strong>{Math.min(round.total + (review || isRetry ? 0 : 1), sitovRoundLength)} / {sitovRoundLength}</strong></span>
          <button disabled={busy} onClick={finish} className={styles.sitovExit}><X size={17} aria-hidden="true" />{copy.finish}</button></div>
        <div className={styles.sitovRoundTrack} role="progressbar" aria-label={copy.round} aria-valuemin={0} aria-valuemax={sitovRoundLength} aria-valuenow={round.total}>
          <span style={{ width: `${sitovRoundLength ? round.total / sitovRoundLength * 100 : 0}%` }} /></div>
        {noTasks ? <div className={styles.sitovEmpty}><Layers3 size={38} /><h2>{deferredForms ? copy.deferredForms : copy.noTasks}</h2><p>{deferredForms ? copy.deferredFormsHint : copy.noTasksHint}</p><button className={styles.sitovSecondary} onClick={home}>{copy.back}</button></div>
          : exercise ? <form onSubmit={onSubmit} className={styles.sitovTask} key={exercise.exerciseId} data-result={review ? review.correct ? 'correct' : 'incorrect' : 'waiting'}>
            <div className={styles.sitovTaskTags}><span>{copy[exercise.tense]}</span><span>{isRetry ? copy.retryForm : exerciseKind}</span></div>
            <h2 className={styles.sitovInfinitive} lang="de" translate="no">{exercise.infinitive}</h2><p className={styles.sitovTranslation}>{exercise.translation}</p>
            {currentVerb?.note && <details className={styles.sitovNote}><summary>{copy.note}</summary><p lang="de" translate="no">{currentVerb.note}</p></details>}
            <p className={styles.sitovPrompt} lang="de" translate="no">{exercise.prompt}</p>
            <div className={styles.sitovSentence} lang="de" translate="no">{exercise.parts.map((part, index) => <span key={index}>
              {part}{index < exercise.parts.length - 1 && <input ref={index === 0 ? inputRef : undefined} aria-label={`${copy.answer} ${index + 1}`} value={answer[index] ?? ''}
                onFocus={() => { focusedBlank.current = index }} onChange={event => setAnswer(values => values.map((value, pos) => pos === index ? event.target.value : value))}
                disabled={busy || !!review} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={100} size={Math.max(8, Math.min(22, (answer[index]?.length ?? 0) + 2))} />}
            </span>)}</div>
            {!review && <div className={styles.sitovCharacters} aria-label={copy.umlauts}>{['ä', 'ö', 'ü', 'ß'].map(char => <button key={char} type="button" disabled={busy} onClick={() => {
              const index = focusedBlank.current; setAnswer(values => values.map((value, pos) => pos === index ? value + char : value))
              document.querySelector<HTMLInputElement>(`[aria-label="${copy.answer} ${index + 1}"]`)?.focus({ preventScroll: true })
            }}>{char}</button>)}</div>}
            {review ? <div className={styles.sitovFeedback} role="status"><span className={styles.sitovFeedbackIcon}>{review.correct ? <Check size={24} /> : <RotateCcw size={24} />}</span>
              <div>{review.softError ? <SoftErrorBadge reason={review.softError} translations={{ umlaut: copy.softUmlaut, typo: copy.softTypo }} /> : <strong>{review.correct ? copy.correct : copy.incorrect}</strong>}<span>{copy.solution}: <b lang="de" translate="no">{review.solution}</b></span></div>
              {review.correct && !review.softError && <div className={styles.sitovCelebration} aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} style={{ '--sitov-i': index } as CSSProperties} />)}</div>}
            </div> : null}
            <div className={styles.sitovActions}>{review ? <button ref={nextRef} className={styles.sitovPrimary} disabled={busy} type="submit">{busy ? <LoaderCircle className={styles.sitovSpinner} size={19} /> : <ArrowRight size={19} />}{(isRetry || round.total >= sitovRoundLength) && retries.current.length === 0 ? copy.finish : copy.next}</button>
              : <><button className={styles.sitovPrimary} disabled={busy || answer.some(value => !value.trim())} type="submit">{busy ? <LoaderCircle className={styles.sitovSpinner} size={19} /> : <Check size={19} />}{busy ? copy.saving : copy.check}</button>
                <button className={styles.sitovSecondary} disabled={busy} type="button" onClick={() => void submit(true)}>{copy.reveal}</button></>}</div>
          </form> : <div className={styles.sitovEmpty} role="status">{busy ? <><LoaderCircle className={styles.sitovSpinner} size={30} /><p>{copy.loading}</p></> : <button className={styles.sitovPrimary} onClick={() => void loadExercise(sessionTenses, undefined, sessionBox)}>{copy.retry}</button>}</div>}
      </>}
    </section> : <>
      {view === 'box' && sitovTarget?.target && <SitovTrainerHelp title={uiCopy.help}><p>{copy.boxHint}</p><p>{copy.retained}</p></SitovTrainerHelp>}
      {view === 'box' && <section className={styles.sitovBox}>
        <div className={styles.sitovSectionHead}><div><h1>{copy.boxTitle}</h1><p>{copy.boxHint}</p></div><span className={styles.sitovRetained}><CheckCheck size={16} />{copy.retained}</span></div>
        <div className={styles.sitovLevels} aria-label={copy.availableLevels}><button aria-pressed={poolLevel === 'all'} onClick={() => setPoolLevel('all')}>{copy.all}</button>
          {SITOV_VERB_TRAINER_LEVELS.filter(level => !SITOV_VERB_REVIEW_LEVELS.includes(level)).map(level => { const available = initialState.authorizedLevels.includes(level); return <button key={level} aria-pressed={poolLevel === level} disabled={!available} title={available ? level : copy.levelLocked} onClick={() => setPoolLevel(level)}>{!available && <LockKeyhole size={13} aria-hidden="true" />}{level}</button> })}</div>
        <div className={styles.sitovFilters}><label className={styles.sitovSearch}><Search size={19} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={copy.search} aria-label={copy.search} /></label>
          <label className={styles.sitovOnly}><input type="checkbox" checked={onlySelected} onChange={event => setOnlySelected(event.target.checked)} />{copy.onlySelected}</label></div>
        <div className={styles.sitovBoxToolbar}><span>{visibleVerbs.length} / {initialState.verbs.length}</span><button disabled={busy || !visibleVerbs.some(verb => !selected.has(verb.id))} onClick={() => void changeBox(visibleVerbs.filter(verb => !selected.has(verb.id)).map(verb => verb.id), true)}><Plus size={17} />{busy ? copy.saving : copy.addVisible}</button></div>
        {!visibleVerbs.length && <p className={styles.sitovEmpty}>{copy.noResults}</p>}
        <ul className={styles.sitovVerbList}>{visibleVerbs.map(verb => <li key={verb.id} ref={verb.id === sitovTarget?.target ? sitovTargetRef : undefined} tabIndex={verb.id === sitovTarget?.target ? -1 : undefined} data-sitov-target={verb.id === sitovTarget?.target || undefined} aria-label={verb.id === sitovTarget?.target ? `${sitovLearningTargetCopy(lang).selected}: ${verb.infinitive}` : undefined} data-selected={selected.has(verb.id)}>
          <div className={styles.sitovVerbRow}><div><span className={styles.sitovLevel}>{verb.level}</span><strong lang="de" translate="no">{verb.infinitive}</strong><p>{verb.translations[locale]}</p></div>
            <button className={styles.sitovAdd} disabled={busy} aria-label={`${selected.has(verb.id) ? copy.remove : copy.add}: ${verb.infinitive}`} aria-pressed={selected.has(verb.id)} onClick={() => void changeBox([verb.id], !selected.has(verb.id))}>
              {selected.has(verb.id) ? <Trash2 size={18} /> : <Plus size={19} />}<span>{selected.has(verb.id) ? copy.added : copy.add}</span></button></div>
          {verb.id === sitovTarget?.target && selected.has(verb.id) && (boxCards.get(verb.id)?.forms.some(form => form.tense === 'present' && form.due)
            ? <button className={styles.sitovPrimary} disabled={busy} onClick={() => void start(false, undefined, ['present'], verb.id)}>{sitovLearningTargetCopy(lang).practice}</button>
            : <p role="status">{sitovLearningTargetCopy(lang).noDue}</p>)}
          {selected.has(verb.id) && <div className={styles.sitovFormProgress} aria-label={copy.progress}>
            <strong>{boxCards.get(verb.id)?.key === 'learned' ? boxCopy.learned : sitovVerbBoxText(boxCopy.phase, { box: boxCards.get(verb.id)?.box ?? 1 })}</strong>
            {getSitovVerbTenses(initialState.level, verb).map(tense => {
              const form = boxCards.get(verb.id)?.forms.find(item => item.tense === tense)
              const tone = !form?.progress?.attempts ? 'new' : form.box >= 6 ? 'secure' : 'learning'
              return <span key={tense} data-tone={tone}><i aria-hidden="true" />{copy[tense]}<b>{form?.box === 7 ? boxCopy.learned : sitovVerbBoxText(boxCopy.phase, { box: form?.box ?? 1 })}</b></span>
            })}</div>}
        </li>)}</ul>
      </section>}
      {view !== 'box' && <div className={styles.sitovSettings}>
        <Link href={`/${lang}/dashboard/profile#trainers`}><Settings2 size={17} aria-hidden="true" />{uiCopy.settings}</Link>
      </div>}
    </>}
    </SitovMotionStage>
  </div>
}
