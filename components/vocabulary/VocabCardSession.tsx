'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { finishVocabularySession, submitVocabularyAnswer } from '@/app/actions/vocabulary'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import LearningScreen from './LearningScreen'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { scheduleVocabularyCards } from '@/lib/vocabulary-scheduler'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import { cn, stripLessonPrefix } from '@/lib/utils'

interface VocabCardSessionProps {
  cards: DueVocabularyCard[]
  translations?: VocabularyTranslations
  overviewHref: string
  uiLanguage?: string
  previousCardId?: string | null
  initialDeferredCount?: number
  onBackToLernkasten?: (lastAnsweredCardId: string | null) => void
}

export default function VocabCardSession({ cards, translations = {}, overviewHref, uiLanguage = 'de', previousCardId = null, initialDeferredCount = 0, onBackToLernkasten }: VocabCardSessionProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotion()
  const [plan] = useState(() => scheduleVocabularyCards(cards, previousCardId))
  const session = plan.cards
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const lastAnswered = useRef<string | null>(previousCardId)
  const [saveFailed, setSaveFailed] = useState(false)
  const [answer, setAnswer] = useState('')
  const [sentenceResult, setSentenceResult] = useState<{ correct: boolean; solution: string } | null>(null)
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const current = session[index]
  const goBack = () => onBackToLernkasten ? onBackToLernkasten(lastAnswered.current) : router.push(overviewHref)

  function advance() {
    setIndex(index + 1)
    setRevealed(false)
    setAnswer('')
    setSentenceResult(null)
    if (index + 1 === session.length) void finishVocabularySession().catch(() => undefined)
  }

  async function submitWord(isCorrect: boolean) {
    if (!current || !revealed || busy.current) return
    busy.current = true
    setPending(true)
    setSaveFailed(false)
    const previousIndex = index
    // Optimistic next card, with one in-flight write and a full rollback on error.
    setIndex(index + 1)
    setRevealed(false)
    try {
      const result = await submitVocabularyAnswer({ progressId: current.progressId, isCorrect, uiLanguage })
      if (!result.success) throw new Error('answer_save_failed')
      lastAnswered.current = current.card.id
    } catch {
      setIndex(previousIndex)
      setRevealed(true)
      setSaveFailed(true)
    } finally {
      busy.current = false
      setPending(false)
    }
    // A failed cache refresh must never undo an answer already committed by the DB.
    if (lastAnswered.current === current.card.id && previousIndex + 1 === session.length) {
      void finishVocabularySession().catch(() => undefined)
    }
  }

  async function submitSentence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!current || busy.current || !answer.length) return
    busy.current = true
    setPending(true)
    setSaveFailed(false)
    try {
      const result = await submitVocabularyAnswer({ progressId: current.progressId, typedAnswer: answer, uiLanguage })
      if (!result.success || typeof result.isCorrect !== 'boolean') throw new Error('sentence_save_failed')
      lastAnswered.current = current.card.id
      setSentenceResult({ correct: result.isCorrect, solution: result.correctAnswer ?? '' })
    } catch {
      setSaveFailed(true)
    } finally {
      busy.current = false
      setPending(false)
    }
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
      progress={session.length ? index / session.length * 100 : 100} onExit={goBack} exitDisabled={pending} t={t}>
      {!current ? <div className="learning-card learning-complete" aria-live="polite">
        <span className="learning-pill">{t('card_progress_compact', { current: index, total: session.length })}</span>
        <h2>{pending ? t('saving_progress') : t('session_done_title')}</h2>
        <p>{t('session_done_text')}</p>
        {plan.deferredCount + initialDeferredCount > 0 && <p>{t('repetition_gap_hint')}</p>}
        <button type="button" className="learning-button learning-button-primary" onClick={goBack} disabled={pending}>{t('lernkasten_back')}</button>
      </div> : <>
        <div className="learning-meta">
          <span className="learning-pill">{t(isSentence ? 'sentence_format' : isToGerman ? 'direction_to_de' : 'direction_from_de')}</span>
          <span>{t('card_progress_compact', { current: index + 1, total: session.length })} · {t('phase_compact', { phase: current.phase })}</span>
        </div>
        <article className="learning-card">
          <motion.div key={current.progressId} tabIndex={0} initial={reducedMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }} className={cn('learning-card-content', denseCard && 'learning-card-content-dense')}>
            {!isSentence && !revealed && current.card.image_url && <img className="learning-card-image" src={current.card.image_url} alt={t('image_alt')} />}
            <span className="learning-eyebrow">{t(isSentence ? 'sentence_format' : 'word_format')}</span>
            <h2 className={cn(isSentence ? 'learning-sentence' : 'learning-word', !isToGerman && articleColorClass(current.card.article))}>{prompt}</h2>
            {isSentence ? sentenceResult && <>
              <div className="learning-divider" />
              <p className={sentenceResult.correct ? 'learning-success' : 'learning-error'} role="status">{t(sentenceResult.correct ? 'sentence_correct' : 'sentence_incorrect')}</p>
              <span className="learning-eyebrow">{t('correct_sentence_label')}</span>
              <p className="learning-sentence" lang="de">{sentenceResult.solution}</p>
            </> : revealed && <>
              <div className="learning-divider" />
              <p className={cn('learning-solution', isToGerman && articleColorClass(current.card.article))}>{isToGerman ? targetWord : current.translation || t('no_translation')}</p>
              {current.contextSentence && <p className="learning-context" lang="de"><span className="sr-only">{t('context_label')}: </span>{current.contextSentence}</p>}
              <SolutionAudioButton text={targetWord ?? ''} audioUrl={current.card.audio_url} label={t('listen_word')} ariaLabel={t('listen_word_aria', { word: current.card.word_de })} variant="secondary" />
            </>}
          </motion.div>
        </article>
        {isSentence ? sentenceResult
          ? <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={advance}>{t(index + 1 === session.length ? 'finish_session' : 'next_card')}</button>
          : <form className="learning-typing" onSubmit={event => void submitSentence(event)}>
            <label htmlFor="german-sentence">{t('type_german')}</label>
            <textarea id="german-sentence" lang="de" value={answer} onChange={event => setAnswer(event.target.value)} rows={2} maxLength={1000} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} aria-describedby="exact-spelling" disabled={pending} />
            <button className="learning-button learning-button-primary" disabled={pending || !answer.length}>{t('check_sentence')}</button>
          </form>
          : revealed ? <div className="learning-actions">
            <button type="button" className="learning-button" disabled={pending} onClick={() => void submitWord(false)}><span>{t('didnt_know')}</span><small>{t('didnt_know_hint')}</small></button>
            <button type="button" className="learning-button learning-button-primary" disabled={pending} onClick={() => void submitWord(true)}><span>{t('knew_it')}</span><small>{t('knew_it_hint')}</small></button>
          </div> : <button type="button" className="learning-button learning-button-primary learning-button-wide" disabled={pending} onClick={() => setRevealed(true)}>{t('reveal_solution')}</button>}
      </>}
      <p id="exact-spelling" role="status" className={cn('learning-status', saveFailed && 'learning-error')}>{saveFailed ? t('save_failed') : pending ? t('saving_progress') : isSentence && !sentenceResult ? t('exact_spelling_hint') : t('assessment_auto_save')}</p>
    </LearningScreen>
  )
}
