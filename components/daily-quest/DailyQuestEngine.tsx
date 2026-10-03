'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, Flame, Loader2, MapPin, Pause, RotateCcw, Sparkles, Undo2, Volume2 } from 'lucide-react'
import BrandLogo from '@/components/layout/BrandLogo'
import MotionProvider from '@/components/motion/MotionProvider'
import PressableCard from '@/components/motion/PressableCard'
import FeedbackMotion from '@/components/motion/FeedbackMotion'
import { completeDailyQuest, submitDailyQuestStep } from '@/app/actions/daily-quests'
import type { DailyQuest, DailyQuestMutation, DailyQuestResult, DailyQuestStep, DailyQuestStepAnswer, DailyQuestStepResult, DailyQuestStreak } from '@/lib/daily-quest-contract'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'
import { neuralAudioKey, type NeuralAudioSource } from '@/lib/audio/neural-client'
import { PLAYBACK_RATES } from '@/lib/audio/playback-settings'
import { usePlaybackRate } from '@/lib/audio/usePlaybackRate'
import { EASE_OUT_SOFT, MOTION, useReducedMotionSafe } from '@/lib/motion'
import { useQuestAudio } from './useQuestAudio'
import styles from './DailyQuestEngine.module.css'

export interface DailyQuestActions {
  submit: (input: { assignmentId: string; stepId: string; answer: DailyQuestStepAnswer }) => Promise<DailyQuestResult<DailyQuestStepResult>>
  complete: (assignmentId: string) => Promise<DailyQuestResult<DailyQuestMutation>>
}
export interface DailyQuestEngineProps {
  initialQuest: DailyQuest
  initialStreak: DailyQuestStreak
  locale: string
  dashboardHref: string
  preview?: boolean
  /** The production defaults are authenticated server actions. */
  actions?: DailyQuestActions
}
const DEFAULT_ACTIONS: DailyQuestActions = { submit: submitDailyQuestStep, complete: completeDailyQuest }

function firstOpenStep(quest: DailyQuest) {
  const index = quest.steps.findIndex(step => !quest.completedStepIds.includes(step.id))
  return index < 0 ? quest.steps.length : index
}
function pieceOrder(id: string) {
  return Array.from(id).reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 23)
}

