'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion'
import { Check, Clock, Info, Loader2, X } from 'lucide-react'
import { getPhaseCards } from '@/app/actions/vocabulary'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { phaseTone, VOCABULARY_DIRECTIONS, type BoxBucket, type BoxBucketKey } from '@/lib/vocabulary-box'
import { articleColorClass } from '@/lib/vocabulary-ui'
import type { PhaseCardView, PhaseCardsResult } from '@/lib/types/vocabulary'
import { cn } from '@/lib/utils'
import { lessonLabel } from '@/lib/vocabulary-own-words'
import { useScrollLock } from '@/components/ui/useScrollLock'
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
        <span className="ml-auto text-base text-[var(--muted)]">{lessonLabel(card.lesson, t)}</span>
      </div>
    </li>
  )
}

/** Ab so vielen Pixeln Zug nach unten (oder entsprechendem Schwung) schließt das Blatt. */
const DISMISS_OFFSET = 120
const DISMISS_VELOCITY = 600

/**
 * „In ein Fach hineinschauen".
 *
 * Auf dem Telefon ein Blatt von unten wie in einer App: feste Höhe, damit es
 * beim Laden nicht springt, am Griff nach unten wegziehbar, und nur die Liste
 * darin scrollt — die Seite dahinter steht still. Auf breiten Geräten fährt
 * die Karteikarte aus dem angetippten Fach heraus, kippt nach vorn und legt
 * sich mittig vor den Betrachter; beim Schließen wandert sie zurück ins Fach.
 *
 * Die Ansicht hängt per Portal direkt am `<body>`: Die Glasfläche um die
 * Lernbox trägt `backdrop-filter`, und damit wäre sie der Bezugsrahmen für
 * `position: fixed` — das Blatt säße im Kasten statt im Bildschirm.
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
  const [mounted, setMounted] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  const isOpen = phase !== null
  useScrollLock(isOpen)

  useEffect(() => { setMounted(true) }, [])

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

  // Fokus und Escape wie im Lektions-Modal: Die Karte ist ein Dialog, auch
  // wenn sie wie ein Gegenstand aussieht.
  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
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
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [isOpen, onClose])

  const key = phase
  const tone = key === null ? null : phaseTone(key)
  const title = key === null ? '' : key === 'learned'
    ? t('inspector_title_learned')
    : t('inspector_title', { phase: key, name: bucketName(key, t) })

  // Weg der Karte auf breiten Geräten: vom Fach (klein, nach hinten gekippt)
  // in die Bildschirmmitte. Das Blatt auf dem Telefon fährt schlicht von unten
  // herein — so, wie man es von jeder App kennt.
  const dx = origin && viewport.width ? origin.x - viewport.width / 2 : 0
  const dy = origin && viewport.height ? origin.y - viewport.height / 2 : 0
  const hidden = reduced
    ? { opacity: 0 }
    : wide
      ? { opacity: 0, x: dx, y: dy, scale: 0.28, rotateX: 58, rotateY: Math.max(-24, Math.min(24, dx / -18)) }
      : { y: '100%' }
  const shownState = reduced ? { opacity: 1 } : wide ? { opacity: 1, x: 0, y: 0, scale: 1, rotateX: 0, rotateY: 0 } : { y: 0 }
  const transition = reduced
    ? { duration: 0.2 }
    : wide
      ? { type: 'spring' as const, stiffness: 150, damping: 21, mass: 0.9 }
      : { type: 'spring' as const, stiffness: 340, damping: 34, mass: 0.9 }

  // Gezogen wird nur am Kopf: In der Liste gehört die Wischgeste dem Scrollen.
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (wide || (event.target instanceof Element && event.target.closest('button'))) return
    drag.start(event)
  }
  function endDrag(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose()
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="phase-inspector" className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
          {/* Reine Klickfläche: Schließen ist über die Tasten in der Karte und
              über Escape bedienbar, daher braucht der Hintergrund keinen
              eigenen Eintrag im Accessibility-Baum. */}
          <motion.div
            aria-hidden="true"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 touch-none bg-slate-950/60 backdrop-blur-[3px]"
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={hidden}
            animate={shownState}
            exit={hidden}
            transition={transition}
            drag={wide ? false : 'y'}
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={endDrag}
            style={{ transformPerspective: 1400 }}
            className="lb-inspector relative flex w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-b-0 border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-lg)] sm:max-w-2xl sm:rounded-[1.75rem] sm:border-b"
          >
            {tone && <span aria-hidden="true" className={cn('lb-inspector__band', tone.fill)} />}

            <div onPointerDown={startDrag} className="flex-shrink-0 touch-none px-5 pb-4 pt-3 sm:touch-auto sm:px-7 sm:pt-7">
              {/* Griff: zeigt, dass sich das Blatt nach unten wegziehen lässt. */}
              <span aria-hidden="true" className="mx-auto mb-3 block h-1.5 w-11 rounded-full bg-[var(--border-strong)] sm:hidden" />
              <div className="flex items-start gap-4">
                {key !== null && tone && (
                  <span aria-hidden="true" className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-extrabold tabular-nums sm:h-14 sm:w-14 sm:text-2xl', tone.soft, tone.text)}>
                    {key === 'learned' ? <Check size={26} strokeWidth={3} /> : key}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-xl font-semibold leading-tight sm:text-2xl">{title}</h2>
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
              {/* Unter dem Titel statt in dessen schmaler Spalte: So passen
                  beide Marken auch auf dem Telefon in eine Zeile. */}
              {bucket && (bucket.due > 0 || bucket.halfKnown > 0) && (
                <p className="mt-3 flex flex-wrap gap-2 pl-16 text-base sm:pl-[4.5rem]">
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

            {/* Die einzige Scrollfläche des Blatts. Der Hinweis scrollt mit, damit
                die Liste auf kleinen Telefonen den ganzen Platz bekommt. */}
            <div className="modal-scroll-region min-h-0 flex-1 overflow-y-auto border-t border-[var(--border)] px-5 sm:px-7" data-lenis-prevent>
              <p className="mt-4 flex gap-3 rounded-2xl bg-[var(--surface-muted)] p-4 text-base leading-relaxed text-[var(--foreground)]">
                <Info size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
                <span>{t('half_known_hint')}</span>
              </p>
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
                <ul className="mt-2 min-w-0">
                  {content.cards.map((card) => <CardRow key={card.id} card={card} t={t} />)}
                </ul>
              )}
              {typeof content === 'object' && content.truncated && (
                <p className="py-4 text-base text-[var(--muted)]">
                  {t('inspector_truncated', { count: content.cards.length, total: content.total })}
                </p>
              )}
            </div>

            <div className="lb-inspector__foot flex-shrink-0 border-t border-[var(--border)] px-5 pt-4 sm:px-7">
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
    </AnimatePresence>,
    document.body,
  )
}
