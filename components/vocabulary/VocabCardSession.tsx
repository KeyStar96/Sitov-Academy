'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, CloudOff, Image as ImageIcon, PartyPopper, X } from 'lucide-react'
import SolutionAudioButton from '@/components/exercises/SolutionAudioButton'
import { finishVocabularySession, submitVocabularyAnswer } from '@/app/actions/vocabulary'
import {
  createVocabularyTranslator,
  type VocabularyTranslations,
  type VocabularyTranslator,
} from '@/lib/vocabulary-i18n'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import { cn, stripLessonPrefix } from '@/lib/utils'

interface VocabCardSessionProps {
  /** Bereits nach Lernkasten-Auswahl gefilterte, fällige Karten. */
  cards: DueVocabularyCard[]
  translations?: VocabularyTranslations
  overviewHref: string
  /** Zurück zur Lernkasten-Zusammenstellung. */
  onBackToLernkasten: () => void
}

/** Dauer der Exit-Animation. Danach wird sofort die vorgerenderte Karte aktiv. */
const EXIT_MS = 260

type ExitDirection = 'left' | 'right' | null
type QuizDirection = 'native-to-target' | 'target-to-native'

/** Feste Kartenhöhe – Vorder- und Rückseite sowie Folgekarte teilen denselben Slot. */
const CARD_SHELL_CLASS = 'flex h-[36rem] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-gray-900/10 dark:bg-slate-900 dark:ring-slate-800 sm:h-[42rem]'
const CARD_FRONT_CLASS = 'flex h-[14.5rem] shrink-0 flex-col items-center justify-center border-b border-gray-100 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 sm:h-[18rem] sm:p-8'
const CARD_BACK_CLASS = 'flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto bg-white p-4 dark:bg-slate-900 sm:p-8'
const IMAGE_BOX_CLASS = 'mb-3 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-200 shadow-inner dark:bg-slate-800 sm:mb-6 sm:h-36 sm:w-36'

/** Deutsches Wort inkl. Artikel, wie es aufgedeckt angezeigt wird. */
function toDisplayWord(card: DueVocabularyCard['card']): string {
  return card.article && card.article !== 'none' ? `${card.article} ${card.word_de}` : card.word_de
}

/**
 * Vorderseite (Muttersprache + Bild). Wird sowohl für die aktive Karte als auch
 * für die vorgerenderte nächste Karte im Stapel verwendet – so ist das Bild der
 * Folgekarte bereits dekodiert, sobald sie aktiv wird.
 */
function CardFront({ item, t, direction }: { item: DueVocabularyCard; t: VocabularyTranslator; direction: QuizDirection }) {
  const { card } = item
  const displayWord = direction === 'native-to-target'
    ? (item.translation || t('no_translation'))
    : toDisplayWord(card)

  return (
    <div className={CARD_FRONT_CLASS}>
      <div className={IMAGE_BOX_CLASS}>
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={t('image_alt')}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon size={40} className="text-gray-400 dark:text-slate-500" aria-hidden="true" />
        )}
      </div>

      <h2 className={cn(
        'flex min-h-[3.5rem] w-full items-center justify-center px-2 text-center text-xl font-bold sm:min-h-[4.5rem] sm:text-3xl',
        direction === 'target-to-native' ? articleColorClass(card.article) : 'text-gray-800 dark:text-slate-200'
      )}>
        <span className="line-clamp-2 break-words">{displayWord}</span>
      </h2>
    </div>
  )
}

function CardShell({ children }: { children: ReactNode }) {
  return <div className={CARD_SHELL_CLASS}>{children}</div>
}

