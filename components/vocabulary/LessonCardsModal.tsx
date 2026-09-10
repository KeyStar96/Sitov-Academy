'use client'

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type WheelEvent } from 'react'
import { CloudOff, Loader2, Plus, Trash2, X } from 'lucide-react'
import { addCardsToTrainer, getLessonCards, resetLessonProgress } from '@/app/actions/vocabulary'
import {
  addCustomVocabulary,
  loadCustomVocabulary,
  removeCustomVocabulary,
  type CustomVocabularyCard,
} from '@/lib/vocabulary-custom'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { articleColorClass, phaseBadgeClasses } from '@/lib/vocabulary-ui'
import type { LessonCardView } from '@/lib/types/vocabulary'
import { cn } from '@/lib/utils'
import PhaseDistributionChart from '@/components/vocabulary/PhaseDistributionChart'

type CardsState = 'loading' | 'error' | LessonCardView[]
type ModalTab = 'words' | 'phases'

interface DisplayCard {
  id: string
  word_de: string
  article: string | null
  translation: string
  phase: LessonCardView['phase']
  isLearned: boolean
  isCustom: boolean
}

function toDisplayCard(card: LessonCardView | CustomVocabularyCard): DisplayCard {
  return {
    id: card.id,
    word_de: card.word_de,
    article: 'article' in card ? card.article : null,
    translation: card.translation,
    phase: card.phase,
    isLearned: card.isLearned,
    isCustom: 'isCustom' in card && card.isCustom === true,
  }
}

/**
 * Vokabelliste einer Lektion als Overlay mit Tabs.
 *
 * Scroll-Vertrag: Der Dialog ist `flex flex-col` mit `max-h-[calc(100vh-6rem)]`.
 * Header (Titel, Tabs, Schließen) bleibt `flex-shrink-0`. Der Inhalt darunter
 * bekommt `flex-1 min-h-0 overflow-y-auto overscroll-contain` plus
 * `data-lenis-prevent`, damit Lenis (Desktop-Smooth-Scroll) Trackpad- und
 * Mausrad-Gesten nicht schluckt.
 */