/** The server owns grading, resume state and streaks; this engine owns interaction. */
export default function DailyQuestEngine({ initialQuest, initialStreak, locale, dashboardHref, actions = DEFAULT_ACTIONS, preview = false }: DailyQuestEngineProps) {
  const router = useRouter()
  const copy = getDailyQuestCopy(locale)
  const reduced = useReducedMotionSafe()
  const [quest, setQuest] = useState(initialQuest)
  const [streak, setStreak] = useState(initialStreak)
  const [intro, setIntro] = useState(() => initialQuest.status === 'active' && firstOpenStep(initialQuest) === 0)
  const [index, setIndex] = useState(() => firstOpenStep(initialQuest))
  const [discovered, setDiscovered] = useState<string[]>([])
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [pieces, setPieces] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const busyRef = useRef(false)
  const alive = useRef(true)
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const step = quest.steps[index] as DailyQuestStep | undefined
  const complete = quest.status === 'completed'
  const skipped = quest.status === 'skipped'
  const stageKey = complete ? 'complete' : skipped ? 'skipped' : intro ? 'intro' : step?.id ?? 'finish'
  const previousStage = useRef(stageKey)
  const [rate, setRate] = usePlaybackRate(quest.level)
  const audio = useQuestAudio(`${quest.id}:${stageKey}`, rate)
  const stationComplete = Boolean(step && quest.completedStepIds.includes(step.id))
  const speaker = quest.scene.characters.find(character => character.id === quest.scene.speakerId) ?? quest.scene.characters[0]
  const exerciseSpeaker = step && step.kind !== 'discover'
    ? quest.scene.characters.find(character => character.id === step.speakerId) ?? speaker : speaker
  // Every character uses the trainers' default German voice and cache identity,
  // including already mounted quests whose old character metadata says female.
  // Scene speech remains independent of selectedWord and the active exercise.
  const sceneSource: NeuralAudioSource = { text: quest.scene.audioText, language: 'de' }
  const word = step?.kind === 'discover' ? step.words.find(item => item.id === selectedWord) : undefined
  const wordSource: NeuralAudioSource | undefined = word ? { text: word.audioText, language: 'de' } : undefined
  const exerciseSource: NeuralAudioSource | undefined = step && step.kind !== 'discover'
    ? { text: step.audioText, language: 'de' } : undefined
  const selectedSentence = step?.kind === 'sentence_build'
    ? pieces.map(id => step.pieces.find(item => item.id === id)?.text ?? '').join(' ').replace(/\s+([,.:;!?])/gu, '$1') : ''

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (navigationTimer.current) clearTimeout(navigationTimer.current)
    }
  }, [])
  useEffect(() => {
    if (previousStage.current !== stageKey) {
      titleRef.current?.focus({ preventScroll: true })
      titleRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' })
    }
    previousStage.current = stageKey
  }, [stageKey])
  useEffect(() => {
    if (!feedback) return
    if (feedback.correct) continueRef.current?.focus({ preventScroll: true })
    else feedbackRef.current?.focus({ preventScroll: true })
  }, [feedback])

  function clearStation() {
    audio.stop()
    setDiscovered([]); setSelectedWord(null); setPieces([]); setSelectedOption(null)
    setFeedback(null); setError('')
  }
  function goDashboard() {
    if (leaving) return
    audio.stop()
    setLeaving(true)
    // This href comes from the route, never from authored database content.
    const target = dashboardHref.startsWith('/') && !dashboardHref.startsWith('//') ? dashboardHref : `/${locale}/dashboard`
    navigationTimer.current = setTimeout(() => { router.replace(target); router.refresh() }, reduced ? 0 : MOTION.base * 1000)
  }
  function start() { clearStation(); setIntro(false) }
  function next() {
    if (busyRef.current || !stationComplete) return
    if (index === quest.steps.length - 1) { void finish(); return }
    clearStation()
    setIndex(index + 1)
  }
  async function submit(answer: DailyQuestStepAnswer) {
    if (!step || busyRef.current || stationComplete || quest.status !== 'active') return
    busyRef.current = true; setBusy(true); setError(''); setFeedback(null); audio.stop()
    try {
      const result = await actions.submit({ assignmentId: quest.id, stepId: step.id, answer })
      if (!alive.current) return
      if (result.error || !result.data) { setError(copy.requestError); return }
      // Never unlock a station from a client-side comparison or feedback alone.
      const verified = result.data.correct && result.data.quest.completedStepIds.includes(step.id)
      setQuest(result.data.quest); setStreak(result.data.streak)
      setFeedback({ correct: verified, text: result.data.feedback || (verified ? copy.stationComplete : copy.retry) })
      if (result.data.correct && !verified) setError(copy.requestError)
    } catch { if (alive.current) setError(copy.requestError) }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  async function finish() {
    if (busyRef.current || quest.status !== 'active' || !quest.steps.every(item => quest.completedStepIds.includes(item.id))) return
    busyRef.current = true; setBusy(true); setError(''); audio.stop()
    try {
      const result = await actions.complete(quest.id)
      if (!alive.current) return
      if (result.error || !result.data || result.data.quest.status !== 'completed') { setError(copy.requestError); return }
      setQuest(result.data.quest); setStreak(result.data.streak)
    } catch { if (alive.current) setError(copy.requestError) }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  }
  function selectWord(id: string) {
    if (busyRef.current || stationComplete) return
    audio.stop()
    setSelectedWord(id)
    setDiscovered(previous => previous.includes(id) ? previous : [...previous, id])
    setFeedback(null)
  }
  function choosePiece(id: string) {
    if (busyRef.current || stationComplete || pieces.includes(id)) return
    setPieces(previous => [...previous, id]); setFeedback(null)
  }
  const stepTitle = (item: DailyQuestStep) => item.kind === 'discover' ? copy.discoverTitle : item.kind === 'sentence_build' ? copy.sentenceTitle : copy.dialogueTitle
  function listenButton(source: NeuralAudioSource, label: string) {
    const selected = audio.state.key === neuralAudioKey(source)
    const loading = selected && audio.state.phase === 'loading'
    const playing = selected && audio.state.phase === 'playing'
    const text = loading ? copy.loadingAudio : playing ? copy.pauseAudio : label
    return <PressableCard className={styles.audioButton} onClick={() => audio.play(source)} aria-label={text}
      aria-pressed={playing} aria-busy={loading} disabled={leaving}>
      {loading ? <Loader2 size={18} aria-hidden="true" /> : playing ? <Pause size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}{text}
    </PressableCard>
  }

  return <MotionProvider><main className={`${styles.quest} ${leaving ? styles.leaving : ''}`} aria-busy={busy || leaving}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <BrandLogo name="Sitov Academy" />
        <PressableCard className={styles.skip} disabled={busy || leaving} onClick={goDashboard}>{complete || skipped ? copy.dashboard : copy.skip}</PressableCard>
      </header>
      {preview && <aside className={styles.reference} style={{ marginBottom: 20 }}><p className={styles.note}>{copy.previewNotice}</p></aside>}
      <div className={styles.heading}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 lang="de">{quest.title}</h1><p className={styles.subtitle} lang="de">{quest.subtitle}</p>
        <div className={styles.meta}><span className={styles.level}>{quest.level}</span><span className={styles.progressLabel}>{quest.completedStepIds.length} {copy.of} {quest.steps.length} {copy.progressLabel}</span></div>
      </div>
      <div className={styles.layout}>
        <section className={styles.scene} aria-label={copy.sceneListen}>
          <div className={styles.art}>
            <Image src={quest.scene.backgroundImage} alt={quest.scene.imageAlt} fill preload sizes="(min-width: 900px) 600px, (min-width: 600px) calc(100vw - 56px), calc(100vw - 32px)" className={styles.image} />
            <p className={styles.location} lang="de"><MapPin size={14} aria-hidden="true" />{quest.scene.location}</p>
          </div>
          <div className={styles.sceneBody}>
            <p className={styles.speaker}>{speaker.name}</p>
            <motion.p key={stageKey} className={styles.sceneText} lang="de" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : MOTION.slow, ease: EASE_OUT_SOFT }}>{quest.scene.audioText}</motion.p>
            <div className={styles.sceneControls}>{listenButton(sceneSource, copy.sceneListen)}
              <label className={styles.speed}>{copy.speed}<select aria-label={copy.speed} value={rate} onChange={event => setRate(Number(event.target.value))}>{PLAYBACK_RATES.map(value => <option value={value} key={value}>{value}×</option>)}</select></label>
            </div>
          </div>
        </section>
        <section className={styles.panel} aria-labelledby="quest-station-title">
          <p className={styles.eyebrow}>{complete ? copy.completed : skipped ? copy.skipTitle : intro ? copy.instruction : step ? `${copy.step} ${index + 1} ${copy.of} ${quest.steps.length}` : copy.completionTitle}</p>
          <h2 id="quest-station-title" ref={titleRef} tabIndex={-1} className={styles.panelTitle}>{complete ? quest.completion.title : skipped ? copy.skipTitle : intro ? copy.title : step ? stepTitle(step) : copy.completionTitle}</h2>
          {intro && <>
            <PressableCard className={styles.primary} onClick={start}>{copy.start}<ArrowRight size={19} aria-hidden="true" /></PressableCard>
            <ol className={styles.stationList}>{quest.steps.map((item, position) => <li key={item.id}><span className={styles.number}>{position + 1}</span>{stepTitle(item)}</li>)}</ol>
          </>}
          {!intro && !complete && !skipped && step?.kind === 'discover' && <>
            <p className={styles.description} lang="de">{step.instruction}</p>
            <div className={styles.words}>{step.words.map(item => <PressableCard key={item.id} className={styles.word} disabled={busy || stationComplete} aria-pressed={selectedWord === item.id} onClick={() => selectWord(item.id)}>
              <span lang="de">{item.text}</span>{discovered.includes(item.id) && <Check size={18} className={styles.wordCheck} aria-label={copy.discovered} />}
            </PressableCard>)}</div>
            {word && wordSource && <div className={styles.reference}><p lang="de">{word.audioText}</p>{listenButton(wordSource, copy.wordListen)}</div>}
            <p className={styles.note}>{discovered.length} {copy.of} {step.words.length} · {copy.discovered}</p>
          </>}
          {!intro && !complete && !skipped && step?.kind === 'sentence_build' && <>
            <p className={styles.description} lang="de">{step.prompt}</p>
            {exerciseSource && <div className={styles.reference}><p lang="de">{step.audioText}</p>{listenButton(exerciseSource, copy.sentenceListen)}</div>}
            <div className={styles.sentence} aria-label={copy.sentenceLabel} aria-live="polite" lang="de">
              {pieces.length === 0 && <p className={styles.placeholder}>{copy.sentencePlaceholder}</p>}
              {pieces.length > 0 && <span className={styles.selectedPiece}>{selectedSentence}</span>}
            </div>
            <div className={styles.pool}>{[...step.pieces].sort((a, b) => pieceOrder(`${step.id}:${b.id}`) - pieceOrder(`${step.id}:${a.id}`)).map(piece => <PressableCard key={piece.id} className={`${styles.chip} ${pieces.includes(piece.id) ? styles.selectedChip : ''}`} disabled={busy || stationComplete || pieces.includes(piece.id)} onClick={() => choosePiece(piece.id)} lang="de">{piece.text}</PressableCard>)}</div>
            {!stationComplete && <div className={styles.actions}><PressableCard className={styles.textButton} disabled={busy || !pieces.length} onClick={() => { setPieces(previous => previous.slice(0, -1)); setFeedback(null) }}><Undo2 size={16} aria-hidden="true" />{copy.undo}</PressableCard><PressableCard className={styles.textButton} disabled={busy || !pieces.length} onClick={() => { setPieces([]); setFeedback(null) }}><RotateCcw size={16} aria-hidden="true" />{copy.reset}</PressableCard></div>}
          </>}
          {!intro && !complete && !skipped && step?.kind === 'dialogue_choice' && <>
            <p className={styles.description} lang="de">{step.prompt}</p>
            {exerciseSource && <div className={styles.reference}><span className={styles.speaker}>{exerciseSpeaker.name}</span><p lang="de">{step.audioText}</p>{listenButton(exerciseSource, copy.questionListen)}</div>}
            <div className={styles.choices} aria-label={copy.choicesLabel}>{step.options.map(option => <PressableCard key={option.id} className={styles.choice} aria-pressed={selectedOption === option.id} disabled={busy || stationComplete} onClick={() => { setSelectedOption(option.id); void submit({ optionId: option.id }) }}><span lang="de">{option.text}</span>{stationComplete && selectedOption === option.id ? <Check size={18} aria-hidden="true" /> : <ArrowRight size={17} aria-hidden="true" />}</PressableCard>)}</div>
          </>}
          {feedback && !intro && !complete && !skipped && <FeedbackMotion correct={feedback.correct} className={styles.feedback}><div ref={feedbackRef} tabIndex={-1} role="status"><p lang="de">{feedback.text}</p></div></FeedbackMotion>}
          {!intro && !complete && !skipped && step && <div className={styles.bottom}>
            {stationComplete ? <PressableCard ref={continueRef} className={styles.primary} disabled={busy} onClick={next}>{busy ? copy.saving : index === quest.steps.length - 1 ? copy.finish : copy.continue}<ArrowRight size={19} aria-hidden="true" /></PressableCard>
              : step.kind !== 'dialogue_choice' && <PressableCard className={styles.primary} disabled={busy || (step.kind === 'discover' ? discovered.length !== step.words.length : pieces.length !== step.pieces.length)} onClick={() => { void submit(step.kind === 'discover' ? { wordIds: discovered } : { pieceIds: pieces }) }}>{busy ? copy.checking : copy.check}{busy ? <Loader2 size={19} aria-hidden="true" /> : <ArrowRight size={19} aria-hidden="true" />}</PressableCard>}
          </div>}
          {!intro && !step && !complete && !skipped && <><p className={styles.description} lang="de">{quest.completion.text}</p><PressableCard className={styles.primary} disabled={busy} onClick={() => { void finish() }}>{busy ? copy.saving : copy.finish}<Check size={19} aria-hidden="true" /></PressableCard></>}
          {complete && <>
            <p className={styles.description} lang="de">{quest.completion.text}</p>
            <motion.div className={styles.stamp} initial={reduced ? false : { opacity: 0, scale: 1.12, rotate: -14 }} animate={{ opacity: 1, scale: 1, rotate: -6 }} transition={{ duration: reduced ? 0 : MOTION.slower, ease: EASE_OUT_SOFT }}><Sparkles size={28} aria-hidden="true" /><span>{copy.completed}</span><strong lang="de">{quest.completion.title}</strong><span>{quest.level}</span></motion.div>
            {!preview && <div className={styles.streak}><Flame size={28} aria-hidden="true" /><strong>{streak.current}</strong><span>{copy.streakDays}</span></div>}
            <div className={styles.bottom}><PressableCard className={styles.primary} disabled={leaving} onClick={goDashboard}>{copy.dashboard}<ArrowRight size={19} aria-hidden="true" /></PressableCard></div>
          </>}
          {skipped && <><p className={styles.description}>{copy.skipText}</p><PressableCard className={styles.primary} disabled={leaving} onClick={goDashboard}>{copy.dashboard}<ArrowRight size={19} aria-hidden="true" /></PressableCard></>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {audio.state.phase === 'error' && <p className={styles.error} role="alert">{copy.audioError}</p>}
          {audio.state.phase === 'ready' && <p className={styles.audioStatus} role="status">{copy.audioReady}</p>}
          <audio ref={audio.audioRef} {...audio.audioEvents} preload="none" playsInline controls={audio.state.phase === 'ready'} className={audio.state.phase === 'ready' ? styles.nativeAudio : styles.hidden} aria-label={audio.state.text || copy.sceneListen} />
        </section>
      </div>
      <p className={styles.footer}>{copy.allWords}</p>
      <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{busy ? copy.checking : leaving ? copy.dashboard : `${copy.step}: ${complete ? copy.completed : skipped ? copy.skipTitle : intro ? copy.title : step ? stepTitle(step) : copy.completionTitle}`}</p>
      <p className={styles.srOnly} role="status" aria-live="polite">{audio.state.phase === 'loading' ? copy.loadingAudio : audio.state.phase === 'playing' ? `${copy.audioPlaying} ${audio.state.text}` : copy.audioIdle}</p>
    </div>
  </main></MotionProvider>
}
