'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { finishVocabularySession, submitVocabularyAnswer, submitVocabularySelfRating } from '@/app/actions/vocabulary'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import LearningScreen from './LearningScreen'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { scheduleVocabularyCards } from '@/lib/vocabulary-scheduler'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { DueVocabularyCard, SubmitVocabularyAnswerInput, SubmitVocabularyAnswerResult, SubmitVocabularySelfRatingInput } from '@/lib/types/vocabulary'
import { createOrderedWriteQueue, type OrderedWriteQueue } from '@/lib/vocabulary-write-queue'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { vocabularyAudioText } from '@/lib/audio/neural-config'
import { cn, stripLessonPrefix } from '@/lib/utils'
import VisualDiff from '@/components/exercises/VisualDiff'
import SoftErrorBadge from '@/components/exercises/SoftErrorBadge'
import type { SoftErrorReason } from '@/lib/answer-grading'

interface VocabCardSessionProps {
  learnerId: string | null
  cards: DueVocabularyCard[]
  translations?: VocabularyTranslations
  softErrorTranslations?: Partial<Record<SoftErrorReason, string>>
  overviewHref: string
  uiLanguage?: string
  previousCardId?: string | null
  initialDeferredCount?: number
  onBackToLernkasten?: (lastAnsweredCardId: string | null) => void
}

