'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitLessonAssessment, skipVocabularyAssessment } from '@/app/actions/vocabulary'
import { loadLernkastenSelection, saveLernkastenSelection } from '@/lib/vocabulary-lernkasten'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { LessonCardView } from '@/lib/types/vocabulary'
import { cn, stripLessonPrefix } from '@/lib/utils'
import LearningScreen from '@/components/vocabulary/LearningScreen'

export type AssessmentCard = Pick<LessonCardView, 'id' | 'word_de' | 'article'>
interface LessonAssessmentClientProps {
  cards: AssessmentCard[]
  lessonName: string
  lang: string
  level: string
  translations?: VocabularyTranslations
}

export default function LessonAssessmentClient({ cards, lessonName, lang, level, translations = {} }: LessonAssessmentClientProps) {
  const router = useRouter()
  const [session] = useState(cards)
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [counts, setCounts] = useState({ known: 0, fresh: 0 })
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overview = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const current = session[index]

  function startTraining(lesson: string) {
    const selected = loadLernkastenSelection(level) ?? []
    saveLernkastenSelection(level, Array.from(new Set([...selected, lesson])))
    router.replace(`${overview}/train?lesson=${encodeURIComponent(lesson)}`)
  }

  async function decide(alreadyKnown: boolean) {
    if (!current || busy.current) return
    busy.current = true
    setPending(true)
    setSaveFailed(false)
    const previousIndex = index
    const previousCounts = counts
    const nextCounts = { known: counts.known + Number(alreadyKnown), fresh: counts.fresh + Number(!alreadyKnown) }
    // Show the next word immediately, but serialize writes and restore on failure.
    setIndex(index + 1)
    setCounts(nextCounts)
    try {
      const result = await submitLessonAssessment([{ cardId: current.id, alreadyKnown }])
      if (!result.success) throw new Error('assessment_save_failed')
      if (!alreadyKnown) {
        const selected = loadLernkastenSelection(level) ?? []
        saveLernkastenSelection(level, Array.from(new Set([...selected, lessonName])))
      }
      if (previousIndex + 1 === session.length && nextCounts.fresh > 0) startTraining(lessonName)
    } catch {
      setIndex(previousIndex)
      setCounts(previousCounts)
      setSaveFailed(true)
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  async function skip() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setSaveFailed(false)
    try {
      const result = await skipVocabularyAssessment(level)
      if (!result.success || !result.lesson) throw new Error('assessment_skip_failed')
      startTraining(result.lesson)
    } catch {
      setSaveFailed(true)
      busy.current = false
      setPending(false)
    }
  }

  return (
    <LearningScreen title={t('assess_title')} subtitle={t('lesson_label', { lesson: stripLessonPrefix(lessonName) })}
      progress={session.length ? index / session.length * 100 : 100} onExit={() => router.push(overview)} exitDisabled={pending} t={t}>
      {current ? <>
        <div className="learning-meta"><span>{t('assess_subtitle')}</span><span>{t('card_progress_compact', { current: index + 1, total: session.length })}</span></div>
        <div className="learning-card">
          <div className="learning-card-content" aria-live="polite" aria-atomic="true">
            <span className="learning-eyebrow">{t('assessment_word_label')}</span>
            <h2 className={cn('learning-word', articleColorClass(current.article))}>
              {current.article && current.article !== 'none' ? `${current.article} ${current.word_de}` : current.word_de}
            </h2>
          </div>
        </div>
        <div className="learning-actions">
          <button className="learning-button" disabled={pending} onClick={() => void decide(false)}>
            <span>{t('add_to_box')}</span><small>{t('add_to_box_hint')}</small>
          </button>
          <button className="learning-button learning-button-primary" disabled={pending} onClick={() => void decide(true)}>
            <span>{t('already_know')}</span><small>{t('already_know_hint')}</small>
          </button>
        </div>
      </> : <div className="learning-card learning-complete" aria-live="polite">
        <h2>{pending || counts.fresh > 0 ? t('loading') : t('assess_done_title')}</h2>
        {!pending && counts.fresh === 0 && <p>{t('assess_done_summary', { known: counts.known, new: counts.fresh })}</p>}
        {!pending && <button className="learning-button" onClick={() => counts.fresh > 0 ? startTraining(lessonName) : router.push(overview)}>{t(counts.fresh > 0 ? 'go_to_training' : 'back_to_overview')}</button>}
      </div>}
      <button className="learning-button learning-button-wide" disabled={pending} onClick={() => void skip()}>{t('skip_assessment')}</button>
      <p className={cn('learning-status', saveFailed && 'learning-error')} role="status">{saveFailed ? t('assess_save_failed') : pending ? t('saving_progress') : t('assessment_auto_save')}</p>
    </LearningScreen>
  )
}
