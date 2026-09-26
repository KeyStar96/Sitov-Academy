'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import FeedbackMotion from '@/components/motion/FeedbackMotion'
import { Info, RotateCw } from 'lucide-react'
import { checkVocabularyRetry, finishVocabularySession, submitVocabularyAnswer, submitVocabularySelfRating } from '@/app/actions/vocabulary'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import LearningScreen, { LearningStats } from './LearningScreen'
import StudyModeToggle, { type StudyMode } from './StudyModeToggle'
import { loadRoundSize, loadStudyMode, saveStudyMode } from '@/lib/vocabulary-lernkasten'
import { countRounds, DEFAULT_ROUND_SIZE, roundLimit, takeRound, type RoundSize } from '@/lib/vocabulary-rounds'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { scheduleVocabularyCards } from '@/lib/vocabulary-scheduler'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { LeitnerPhase } from '@/lib/leitner'
import type { DueVocabularyCard, SubmitVocabularyAnswerInput, SubmitVocabularyAnswerResult, SubmitVocabularySelfRatingInput } from '@/lib/types/vocabulary'
import { createOrderedWriteQueue, type OrderedWriteQueue } from '@/lib/vocabulary-write-queue'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { vocabularyAudioText } from '@/lib/audio/neural-config'
import { cn } from '@/lib/utils'
import { lessonLabel } from '@/lib/vocabulary-own-words'
import VisualDiff from '@/components/exercises/VisualDiff'
import SoftErrorBadge, { OrthographyNote } from '@/components/exercises/SoftErrorBadge'
import { SessionBoxMoves, type SessionMove } from './SuccessMoments'
import RoundBreak, { TodayRounds } from './RoundBreak'
import ArticleHint, { ArticleSolution } from './ArticleHint'
import { learningFeedback } from '@/lib/learning-feedback-i18n'
import type { SoftErrorReason, OrthographyHint, ArticleFeedback } from '@/lib/answer-grading'
import { carryoverTranslator } from '@/lib/vocabulary-carryover-i18n'

interface VocabCardSessionProps {
  learnerId: string | null
  /** Explicit target of this session, also carried in each queued write. */
  level?: string
  cards: DueVocabularyCard[]
  translations?: VocabularyTranslations
  softErrorTranslations?: Partial<Record<SoftErrorReason, string>>
  overviewHref: string
  uiLanguage?: string
  previousCardId?: string | null
  initialDeferredCount?: number
  /** Karten pro Runde; ohne Angabe gilt die auf diesem Gerät gespeicherte Wahl. */
  roundSize?: RoundSize
  onBackToLernkasten?: (lastAnsweredCardId: string | null) => void
}

/** Eine Karte der Sitzung; `retry` markiert die Wiederholung nach einem falschen ersten Versuch. */
interface SessionItem {
  card: DueVocabularyCard
  retry: boolean
  key: string
}

function toSessionItem(card: DueVocabularyCard): SessionItem {
  return { card, retry: false, key: card.progressId }
}

