'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Info } from 'lucide-react'
import { finishVocabularySession, submitVocabularyAnswer } from '@/app/actions/vocabulary'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import LearningScreen from './LearningScreen'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { scheduleVocabularyCards } from '@/lib/vocabulary-scheduler'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { DueVocabularyCard, SubmitVocabularyAnswerInput, SubmitVocabularyAnswerResult } from '@/lib/types/vocabulary'
import { createOrderedWriteQueue, type OrderedWriteQueue } from '@/lib/vocabulary-write-queue'
import { prefetchNeuralAudio } from '@/lib/audio/neural-client'
import { vocabularyAudioText } from '@/lib/audio/neural-config'
import { cn, stripLessonPrefix } from '@/lib/utils'
import VisualDiff from '@/components/exercises/VisualDiff'

interface VocabCardSessionProps {
  learnerId: string | null
  cards: DueVocabularyCard[]
  translations?: VocabularyTranslations
  overviewHref: string
  uiLanguage?: string
  previousCardId?: string | null
  initialDeferredCount?: number
  onBackToLernkasten?: (lastAnsweredCardId: string | null) => void
}

export default function VocabCardSession({ learnerId, cards, translations = {}, overviewHref, uiLanguage = 'de', previousCardId = null, initialDeferredCount = 0, onBackToLernkasten }: VocabCardSessionProps) {
  const router = useRouter()
  const actorId = useRef(learnerId).current
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [plan] = useState(() => scheduleVocabularyCards(cards, previousCardId))
  const session = plan.cards
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const [revealed, setRevealed] = useState(false)
  const [sentencePending, setSentencePending] = useState(false)
  const sentenceBusy = useRef(false)
  const lastAnswered = useRef<string | null>(previousCardId)
  const [saveFailed, setSaveFailed] = useState(false)
  const [answer, setAnswer] = useState('')
  const drafts = useRef(new Map<string, string>())
  const [sentenceResult, setSentenceResult] = useState<{ correct: boolean; solution: string; isAlternative?: boolean } | null>(null)
  const exitRequested = useRef(false)
  const finalized = useRef(false)
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const current = session[index]
  useEffect(() => prefetchNeuralAudio(session.slice(index, index + 2)
    .filter(item => item.format === 'word')
    .map(item => ({ text: vocabularyAudioText(item.card), language: 'de', cardId: item.card.id, audioUrl: item.card.audio_url }))), [index, session])
  type ReviewIntent = { index: number; card: DueVocabularyCard; input: SubmitVocabularyAnswerInput }
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
    write: item => submitVocabularyAnswer(item.input),
    accepted: (result, item) => result.success && (item.card.format !== 'sentence' || (typeof result.isCorrect === 'boolean' && typeof result.correctAnswer === 'string')),
    onAccepted: (item, result) => {
      lastAnswered.current = item.card.card.id
      if (mounted.current && item.card.format === 'sentence') {
        sentenceBusy.current = false
        setSentencePending(false)
        setSentenceResult({ correct: result.isCorrect === true, solution: result.correctAnswer ?? '', isAlternative: result.isAlternative })
      }
    },
    onBlocked: pending => {
      if (!mounted.current) return
      const failed = pending[0]
      if (!failed) return
      // Restore the failed card; later clicks stay in the queue, never discarded.
      indexRef.current = failed.index
      setIndex(failed.index)
      setRevealed(failed.card.format === 'word')
      setAnswer(failed.input.typedAnswer ?? '')
      setSentenceResult(null)
      sentenceBusy.current = false
      setSentencePending(false)
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
    const nextIndex = last.index + Number(last.card.format !== 'sentence')
    indexRef.current = nextIndex
    setIndex(nextIndex)
    setRevealed(false)
    setAnswer(last.card.format === 'sentence' ? last.input.typedAnswer ?? '' : drafts.current.get(session[nextIndex]?.progressId) ?? '')
    setSentenceResult(null)
    sentenceBusy.current = last.card.format === 'sentence'
    setSentencePending(sentenceBusy.current)
    setSaveFailed(false)
    queue.retry()
  }

  function goBack() {
    if (writes.current?.pending.length) {
      // Leaving waits for acknowledged writes, without disabling learning controls.
      exitRequested.current = true
      if (writes.current.blocked) retry()
      return
    }
    navigateBack()
  }

  function advance(checkFinish = true) {
    if (index !== indexRef.current) return
    indexRef.current += 1
    setIndex(indexRef.current)
    setRevealed(false)
    setAnswer(drafts.current.get(session[indexRef.current]?.progressId) ?? '')
    setSentenceResult(null)
    if (checkFinish) finishIfReady()
  }

  function submitWord(isCorrect: boolean) {
    if (!actorId || !current || !revealed || index !== indexRef.current || writes.current?.blocked) return
    const item = { index, card: current, input: { progressId: current.progressId, expectedLearnerId: actorId, isCorrect, uiLanguage, requestId: crypto.randomUUID() } }
    // Advance synchronously; ordered background writes never lock the next word.
    advance(false)
    writes.current?.enqueue(item)
  }

  function submitSentence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!actorId || !current || sentenceBusy.current || !answer.length || index !== indexRef.current || writes.current?.blocked) return
    sentenceBusy.current = true
    setSentencePending(true)
    setSaveFailed(false)
    writes.current?.enqueue({ index, card: current, input: {
      progressId: current.progressId, expectedLearnerId: actorId, typedAnswer: answer, uiLanguage, requestId: crypto.randomUUID(),
    } })
  }

  const targetWord = current && (current.card.article && current.card.article !== 'none'
    ? `${current.card.article} ${current.card.word_de}` : current.card.word_de)
  const isSentence = current?.format === 'sentence'
  const isToGerman = current?.direction === 'native_to_de'
  const prompt = (!isSentence && !isToGerman ? targetWord : current?.prompt) || current?.translation || t('no_translation')
  const denseCard = prompt.length + (revealed ? (targetWord?.length ?? 0) + (current?.translation.length ?? 0) + (current?.contextSentence?.length ?? 0) : 0) > 160

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
            {!isSentence && !revealed && current.card.image_url && <img className="learning-card-image" src={current.card.image_url} alt={t('image_alt')} />}
            <span className="learning-eyebrow">{t(isSentence ? 'sentence_format' : 'word_format')}</span>
            <h2 lang={current.promptLanguage} className={cn(isSentence ? 'learning-sentence' : 'learning-word', !isToGerman && articleColorClass(current.card.article))}>{prompt}</h2>
            {isSentence ? sentenceResult && <>
              <div className="learning-divider" />
              <p className={sentenceResult.correct ? 'learning-success' : 'learning-error'} role="status">{t(sentenceResult.correct ? 'sentence_correct' : 'sentence_incorrect')}</p>
              {sentenceResult.isAlternative && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
                  <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <p>
                    {t('alternative_answer_hint') || 'Richtig! Oft wird hierfür auch diese Form verwendet:'} <br />
                    <strong>{sentenceResult.solution}</strong>
                  </p>
                </div>
              )}
              {!sentenceResult.correct && (
                <div className="mt-4 mb-6 rounded-2xl border-2 border-red-200 bg-red-50 p-4">
                  <span className="learning-eyebrow mb-2 text-red-600 block">{t('your_answer_label') || 'Deine Eingabe'}</span>
                  <VisualDiff actual={answer} expected={sentenceResult.solution} />
                </div>
              )}
              <span className="learning-eyebrow">{t('correct_sentence_label')}</span>
              <p className="learning-sentence" lang="de">{sentenceResult.solution}</p>
            </> : revealed && <>
              <div className="learning-divider" />
              <p className={cn('learning-solution', isToGerman && articleColorClass(current.card.article))}>{isToGerman ? targetWord : current.translation || t('no_translation')}</p>
              {current.contextSentence && <p className="learning-context" lang="de"><span className="sr-only">{t('context_label')}: </span>{current.contextSentence}</p>}
              <SolutionAudioButton cardId={current.card.id} language="de" text={targetWord ?? ''} audioUrl={current.card.audio_url} label={t('listen_word')} ariaLabel={t('listen_word_aria', { word: current.card.word_de })} variant="secondary" />
            </>}
          </div>
        </article>
        {saveFailed ? <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={retry}>{t('error_retry')}</button> : isSentence ? sentenceResult
          ? <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={() => advance()}>{t(index + 1 === session.length ? 'finish_session' : 'next_card')}</button>
          : <form className="learning-typing" onSubmit={submitSentence}>
            <label htmlFor="german-sentence">{t('type_german')}</label>
            <textarea id="german-sentence" lang="de" value={answer} onChange={event => { drafts.current.set(current.progressId, event.target.value); setAnswer(event.target.value) }} rows={2} maxLength={1000} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} aria-describedby="exact-spelling" disabled={sentencePending} />
            <button className="learning-button learning-button-primary" disabled={sentencePending || !answer.length}>{t('check_sentence')}</button>
          </form>
          : revealed ? <div className="learning-actions">
            <button type="button" className="learning-button" onClick={() => submitWord(false)}><span>{t('didnt_know')}</span><small>{t('didnt_know_hint')}</small></button>
            <button type="button" className="learning-button learning-button-primary" onClick={() => submitWord(true)}><span>{t('knew_it')}</span><small>{t('knew_it_hint')}</small></button>
          </div> : <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={() => setRevealed(true)}>{t('reveal_solution')}</button>}
      </>}
      {saveFailed && <p role="status" className="learning-status learning-error">{t('save_failed')}</p>}
      {!saveFailed && isSentence && !sentenceResult && <p id="exact-spelling" className="learning-status">{t('exact_spelling_hint')}</p>}
    </LearningScreen>
  )
}
