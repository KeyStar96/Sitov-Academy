'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type WheelEvent } from 'react'
import { CloudOff, Loader2, Plus, Trash2, X } from 'lucide-react'
import { addCardsToTrainer, addOwnWord, deleteOwnWord, getLessonCards, resetLessonProgress } from '@/app/actions/vocabulary'
import { isOwnWordsLesson, lessonTitle } from '@/lib/vocabulary-own-words'
import { createVocabularyTranslator, type VocabularyTranslationKey, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { articleColorClass, phaseBadgeClasses } from '@/lib/vocabulary-ui'
import type { LessonCardView } from '@/lib/types/vocabulary'
import { cn } from '@/lib/utils'
import PhaseDistributionChart from '@/components/vocabulary/PhaseDistributionChart'

type CardsState = 'loading' | 'error' | LessonCardView[]
type ModalTab = 'words' | 'phases'

type OwnMessage = { key: VocabularyTranslationKey; word?: string; tone: 'status' | 'alert' }

/**
 * Vokabelliste einer Lektion als Overlay mit Tabs.
 *
 * Für „Eigene Wörter" ist es zugleich der Ort, an dem man Wörter einträgt und
 * wieder löscht (serverseitig, Migration 23). Kurslektionen bekommen keine
 * eigenen Einträge mehr — die frühere Merkliste im Browser ist entfallen.
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
  /** Wird nach jeder Änderung (Übernahme, eigenes Wort, Löschen, Zurücksetzen) aufgerufen, damit die Seite dahinter aktualisiert. */
  onCardAdded: () => void
}) {
  const t = createVocabularyTranslator(translations)
  const tabIds = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const wordsTabId = `${tabIds}-words`
  const phasesTabId = `${tabIds}-phases`
  const wordsPanelId = `${tabIds}-words-panel`
  const phasesPanelId = `${tabIds}-phases-panel`

  const own = isOwnWordsLesson(lesson)
  const title = lessonTitle(lesson, t)
  const wordInput = useRef<HTMLInputElement>(null)
  const [cardsState, setCardsState] = useState<CardsState>('loading')
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const [addFailed, setAddFailed] = useState(false)
  const [activeTab, setActiveTab] = useState<ModalTab>('words')
  const [ownWord, setOwnWord] = useState('')
  const [ownTranslation, setOwnTranslation] = useState('')
  const [ownSaving, setOwnSaving] = useState(false)
  const [ownMessage, setOwnMessage] = useState<OwnMessage | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetFailed, setResetFailed] = useState(false)

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

  const displayCards = useMemo(() => Array.isArray(cardsState) ? cardsState : [], [cardsState])

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

  // Nach einer Änderung still nachladen, ohne die Liste in den Ladezustand zu
  // werfen — die Eingabe bleibt stehen und der Fokus im Formular.
  const refreshCards = useCallback(async () => {
    try { setCardsState(await getLessonCards(lesson, level, uiLanguage)) } catch { /* Liste bleibt, nächste Änderung lädt erneut */ }
  }, [lesson, level, uiLanguage])

  const handleAddOwn = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (ownSaving) return
      const word = ownWord.trim()
      const translation = ownTranslation.trim()
      if (!word || !translation) {
        setOwnMessage({ key: 'own_words_missing', tone: 'alert' })
        return
      }
      setOwnSaving(true)
      setOwnMessage(null)
      try {
        const result = await addOwnWord({ level, word, translation, uiLanguage: uiLanguage ?? '' })
        if (result.success === false) {
          setOwnMessage({ key: result.error === 'exists' ? 'own_words_exists' : result.error === 'limit' ? 'own_words_limit' : result.error === 'invalid' ? 'own_words_missing' : 'own_words_failed', tone: 'alert' })
          return
        }
        setOwnWord('')
        setOwnTranslation('')
        setOwnMessage({ key: result.activated ? 'own_words_added_to_box' : 'own_words_added', word, tone: 'status' })
        await refreshCards()
        onCardAdded()
        wordInput.current?.focus()
      } catch {
        setOwnMessage({ key: 'own_words_failed', tone: 'alert' })
      } finally {
        setOwnSaving(false)
      }
    },
    [level, onCardAdded, ownSaving, ownTranslation, ownWord, refreshCards, uiLanguage]
  )

  const handleDeleteOwn = useCallback(
    async (cardId: string) => {
      if (!Array.isArray(cardsState) || pendingCardId !== null) return
      const previousCards = cardsState
      setPendingCardId(cardId)
      setOwnMessage(null)
      setCardsState(previousCards.filter(card => card.id !== cardId))
      try {
        const result = await deleteOwnWord(cardId)
        if (!result.success) throw new Error('own_word_delete_failed')
        onCardAdded()
      } catch {
        setCardsState(previousCards)
        setOwnMessage({ key: 'own_words_delete_failed', tone: 'alert' })
      } finally {
        setPendingCardId(null)
      }
    },
    [cardsState, onCardAdded, pendingCardId]
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
        aria-label={title}
        data-lenis-prevent
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        className="academy-lesson-dialog"
      >
        <div className="flex shrink-0 flex-col border-b border-[var(--border)]">
          <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
            <h3 className="min-w-0 break-words pt-2 text-lg font-bold text-[var(--foreground)]">
              {title}
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
                  {own && (
                    <form onSubmit={handleAddOwn} className="space-y-4 rounded-2xl border-2 border-[var(--border)] p-4" noValidate>
                      <p className="text-base leading-relaxed text-[var(--muted)]">{t('own_words_hint')}</p>
                      <div>
                        <label htmlFor={`${tabIds}-own-word`} className="mb-2 block text-base font-bold text-[var(--foreground)]">
                          {t('own_words_word_label')}
                        </label>
                        <input
                          ref={wordInput}
                          id={`${tabIds}-own-word`}
                          type="text"
                          lang="de"
                          value={ownWord}
                          maxLength={160}
                          onChange={(event) => { setOwnWord(event.target.value); setOwnMessage(null) }}
                          placeholder={t('own_words_word_placeholder')}
                          aria-describedby={`${tabIds}-own-word-hint`}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          className="min-h-14 w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
                        />
                        <p id={`${tabIds}-own-word-hint`} className="mt-1.5 text-base text-[var(--muted)]">{t('own_words_word_hint')}</p>
                      </div>
                      <div>
                        <label htmlFor={`${tabIds}-own-translation`} className="mb-2 block text-base font-bold text-[var(--foreground)]">
                          {t('own_words_translation_label')}
                        </label>
                        <input
                          id={`${tabIds}-own-translation`}
                          type="text"
                          lang={uiLanguage}
                          value={ownTranslation}
                          maxLength={200}
                          onChange={(event) => { setOwnTranslation(event.target.value); setOwnMessage(null) }}
                          placeholder={t('own_words_translation_placeholder')}
                          autoComplete="off"
                          className="min-h-14 w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
                        />
                      </div>
                      {ownMessage && (
                        <p role={ownMessage.tone} className={cn('text-base font-medium', ownMessage.tone === 'alert' ? 'text-[var(--danger)]' : 'text-[var(--success)]')}>
                          {t(ownMessage.key, { word: ownMessage.word ?? '' })}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={ownSaving}
                        className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-strong)] px-6 text-base font-bold text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-strong-hover)] disabled:opacity-60 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
                      >
                        {ownSaving ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}
                        {t(ownSaving ? 'own_words_adding' : 'own_words_add')}
                      </button>
                    </form>
                  )}

                  {own && displayCards.length === 0 && (
                    <p className="text-base text-[var(--muted)]">{t('own_words_empty')}</p>
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
                            <p lang="de" className={cn('break-words text-base font-bold', articleColorClass(card.article))}>
                              {displayWord}
                            </p>
                            <p className="break-words text-base text-[var(--muted)]">
                              {card.translation || t('no_translation')}
                            </p>
                          </div>

                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {card.phase === null ? (
                              own ? (
                                // Eigene Wörter warten als Ganzes auf das Einschalten der Lektion.
                                <span className="inline-flex min-h-11 max-w-full shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-strong)] px-4 text-sm font-bold text-[var(--muted)]">
                                  {t('own_words_waiting')}
                                </span>
                              ) : (
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
                              )
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
                            {own && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteOwn(card.id)}
                                disabled={pendingCardId !== null || isResetting}
                                aria-label={t('own_words_delete_aria', { word: displayWord })}
                                className="flex h-12 w-12 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] dark:hover:bg-red-950/40 dark:hover:text-red-300"
                              >
                                {isPending ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Trash2 size={22} aria-hidden="true" />}
                              </button>
                            )}
                          </div>
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