export default function VocabCardSession({ learnerId, level, cards, translations = {}, softErrorTranslations, overviewHref, uiLanguage = 'de', previousCardId = null, initialDeferredCount = 0, roundSize, onBackToLernkasten }: VocabCardSessionProps) {
  const router = useRouter()
  const actorId = useRef(learnerId).current
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [plan] = useState(() => scheduleVocabularyCards(cards, previousCardId))
  // Lernrunden: Der geplante Stapel wird in Runden fester Größe geteilt.
  // Jede fällige Karte kommt einmal als gewerteter Versuch. Ist er falsch,
  // hängt sich eine Wiederholung ans Ende DIESER Runde — so kommt ein
  // unbekanntes Wort nach höchstens einer Rundenlänge wieder. Wiederholungen
  // ändern die Phase nicht.
  const [size, setSize] = useState<RoundSize>(roundSize ?? DEFAULT_ROUND_SIZE)
  const [round, setRound] = useState(() => ({ number: 1, start: 0, length: roundLimit(roundSize ?? DEFAULT_ROUND_SIZE, plan.cards.length) }))
  const [queue, setQueue] = useState<SessionItem[]>(() => takeRound(plan.cards, 0, roundSize ?? DEFAULT_ROUND_SIZE, previousCardId).map(toSessionItem))
  const queueRef = useRef(queue)
  const workspace = useRef<HTMLDivElement>(null)
  const [retryCount, setRetryCount] = useState(0)
  // Wohin die Karten gewandert sind — für die Pause und den Abschluss-Moment.
  const [moves, setMoves] = useState<SessionMove[]>([])
  const [roundMovesFrom, setRoundMovesFrom] = useState(0)
  const [retryFailed, setRetryFailed] = useState(false)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const [reviewPending, setReviewPending] = useState(false)
  const reviewBusy = useRef(false)
  const lastAnswered = useRef<string | null>(previousCardId)
  const [saveFailed, setSaveFailed] = useState(false)
  const [answer, setAnswer] = useState('')
  // Flashcard-Modus: erst Lösung aufdecken, dann selbst einschätzen.
  const [revealed, setRevealed] = useState(false)
  // Gewählter Weg für Karten, bei denen beide Wege offenstehen. Der Wert kommt
  // erst nach dem Mounten aus dem localStorage – Server und erster Client-Render
  // müssen übereinstimmen.
  const [preferredMode, setPreferredMode] = useState<StudyMode>('flashcard')
  useEffect(() => { setPreferredMode(loadStudyMode()) }, [])
  const drafts = useRef(new Map<string, string>())
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; solution: string; isAlternative: boolean; softError: SoftErrorReason | null; hint: OrthographyHint | null; feedback: ArticleFeedback | null } | null>(null)
  const exitRequested = useRef(false)
  const finalized = useRef(false)
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const s = studentTranslator(uiLanguage)
  const item = queue[index]
  const current = item?.card
  const isRetry = item?.retry ?? false
  useEffect(() => prefetchNeuralAudio(queue.slice(index, index + 2).map(entry => entry.card)
    .filter(entry => entry.format === 'word')
    .map(entry => ({ text: vocabularyAudioText(entry.card), language: 'de', cardId: entry.card.id, audioUrl: entry.card.audio_url }))), [index, queue])
  type ReviewIntent =
    | { kind: 'typed'; index: number; card: DueVocabularyCard; input: SubmitVocabularyAnswerInput }
    | { kind: 'self'; index: number; card: DueVocabularyCard; input: SubmitVocabularySelfRatingInput }
  const writes = useRef<OrderedWriteQueue<ReviewIntent> | null>(null)

  /** Setzt die Bühne auf die Runde ab `start` im geplanten Stapel. */
  function beginRound(number: number, start: number, nextSize: RoundSize, previous: string | null) {
    const next = takeRound(plan.cards, start, nextSize, previous).map(toSessionItem)
    queueRef.current = next
    setQueue(next)
    setRound({ number, start, length: next.length })
    setRoundMovesFrom(moves.length)
    indexRef.current = 0
    setIndex(0)
    drafts.current.clear()
    setAnswer('')
    setAnswerResult(null)
    setRevealed(false)
    setRetryFailed(false)
    setSaveFailed(false)
    finalized.current = false
    workspace.current?.scrollTo?.({ top: 0 })
  }

  // Ohne ausdrückliche Größe (z. B. direkter Aufruf über /train) gilt die auf
  // diesem Gerät gespeicherte Wahl — aber nur, solange noch nichts beantwortet ist.
  useEffect(() => {
    if (roundSize !== undefined) return
    const stored = loadRoundSize()
    if (stored === size || indexRef.current !== 0 || writes.current?.pending.length) return
    setSize(stored)
    beginRound(1, 0, stored, previousCardId)
    // Nur beim Öffnen der Sitzung.
  }, [])

  function navigateBack() {
    if (!mounted.current) return
    if (onBackToLernkasten) onBackToLernkasten(lastAnswered.current)
    else router.push(overviewHref)
  }

  /**
   * Falsch beantwortet: Die Karte kommt am Ende der Runde noch einmal. Nach dem
   * ersten Versuch trägt sie schon die zurückgestufte Phase vom Server.
   */
  function enqueueRetry(card: DueVocabularyCard, phase: LeitnerPhase = card.phase) {
    drafts.current.delete(card.progressId)
    const retryCard = phase === card.phase ? card : { ...card, phase, box: phase }
    const next = [...queueRef.current, { card: retryCard, retry: true, key: `${card.progressId}:${queueRef.current.length}` }]
    queueRef.current = next
    setQueue(next)
    setRetryCount(count => count + 1)
  }

  function moveToNextCard() {
    indexRef.current += 1
    setIndex(indexRef.current)
    setAnswer(drafts.current.get(queueRef.current[indexRef.current]?.card.progressId) ?? '')
    setAnswerResult(null)
    setRevealed(false)
    setRetryFailed(false)
    finishIfReady()
  }

  function finishIfReady() {
    if (writes.current?.pending.length || indexRef.current < queueRef.current.length || finalized.current) return
    finalized.current = true
    // A refresh failure cannot roll back answers that have already committed.
    void finishVocabularySession().catch(() => undefined)
  }

  if (!writes.current) writes.current = createOrderedWriteQueue<ReviewIntent, SubmitVocabularyAnswerResult>({
    write: item => item.kind === 'typed' ? submitVocabularyAnswer(item.input) : submitVocabularySelfRating(item.input),
    accepted: result => result.success && typeof result.isCorrect === 'boolean' && typeof result.correctAnswer === 'string'
      && typeof result.isAlternative === 'boolean' && result.softError !== undefined,
    onAccepted: (item, result) => {
      lastAnswered.current = item.card.card.id
      if (mounted.current) {
        reviewBusy.current = false
        setReviewPending(false)
        // Nur der erste Versuch zählt; war er falsch, wird bis zur ersten
        // richtigen Antwort in dieser Sitzung wiederholt.
        if (result.isCorrect === false) enqueueRetry(item.card, result.newPhase)
        if (result.previousPhase && result.newPhase) {
          const move: SessionMove = { from: result.previousPhase, to: result.newPhase, learned: result.becameLearned === true }
          setMoves(previous => [...previous, move])
        }
        if (item.kind === 'self') {
          moveToNextCard()
        } else {
          setAnswerResult({ correct: result.isCorrect === true, solution: result.correctAnswer ?? '', isAlternative: result.isAlternative === true, softError: result.softError ?? null, hint: result.hint ?? null, feedback: result.feedback ?? null })
        }
      }
    },
    onBlocked: pending => {
      if (!mounted.current) return
      const failed = pending[0]
      if (!failed) return
      // Keep the exact answer and request ID until the server acknowledges it.
      indexRef.current = failed.index
      setIndex(failed.index)
      if (failed.kind === 'typed') setAnswer(failed.input.typedAnswer)
      else setRevealed(true)
      setAnswerResult(null)
      reviewBusy.current = false
      setReviewPending(false)
      setSaveFailed(true)
    },
    onDrained: () => {
      finishIfReady()
      if (exitRequested.current) navigateBack()
    },
  })

  function retry() {
    const queue = writes.current
    const last = queue?.pending.at(-1)
    if (!queue || !last) return
    indexRef.current = last.index
    setIndex(last.index)
    if (last.kind === 'typed') setAnswer(last.input.typedAnswer)
    else setRevealed(true)
    setAnswerResult(null)
    reviewBusy.current = true
    setReviewPending(true)
    setSaveFailed(false)
    queue.retry()
  }

  function goBack() {
    if (writes.current?.pending.length) {
      // Leaving waits for an acknowledged write; retry preserves its request ID.
      exitRequested.current = true
      if (writes.current.blocked) retry()
      return
    }
    navigateBack()
  }

  function advance() {
    if (!answerResult || reviewBusy.current || index !== indexRef.current) return
    moveToNextCard()
  }

  /**
   * Getippte Wiederholung: PostgreSQL prüft wie beim ersten Versuch (R5),
   * schreibt aber nichts. Ist sie wieder falsch, kommt die Karte noch einmal.
   */
  async function checkRetry() {
    if (!actorId || !current || answerResult || reviewBusy.current || !answer.trim().length) return
    const at = indexRef.current
    const card = current
    reviewBusy.current = true
    setReviewPending(true)
    setRetryFailed(false)
    const result = await checkVocabularyRetry({ progressId: card.progressId, expectedLearnerId: actorId, typedAnswer: answer, uiLanguage, targetLevel: level ?? card.targetLevel ?? card.card.level })
    if (!mounted.current || at !== indexRef.current) return
    reviewBusy.current = false
    setReviewPending(false)
    if (!result.success) { setRetryFailed(true); return }
    if (!result.isCorrect) enqueueRetry(card)
    setAnswerResult({ correct: result.isCorrect === true, solution: result.correctAnswer ?? '', isAlternative: result.isAlternative === true, softError: result.softError ?? null, hint: result.hint ?? null, feedback: result.feedback ?? null })
  }

  function submitAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isRetry) { void checkRetry(); return }
    if (!actorId || !current || answerResult || reviewBusy.current || !answer.trim().length || index !== indexRef.current || writes.current?.blocked) return
    reviewBusy.current = true
    setReviewPending(true)
    setSaveFailed(false)
    writes.current?.enqueue({ kind: 'typed', index, card: current, input: {
      progressId: current.progressId, expectedLearnerId: actorId, typedAnswer: answer, uiLanguage, targetLevel: level ?? current.targetLevel ?? current.card.level, requestId: crypto.randomUUID(),
    } })
  }

  /** Karteikarten-Selbsteinschätzung; die DB entscheidet den Lernstand (R5). */
  function submitSelfRating(known: boolean) {
    if (!actorId || !current || answerResult || reviewBusy.current || index !== indexRef.current || writes.current?.blocked) return
    // Wiederholung: nichts wird gespeichert, der erste Versuch hat entschieden.
    if (isRetry) {
      if (!known) enqueueRetry(current)
      moveToNextCard()
      return
    }
    reviewBusy.current = true
    setReviewPending(true)
    setSaveFailed(false)
    writes.current?.enqueue({ kind: 'self', index, card: current, input: {
      progressId: current.progressId, expectedLearnerId: actorId, known, uiLanguage, targetLevel: level ?? current.targetLevel ?? current.card.level, requestId: crypto.randomUUID(),
    } })
  }

  // Stand des Tages: Karten bis zum Ende dieser Runde, übrige Karten, Runden insgesamt.
  const done = round.start + round.length
  const remaining = plan.cards.length - done
  const totalRounds = round.number - 1 + countRounds(plan.cards.length - round.start, size)

  const targetWord = current && (current.card.article && current.card.article !== 'none'
    ? `${current.card.article} ${current.card.word_de}` : current.card.word_de)
  const isSentence = current?.format === 'sentence'
  const isToGerman = current?.direction === 'native_to_de'
  const answerLanguage = isSentence || isToGerman ? 'de' : uiLanguage
  const answerLabel = answerLanguage !== 'de' ? 'type_answer'
    : !isSentence && current?.card.article && current.card.article !== 'none' ? 'type_german_with_article' : 'type_german'
  const prompt = (!isSentence && !isToGerman ? targetWord : current?.prompt) || current?.translation || t('no_translation')
  const denseCard = prompt.length + (answerResult ? answerResult.solution.length + (current?.contextSentence?.length ?? 0) : 0) > 160
  /**
   * Der Server sagt, welche Wege erlaubt sind. Bei `learner_choice` entscheidet
   * der Umschalter; sonst gibt es nur einen Weg, und der Hinweis darunter sagt
   * warum. Ein manipulierter Client gewinnt nichts: Die RPC leitet dieselbe
   * Regel erneut ab (R5).
   */
  const canChooseMode = current?.mode === 'learner_choice'
  const effectiveMode: StudyMode = canChooseMode ? preferredMode : current?.mode === 'flashcard' ? 'flashcard' : 'typed'
  const isFlashcard = effectiveMode === 'flashcard'
  // Der Wechsel des Weges deckt nichts auf: Die nächste Ansicht fängt wieder
  // bei der Frage an.
  useEffect(() => { setRevealed(false) }, [effectiveMode])
  const reducedMotion = useReducedMotion() ?? false
  // Die Lösung liegt im Payload; der Server bleibt trotzdem die Instanz für den
  // Lernstand. Sätze zeigen ihren deutschen Musterlösungssatz (`solution`),
  // Wortkarten das deutsche Wort bzw. die Übersetzung.
  const flashcardSolution = current
    ? isSentence ? (current.solution ?? '') : isToGerman ? (targetWord ?? '') : current.translation
    : ''
  // Die Rückseite trägt Frage und Lösung, wird also früher eng als die Vorderseite.
  const denseFlipBack = prompt.length + flashcardSolution.length + (current?.contextSentence?.length ?? 0) > 160
  // Solange die Karte gedreht ist, darf nur die sichtbare Seite Fokus und
  // Vorlesereihenfolge bekommen – sonst tabbt man ins Unsichtbare.
  const flipCard = isFlashcard && !answerResult
  const flipBackRef = useRef<HTMLDivElement>(null)

  const flipFrontRef = useRef<HTMLDivElement>(null)

  function revealFlashcard() {
    setRevealed(true)
    // Nach dem Umdrehen liegt der Fokus auf der Rückseite: Screenreader lesen
    // Frage und Lösung vor, und der scrollbare Bereich bleibt bedienbar.
    requestAnimationFrame(() => flipBackRef.current?.focus())
  }

  /**
   * Die ganze Karte ist eine Karteikarte zum Umdrehen: Ein Tipp irgendwo auf
   * die Karte dreht sie um — und wieder zurück. Knöpfe auf der Karte
   * (Vorlesen) behalten ihre eigene Aufgabe. Solange eine Einschätzung
   * gespeichert wird, bleibt die Karte liegen.
   */
  function turnCard() {
    if (reviewPending || saveFailed) return
    if (!revealed) { revealFlashcard(); return }
    setRevealed(false)
    requestAnimationFrame(() => flipFrontRef.current?.focus())
  }

  function onCardClick(event: React.MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return
    // Markierter Text ist kein Tipp zum Umdrehen.
    if (window.getSelection?.()?.toString()) return
    turnCard()
  }

  function onCardKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    turnCard()
  }

  return (
    <LearningScreen title={t('title')}
      subtitle={current ? lessonLabel(current.card.lesson, t) : undefined}
      progress={queue.length ? index / queue.length * 100 : 100} onExit={goBack} t={t} workspaceRef={workspace}>
      {!current ? remaining > 0
        ? <RoundBreak key={round.number} lang={uiLanguage} round={round.number} rounds={totalRounds} roundCards={round.length}
            done={done} total={plan.cards.length} nextCount={roundLimit(size, remaining)} moves={moves.slice(roundMovesFrom)}
            onContinue={() => beginRound(round.number + 1, done, size, lastAnswered.current)} onPause={goBack} />
        : <div className="learning-card learning-complete" aria-live="polite">
        <span className="learning-pill">{t('card_progress_compact', { current: index, total: queue.length })}</span>
        <h2>{t('session_done_title')}</h2>
        <p>{t('session_done_text')}</p>
        {totalRounds > 1 && <>
          <p className="learning-round__remaining">{s('round_all_done', { total: plan.cards.length, rounds: totalRounds })}</p>
          <TodayRounds lang={uiLanguage} rounds={totalRounds} completed={totalRounds} done={plan.cards.length} previous={round.start} total={plan.cards.length} />
        </>}
        {retryCount > 0 && <p>{t('session_done_retry')}</p>}
        {plan.deferredCount + initialDeferredCount > 0 && <p>{t('repetition_gap_hint')}</p>}
        <SessionBoxMoves lang={uiLanguage} moves={moves} />
        <button type="button" className="learning-button learning-button-primary" onClick={goBack}>{t('lernkasten_back')}</button>
      </div> : <>
        <div className="learning-meta">
          <div className="learning-meta-pills">
            {current.originLevel && <span className="learning-pill" data-testid="carryover-origin">{carryoverTranslator(uiLanguage)('origin', { level: current.originLevel })}</span>}
            <span className="learning-pill">{t(isSentence ? 'sentence_format' : isToGerman ? 'direction_to_de' : 'direction_from_de')}</span>
            {isRetry && <span className="learning-pill learning-pill-retry">{t('retry_label')}</span>}
          </div>
          <LearningStats label={`${totalRounds > 1 ? `${s('round_label', { round: round.number, rounds: totalRounds })}, ` : ''}${t('card_progress', { current: index + 1, total: queue.length })}, ${t('phase_label', { phase: current.phase })}`}
            items={[
              ...(totalRounds > 1 ? [{ label: s('round_stat'), value: `${round.number}/${totalRounds}` }] : []),
              { label: t('stat_card'), value: `${index + 1}/${queue.length}` }, { label: t('stat_phase'), value: `${current.phase}/6` },
            ]} />
        </div>
        {isRetry && !answerResult && <p className="learning-mode-locked" role="note">{t('retry_hint')}</p>}
        {/* Nur wo es wirklich eine Wahl gibt, steht der Umschalter. Karten mit
            nur einem Weg bleiben ohne Erklärtext — die Karte selbst zeigt, was zu tun ist. */}
        {!answerResult && !saveFailed && canChooseMode && <StudyModeToggle mode={preferredMode} disabled={reviewPending} t={t}
          onChange={mode => { setPreferredMode(mode); saveStudyMode(mode) }} />}
        {/* Buehnenwechsel: Karte und Aktionsflaeche blenden als ein Block ueber,
            statt dass die Karte stehen bleibt und nur die Knoepfe springen. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={effectiveMode} className="learning-stage"
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: .985 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -12, scale: .985 }}
            transition={{ duration: .28, ease: [.22, 1, .36, 1] }}>
          {flipCard ? (
            /* Karteikarte: Vorderseite fragt, Rückseite zeigt Frage und Lösung.
               Der `key` setzt die Drehung bei jeder neuen Karte hart zurück,
               damit die nächste Frage nicht rückwärts hereindreht. */
            <article key={item.key} className={cn('learning-card learning-card-flip', revealed && 'is-revealed')} onClick={onCardClick}>
              <div className="learning-flip-inner">
                <div className="learning-flip-face learning-flip-front" aria-hidden={revealed} inert={revealed}>
                  <div ref={flipFrontRef} tabIndex={0} onKeyDown={onCardKeyDown} aria-keyshortcuts="Enter Space" className={cn('learning-card-content', denseCard && 'learning-card-content-dense')}>
                    {!isSentence && current.card.image_url && <img className="learning-card-image" src={current.card.image_url} alt={t('image_alt')} />}
                    <span className="learning-eyebrow">{t(isSentence ? 'sentence_format' : 'word_format')}</span>
                    <h2 lang={current.promptLanguage} className={cn(isSentence ? 'learning-sentence' : 'learning-word', !isToGerman && articleColorClass(current.card.article))}>{prompt}</h2>
                  </div>
                  <RotateCw size={20} aria-hidden="true" className="learning-flip-cue" />
                </div>
                <div className="learning-flip-face learning-flip-back" aria-hidden={!revealed} inert={!revealed}>
                  {/* Die Rueckseite fuellt sich erst beim Aufdecken: bis 90 Grad ist sie
                      ohnehin unsichtbar, und die Loesung steht vorher nicht im DOM. */}
                  <div ref={flipBackRef} tabIndex={0} onKeyDown={onCardKeyDown} aria-keyshortcuts="Enter Space" className={cn('learning-card-content', denseFlipBack && 'learning-card-content-dense')}>
                    {revealed && <>
                    {/* Die Frage bleibt auf der Rückseite stehen, nur zurückgenommen. */}
                    <p className="learning-flip-echo" lang={current.promptLanguage}>{prompt}</p>
                    <div className="learning-divider" />
                    <span className="learning-eyebrow">{t('correct_sentence_label')}</span>
                    <p className={cn(isSentence ? 'learning-sentence' : 'learning-solution', !isSentence && isToGerman && articleColorClass(current.card.article))} lang={answerLanguage}>{flashcardSolution}</p>
                    {current.contextSentence && <p className="learning-context learning-example" lang="de"><span className="sr-only">{t('context_label')}: </span>{current.contextSentence}</p>}
                    {!isSentence && <SolutionAudioButton cardId={current.card.id} language="de" text={targetWord ?? ''} audioUrl={current.card.audio_url} label={t('listen_word')} ariaLabel={t('listen_word_aria', { word: current.card.word_de })} variant="secondary" />}
                    </>}
                  </div>
                  <RotateCw size={20} aria-hidden="true" className="learning-flip-cue" />
                </div>
              </div>
            </article>
          ) : (
          <article className="learning-card">
            <div key={item.key} tabIndex={0} className={cn('learning-card-content', denseCard && 'learning-card-content-dense')}>
              {!isSentence && !answerResult && current.card.image_url && <img className="learning-card-image" src={current.card.image_url} alt={t('image_alt')} />}
              <span className="learning-eyebrow">{t(isSentence ? 'sentence_format' : 'word_format')}</span>
              <h2 lang={current.promptLanguage} className={cn(isSentence ? 'learning-sentence' : 'learning-word', !isToGerman && articleColorClass(current.card.article))}>{prompt}</h2>
              {answerResult && <>
                <div className="learning-divider" />
                {/* D5/D11: richtig ein kurzer Pop, falsch ein sanftes Wackeln — nie rot blinkend. */}
                <FeedbackMotion key={`${item.key}-feedback`} correct={answerResult.correct}>
                {answerResult.softError
                  ? <SoftErrorBadge reason={answerResult.softError} translations={softErrorTranslations} />
                  : <p className={answerResult.correct ? 'learning-success' : 'learning-error'} role="status">{
                      isFlashcard 
                        ? t(answerResult.correct ? 'knew_it_hint' : 'didnt_know_hint')
                        : t(isSentence ? answerResult.correct ? 'sentence_correct' : 'sentence_incorrect' : answerResult.correct ? 'answer_correct' : 'answer_incorrect')
                    }</p>}
                </FeedbackMotion>
                {!answerResult.correct && <p className="learning-context" role="note">{t('retry_scheduled')}</p>}
                {answerResult.hint && <OrthographyNote lang={uiLanguage} solution={answerResult.solution} />}
                {answerResult.feedback && <p role="note" className="learning-context">{learningFeedback(uiLanguage)[answerResult.feedback]}</p>}
                {answerResult.isAlternative && (
                  <div className="mt-3 flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-[var(--foreground)]">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--violet)]" aria-hidden="true" />
                    <p>
                      {t('alternative_answer_hint')}
                    </p>
                  </div>
                )}
                {!answerResult.correct && !isFlashcard && (
                  <div className="my-4 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-left" lang={answerLanguage}>
                    <span className="learning-eyebrow mb-2 block">{t('your_answer_label')}</span>
                    <p className="learning-sentence whitespace-pre-wrap break-words">{answer}</p>
                    <span className="learning-eyebrow mb-2 mt-5 block">{t('correct_sentence_label')}</span>
                    {answerResult.feedback ? <p className="learning-sentence"><ArticleSolution solution={answerResult.solution} /></p>
                      : <VisualDiff actual={answer} expected={answerResult.solution} className="learning-sentence" />}
                  </div>
                )}
                {answerResult.correct && <>
                  <span className="learning-eyebrow">{t('correct_sentence_label')}</span>
                  <p className={cn(isSentence ? 'learning-sentence' : 'learning-solution', !isSentence && isToGerman && articleColorClass(current.card.article))} lang={answerLanguage}><ArticleSolution solution={answerResult.solution} /></p>
                </>}
                {!isSentence && <>
                  {current.contextSentence && <p className="learning-context learning-example" lang="de"><span className="sr-only">{t('context_label')}: </span>{current.contextSentence}</p>}
                  <SolutionAudioButton cardId={current.card.id} language="de" text={targetWord ?? ''} audioUrl={current.card.audio_url} label={t('listen_word')} ariaLabel={t('listen_word_aria', { word: current.card.word_de })} variant="secondary" />
                </>}
              </>}
            </div>
          </article>
          )}
          {saveFailed ? <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={retry}>{t('error_retry')}</button> : answerResult
            ? <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={() => advance()}>{index + 1 < queue.length ? t('next_card') : remaining > 0 ? s('round_finish') : t('finish_session')}</button>
            : isFlashcard
            ? revealed
              ? <div className="learning-flashcard-actions">
                  <button type="button" className="learning-button learning-button-secondary" disabled={reviewPending} onClick={() => submitSelfRating(false)}>{t('didnt_know')}</button>
                  <button type="button" className="learning-button learning-button-primary" disabled={reviewPending} onClick={() => submitSelfRating(true)}>{t('knew_it')}</button>
                </div>
              : <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={revealFlashcard}>{t('reveal_solution')}</button>
            : <form className="learning-typing" onSubmit={submitAnswer}>
              {isSentence && current.card.target_form?.length ? <p className="text-xl" lang="de" translate="no">[{current.card.target_form.join(', ')}]</p> : null}
              {!isSentence && isToGerman && <ArticleHint article={current.card.article} lang={uiLanguage} id="vocabulary-article-hint" />}
              <label htmlFor="vocabulary-answer">{t(answerLabel)}</label>
              <textarea id="vocabulary-answer" aria-describedby={!isSentence && isToGerman && current.card.article && current.card.article !== 'none' ? 'vocabulary-article-hint' : undefined} lang={answerLanguage} value={answer} onChange={event => { drafts.current.set(current.progressId, event.target.value); setAnswer(event.target.value) }} rows={isSentence ? 2 : 1} maxLength={4000} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={reviewPending} />
              <button className="learning-button learning-button-primary" disabled={reviewPending || !answer.trim().length}>{t('check_sentence')}</button>
            </form>}
          </motion.div>
        </AnimatePresence>
      </>}
      {saveFailed && <p role="status" className="learning-status learning-error">{t('save_failed')}</p>}
      {retryFailed && <p role="status" className="learning-status learning-error">{t('retry_check_failed')}</p>}
    </LearningScreen>
  )
}
