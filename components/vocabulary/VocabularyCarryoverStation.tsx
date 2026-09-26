'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Layers } from 'lucide-react'
import { setVocabularyCarryover } from '@/app/actions/vocabulary'
import { carryoverTranslator } from '@/lib/vocabulary-carryover-i18n'
import { phaseTone } from '@/lib/vocabulary-box'
import type { VocabularyCarryoverSummary } from '@/lib/types/vocabulary'
import { announceVocabularyCarryoverChange } from '@/lib/learning-reset-events'

export default function VocabularyCarryoverStation({ summary, lang, learnerId }: {
  summary: VocabularyCarryoverSummary
  lang: string
  learnerId?: string | null
}) {
  const router = useRouter()
  const t = carryoverTranslator(lang)
  const titleId = useId()
  const [enabled, setEnabled] = useState(summary.enabled)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setEnabled(summary.enabled) }, [summary])

  async function toggle() {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      const result = await setVocabularyCarryover(summary.targetLevel, !enabled, learnerId ?? undefined)
      if (!result.success) throw new Error('carryover_save_failed')
      setEnabled(result.carryover.enabled)
      if (learnerId) announceVocabularyCarryoverChange(learnerId)
      router.refresh()
    } catch { setFailed(true) } finally { setBusy(false) }
  }

  return <article className="st-own-words" aria-labelledby={titleId} data-inbox={enabled}>
    <div className="flex items-start gap-3">
      <span className="st-own-words__icon" aria-hidden="true"><Layers size={22} /></span>
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="st-path__name">{t('title')}</h3>
        <p className="st-path__meta">{t('count', { count: summary.total })}</p>
      </div>
    </div>
    <button type="button" role="switch" aria-checked={enabled} aria-label={t('switch')} aria-busy={busy || undefined}
      disabled={busy || (!enabled && summary.total === 0)} onClick={() => void toggle()} className="st-switch min-h-12">
      <span className="st-switch__track" aria-hidden="true"><span className="st-switch__thumb">{enabled && <Check size={16} strokeWidth={3} />}</span></span>
      <span className="flex min-w-0 flex-col"><span className="st-switch__label">{t(enabled ? 'on' : 'off')}</span><span className="st-switch__hint">{t('hint')}</span></span>
    </button>
    {summary.total === 0 ? <p className="text-base text-[var(--muted)]">{t('empty')}</p> : <ul className="space-y-4" aria-label={t('title')}>
      {summary.byLevel.map(origin => <li key={origin.level}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-base"><strong>{origin.level}</strong><span>{t('count', { count: origin.total })}</span></div>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {origin.box.buckets.filter(bucket => bucket.key !== 'learned').map(bucket => {
            const tone = phaseTone(bucket.key)
            return <li key={bucket.key} aria-label={t('phase', { phase: bucket.key, count: bucket.count })}
              className={`rounded-xl border border-[var(--border)] px-2 py-2 text-center text-base ${tone.soft} ${tone.text}`}>
              <span aria-hidden="true" className="block font-semibold">{bucket.key}</span><strong aria-hidden="true" className="text-lg tabular-nums">{bucket.count}</strong>
            </li>
          })}
        </ul>
      </li>)}
    </ul>}
    {failed && <p role="alert" className="st-path__error">{t('error')}</p>}
  </article>
}
