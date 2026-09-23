'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Check, Hand } from 'lucide-react'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { phaseIntervalInDays, phaseTone, type BoxBucket, type BoxBucketKey } from '@/lib/vocabulary-box'
import type { VocabularyBoxSummary } from '@/lib/types/vocabulary'
import { cn } from '@/lib/utils'
import PhaseInspector, { type InspectorOrigin } from './PhaseInspector'
import './lernkasten.css'

interface Props {
  summary: VocabularyBoxSummary
  level: string
  uiLanguage: string
  translations?: VocabularyTranslations
  /** Hauptaktion direkt unter der Box — der Start-Knopf der Trainer-Seite. */
  action?: ReactNode
}

type Translator = ReturnType<typeof createVocabularyTranslator>

/** Fachname als eigener Schlüssel je Phase — „Neu", „Frisch", „Vertraut" … */
export function bucketName(key: BoxBucketKey, t: Translator): string {
  return key === 'learned' ? t('box_phase_learned') : t(`box_phase_name_${key}` as 'box_phase_name_1')
}

export function intervalLabel(key: BoxBucketKey, t: Translator): string {
  if (key === 'learned') return t('box_interval_archive')
  const days = phaseIntervalInDays(key)
  return days === 1 ? t('box_interval_day') : t('box_interval_days', { days })
}

/** Ab so vielen Vokabeln ist ein Fach randvoll. */
const STACK_FULL_AT = 400
/** So viele Kartenkanten passen sichtbar an einen vollen Stapel. */
const STACK_MAX_LINES = 28

/**
 * Füllhöhe eines Fachs zwischen 0 (leer) und 1 (randvoll).
 *
 * Logarithmisch statt linear: Der Unterschied zwischen 2 und 20 Vokabeln muss
 * genauso ins Auge fallen wie der zwischen 50 und 300 — sonst wäre ein Fach mit
 * wenigen Karten neben einem vollen nicht mehr zu sehen. Eine einzelne Karte
 * bleibt als dünne Lage sichtbar, ein leeres Fach bleibt leer.
 */
export function stackFill(count: number): number {
  if (count <= 0) return 0
  return Math.min(1, Math.log2(1 + count / 2) / Math.log2(1 + STACK_FULL_AT / 2))
}

/** Sichtbare Kartenkanten: nie mehr, als Karten im Fach liegen. */
export function stackLines(count: number): number {
  if (count <= 0) return 0
  return Math.max(1, Math.min(count, Math.round(stackFill(count) * STACK_MAX_LINES)))
}

const COUNT_SLOT = '\u0000'

/**
 * Das Mitkippen gibt es nur am Rechner: breiter Bildschirm und ein Gerät, das
 * sich als echte Maus meldet. Auf dem Telefon bleibt die Box ruhig stehen —
 * das Event allein reicht nicht, denn auch Touch-Geräte liefern mitunter
 * Maus-Events (Emulatoren, Tablets mit Maus-Modus).
 */
const TILT_QUERY = '(min-width: 640px) and (hover: hover) and (pointer: fine)'

function clearTilt(node: HTMLElement | null) {
  if (!node) return
  delete node.dataset.tracking
  node.style.removeProperty('--lb-ry')
  node.style.removeProperty('--lb-rx')
}

/** Teilt „{count} Vokabeln" um die Zahl, damit sie groß stehen kann — in jeder Sprache an ihrer Stelle. */
function countParts(count: number, t: Translator): [string, string] {
  if (count === 1) {
    const text = t('box_word_count_one')
    const at = text.indexOf('1')
    return at === -1 ? ['', ` ${text}`] : [text.slice(0, at), text.slice(at + 1)]
  }
  const [before = '', after = ''] = t('box_word_count', { count: COUNT_SLOT }).split(COUNT_SLOT)
  return [before, after]
}

/**
 * Ein Fach der Lernbox: Öffnung mit Tiefe, darin der Kartenstapel, darunter
 * das Messing-Etikett.
 *
 * Das ganze Fach ist der Schalter zum Hineinschauen. Es ist bewusst ein
 * `div` mit Button-Rolle: Ein natives `<button>` beschneidet in manchen
 * Browsern seinen Inhalt und drückt die 3D-Szene darin flach.
 */