export default function LessonCardsModal({
  lesson,
  level,
  translations = {},
  onClose,
  onCardAdded,
}: {
  lesson: string
  level: string
  translations?: VocabularyTranslations
  onClose: () => void
  /** Wird nach erfolgreicher manueller Übernahme aufgerufen, damit die Lektionsliste dahinter aktualisiert. */
  onCardAdded: () => void
}) {
  const t = createVocabularyTranslator(translations)
  const tabIds = useId()
  const wordsTabId = `${tabIds}-words`
  const phasesTabId = `${tabIds}-phases`
  const wordsPanelId = `${tabIds}-words-panel`
  const phasesPanelId = `${tabIds}-phases-panel`

  const [cardsState, setCardsState] = useState<CardsState>('loading')
  const [customCards, setCustomCards] = useState<CustomVocabularyCard[]>([])
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const [addFailed, setAddFailed] = useState(false)
  const [activeTab, setActiveTab] = useState<ModalTab>('words')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customWord, setCustomWord] = useState('')
  const [customTranslation, setCustomTranslation] = useState('')
  const [customError, setCustomError] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    setCustomCards(loadCustomVocabulary(level, lesson))
  }, [level, lesson])

  useEffect(() => {
    let cancelled = false
    setCardsState('loading')

    void getLessonCards(lesson, level)
      .then((cards) => {
        if (!cancelled) setCardsState(cards)
      })
      .catch((err) => {
        console.error(`Vokabeln der Lektion "${lesson}" konnten nicht geladen werden:`, err)
        if (!cancelled) setCardsState('error')
      })

    return () => {
      cancelled = true
    }
  }, [lesson, level])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const displayCards = useMemo((): DisplayCard[] => {
    const serverCards = Array.isArray(cardsState) ? cardsState.map(toDisplayCard) : []
    return [...customCards.map(toDisplayCard), ...serverCards]
  }, [cardsState, customCards])

  const handleAddSingleCard = useCallback(
    async (cardId: string) => {
      setPendingCardId(cardId)
      setAddFailed(false)
      try {
        const result = await addCardsToTrainer([cardId])
        if (!result.success) {
          setAddFailed(true)
          return
        }
        setCardsState((prev) =>
          Array.isArray(prev)
            ? prev.map((card) => (card.id === cardId ? { ...card, phase: 1, isLearned: false } : card))
            : prev
        )
        onCardAdded()
      } catch (err) {
        console.error(`Vokabel ${cardId} konnte nicht manuell übernommen werden:`, err)
        setAddFailed(true)
      } finally {
        setPendingCardId(null)
      }
    },
    [onCardAdded]
  )

  const handleSaveCustom = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const word = customWord.trim()
      const translation = customTranslation.trim()
      if (!word || !translation) {
        setCustomError(true)
        return
      }

      try {
        const updated = addCustomVocabulary(level, lesson, word, translation)
        setCustomCards(updated)
        setCustomWord('')
        setCustomTranslation('')
        setCustomError(false)
        setShowCustomForm(false)
      } catch (err) {
        console.error(`Eigene Vokabel für Lektion "${lesson}" konnte nicht gespeichert werden:`, err)
        setCustomError(true)
      }
    },
    [customTranslation, customWord, lesson, level]
  )

  const handleRemoveCustom = useCallback(
    (cardId: string) => {
      try {
        setCustomCards(removeCustomVocabulary(level, lesson, cardId))
      } catch (err) {
        console.error(`Eigene Vokabel ${cardId} konnte nicht gelöscht werden:`, err)
      }
    },
    [lesson, level]
  )

  const handleResetProgress = useCallback(async () => {
    setIsResetting(true)
    try {
      const result = await resetLessonProgress(lesson, level)
      if (result.success) {
        // Refresh cards
        const cards = await getLessonCards(lesson, level)
        setCardsState(cards)
        setShowResetConfirm(false)
        onCardAdded() // trigger parent refresh
      } else {
        console.error('Fehler beim Zurücksetzen des Fortschritts')
      }
    } catch (err) {
      console.error('Unerwarteter Fehler beim Zurücksetzen:', err)
    } finally {
      setIsResetting(false)
    }
  }, [lesson, level, onCardAdded])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onWheel={(event: WheelEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) event.preventDefault()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={lesson}
        data-lenis-prevent
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        className="flex max-h-[calc(100vh-6rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex shrink-0 flex-col border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-4 p-5 pb-3">
            <h3 className="min-w-0 truncate text-xl font-bold text-gray-900 dark:text-slate-100">
              {lesson}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close_cards')}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>

          <div
            role="tablist"
            aria-label={t('modal_tabs_aria')}
            className="flex gap-2 px-5 pb-4"
          >
            <button
              type="button"
              role="tab"
              id={wordsTabId}
              aria-controls={wordsPanelId}
              aria-selected={activeTab === 'words'}
              tabIndex={activeTab === 'words' ? 0 : -1}
              onClick={() => setActiveTab('words')}
              className={cn(
                'inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl px-4 text-lg font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]',
                activeTab === 'words'
                  ? 'bg-[#FF5C00] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {t('tab_words')}
            </button>
            <button
              type="button"
              role="tab"
              id={phasesTabId}
              aria-controls={phasesPanelId}
              aria-selected={activeTab === 'phases'}
              tabIndex={activeTab === 'phases' ? 0 : -1}
              onClick={() => setActiveTab('phases')}
              className={cn(
                'inline-flex min-h-12 flex-1 items-center justify-center rounded-2xl px-4 text-lg font-bold transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]',
                activeTab === 'phases'
                  ? 'bg-[#FF5C00] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              )}
            >
              {t('tab_phases')}
            </button>
          </div>
        </div>

        <div
          data-lenis-prevent
          className="modal-scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6"
        >
          {activeTab === 'words' && (
            <div role="tabpanel" id={wordsPanelId} aria-labelledby={wordsTabId}>
              {cardsState === 'loading' && (
                <p className="flex items-center gap-3 text-lg text-gray-600 dark:text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  {t('cards_loading')}
                </p>
              )}

              {cardsState === 'error' && (
                <p className="flex items-center gap-3 text-lg text-gray-600 dark:text-slate-400">
                  <CloudOff className="h-6 w-6 shrink-0" aria-hidden="true" />
                  {t('cards_load_failed')}
                </p>
              )}

              {Array.isArray(cardsState) && (
                <div className="space-y-4">
                  {showCustomForm ? (
                    <form
                      onSubmit={handleSaveCustom}
                      className="space-y-4 rounded-2xl border-2 border-[#FF5C00]/30 bg-orange-50 p-4 dark:border-orange-900 dark:bg-orange-950/30"
                    >
                      <div>
                        <label htmlFor={`${tabIds}-custom-word`} className="mb-2 block text-lg font-bold text-gray-900 dark:text-slate-100">
                          {t('custom_vocab_word_label')}
                        </label>
                        <input
                          id={`${tabIds}-custom-word`}
                          type="text"
                          value={customWord}
                          onChange={(event) => {
                            setCustomWord(event.target.value)
                            setCustomError(false)
                          }}
                          placeholder={t('custom_vocab_word_placeholder')}
                          autoComplete="off"
                          className="min-h-14 w-full rounded-2xl border-2 border-gray-300 bg-white px-4 text-lg text-gray-900 placeholder:text-gray-400 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label htmlFor={`${tabIds}-custom-translation`} className="mb-2 block text-lg font-bold text-gray-900 dark:text-slate-100">
                          {t('custom_vocab_translation_label')}
                        </label>
                        <input
                          id={`${tabIds}-custom-translation`}
                          type="text"
                          value={customTranslation}
                          onChange={(event) => {
                            setCustomTranslation(event.target.value)
                            setCustomError(false)
                          }}
                          placeholder={t('custom_vocab_translation_placeholder')}
                          autoComplete="off"
                          className="min-h-14 w-full rounded-2xl border-2 border-gray-300 bg-white px-4 text-lg text-gray-900 placeholder:text-gray-400 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </div>
                      {customError && (
                        <p role="alert" className="text-lg font-medium text-amber-800 dark:text-amber-300">
                          {t('custom_vocab_error')}
                        </p>
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="submit"
                          className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-[#FF5C00] px-6 text-lg font-bold text-white shadow-sm transition-colors hover:bg-[#E65000] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
                        >
                          {t('custom_vocab_save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomForm(false)
                            setCustomError(false)
                          }}
                          className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl border-2 border-gray-300 bg-white px-6 text-lg font-bold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {t('custom_vocab_cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCustomForm(true)}
                      className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-dashed border-[#FF5C00] bg-orange-50 px-6 text-lg font-bold text-[#CC4700] transition-colors hover:bg-orange-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-orange-500 dark:bg-orange-950/40 dark:text-orange-200"
                    >
                      {t('add_custom_vocab')}
                    </button>
                  )}

                  <ul className="space-y-3">
                    {displayCards.map((card) => {
                      const displayWord =
                        card.article && card.article !== 'none'
                          ? `${card.article} ${card.word_de}`
                          : card.word_de
                      const isPending = pendingCardId === card.id

                      return (
                        <li
                          key={card.id}
                          className="flex flex-col gap-3 rounded-xl bg-gray-50 p-4 shadow-sm ring-1 ring-gray-900/5 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800 dark:ring-slate-700"
                        >
                          <div className="min-w-0">
                            <p className={cn('break-words text-lg font-bold', articleColorClass(card.article))}>
                              {displayWord}
                            </p>
                            <p className="break-words text-base text-gray-600 dark:text-slate-400">
                              {card.translation || t('no_translation')}
                            </p>
                            {card.isCustom && (
                              <p className="mt-1 text-base font-semibold text-[#CC4700] dark:text-orange-300">
                                {t('custom_vocab_badge')}
                              </p>
                            )}
                          </div>

                          {card.isCustom ? (
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={cn(
                                  'inline-flex min-h-12 items-center justify-center rounded-full px-5 text-base font-bold',
                                  phaseBadgeClasses(card.phase, card.isLearned)
                                )}
                              >
                                {t('phase_badge', { phase: card.phase ?? 1 })}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCustom(card.id)}
                                aria-label={t('remove_custom_vocab_aria', { word: card.word_de })}
                                className="flex h-12 w-12 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              >
                                <Trash2 size={22} aria-hidden="true" />
                              </button>
                            </div>
                          ) : card.phase === null ? (
                            <button
                              type="button"
                              onClick={() => void handleAddSingleCard(card.id)}
                              disabled={isPending}
                              aria-label={t('add_single_card_aria', { word: card.word_de })}
                              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
                            >
                              {isPending ? (
                                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                              ) : (
                                <Plus size={20} aria-hidden="true" />
                              )}
                              {t('add_single_card')}
                            </button>
                          ) : (
                            <span
                              className={cn(
                                'inline-flex min-h-12 shrink-0 items-center justify-center rounded-full px-5 text-base font-bold',
                                phaseBadgeClasses(card.phase, card.isLearned)
                              )}
                            >
                              {card.isLearned
                                ? t('phase_badge_learned')
                                : t('phase_badge', { phase: card.phase })}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {addFailed && (
                <p role="status" aria-live="polite" className="mt-4 text-lg font-medium text-amber-700 dark:text-amber-400">
                  {t('manual_add_failed')}
                </p>
              )}

              {/* Reset Progress Section */}
              {Array.isArray(cardsState) && cardsState.some((c) => c.phase !== null) && (
                <div className="mt-8 border-t border-gray-200 pt-6 dark:border-slate-800">
                  {showResetConfirm ? (
                    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                      <p className="mb-4 text-lg font-bold text-red-900 dark:text-red-100">
                        {t('reset_progress_confirm')}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <button
                          type="button"
                          onClick={handleResetProgress}
                          disabled={isResetting}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-600 px-6 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          {isResetting ? <Loader2 size={20} className="animate-spin" /> : t('reset_progress_yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm(false)}
                          disabled={isResetting}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-6 font-bold text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl text-red-600 transition-colors hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 size={20} />
                      <span className="font-bold underline underline-offset-4">{t('reset_progress')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'phases' && (
            <div role="tabpanel" id={phasesPanelId} aria-labelledby={phasesTabId}>
              {cardsState === 'loading' ? (
                <p className="flex items-center gap-3 text-lg text-gray-600 dark:text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  {t('cards_loading')}
                </p>
              ) : (
                <PhaseDistributionChart cards={displayCards} translations={translations} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
