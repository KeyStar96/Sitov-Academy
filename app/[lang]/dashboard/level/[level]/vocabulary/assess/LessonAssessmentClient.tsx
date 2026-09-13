'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitLessonAssessment, skipVocabularyAssessment } from '@/app/actions/vocabulary'
import { loadLernkastenSelection, saveLernkastenSelection } from '@/lib/vocabulary-lernkasten'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { VocabularyAssessmentCard, VocabularyDirection } from '@/lib/types/vocabulary'
import { createOrderedWriteQueue, type OrderedWriteQueue } from '@/lib/vocabulary-write-queue'
import { cn, stripLessonPrefix } from '@/lib/utils'
import LearningScreen from '@/components/vocabulary/LearningScreen'

export type AssessmentCard = VocabularyAssessmentCard
interface LessonAssessmentClientProps {
  learnerId: string | null
  cards: AssessmentCard[]
  lessonName: string
  lang: string
  level: string
  translations?: VocabularyTranslations
}

export default function LessonAssessmentClient({ learnerId, cards, lessonName, lang, level, translations = {} }: LessonAssessmentClientProps) {
  const router = useRouter()
  const actorId = useRef(learnerId).current
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  // Separate directions into two passes instead of showing a word's inverse next.
  const [session] = useState(() => [
    ...cards.filter(card => card.direction === 'de_to_native'),
    ...cards.filter(card => card.direction === 'native_to_de'),
  ])
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const resumeIndex = useRef(0)
  const [skipQueued, setSkipQueued] = useState(false)
  const skipRequested = useRef(false)
  const exitRequested = useRef(false)
  const navigated = useRef(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [counts, setCounts] = useState({ known: 0, fresh: 0 })
  const optimisticCounts = useRef({ known: 0, fresh: 0 })
  const confirmedCounts = useRef({ known: 0, fresh: 0 })
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overview = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const current = session[index]
  type AssessmentIntent = { kind: 'decision'; index: number; cardId: string; alreadyKnown: boolean; direction: VocabularyDirection } | { kind: 'skip' }
  type AssessmentResult = { success: boolean; lesson?: string }
  const writes = useRef<OrderedWriteQueue<AssessmentIntent> | null>(null)

  function startTraining(lesson: string) {
    if (navigated.current || !mounted.current) return
    navigated.current = true
    const selected = loadLernkastenSelection(level) ?? []
    saveLernkastenSelection(level, Array.from(new Set([...selected, lesson])))
    router.replace(`${overview}/train?lesson=${encodeURIComponent(lesson)}`)
  }

  function leave() {
    if (navigated.current || !mounted.current) return
    navigated.current = true
    router.push(overview)
  }

  if (!writes.current) writes.current = createOrderedWriteQueue<AssessmentIntent, AssessmentResult>({
    write: item => !actorId ? Promise.resolve({ success: false }) : item.kind === 'skip' ? skipVocabularyAssessment(level, actorId)
      : submitLessonAssessment([{ cardId: item.cardId, alreadyKnown: item.alreadyKnown, direction: item.direction }], actorId),
    accepted: (result, item) => result.success && (item.kind !== 'skip' || !!result.lesson),
    onAccepted: (item, result) => {
      if (item.kind === 'skip') {
        if (!exitRequested.current) startTraining(result.lesson!)
        return
      }
      confirmedCounts.current = { known: confirmedCounts.current.known + Number(item.alreadyKnown), fresh: confirmedCounts.current.fresh + Number(!item.alreadyKnown) }
      if (!item.alreadyKnown) {
        const selected = loadLernkastenSelection(level) ?? []
        saveLernkastenSelection(level, Array.from(new Set([...selected, lessonName])))
      }
    },
    onBlocked: pending => {
      if (!mounted.current) return
      const failed = pending[0]
      if (failed?.kind === 'decision') {
        indexRef.current = failed.index
        setIndex(failed.index)
      }
      setCounts(confirmedCounts.current)
      setSaveFailed(true)
    },
    onDrained: () => {
      if (exitRequested.current) leave()
      else if (indexRef.current === session.length && optimisticCounts.current.fresh > 0) startTraining(lessonName)
    },
  })

  function retry() {
    if (!writes.current?.pending.length) return
    indexRef.current = resumeIndex.current
    setIndex(resumeIndex.current)
    setCounts(optimisticCounts.current)
    setSaveFailed(false)
    writes.current.retry()
  }

  function decide(alreadyKnown: boolean) {
    if (!actorId || !current || index !== indexRef.current || writes.current?.blocked || skipRequested.current) return
    const item: AssessmentIntent = { kind: 'decision', index, cardId: current.id, alreadyKnown, direction: current.direction }
    indexRef.current += 1
    resumeIndex.current = indexRef.current
    setIndex(indexRef.current)
    optimisticCounts.current = { known: optimisticCounts.current.known + Number(alreadyKnown), fresh: optimisticCounts.current.fresh + Number(!alreadyKnown) }
    setCounts(optimisticCounts.current)
    // The UI continues instantly; the queue preserves network ordering and retry intent.
    writes.current?.enqueue(item)
  }

  function skip() {
    if (!actorId || skipRequested.current) return
    skipRequested.current = true
    setSkipQueued(true)
    writes.current?.enqueue({ kind: 'skip' })
    if (writes.current?.blocked) retry()
  }

  function goBack() {
    if (writes.current?.pending.length) {
      exitRequested.current = true
      if (writes.current.blocked) retry()
      return
    }
    leave()
  }

  function finishAssessment() {
    if (optimisticCounts.current.fresh === 0) goBack()
    else if (!writes.current?.pending.length) startTraining(lessonName)
  }

  return (
    <LearningScreen title={t('assess_title')} subtitle={t('lesson_label', { lesson: stripLessonPrefix(lessonName) })}
      progress={session.length ? index / session.length * 100 : 100} onExit={goBack} t={t}>
      {current ? <>
        <div className="learning-meta"><span className="learning-pill">{t(current.direction === 'native_to_de' ? 'direction_to_de' : 'direction_from_de')}</span><span>{t('card_progress_compact', { current: index + 1, total: session.length })}</span></div>
        <div className="learning-card">
          <div className="learning-card-content" aria-live="polite" aria-atomic="true">
            <span className="learning-eyebrow">{t('assessment_word_label')}</span>
            <h2 lang={current.direction === 'native_to_de' ? current.translationLanguage : 'de'} className={cn('learning-word', current.direction === 'de_to_native' && articleColorClass(current.article))}>
              {current.direction === 'native_to_de' ? current.translation : current.article && current.article !== 'none' ? `${current.article} ${current.word_de}` : current.word_de}
            </h2>
          </div>
        </div>
        {saveFailed ? <button className="learning-button learning-button-primary learning-button-wide" onClick={retry}>{t('error_retry')}</button> : <div className="learning-actions">
          <button className="learning-button" onClick={() => decide(false)}>
            <span>{t('add_to_box')}</span><small>{t('add_to_box_hint')}</small>
          </button>
          <button className="learning-button learning-button-primary" onClick={() => decide(true)}>
            <span>{t('already_know')}</span><small>{t('already_know_hint')}</small>
          </button>
        </div>}
      </> : <div className="learning-card learning-complete" aria-live="polite">
        <h2>{t('assess_done_title')}</h2>
        {counts.fresh === 0 && <p>{t('assess_done_summary', { known: counts.known, new: counts.fresh })}</p>}
        <button className="learning-button" onClick={finishAssessment}>{t(counts.fresh > 0 ? 'go_to_training' : 'back_to_overview')}</button>
      </div>}
      <button className="learning-button learning-button-wide" disabled={skipQueued} onClick={skip}>{t('skip_assessment')}</button>
      {saveFailed && <p className="learning-status learning-error" role="status">{t('assess_save_failed')}</p>}
      {saveFailed && !current && <button className="learning-button learning-button-primary" onClick={retry}>{t('error_retry')}</button>}
    </LearningScreen>
  )
}