export default function VocabCardSession({ learnerId, cards, translations = {}, softErrorTranslations, overviewHref, uiLanguage = 'de', previousCardId = null, initialDeferredCount = 0, onBackToLernkasten }: VocabCardSessionProps) {
  const router = useRouter()
  const actorId = useRef(learnerId).current
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [plan] = useState(() => scheduleVocabularyCards(cards, previousCardId))
  const session = plan.cards
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const [reviewPending, setReviewPending] = useState(false)
  const reviewBusy = useRef(false)
  const lastAnswered = useRef<string | null>(previousCardId)
  const [saveFailed, setSaveFailed] = useState(false)
  const [answer, setAnswer] = useState('')
  // Flashcard-Modus: erst Lösung aufdecken, dann selbst einschätzen.
  const [revealed, setRevealed] = useState(false)
  const drafts = useRef(new Map<string, string>())
  const [answerResult, setAnswerResult] = useState<{ correct: boolean; solution: string; isAlternative: boolean; softError: SoftErrorReason | null } | null>(null)
  const exitRequested = useRef(false)
  const finalized = useRef(false)
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const current = session[index]
  useEffect(() => prefetchNeuralAudio(session.slice(index, index + 2)
    .filter(item => item.format === 'word')
    .map(item => ({ text: vocabularyAudioText(item.card), language: 'de', cardId: item.card.id, audioUrl: item.card.audio_url }))), [index, session])
  type ReviewIntent =
    | { kind: 'typed'; index: number; card: DueVocabularyCard; input: SubmitVocabularyAnswerInput }
    | { kind: 'self'; index: number; card: DueVocabularyCard; input: SubmitVocabularySelfRatingInput }
  const writes = useRef<OrderedWriteQueue<ReviewIntent> | null>(null)

  function navigateBack() {
    if (!mounted.current) return
    if (onBackToLernkasten) onBackToLernkasten(lastAnswered.current)
    else router.push(overviewHref)
  }

  function finishIfReady() {
    if (writes.current?.pending.length || indexRef.current < session.length || finalized.current) return
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
        if (item.kind === 'self') {
          indexRef.current += 1
          setIndex(indexRef.current)
          setAnswer(drafts.current.get(session[indexRef.current]?.progressId) ?? '')
          setAnswerResult(null)
          setRevealed(false)
          finishIfReady()
        } else {
          setAnswerResult({ correct: result.isCorrect === true, solution: result.correctAnswer ?? '', isAlternative: result.isAlternative === true, softError: result.softError ?? null })
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
    indexRef.current += 1
    setIndex(indexRef.current)
    setAnswer(drafts.current.get(session[indexRef.current]?.progressId) ?? '')
    setAnswerResult(null)
    setRevealed(false)
    finishIfReady()
  }

  function submitAnswer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!actorId || !current || answerResult || reviewBusy.current || !answer.trim().length || index !== indexRef.current || writes.current?.blocked) return
    reviewBusy.current = true
    setReviewPending(true)
    setSaveFailed(false)
    writes.current?.enqueue({ kind: 'typed', index, card: current, input: {
      progressId: current.progressId, expectedLearnerId: actorId, typedAnswer: answer, uiLanguage, requestId: crypto.randomUUID(),
    } })
  }

  /** Karteikarten-Selbsteinschätzung; die DB entscheidet den Lernstand (R5). */
  function submitSelfRating(known: boolean) {
    if (!actorId || !current || answerResult || reviewBusy.current || index !== indexRef.current || writes.current?.blocked) return
    reviewBusy.current = true
    setReviewPending(true)
    setSaveFailed(false)
    writes.current?.enqueue({ kind: 'self', index, card: current, input: {
      progressId: current.progressId, expectedLearnerId: actorId, known, uiLanguage, requestId: crypto.randomUUID(),
    } })
  }

  const targetWord = current && (current.card.article && current.card.article !== 'none'
    ? `${current.card.article} ${current.card.word_de}` : current.card.word_de)
  const isSentence = current?.format === 'sentence'
  const isToGerman = current?.direction === 'native_to_de'
  const answerLanguage = isSentence || isToGerman ? 'de' : uiLanguage
  const answerLabel = answerLanguage !== 'de' ? 'type_answer'
    : !isSentence && current?.card.article && current.card.article !== 'none' ? 'type_german_with_article' : 'type_german'
  const prompt = (!isSentence && !isToGerman ? targetWord : current?.prompt) || current?.translation || t('no_translation')
  const denseCard = prompt.length + (answerResult ? answerResult.solution.length + (current?.contextSentence?.length ?? 0) : 0) > 160
  const isFlashcard = current?.mode === 'flashcard'
  // Bei Wörtern liegt die Lösung schon im Payload (kein Satz-Geheimnis wie bei
  // getippten Sätzen); der Server bleibt trotzdem die Instanz für den Lernstand.
  const flashcardSolution = current ? (isToGerman ? (targetWord ?? '') : current.translation) : ''

  return (
    <LearningScreen title={t('title')}
      subtitle={current ? t('lesson_label', { lesson: stripLessonPrefix(current.card.lesson) }) : undefined}
      progress={session.length ? index / session.length * 100 : 100} onExit={goBack} t={t}>
      {!current ? <div className="learning-card learning-complete" aria-live="polite">
        <span className="learning-pill">{t('card_progress_compact', { current: index, total: session.length })}</span>
        <h2>{t('session_done_title')}</h2>
        <p>{t('session_done_text')}</p>
        {plan.deferredCount + initialDeferredCount > 0 && <p>{t('repetition_gap_hint')}</p>}
        <button type="button" className="learning-button learning-button-primary" onClick={goBack}>{t('lernkasten_back')}</button>
      </div> : <>
        <div className="learning-meta">
          <span className="learning-pill">{t(isSentence ? 'sentence_format' : isToGerman ? 'direction_to_de' : 'direction_from_de')}</span>
          <span>{t('card_progress_compact', { current: index + 1, total: session.length })} · {t('phase_compact', { phase: current.phase })}</span>
        </div>
        <article className="learning-card">
          <div key={current.progressId} tabIndex={0} className={cn('learning-card-content', denseCard && 'learning-card-content-dense')}>
            {!isSentence && !answerResult && current.card.image_url && <img className="learning-card-image" src={current.card.image_url} alt={t('image_alt')} />}
            <span className="learning-eyebrow">{t(isSentence ? 'sentence_format' : 'word_format')}</span>
            <h2 lang={current.promptLanguage} className={cn(isSentence ? 'learning-sentence' : 'learning-word', !isToGerman && articleColorClass(current.card.article))}>{prompt}</h2>
            {isFlashcard && revealed && !answerResult && <>
              <div className="learning-divider" />
              <span className="learning-eyebrow">{t('correct_sentence_label')}</span>
              <p className={cn('learning-solution', isToGerman && articleColorClass(current.card.article))} lang={answerLanguage}>{flashcardSolution}</p>
              {current.contextSentence && <p className="learning-context" lang="de"><span className="sr-only">{t('context_label')}: </span>{current.contextSentence}</p>}
              <SolutionAudioButton cardId={current.card.id} language="de" text={targetWord ?? ''} audioUrl={current.card.audio_url} label={t('listen_word')} ariaLabel={t('listen_word_aria', { word: current.card.word_de })} variant="secondary" />
            </>}
            {answerResult && <>
              <div className="learning-divider" />
              {answerResult.softError
                ? <SoftErrorBadge reason={answerResult.softError} translations={softErrorTranslations} />
                : <p className={answerResult.correct ? 'learning-success' : 'learning-error'} role="status">{
                    isFlashcard 
                      ? t(answerResult.correct ? 'knew_it_hint' : 'didnt_know_hint')
                      : t(isSentence ? answerResult.correct ? 'sentence_correct' : 'sentence_incorrect' : answerResult.correct ? 'answer_correct' : 'answer_incorrect')
                  }</p>}
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
                  <VisualDiff actual={answer} expected={answerResult.solution} className="learning-sentence" />
                </div>
              )}
              {answerResult.correct && <>
                <span className="learning-eyebrow">{t('correct_sentence_label')}</span>
                <p className={cn(isSentence ? 'learning-sentence' : 'learning-solution', !isSentence && isToGerman && articleColorClass(current.card.article))} lang={answerLanguage}>{answerResult.solution}</p>
              </>}
              {!isSentence && <>
                {current.contextSentence && <p className="learning-context" lang="de"><span className="sr-only">{t('context_label')}: </span>{current.contextSentence}</p>}
                <SolutionAudioButton cardId={current.card.id} language="de" text={targetWord ?? ''} audioUrl={current.card.audio_url} label={t('listen_word')} ariaLabel={t('listen_word_aria', { word: current.card.word_de })} variant="secondary" />
              </>}
            </>}
          </div>
        </article>
        {saveFailed ? <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={retry}>{t('error_retry')}</button> : answerResult
          ? <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={() => advance()}>{t(index + 1 === session.length ? 'finish_session' : 'next_card')}</button>
          : isFlashcard
          ? revealed
            ? <div className="learning-flashcard-actions">
                <button type="button" className="learning-button learning-button-primary" disabled={reviewPending} onClick={() => submitSelfRating(true)}>{t('knew_it')}</button>
                <button type="button" className="learning-button learning-button-secondary" disabled={reviewPending} onClick={() => submitSelfRating(false)}>{t('didnt_know')}</button>
              </div>
            : <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={() => setRevealed(true)}>{t('reveal_solution')}</button>
          : <form className="learning-typing" onSubmit={submitAnswer}>
            <label htmlFor="vocabulary-answer">{t(answerLabel)}</label>
            <textarea id="vocabulary-answer" lang={answerLanguage} value={answer} onChange={event => { drafts.current.set(current.progressId, event.target.value); setAnswer(event.target.value) }} rows={isSentence ? 2 : 1} maxLength={4000} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} disabled={reviewPending} />
            <button className="learning-button learning-button-primary" disabled={reviewPending || !answer.trim().length}>{t('check_sentence')}</button>
          </form>}
      </>}
      {saveFailed && <p role="status" className="learning-status learning-error">{t('save_failed')}</p>}
    </LearningScreen>
  )
}
