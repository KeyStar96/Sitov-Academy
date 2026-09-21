'use client'

import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Archive, ChevronRight, Clock, Layers, SplitSquareHorizontal } from 'lucide-react'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { phaseIntervalInDays, phaseTone, type BoxBucket, type BoxBucketKey } from '@/lib/vocabulary-box'
import type { VocabularyBoxSummary } from '@/lib/types/vocabulary'
import { cn } from '@/lib/utils'
import PhaseInspector from './PhaseInspector'
import './lernkasten.css'

const EASE = [0.22, 1, 0.36, 1] as const

interface Props {
  summary: VocabularyBoxSummary
  level: string
  uiLanguage: string
  translations?: VocabularyTranslations
}

type Translator = ReturnType<typeof createVocabularyTranslator>

/** Fachname als eigener Schlüssel je Phase — „Neu", „Frisch", „Vertraut" … */
export function bucketName(key: BoxBucketKey, t: Translator): string {
  return key === 'learned' ? t('box_phase_learned') : t(`box_phase_name_${key}` as 'box_phase_name_1')
}

function intervalLabel(key: BoxBucketKey, t: Translator): string {
  if (key === 'learned') return t('box_interval_archive')
  const days = phaseIntervalInDays(key)
  return days === 1 ? t('box_interval_day') : t('box_interval_days', { days })
}

/**
 * Ein Fach des Karteikastens.
 *
 * Die Kachel ist als Ganzes der Schalter zum Hineinschauen: Ein Fach ohne
 * sichtbaren Inhalt wäre ein Karteikasten mit zugeklebten Schubladen.
 */
function PhaseTile({ bucket, t, onOpen, delay, reduced }: {
  bucket: BoxBucket
  t: Translator
  onOpen: () => void
  delay: number
  reduced: boolean
}) {
  const tone = phaseTone(bucket.key)
  const name = bucketName(bucket.key, t)
  const isArchive = bucket.key === 'learned'
  // Der Balken zeigt die Zusammensetzung des Fachs, nicht seine Größe: Wie
  // viele Vokabeln sitzen in beiden Richtungen, wie viele erst in einer?
  const halfShare = bucket.count ? (bucket.halfKnown / bucket.count) * 100 : 0
  const fullShare = bucket.count ? 100 - halfShare : 0

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={t('box_open_aria', { name })}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={reduced ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      whileHover={reduced ? undefined : { y: -4 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      className={cn(
        'sl-glass group relative flex min-h-[10.5rem] w-full flex-col overflow-hidden rounded-2xl p-4 text-left',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]',
        isArchive && 'sm:col-span-2 lg:col-span-3',
      )}
    >
      <span aria-hidden="true" className={cn('vocab-phase-numeral', tone.text)}>
        {isArchive ? '✓' : bucket.key}
      </span>

      <span className="flex items-center gap-2">
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone.soft, tone.text)} aria-hidden="true">
          {isArchive ? <Archive size={16} /> : <Layers size={16} />}
        </span>
        <span className="min-w-0">
          <span className={cn('block break-words text-base font-bold leading-tight', tone.text)}>{name}</span>
          <span className="mt-0.5 flex items-center gap-1 text-sm text-[var(--muted)]">
            <Clock size={12} aria-hidden="true" />
            {intervalLabel(bucket.key, t)}
          </span>
        </span>
      </span>

      <span className="mt-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums tracking-tighter text-[var(--foreground)]">{bucket.count}</span>
        <span className="text-sm text-[var(--muted)]">{t(bucket.count === 1 ? 'box_word_count_one' : 'box_word_count', { count: bucket.count })}</span>
      </span>

      <span className="mt-auto block w-full pt-4">
        <span className="vocab-phase-bar" aria-hidden="true">
          <span className={tone.fill} style={{ width: `${fullShare}%` }} />
          <span className={tone.fill} data-half="true" style={{ width: `${halfShare}%` }} />
        </span>
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {bucket.due > 0 && (
            <span className="font-semibold text-[var(--accent-text)]">{t('box_due_badge', { count: bucket.due })}</span>
          )}
          {bucket.halfKnown > 0 && (
            <span className="inline-flex items-center gap-1 text-[var(--muted)]">
              <SplitSquareHorizontal size={13} aria-hidden="true" />
              {t('box_half_known', { count: bucket.halfKnown })}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--accent-text)]">
            {t('box_open')}
            <ChevronRight size={14} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </span>
      </span>
    </motion.button>
  )
}

/**
 * Der Karteikasten als Ganzes: sechs Lernphasen plus Archiv.
 *
 * Eine Vokabel liegt in der Phase ihrer **schwächeren** Richtung. Sie rückt
 * also erst weiter, wenn sie in beide Richtungen sitzt — der Zwischenschritt
 * steht als „halb gewusst" an jedem Fach und an jeder Vokabel im Fach.
 */
export default function LeitnerBoxOverview({ summary, level, uiLanguage, translations = {} }: Props) {
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const reduced = useReducedMotion() ?? false
  const [openPhase, setOpenPhase] = useState<BoxBucketKey | null>(null)

  return (
    <section aria-label={t('box_title')} className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">{t('box_title')}</h2>
          <p className="mt-1 max-w-prose text-base leading-relaxed text-[var(--muted)]">{t('box_intro')}</p>
        </div>
        <p className="text-base text-[var(--muted)]">
          {t('box_untouched', { count: summary.untouched })}
        </p>
      </div>

      <div className="sl-glass mb-4 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-bold text-[var(--foreground)]">{t('box_progress_label')}</span>
          <span className="shrink-0 text-xl font-bold tabular-nums text-[var(--foreground)]">{summary.percent}%</span>
        </div>
        <div
          className="sl-bar mt-3 h-2.5"
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

      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.buckets.map((bucket, index) => (
          <PhaseTile
            key={String(bucket.key)}
            bucket={bucket}
            t={t}
            reduced={reduced}
            delay={reduced ? 0 : index * 0.05}
            onOpen={() => setOpenPhase(bucket.key)}
          />
        ))}
      </div>

      <PhaseInspector
        phase={openPhase}
        level={level}
        uiLanguage={uiLanguage}
        translations={translations}
        onClose={() => setOpenPhase(null)}
      />
    </section>
  )
}
