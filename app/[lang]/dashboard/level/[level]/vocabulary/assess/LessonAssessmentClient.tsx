'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, CloudOff, PartyPopper, X } from 'lucide-react'
import { submitLessonAssessment } from '@/app/actions/vocabulary'
import { loadLernkastenSelection, saveLernkastenSelection, markVocabularyAutostart } from '@/lib/vocabulary-lernkasten'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { LessonCardView } from '@/lib/types/vocabulary'
import { cn, stripLessonPrefix } from '@/lib/utils'

interface LessonAssessmentClientProps {
  cards: LessonCardView[]
  lessonName: string
  lang: string
  level: string
  translations?: VocabularyTranslations
}

/**
 * Einstufungs-Durchlauf (Pre-Assessment) vor der Übernahme einer Lektion:
 * Der Lernende sieht nur das Fremdwort (kein Übersetzungshinweis) und
 * entscheidet Vokabel für Vokabel, ob sie schon bekannt ist (→ Phase 6)
 * oder neu gelernt werden soll (→ Phase 1, sofort fällig).
 * Jede Entscheidung wird sofort gespeichert, damit ein Abbruch mittendrin
 * keinen Fortschritt kostet.
 */
export default function LessonAssessmentClient({
  cards,
  lessonName,
  lang,
  level,
  translations = {},
}: LessonAssessmentClientProps) {
  const router = useRouter()
  const [sessionCards] = useState(cards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [knownCount, setKnownCount] = useState(0)
  const [newCount, setNewCount] = useState(0)

  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const overviewHref = `/${lang}/dashboard/level/${encodeURIComponent(level)}/vocabulary`
  const currentCard = sessionCards[currentIndex]

  const rememberLessonInLernkasten = useCallback((): void => {
    const saved = loadLernkastenSelection(level) || []
    if (!saved.includes(lessonName)) {
      saveLernkastenSelection(level, [...saved, lessonName])
    }
  }, [level, lessonName])

  const handleDecision = useCallback(
    async (alreadyKnown: boolean): Promise<void> => {
      if (!currentCard || isSubmitting) return
      setIsSubmitting(true)
      setSaveFailed(false)

      try {
        const result = await submitLessonAssessment([{ cardId: currentCard.id, alreadyKnown }])

        if (!result.success) {
          setSaveFailed(true)
          return
        }

        const nextKnownCount = alreadyKnown ? knownCount + 1 : knownCount
        const nextNewCount = alreadyKnown ? newCount : newCount + 1
        const isLastCard = currentIndex >= sessionCards.length - 1

        if (alreadyKnown) {
          setKnownCount(nextKnownCount)
        } else {
          setNewCount(nextNewCount)
        }

        if (isLastCard) {
          rememberLessonInLernkasten()
          if (nextNewCount > 0) {
            markVocabularyAutostart(level)
            router.replace(overviewHref)
          }
        }

        setCurrentIndex((index) => index + 1)
      } catch (err) {
        console.error(`Einstufung für Vokabel ${currentCard.id} konnte nicht gespeichert werden:`, err)
        setSaveFailed(true)
      } finally {
        setIsSubmitting(false)
      }
    },
    [
      currentCard,
      currentIndex,
      isSubmitting,
      knownCount,
      newCount,
      overviewHref,
      rememberLessonInLernkasten,
      router,
      sessionCards.length,
      level,
    ]
  )

  useEffect(() => {
    if (currentCard) return
    rememberLessonInLernkasten()
  }, [currentCard, rememberLessonInLernkasten])

  if (!currentCard) {
    if (newCount > 0) {
      return (
        <div className="mx-auto mt-2 flex min-h-[20rem] max-w-2xl flex-col items-center justify-center rounded-3xl border-2 border-blue-200 bg-blue-50 p-6 text-center shadow-sm sm:p-12">
          <p className="text-2xl font-bold text-blue-900">{t('loading')}</p>
        </div>
      )
    }

    return (
      <div className="mx-auto mt-2 max-w-2xl rounded-3xl border-2 border-green-200 bg-green-50 p-6 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-10 w-10 text-green-600" aria-hidden="true" />
        </div>
        <h2 className="text-3xl font-bold text-green-900">{t('assess_done_title')}</h2>
        <p className="mt-3 text-xl text-green-800">
          {t('assess_done_summary', { known: knownCount, new: newCount })}
        </p>
        <p className="mt-2 text-lg text-green-800/80">{t('assess_done_hint')}</p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            href={overviewHref}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-green-700 px-8 py-4 text-xl font-bold text-white shadow-md transition-colors hover:bg-green-600 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
          >
            {t('back_to_overview')}
          </Link>
        </div>
      </div>
    )
  }

  const displayWord =
    currentCard.article && currentCard.article !== 'none'
      ? `${currentCard.article} ${currentCard.word_de}`
      : currentCard.word_de

  return (
    <div className="mx-auto mt-2 max-w-2xl">
      <div className="mb-6 flex min-h-8 flex-col gap-3 text-lg font-medium text-gray-600 sm:flex-row sm:items-center sm:justify-between">
        <span>{t('lesson_label', { lesson: stripLessonPrefix(lessonName) })}</span>
        <span className="tabular-nums">
          {t('card_progress', { current: currentIndex + 1, total: sessionCards.length })}
        </span>
      </div>

      <div className="flex h-64 flex-col items-center justify-center overflow-hidden rounded-3xl bg-white p-6 text-center shadow-xl ring-1 ring-gray-900/10 sm:h-72 sm:p-10">
        <span
          className={cn(
            'line-clamp-3 max-w-full break-words px-2 text-3xl font-extrabold sm:text-5xl',
            articleColorClass(currentCard.article)
          )}
        >
          {displayWord}
        </span>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:gap-6">
        <button
          type="button"
          onClick={() => void handleDecision(true)}
          disabled={isSubmitting}
          className="flex min-h-16 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-green-300 bg-green-50 py-6 text-green-800 transition-colors hover:bg-green-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
        >
          <Check size={36} className="mb-2" aria-hidden="true" />
          <span className="text-xl font-bold">{t('already_know')}</span>
          <span className="mt-1 text-base opacity-90">{t('already_know_hint')}</span>
        </button>

        <button
          type="button"
          onClick={() => void handleDecision(false)}
          disabled={isSubmitting}
          className="flex min-h-16 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-blue-300 bg-blue-50 py-6 text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
        >
          <X size={36} className="mb-2" aria-hidden="true" />
          <span className="text-xl font-bold">{t('add_to_box')}</span>
          <span className="mt-1 text-base opacity-90">{t('add_to_box_hint')}</span>
        </button>
      </div>

      <div className="mt-6 min-h-16" aria-live="polite">
        {saveFailed && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4"
          >
            <CloudOff className="h-6 w-6 shrink-0 text-gray-500" aria-hidden="true" />
            <p className="text-lg text-gray-600">{t('assess_save_failed')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