export default function VocabCardSession({
  cards,
  translations = {},
  overviewHref,
  onBackToLernkasten,
}: VocabCardSessionProps) {
  /** Snapshot, damit ein Server-Refresh die laufende Session nicht umsortiert. */
  const [session] = useState<DueVocabularyCard[]>(cards)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRevealed, setIsRevealed] = useState(false)
  /** Solange gesetzt, läuft die Exit-Animation der aktuellen Karte. */
  const [exitDirection, setExitDirection] = useState<ExitDirection>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [quizDirection, setQuizDirection] = useState<QuizDirection>('native-to-target')
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const currentCard = session[currentIndex]
  const nextCard = session[currentIndex + 1]

  /**
   * Pre-Rendering-Absicherung: Bilder der nächsten beiden Karten vorab in den
   * Browser-Cache holen, damit beim Kartenwechsel keine Ladezeit entsteht.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    for (const offset of [1, 2]) {
      const url = session[currentIndex + offset]?.card.image_url
      if (url) {
        const preload = new window.Image()
        preload.decoding = 'async'
        preload.src = url
      }
    }
  }, [currentIndex, session])

  /** Aufräumen: laufenden Exit-Timer beim Unmount stoppen. */
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
  }, [])

  const handleAnswer = useCallback(
    (isCorrect: boolean): void => {
      if (exitDirection !== null || !currentCard) return

      const nextIndex = currentIndex + 1

      setSaveFailed(false)
      void submitVocabularyAnswer({ progressId: currentCard.progressId, isCorrect })
        .then((result) => {
          if (!result.success) setSaveFailed(true)
        })
        .catch((err) => {
          console.error('Antwort konnte nicht gespeichert werden:', err)
          setSaveFailed(true)
        })

      setExitDirection(isCorrect ? 'right' : 'left')

      exitTimerRef.current = setTimeout(() => {
        setCurrentIndex(nextIndex)
        setIsRevealed(false)
        setExitDirection(null)

        if (nextIndex >= session.length) {
          void finishVocabularySession().catch(() => {
            // Die Übersicht aktualisiert sich dann beim nächsten Seitenaufruf.
          })
        }
      }, EXIT_MS)
    },
    [currentCard, currentIndex, exitDirection, session.length]
  )

  if (!currentCard) {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-3xl border-2 border-green-200 bg-green-50 p-6 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <PartyPopper className="h-10 w-10 text-green-600" aria-hidden="true" />
        </div>
        <h2 className="text-3xl font-bold text-green-900">{t('session_done_title')}</h2>
        <p className="mt-3 text-xl text-green-800">{t('session_done_text')}</p>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onBackToLernkasten}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-green-700 px-8 py-4 text-xl font-bold text-white shadow-md transition-colors hover:bg-green-600 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
          >
            {t('lernkasten_back')}
          </button>
          <Link
            href={overviewHref}
            className="inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-green-300 bg-white px-8 py-4 text-xl font-bold text-green-800 shadow-sm transition-colors hover:bg-green-50"
          >
            {t('back_to_overview')}
          </Link>
        </div>
      </div>
    )
  }

  const displayTargetWord = toDisplayWord(currentCard.card)
  const displayNativeWord = currentCard.translation || t('no_translation')
  const isExiting = exitDirection !== null

  const metaLine = [
    t('lesson_label', { lesson: stripLessonPrefix(currentCard.card.lesson) }),
    t('card_progress_compact', { current: currentIndex + 1, total: session.length }),
    t('phase_compact', { phase: currentCard.phase }),
  ].join(' • ')

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-2xl flex-col sm:min-h-[calc(100dvh-9rem)]">
      <div className="flex h-11 shrink-0 items-center gap-2 pb-2">
        <button
          type="button"
          onClick={onBackToLernkasten}
          aria-label={t('lernkasten_back')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-blue-600 transition-colors hover:bg-blue-50 active:bg-blue-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:text-blue-400 dark:hover:bg-blue-950 dark:active:bg-blue-900"
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-gray-600 dark:text-slate-400 sm:text-base">
          {metaLine}
        </p>
        <button
          type="button"
          onClick={() => setQuizDirection((prev) => (prev === 'native-to-target' ? 'target-to-native' : 'native-to-target'))}
          title="Abfragerichtung ändern"
          aria-label="Abfragerichtung ändern"
          className="flex h-11 shrink-0 items-center justify-center rounded-full bg-blue-50 px-3 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-100 active:bg-blue-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:bg-blue-950 dark:text-blue-400 dark:hover:bg-blue-900 dark:active:bg-blue-800"
        >
          {quizDirection === 'native-to-target' ? '🌍 ➔ 🇩🇪' : '🇩🇪 ➔ 🌍'}
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        <div className="grid h-[36rem] w-full sm:h-[42rem]">
          {nextCard && (
            <div
              key={nextCard.progressId}
              aria-hidden="true"
              className="z-0 [grid-area:1/1]"
            >
              <CardShell>
                <CardFront item={nextCard} t={t} direction={quizDirection} />
                <div className={CARD_BACK_CLASS}>
                  <div className="w-full rounded-2xl bg-blue-600 py-4 text-center text-xl font-bold text-white shadow-md sm:py-6 sm:text-2xl">
                    {t('reveal_solution')}
                  </div>
                </div>
              </CardShell>
            </div>
          )}

          <div
            key={currentCard.progressId}
            className={cn(
              'z-10 [grid-area:1/1] transition-[transform,opacity] duration-[260ms] ease-in will-change-transform motion-reduce:transition-none',
              exitDirection === 'right' && 'translate-x-[130%] rotate-[8deg] opacity-0',
              exitDirection === 'left' && '-translate-x-[130%] -rotate-[8deg] opacity-0'
            )}
          >
            <CardShell>
              <CardFront item={currentCard} t={t} direction={quizDirection} />

              <div className={CARD_BACK_CLASS}>
                {isRevealed ? (
                  <>
                    <span
                      className={cn(
                        'line-clamp-2 break-words text-center text-2xl font-extrabold sm:text-4xl',
                        quizDirection === 'native-to-target' ? articleColorClass(currentCard.card.article) : 'text-gray-800 dark:text-slate-200'
                      )}
                    >
                      {quizDirection === 'native-to-target' ? displayTargetWord : displayNativeWord}
                    </span>

                    <p className="mt-1 min-h-[1.75rem] text-lg text-gray-500 dark:text-slate-400 sm:mt-2 sm:min-h-[2rem] sm:text-xl">
                      {quizDirection === 'native-to-target' && currentCard.card.plural
                        ? t('plural_label', { plural: currentCard.card.plural })
                        : '\u00a0'}
                    </p>

                    <div className="mt-3 sm:mt-4">
                      <SolutionAudioButton
                        text={displayTargetWord}
                        audioUrl={currentCard.card.audio_url}
                        label={t('listen_word')}
                        ariaLabel={t('listen_word_aria', { word: currentCard.card.word_de })}
                        variant="secondary"
                      />
                    </div>

                    <div className="mt-4 flex w-full flex-col gap-3 sm:mt-6 sm:flex-row sm:gap-4">
                      <button
                        type="button"
                        onClick={() => handleAnswer(false)}
                        disabled={isExiting}
                        className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-amber-300 bg-amber-50 py-3 text-amber-800 transition-colors hover:bg-amber-100 active:bg-amber-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] sm:min-h-16 sm:py-4 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-500 dark:hover:bg-amber-900/50 dark:active:bg-amber-900/80"
                      >
                        <X size={28} className="mb-0.5 sm:mb-1" aria-hidden="true" />
                        <span className="text-lg font-bold sm:text-xl">{t('didnt_know')}</span>
                        <span className="mt-0.5 text-sm opacity-90 sm:mt-1 sm:text-base">{t('didnt_know_hint')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAnswer(true)}
                        disabled={isExiting}
                        className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-2xl border-2 border-green-300 bg-green-50 py-3 text-green-800 transition-colors hover:bg-green-100 active:bg-green-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] sm:min-h-16 sm:py-4 dark:border-green-700/50 dark:bg-green-950/30 dark:text-green-500 dark:hover:bg-green-900/50 dark:active:bg-green-900/80"
                      >
                        <Check size={28} className="mb-0.5 sm:mb-1" aria-hidden="true" />
                        <span className="text-lg font-bold sm:text-xl">{t('knew_it')}</span>
                        <span className="mt-0.5 text-sm opacity-90 sm:mt-1 sm:text-base">{t('knew_it_hint')}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsRevealed(true)}
                    disabled={isExiting}
                    className="w-full rounded-2xl bg-blue-600 py-4 text-xl font-bold text-white shadow-md transition-all hover:bg-blue-500 hover:shadow-lg active:bg-blue-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] sm:py-6 sm:text-2xl"
                  >
                    {t('reveal_solution')}
                  </button>
                )}
              </div>
            </CardShell>
          </div>
        </div>
      </div>

      <div className="min-h-14" aria-live="polite">
        {saveFailed && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4"
          >
            <CloudOff className="h-6 w-6 shrink-0 text-gray-500" aria-hidden="true" />
            <p className="text-base text-gray-600 sm:text-lg">{t('save_failed')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
