'use client'

import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { computePhaseDistribution, phaseBarClasses, type PhaseBucketKey, type PhaseCountCard } from '@/lib/vocabulary-ui'

interface PhaseDistributionChartProps {
  cards: readonly PhaseCountCard[]
  translations?: VocabularyTranslations
}

function bucketLabel(key: PhaseBucketKey, t: ReturnType<typeof createVocabularyTranslator>): string {
  return key === 'learned' ? t('phase_chart_learned_label') : t('phase_chart_phase_label', { phase: key })
}

/** Labelled horizontal bars preserve readable phase names at 320px without scrolling. */
export default function PhaseDistributionChart({ cards, translations = {} }: PhaseDistributionChartProps) {
  const t = createVocabularyTranslator(translations)
  const distribution = computePhaseDistribution(cards)
  const maxCount = Math.max(1, ...distribution.buckets.map(bucket => bucket.count))

  return <div className="min-w-0 space-y-6">
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="text-base font-bold text-[var(--foreground)]">{t('overall_progress_label')}</p>
      <div className="mt-3 flex min-w-0 items-center gap-3">
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--surface)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={distribution.overallPercent} aria-label={t('overall_progress_label')}>
          <div className="h-full rounded-full bg-[var(--success)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${distribution.overallPercent}%` }} />
        </div>
        <span className="shrink-0 text-xl font-bold tabular-nums text-[var(--foreground)]">{distribution.overallPercent}%</span>
      </div>
    </div>
    {distribution.totalInBox === 0 ? <p className="rounded-2xl border border-dashed border-[var(--border)] p-4 text-base leading-relaxed text-[var(--muted)]">{t('phase_chart_empty')}</p> :
      <ul className="min-w-0 space-y-4" aria-label={t('tab_phases')}>
        {distribution.buckets.map(bucket => {
          const colors = phaseBarClasses(bucket.key)
          const label = bucketLabel(bucket.key, t)
          return <li key={String(bucket.key)} className="min-w-0">
            <div className="mb-2 flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm leading-relaxed">
              <span className={`break-words font-bold ${colors.label}`}>{label}</span>
              <span className="break-words tabular-nums text-[var(--muted)]">{t('phase_chart_bar_count', { count: bucket.count })}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true">
              <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${(bucket.count / maxCount) * 100}%` }} />
            </div>
          </li>
        })}
      </ul>}
  </div>
}
