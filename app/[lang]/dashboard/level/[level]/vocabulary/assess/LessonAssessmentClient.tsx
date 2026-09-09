'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, CloudOff, Image as ImageIcon, PartyPopper, X } from 'lucide-react'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
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

const CARD_SHELL_CLASS =
  'flex h-[36rem] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-gray-900/10 dark:bg-slate-900 dark:ring-slate-800 sm:h-[42rem]'
const CARD_FRONT_CLASS =
  'flex h-[14.5rem] shrink-0 flex-col items-center justify-center border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 sm:h-[18rem] sm:p-8'
const CARD_BACK_CLASS =
  'flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-white p-4 dark:bg-slate-900 sm:p-8'
const IMAGE_BOX_CLASS =
  'mb-3 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-200 shadow-inner dark:bg-slate-800 sm:mb-6 sm:h-36 sm:w-36'

function toDisplayWord(card: LessonCardView): string {
  return card.article && card.article !== 'none' ? `${card.article} ${card.word_de}` : card.word_de
}

/**
 * Einstufungs-Durchlauf vor der Übernahme einer Lektion.
 * Ablauf wie in der Lernbox: zuerst die Übersetzung (Oberflächensprache),
 * dann „Lösung aufdecken“, danach die Entscheidung Phase 6 oder Lernkasten.
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
  const [isRevealed, setIsRevealed] = useState(false)
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    for (const offset of [1, 2]) {
      const url = sessionCards[currentIndex + offset]?.image_url
      if (url) {
        const preload = new window.Image()
        preload.decoding = 'async'
        preload.src = url
      }
    }
  }, [currentIndex, sessionCards])

  const handleDecision = useCallback(
    async (alreadyKnown: boolean): Promise<void> => {
      if (!currentCard || isSubmitting || !isRevealed) return
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

        setIsRevealed(false)
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
      isRevealed,
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

  const displayNativeWord = currentCard.translation || t('no_translation')
  const displayTargetWord = toDisplayWord(currentCard)

  return (
    <div className="mx-auto mt-2 max-w-2xl">
      <div className="mb-6 flex min-h-8 flex-col gap-3 text-lg font-medium text-gray-600 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>{t('lesson_label', { lesson: stripLessonPrefix(lessonName) })}</span>
        <span className="tabular-nums">
          {t('card_progress', { current: currentIndex + 1, total: sessionCards.length })}
        </span>
      </div>

      <div className={CARD_SHELL_CLASS}>
        <div className={CARD_FRONT_CLASS}>
          <div className={IMAGE_BOX_CLASS}>
            {currentCard.image_url ? (
              <img
                src={currentCard.image_url}
                alt={t('image_alt')}
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon size={40} className="text-gray-400 dark:text-slate-500" aria-hidden="true" />
            )}
          </div>
          <h2 className="flex min-h-[3.75rem] w-full items-center justify-center px-2 py-1 text-center text-xl font-bold leading-snug text-gray-800 dark:text-slate-200 sm:min-h-[4.75rem] sm:text-3xl">
            <span className="inline-block max-w-full overflow-visible break-words">{displayNativeWord}</span>
          </h2>
        </div>

        <div className={CARD_BACK_CLASS}>
          {isRevealed ? (
            <>
              <span
                className={cn(
                  'max-w-full overflow-visible break-words px-1 py-1 text-center text-2xl font-extrabold leading-snug sm:text-4xl',
                  articleColorClass(currentCard.article)
                )}
              >
                {displayTargetWord}
              </span>

              <p className="mt-1 min-h-[1.75rem] text-lg text-gray-500 dark:text-slate-400 sm:mt-2 sm:min-h-[2rem] sm:text-xl">
                {currentCard.plural ? t('plural_label', { plural: currentCard.plural }) : '\u00a0'}
              </p>

              <div className="mt-3 sm:mt-4">
                <SolutionAudioButton
                  text={displayTargetWord}
                  audioUrl={currentCard.audio_url}
                  label={t('listen_word')}
                  ariaLabel={t('listen_word_aria', { word: currentCard.word_de })}
                  variant="secondary"
                />
              </div>

              <div className="mt-4 flex w-full flex-col gap-3 sm:mt-6 sm:flex-row sm:gap-4">
                <button
                  type="button"
                  onClick={() => void handleDecision(false)}
                  disabled={isSubmitting}
                  className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-blue-300 bg-blue-50 py-3 text-blue-800 transition-colors hover:bg-blue-100 active:bg-blue-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] sm:min-h-16 sm:py-4 dark:border-blue-700/50 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-900/50"
                >
                  <X size={28} className="mb-0.5 sm:mb-1" aria-hidden="true" />
                  <span className="text-lg font-bold sm:text-xl">{t('add_to_box')}</span>
                  <span className="mt-0.5 text-sm opacity-90 sm:mt-1 sm:text-base">{t('add_to_box_hint')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleDecision(true)}
                  disabled={isSubmitting}
                  className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-green-300 bg-green-50 py-3 text-green-800 transition-colors hover:bg-green-100 active:bg-green-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] sm:min-h-16 sm:py-4 dark:border-green-700/50 dark:bg-green-950/30 dark:text-green-500 dark:hover:bg-green-900/50"
                >
                  <Check size={28} className="mb-0.5 sm:mb-1" aria-hidden="true" />
                  <span className="text-lg font-bold sm:text-xl">{t('already_know')}</span>
                  <span className="mt-0.5 text-sm opacity-90 sm:mt-1 sm:text-base">{t('already_know_hint')}</span>
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsRevealed(true)}
              disabled={isSubmitting}
              className="w-full min-h-14 rounded-2xl bg-blue-600 py-4 text-xl font-bold text-white shadow-md transition-all hover:bg-blue-500 hover:shadow-lg active:bg-blue-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] sm:min-h-16 sm:py-6 sm:text-2xl"
            >
              {t('reveal_solution')}
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 min-h-16" aria-live="polite">
        {saveFailed && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800"
          >
            <CloudOff className="h-6 w-6 shrink-0 text-gray-500" aria-hidden="true" />
            <p className="text-lg text-gray-600 dark:text-slate-300">{t('assess_save_failed')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
