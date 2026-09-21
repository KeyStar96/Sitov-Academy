'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type WheelEvent } from 'react'
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
 * Der Dialog reserviert die dynamische Viewport-Höhe samt Safe Areas.
 * Header (Titel, Tabs, Schließen) bleibt `flex-shrink-0`. Der Inhalt darunter
 * bekommt `flex-1 min-h-0 overflow-y-auto overscroll-contain` plus
 * `data-lenis-prevent`, damit Lenis (Desktop-Smooth-Scroll) Trackpad- und
 * Mausrad-Gesten nicht schluckt.
 */
export default function LessonCardsModal({
  lesson,
  level,
  uiLanguage,
  translations = {},
  onClose,
  onCardAdded,
}: {
  lesson: string
  level: string
  uiLanguage?: string
  translations?: VocabularyTranslations
  onClose: () => void
  /** Wird nach erfolgreicher manueller Übernahme aufgerufen, damit die Lektionsliste dahinter aktualisiert. */
  onCardAdded: () => void
}) {
  const t = createVocabularyTranslator(translations)
  const tabIds = useId()
  const dialog = useRef<HTMLDivElement>(null)
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
  const [resetFailed, setResetFailed] = useState(false)

  useEffect(() => {
    setCustomCards(loadCustomVocabulary(level, lesson))
  }, [level, lesson])

  useEffect(() => {
    let cancelled = false
    setCardsState('loading')

    void getLessonCards(lesson, level, uiLanguage)
      .then((cards) => {
        if (!cancelled) setCardsState(cards)
      })
      .catch((err) => {
        console.error("Vokabeln der Lektion konnten nicht geladen werden:")
        if (!cancelled) setCardsState('error')
      })

    return () => {
      cancelled = true
    }
  }, [lesson, level, uiLanguage])

  useEffect(() => {
    const previousFocus = document.activeElement
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const focusable = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), [href], [tabindex="0"]')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true })
    }
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
      if (!Array.isArray(cardsState) || pendingCardId !== null || isResetting) return
      const previousCards = cardsState
      setPendingCardId(cardId)
      setAddFailed(false)
      setCardsState(previousCards.map(card => card.id === cardId ? { ...card, phase: 1, isLearned: false } : card))
      try {
        const result = await addCardsToTrainer([cardId])
        if (!result.success) {
          setCardsState(previousCards)
          setAddFailed(true)
          return
        }
        onCardAdded()
      } catch (err) {
        console.error("Vokabel konnte nicht manuell übernommen werden:")
        setCardsState(previousCards)
        setAddFailed(true)
      } finally {
        setPendingCardId(null)
      }
    },
    [cardsState, isResetting, onCardAdded, pendingCardId]
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
        console.error("Eigene Vokabel für Lektion konnte nicht gespeichert werden:")
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
        console.error("Eigene Vokabel konnte nicht gelöscht werden:")
      }
    },
    [lesson, level]
  )

  const handleResetProgress = useCallback(async () => {
    if (!Array.isArray(cardsState) || isResetting || pendingCardId !== null) return
    const previousCards = cardsState
    setIsResetting(true)
    setResetFailed(false)
    setCardsState(previousCards.map(card => ({ ...card, phase: null, isLearned: false })))
    try {
      const result = await resetLessonProgress(lesson, level)
      if (!result.success) throw new Error('lesson_reset_failed')
      setShowResetConfirm(false)
      onCardAdded()
    } catch (err) {
      console.error("Lernfortschritt konnte nicht zurückgesetzt werden:")
      setCardsState(previousCards)
      setResetFailed(true)
    } finally {
      setIsResetting(false)
    }
  }, [cardsState, isResetting, lesson, level, onCardAdded, pendingCardId])

  return (
    <div
      className="academy-modal-backdrop"
      onClick={onClose}
      onWheel={(event: WheelEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) event.preventDefault()
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={lesson}
        data-lenis-prevent
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        className="academy-lesson-dialog"
      >
        <div className="flex shrink-0 flex-col border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
            <h3 className="min-w-0 break-words pt-2 text-lg font-bold text-[var(--foreground)]">
              {lesson}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close_cards')}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>

          <div
            role="tablist"
            aria-label={t('modal_tabs_aria')}
            className="academy-lesson-tabs"
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const tab: ModalTab = event.key === 'Home' ? 'words' : event.key === 'End' ? 'phases' : activeTab === 'words' ? 'phases' : 'words'
              setActiveTab(tab)
              document.getElementById(tab === 'words' ? wordsTabId : phasesTabId)?.focus()
            }}
          >
            <button
              type="button"
              role="tab"
              id={wordsTabId}
              aria-controls={wordsPanelId}
              aria-selected={activeTab === 'words'}
              tabIndex={activeTab === 'words' ? 0 : -1}
              onClick={() => setActiveTab('words')}
              className="academy-lesson-tab"
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
              className="academy-lesson-tab"
            >
              {t('tab_phases')}
            </button>
          </div>
        </div>

        <div
          data-lenis-prevent
          className="modal-scroll-region min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-6"
        >
          {activeTab === 'words' && (
            <div role="tabpanel" tabIndex={0} id={wordsPanelId} aria-labelledby={wordsTabId}>
              {cardsState === 'loading' && (
                <p className="flex items-center gap-3 text-base text-[var(--muted)]">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  {t('cards_loading')}
                </p>
              )}

              {cardsState === 'error' && (
                <p className="flex items-center gap-3 text-base text-[var(--muted)]">
                  <CloudOff className="h-6 w-6 shrink-0" aria-hidden="true" />
                  {t('cards_load_failed')}
                </p>
              )}

              {Array.isArray(cardsState) && (
                <div className="space-y-4">
                  {showCustomForm ? (
                    <form
                      onSubmit={handleSaveCustom}
                      className="space-y-4 rounded-2xl border-2 border-[var(--border)] vocabulary-phase-new p-4"
                    >
                      <div>
                        <label htmlFor={`${tabIds}-custom-word`} className="mb-2 block text-base font-bold text-[var(--foreground)]">
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
                          className="min-h-14 w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
                        />
                      </div>
                      <div>
                        <label htmlFor={`${tabIds}-custom-translation`} className="mb-2 block text-base font-bold text-[var(--foreground)]">
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
                          className="min-h-14 w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
                        />
                      </div>
                      {customError && (
                        <p role="alert" className="text-base font-medium text-amber-800 dark:text-amber-300">
                          {t('custom_vocab_error')}
                        </p>
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="submit"
                          className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl bg-[var(--accent-strong)] px-6 text-base font-bold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
                        >
                          {t('custom_vocab_save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomForm(false)
                            setCustomError(false)
                          }}
                          className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-6 text-base font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
                        >
                          {t('custom_vocab_cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCustomForm(true)}
                      className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-dashed border-[var(--accent)] vocabulary-phase-new px-6 text-base font-bold text-[var(--accent-text)] transition-colors hover:opacity-90 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
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
                          className="flex min-w-0 flex-col gap-3 rounded-2xl bg-[var(--surface-muted)] p-4 shadow-sm ring-1 ring-[var(--border)] sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className={cn('break-words text-base font-bold', articleColorClass(card.article))}>
                              {displayWord}
                            </p>
                            <p className="break-words text-base text-[var(--muted)]">
                              {card.translation || t('no_translation')}
                            </p>
                            {card.isCustom && (
                              <p className="mt-1 text-base font-semibold text-[var(--accent-text)]">
                                {t('custom_vocab_badge')}
                              </p>
                            )}
                          </div>

                          {card.isCustom ? (
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
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
                                className="flex h-12 w-12 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              >
                                <Trash2 size={22} aria-hidden="true" />
                              </button>
                            </div>
                          ) : card.phase === null ? (
                            <button
                              type="button"
                              onClick={() => void handleAddSingleCard(card.id)}
                              disabled={pendingCardId !== null || isResetting}
                              aria-label={t('add_single_card_aria', { word: card.word_de })}
                              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 py-3 text-base font-bold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-strong-hover)] disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
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
                                'inline-flex min-h-11 max-w-full shrink-0 items-center justify-center rounded-full px-4 text-sm font-bold',
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
                <p role="status" aria-live="polite" className="mt-4 text-base font-medium text-amber-700 dark:text-amber-400">
                  {t('manual_add_failed')}
                </p>
              )}

              {resetFailed && <p role="alert" className="mt-4 text-base text-[var(--danger)]">{t('error_description')}</p>}

              {/* Reset Progress Section */}
              {Array.isArray(cardsState) && (isResetting || cardsState.some((c) => c.phase !== null)) && (
                <div className="mt-8 border-t border-[var(--border)] pt-6">
                  {showResetConfirm ? (
                    <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                      <p className="mb-4 text-base font-bold text-red-900 dark:text-red-100">
                        {t('reset_progress_confirm')}
                      </p>
                      <div className="flex flex-wrap gap-4">
                        <button
                          type="button"
                          onClick={handleResetProgress}
                          disabled={isResetting}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-700 px-6 font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                        >
                          {isResetting && <Loader2 size={20} className="mr-2 animate-spin" aria-hidden="true" />}{t('reset_progress_yes')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm(false)}
                          disabled={isResetting}
                          className="inline-flex min-h-12 items-center justify-center rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-6 font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)]"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={pendingCardId !== null}
                      onClick={() => { setResetFailed(false); setShowResetConfirm(true) }}
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
            <div role="tabpanel" tabIndex={0} id={phasesPanelId} aria-labelledby={phasesTabId}>
              {cardsState === 'loading' ? (
                <p className="flex items-center gap-3 text-base text-[var(--muted)]">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                  {t('cards_loading')}
                </p>
              ) : cardsState === 'error' ? (
                <p className="flex items-center gap-3 text-base text-[var(--muted)]" role="status"><CloudOff className="h-6 w-6 shrink-0" aria-hidden="true" />{t('cards_load_failed')}</p>
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
