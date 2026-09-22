'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Clock, Info, Loader2, X } from 'lucide-react'
import { getPhaseCards } from '@/app/actions/vocabulary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { phaseTone, VOCABULARY_DIRECTIONS, type BoxBucket, type BoxBucketKey } from '@/lib/vocabulary-box'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { PhaseCardView, PhaseCardsResult } from '@/lib/types/vocabulary'
import { cn, stripLessonPrefix } from '@/lib/utils'
import { bucketName, intervalLabel } from './LeitnerBoxOverview'
import './lernkasten.css'

type Content = 'loading' | 'error' | PhaseCardsResult

/** Bildschirmpunkt, aus dem die Fachansicht herausfährt — die Mitte des angetippten Fachs. */
export interface InspectorOrigin {
  x: number
  y: number
}

interface Props {
  /** `null` hält das Fach geschlossen. */
  phase: BoxBucketKey | null
  /** Zahlen des Fachs aus der Übersicht, für den Kopf der Ansicht. */
  bucket?: BoxBucket | null
  /** Ohne Ursprung fährt die Ansicht aus der Bildschirmmitte heraus. */
  origin?: InspectorOrigin | null
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
    <li className="min-w-0 border-b border-[var(--border)] py-4 last:border-b-0">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={cn('min-w-0 break-words text-xl font-semibold leading-snug', articleColorClass(card.article))}>{word}</p>
        <p className="min-w-0 break-words text-lg text-[var(--muted)]">{card.translation}</p>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
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
              {cleared ? <Check size={15} aria-hidden="true" /> : <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border-2 border-current" />}
              <span>{label}</span>
              <span className="sr-only">
                {': '}
                {t(cleared ? 'direction_state_cleared' : 'direction_state_open')}
              </span>
            </span>
          )
        })}
        {card.isHalfKnown && (
          <span className="text-base font-semibold text-[var(--accent-text)]">{t('half_known_label')}</span>
        )}
        <span className="ml-auto text-base text-[var(--muted)]">{t('lesson_label', { lesson: stripLessonPrefix(card.lesson) })}</span>
      </div>
    </li>
  )
}

/**
 * „In ein Fach hineinschauen": Die Karteikarte fährt aus dem angetippten Fach
 * heraus, kippt dabei nach vorn und legt sich groß vor den Betrachter — auf dem
 * Telefon als Blatt von unten, auf breiten Geräten mittig. Beim Schließen
 * wandert sie denselben Weg zurück ins Fach.
 *
 * Der Inhalt wird erst beim Öffnen geladen — ein Niveau kann tausende Wörter
 * haben, und niemand braucht sie, bevor er ein Fach aufzieht.
 */