function Compartment({ bucket, index, open, t, onOpen }: {
  bucket: BoxBucket
  index: number
  open: boolean
  t: Translator
  onOpen: (key: BoxBucketKey, from: HTMLElement) => void
}) {
  const id = useId()
  const tone = phaseTone(bucket.key)
  const name = bucketName(bucket.key, t)
  const isArchive = bucket.key === 'learned'
  const [before, after] = countParts(bucket.count, t)
  const ids = { count: `${id}-count`, due: `${id}-due`, half: `${id}-half`, interval: `${id}-interval` }
  const describedBy = [ids.count, bucket.due > 0 && ids.due, bucket.halfKnown > 0 && ids.half, ids.interval].filter(Boolean).join(' ')
  const style = {
    '--i': String(index),
    '--fill': stackFill(bucket.count).toFixed(3),
    '--lines': String(stackLines(bucket.count)),
  } as CSSProperties

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onOpen(bucket.key, event.currentTarget)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t('box_open_aria', { name })}
      aria-describedby={describedBy}
      aria-haspopup="dialog"
      className="lb-cell"
      data-archive={isArchive || undefined}
      data-open={open || undefined}
      data-empty={bucket.count === 0 || undefined}
      style={style}
      onClick={(event) => onOpen(bucket.key, event.currentTarget)}
      onKeyDown={onKeyDown}
    >
      <span className="lb-cell__frame lb-cell__frame--top" aria-hidden="true" />
      <span className="lb-cell__row" aria-hidden="true">
        <span className="lb-cell__frame lb-cell__frame--side" />
        <span className="lb-hole">
          <span className="lb-hole__back" />
          <span className="lb-hole__floor" />
          <span className="lb-hole__wall lb-hole__wall--l" />
          <span className="lb-hole__wall lb-hole__wall--r" />
          {bucket.count > 0 && (
            <>
              <span className="lb-stack__shadow" />
              <span className="lb-stack">
                <span className="lb-stack__grow">
                  <span className="lb-stack__top" />
                  <span className="lb-stack__side lb-stack__side--l" />
                  <span className="lb-stack__side lb-stack__side--r" />
                  <span className="lb-stack__card" />
                  {bucket.due > 0 && <span className="lb-stack__flag" />}
                </span>
              </span>
            </>
          )}
        </span>
        <span className="lb-cell__frame lb-cell__frame--side" />
      </span>
      {bucket.due > 0 && <span id={ids.due} className="lb-due">{t('box_due_badge', { count: bucket.due })}</span>}
      <span className="lb-cell__plinth">
        <span className="lb-plate">
          {/* Jedes Etikett ist gleich gebaut: Nummer, Name, Anzahl — jeweils
              in einer eigenen Zeile. So bekommt der Name die volle Breite, und
              ein langer Name verschiebt nie die Nummer. */}
          <span className={cn('lb-plate__badge', tone.soft, tone.text)} aria-hidden="true">
            {isArchive ? <Check size={16} strokeWidth={3} /> : bucket.key}
          </span>
          <span className="lb-plate__name">{name}</span>
          <span id={ids.count} className="lb-plate__count">{before}<b>{bucket.count}</b>{after}</span>
        </span>
      </span>
      <span className="sr-only">
        {bucket.halfKnown > 0 && <span id={ids.half}>{t('box_half_known', { count: bucket.halfKnown })}</span>}
        <span id={ids.interval}>{intervalLabel(bucket.key, t)}</span>
      </span>
    </div>
  )
}

/**
 * Die Lernbox als Gegenstand: ein Holzkasten mit sechs Reifefächern und dem
 * Archiv. In jedem Fach liegt ein Kartenstapel, dessen Dicke der Zahl der
 * Vokabeln folgt. Ein Tipp auf ein Fach zieht es auf (PhaseInspector).
 *
 * Eine Vokabel liegt in der Phase ihrer **schwächeren** Richtung. Sie rückt
 * also erst weiter, wenn sie in beide Richtungen sitzt — der Zwischenschritt
 * steht als „halb gewusst" an jedem Fach und an jeder Vokabel im Fach.
 */
