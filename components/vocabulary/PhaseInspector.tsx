'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, X } from 'lucide-react'
import { getPhaseCards } from '@/app/actions/vocabulary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { phaseTone, VOCABULARY_DIRECTIONS, type BoxBucketKey } from '@/lib/vocabulary-box'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { PhaseCardView, PhaseCardsResult } from '@/lib/types/vocabulary'
import { cn, stripLessonPrefix } from '@/lib/utils'
import { bucketName } from './LeitnerBoxOverview'
import './lernkasten.css'

const EASE = [0.22, 1, 0.36, 1] as const

type Content = 'loading' | 'error' | PhaseCardsResult

interface Props {
  /** `null` hält die Schublade geschlossen. */
  phase: BoxBucketKey | null
  level: string
  uiLanguage: string
  translations?: VocabularyTranslations
  onClose: () => void
}

/**
 * Zeile einer Vokabel im Fach.
 *
 * Die beiden Richtungs-Chips sind der Kern: Sie machen sichtbar, warum eine
 * Vokabel in diesem Fach liegen bleibt. Gefüllt heißt „sitzt", offen heißt
 * „fehlt noch" — und genau eine gefüllte Seite ist der Zustand „halb gewusst".
 */
function CardRow({ card, t }: { card: PhaseCardView; t: ReturnType<typeof createVocabularyTranslator> }) {
  const tone = phaseTone(card.isLearned ? 'learned' : card.phase)
  const word = card.article && card.article !== 'none' ? `${card.article} ${card.word_de}` : card.word_de

  return (
    <li className="min-w-0 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className={cn('min-w-0 break-words text-lg font-semibold', articleColorClass(card.article))}>{word}</p>
        <p className="min-w-0 break-words text-base text-[var(--muted)]">{card.translation}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {VOCABULARY_DIRECTIONS.map((direction) => {
          // Eine Richtung „sitzt", wenn sie die Phase der Vokabel schon
          // verlassen hat — sie wartet dann auf die Gegenrichtung.
          const state = card.directions[direction]
          const cleared = state.phase > card.phase || (state.isLearned && !card.isLearned)
          const label = t(direction === 'native_to_de' ? 'direction_to_de' : 'direction_from_de')
          return (
            <span
              key={direction}
              data-cleared={cleared}
              className={cn('vocab-direction-chip', cleared ? cn(tone.soft, tone.text) : 'text-[var(--muted)]')}
            >
              {cleared ? <Check size={13} aria-hidden="true" /> : <span aria-hidden="true" className="h-2 w-2 rounded-full border border-current" />}
              <span>{label}</span>
              <span className="sr-only">
                {': '}
                {t(cleared ? 'direction_state_cleared' : 'direction_state_open')}
              </span>
            </span>
          )
        })}
        {card.isHalfKnown && (
          <span className="text-sm font-semibold text-[var(--accent-text)]">{t('half_known_label')}</span>
        )}
        <span className="ml-auto text-sm text-[var(--muted)]">{t('lesson_label', { lesson: stripLessonPrefix(card.lesson) })}</span>
      </div>
    </li>
  )
}

/**
 * „In ein Fach hineinschauen": Seitliche Schublade (auf kleinen Geräten von
 * unten) mit der vollständigen Vokabelliste einer Phase.
 *
 * Der Inhalt wird erst beim Öffnen geladen — ein Niveau kann tausende Wörter
 * haben, und niemand braucht sie, bevor er ein Fach aufzieht.
 */
export default function PhaseInspector({ phase, level, uiLanguage, translations = {}, onClose }: Props) {
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const reduced = useReducedMotion() ?? false
  const [content, setContent] = useState<Content>('loading')
  const [fromSide, setFromSide] = useState(true)
  const panel = useRef<HTMLDivElement>(null)
  const isOpen = phase !== null

  // Auf dem Telefon kommt die Schublade von unten, auf breiten Geräten von der
  // Seite — die Richtung, aus der man sie dort erwartet.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(min-width: 640px)')
    const sync = () => setFromSide(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (phase === null) return
    let cancelled = false
    setContent('loading')
    void getPhaseCards(phase, level, uiLanguage)
      .then((result) => { if (!cancelled) setContent(result) })
      .catch(() => {
        console.error('[vocabulary] phase_inspector_unavailable')
        if (!cancelled) setContent('error')
      })
    return () => { cancelled = true }
  }, [phase, level, uiLanguage])

  // Fokus, Escape und Hintergrund-Scroll wie im Lektions-Modal: Die Schublade
  // ist ein Dialog, auch wenn sie wie ein Möbelstück aussieht.
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex="0"]')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [isOpen, onClose])

  const title = phase === null ? '' : phase === 'learned'
    ? t('inspector_title_learned')
    : t('inspector_title', { phase, name: bucketName(phase, t) })
  const hidden = reduced ? { opacity: 0 } : fromSide ? { x: '100%', opacity: 1 } : { y: '100%', opacity: 1 }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="phase-inspector"
          className="fixed inset-0 z-[90] flex items-end justify-end sm:items-stretch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Reine Klickfläche: Schließen ist über die Taste im Kopf und über
              Escape bedienbar, daher braucht der Hintergrund keinen zweiten
              Eintrag mit demselben Namen im Accessibility-Baum. */}
          <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/50" />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={hidden}
            animate={reduced ? { opacity: 1 } : { x: 0, y: 0, opacity: 1 }}
            exit={hidden}
            transition={{ duration: 0.42, ease: EASE }}
            className={cn(
              'sl-glass relative flex max-h-[88dvh] w-full flex-col rounded-t-3xl p-4 text-[var(--foreground)] sm:max-h-none sm:h-full sm:max-w-md sm:rounded-l-3xl sm:rounded-tr-none sm:p-6',
            )}
          >
            <div className="flex flex-shrink-0 items-start justify-between gap-3 pb-3">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold">{title}</h2>
                {typeof content === 'object' && (
                  <p className="mt-1 text-base text-[var(--muted)]">
                    {t(content.total === 1 ? 'box_word_count_one' : 'box_word_count', { count: content.total })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)]"
              >
                <X size={18} aria-hidden="true" />
                <span className="sr-only">{t('inspector_close')}</span>
              </button>
            </div>

            <p className="flex-shrink-0 border-t border-[var(--border)] pt-3 text-base leading-relaxed text-[var(--muted)]">
              {t('half_known_hint')}
            </p>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent>
              {content === 'loading' && (
                <p className="flex items-center gap-2 py-8 text-[var(--muted)]" role="status">
                  <Loader2 size={18} aria-hidden="true" className="animate-spin" />
                  {t('inspector_loading')}
                </p>
              )}
              {content === 'error' && (
                <p role="alert" className="py-8 text-[var(--danger)]">{t('inspector_failed')}</p>
              )}
              {typeof content === 'object' && content.cards.length === 0 && (
                <p className="py-8 text-[var(--muted)]">{t('inspector_empty')}</p>
              )}
              {typeof content === 'object' && content.cards.length > 0 && (
                <ul className="min-w-0">
                  {content.cards.map((card) => <CardRow key={card.id} card={card} t={t} />)}
                </ul>
              )}
              {typeof content === 'object' && content.truncated && (
                <p className="py-4 text-base text-[var(--muted)]">
                  {t('inspector_truncated', { count: content.cards.length, total: content.total })}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