export default function PhaseInspector({ phase, bucket = null, origin = null, level, uiLanguage, translations = {}, onClose }: Props) {
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const reduced = useReducedMotion() ?? false
  const [content, setContent] = useState<Content>('loading')
  const [wide, setWide] = useState(true)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const panel = useRef<HTMLDivElement>(null)
  const isOpen = phase !== null

  // Auf dem Telefon kommt das Blatt von unten, auf breiten Geräten liegt die
  // Karte in der Mitte.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(min-width: 640px)')
    const sync = () => {
      setWide(query.matches)
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    sync()
    query.addEventListener('change', sync)
    window.addEventListener('resize', sync)
    return () => {
      query.removeEventListener('change', sync)
      window.removeEventListener('resize', sync)
    }
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

  // Fokus, Escape und Hintergrund-Scroll wie im Lektions-Modal: Die Karte ist
  // ein Dialog, auch wenn sie wie ein Gegenstand aussieht.
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

  const key = phase
  const tone = key === null ? null : phaseTone(key)
  const title = key === null ? '' : key === 'learned'
    ? t('inspector_title_learned')
    : t('inspector_title', { phase: key, name: bucketName(key, t) })

  // Weg der Karte: vom Fach (klein, nach hinten gekippt) zur Endlage. Die
  // Endlage ist auf breiten Geräten die Bildschirmmitte, auf dem Telefon die
  // Mitte des unteren Blatts.
  const settleY = wide ? viewport.height / 2 : viewport.height * 0.56
  const dx = origin && viewport.width ? origin.x - viewport.width / 2 : 0
  const dy = origin && viewport.height ? origin.y - settleY : wide ? 0 : viewport.height * 0.4
  const hidden = reduced
    ? { opacity: 0 }
    : { opacity: 0, x: dx, y: dy, scale: 0.28, rotateX: 58, rotateY: Math.max(-24, Math.min(24, dx / -18)) }
  const shownState = reduced ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1, rotateX: 0, rotateY: 0 }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="phase-inspector"
          className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Reine Klickfläche: Schließen ist über die Tasten in der Karte und
              über Escape bedienbar, daher braucht der Hintergrund keinen
              eigenen Eintrag im Accessibility-Baum. */}
          <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-slate-950/60 backdrop-blur-[3px]" />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={hidden}
            animate={shownState}
            exit={hidden}
            transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 150, damping: 21, mass: 0.9 }}
            style={{ transformPerspective: 1400 }}
            className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-lg)] sm:max-h-[86dvh] sm:max-w-2xl sm:rounded-[1.75rem]"
          >
            {tone && <span aria-hidden="true" className={cn('lb-inspector__band', tone.fill)} />}

            <div className="flex flex-shrink-0 items-start gap-4 px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
              {key !== null && tone && (
                <span aria-hidden="true" className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold tabular-nums', tone.soft, tone.text)}>
                  {key === 'learned' ? <Check size={28} strokeWidth={3} /> : key}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-2xl font-semibold leading-tight">{title}</h2>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-[var(--muted)]">
                  {key !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={16} aria-hidden="true" />
                      {intervalLabel(key, t)}
                    </span>
                  )}
                  {typeof content === 'object' && (
                    <span className="font-semibold text-[var(--foreground)]">
                      {t(content.total === 1 ? 'box_word_count_one' : 'box_word_count', { count: content.total })}
                    </span>
                  )}
                </p>
                {bucket && (bucket.due > 0 || bucket.halfKnown > 0) && (
                  <p className="mt-2 flex flex-wrap gap-2 text-base">
                    {bucket.due > 0 && (
                      <span className="rounded-full bg-[var(--accent-strong)] px-3 py-0.5 font-semibold text-[var(--accent-foreground)]">
                        {t('box_due_badge', { count: bucket.due })}
                      </span>
                    )}
                    {bucket.halfKnown > 0 && (
                      <span className="rounded-full border border-[var(--border)] px-3 py-0.5 font-semibold text-[var(--accent-text)]">
                        {t('box_half_known', { count: bucket.halfKnown })}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <X size={22} aria-hidden="true" />
                <span className="sr-only">{t('inspector_close')}</span>
              </button>
            </div>

            <p className="mx-5 flex flex-shrink-0 gap-3 rounded-2xl bg-[var(--surface-muted)] p-4 text-base leading-relaxed text-[var(--foreground)] sm:mx-7">
              <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
              <span>{t('half_known_hint')}</span>
            </p>

            <div className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7" data-lenis-prevent>
              {content === 'loading' && (
                <p className="flex items-center gap-3 py-10 text-lg text-[var(--muted)]" role="status">
                  <Loader2 size={22} aria-hidden="true" className="animate-spin" />
                  {t('inspector_loading')}
                </p>
              )}
              {content === 'error' && (
                <p role="alert" className="py-10 text-lg text-[var(--danger)]">{t('inspector_failed')}</p>
              )}
              {typeof content === 'object' && content.cards.length === 0 && (
                <p className="py-10 text-lg text-[var(--muted)]">{t('inspector_empty')}</p>
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

            <div className="flex-shrink-0 border-t border-[var(--border)] px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={onClose}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--border-strong)] text-lg font-semibold transition-colors hover:border-[var(--accent)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {t('inspector_close')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