export default function LeitnerBoxOverview({ summary, level, uiLanguage, translations = {}, action }: Props) {
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const reduced = useReducedMotion() ?? false
  const introId = useId()
  const scene = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const canTilt = useRef(false)
  const [openPhase, setOpenPhase] = useState<BoxBucketKey | null>(null)
  const [origin, setOrigin] = useState<InspectorOrigin | null>(null)
  const openBucket = summary.buckets.find((bucket) => bucket.key === openPhase) ?? null

  const open = useCallback((key: BoxBucketKey, from: HTMLElement) => {
    const rect = from.getBoundingClientRect()
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setOpenPhase(key)
  }, [])
  const close = useCallback(() => setOpenPhase(null), [])

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(TILT_QUERY)
    const sync = () => {
      canTilt.current = query.matches
      if (!query.matches) {
        cancelAnimationFrame(frame.current)
        clearTilt(scene.current)
      }
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // Die Box neigt sich leicht zur Maus — nur am Rechner (TILT_QUERY) und ohne
  // Bewegungsreduktion. Die Werte laufen als CSS-Variablen direkt an die
  // Bühne, React rendert dafür nicht neu.
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduced || !canTilt.current || event.pointerType !== 'mouse' || !scene.current) return
    const rect = scene.current.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width - 0.5
    const y = (event.clientY - rect.top) / rect.height - 0.5
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const node = scene.current
      if (!node) return
      node.dataset.tracking = 'true'
      node.style.setProperty('--lb-ry', `${(x * 9).toFixed(2)}deg`)
      node.style.setProperty('--lb-rx', `${(-21 - y * 5).toFixed(2)}deg`)
    })
  }

  function onPointerLeave() {
    cancelAnimationFrame(frame.current)
    clearTilt(scene.current)
  }

  return (
    <section aria-label={t('box_title')} aria-describedby={introId} className="min-w-0">
      <p id={introId} className="sr-only">{t('box_intro')}</p>

      <div ref={scene} className="lb-scene" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <div className="lb-stage">
          <div className="lb-cabinet">
            <span className="lb-cabinet__shadow" aria-hidden="true" />
            <span className="lb-cabinet__top" aria-hidden="true" />
            <span className="lb-cabinet__side lb-cabinet__side--l" aria-hidden="true" />
            <span className="lb-cabinet__side lb-cabinet__side--r" aria-hidden="true" />
            <span className="lb-cabinet__rail lb-cabinet__rail--top" aria-hidden="true" />
            <span className="lb-cabinet__rail lb-cabinet__rail--bottom" aria-hidden="true" />
            <span className="lb-cabinet__rail lb-cabinet__rail--left" aria-hidden="true" />
            <span className="lb-cabinet__rail lb-cabinet__rail--right" aria-hidden="true" />
            <div className="lb-grid">
              {summary.buckets.map((bucket, index) => (
                <Compartment
                  key={String(bucket.key)}
                  bucket={bucket}
                  index={index}
                  open={openPhase === bucket.key}
                  t={t}
                  onOpen={open}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="lb-hint">
        <Hand size={18} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
        {t('box_tap_hint')}
      </p>

      {action && <div className="mt-6">{action}</div>}

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-base font-semibold text-[var(--foreground)]">{t('box_progress_label')}</span>
          <span className="flex flex-wrap items-baseline gap-x-3 text-base text-[var(--muted)]">
            <span className="text-xl font-bold tabular-nums text-[var(--foreground)]">{summary.percent}%</span>
            {summary.untouched > 0 && <span>{t('box_untouched', { count: summary.untouched })}</span>}
          </span>
        </div>
        <div
          className="sl-bar mt-3 h-3"
          data-tone="success"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.percent}
          aria-label={t('box_progress_label')}
        >
          {/* Breite als Inline-Style statt als Motion-Ziel: Der Server rendert
              den Balken sonst ohne Breite (also voll) und er springt erst beim
              Hydrieren auf den echten Wert. Die Bewegung macht CSS. */}
          <span style={{ width: `${summary.percent}%` }} />
        </div>
      </div>

      <PhaseInspector
        phase={openPhase}
        bucket={openBucket}
        origin={origin}
        level={level}
        uiLanguage={uiLanguage}
        translations={translations}
        onClose={close}
      />
    </section>
  )
}
