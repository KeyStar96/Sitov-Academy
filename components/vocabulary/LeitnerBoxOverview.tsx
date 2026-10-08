'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createVocabularyTranslator, type VocabularyTranslations } from '@/lib/vocabulary-i18n'
import { phaseIntervalInDays, type BoxBucketKey } from '@/lib/vocabulary-box'
import type { VocabularyBoxSummary, VocabularyCarryoverSummary } from '@/lib/types/vocabulary'
import { carryoverTranslator } from '@/lib/vocabulary-carryover-i18n'
import SitovLearningBox from '@/components/learning/SitovLearningBox'
import { sitovTrainerUiCopy } from '@/lib/sitov-trainer-ui-i18n'
import LernkastenGuide from './LernkastenGuide'
import PhaseInspector, { type InspectorOrigin } from './PhaseInspector'
import './lernkasten.css'
export { sitovStackFill as stackFill, sitovStackLines as stackLines } from '@/components/learning/SitovLearningBox'

interface Props {
  summary: VocabularyBoxSummary
  level: string
  uiLanguage: string
  translations?: VocabularyTranslations
  /** Hauptaktion direkt unter der Box — der Start-Knopf der Trainer-Seite. */
  action?: ReactNode
  carryover?: VocabularyCarryoverSummary | null
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

/** Vocabulary evidence and inspector stay independent of the shared presentation. */
export default function LeitnerBoxOverview({ summary, level, uiLanguage, translations = {}, action, carryover }: Props) {
  const t = useMemo(() => createVocabularyTranslator(translations), [translations])
  const [openPhase, setOpenPhase] = useState<BoxBucketKey | null>(null)
  const [origin, setOrigin] = useState<InspectorOrigin | null>(null)
  const openBucket = summary.buckets.find((bucket) => bucket.key === openPhase) ?? null

  const open = useCallback((key: BoxBucketKey, from: HTMLElement) => {
    const rect = from.getBoundingClientRect()
    setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    setOpenPhase(key)
  }, [])
  const close = useCallback(() => setOpenPhase(null), [])

  return <>
    <SitovLearningBox title={t('box_title')} intro={t('box_intro')} scopeLabel={`${t('title')} · ${level}`}
      progressLabel={t('box_progress_label')} percent={summary.percent} tapHint={t('box_tap_hint')}
      stats={[
        { key: 'total', label: t('total'), value: summary.total },
        { key: 'active', label: t('in_training'), value: summary.inPhases },
        { key: 'learned', label: t('learned'), value: summary.learned },
        { key: 'due', label: t('due_now'), value: summary.due },
      ]}
      buckets={summary.buckets.map(bucket => ({ ...bucket,
        label: bucketName(bucket.key, t), interval: intervalLabel(bucket.key, t),
        countLabel: bucket.count === 1 ? t('box_word_count_one') : t('box_word_count', { count: bucket.count }),
        dueLabel: t('box_due_badge', { count: bucket.due }),
        halfKnownLabel: t('box_half_known', { count: bucket.halfKnown }),
        openLabel: t('box_open_aria', { name: bucketName(bucket.key, t) }),
      }))}
      selected={openPhase} onOpen={open} action={action}>
      <LernkastenGuide t={t} title={sitovTrainerUiCopy(uiLanguage).help}>
      {summary.untouched > 0 && <p className="mb-3 text-base text-[var(--muted)]">{t('box_untouched', { count: summary.untouched })}</p>}
      {carryover?.enabled && carryover.total > 0 && <div className="space-y-2 text-base text-[var(--muted)]">
        <p>{carryoverTranslator(uiLanguage)('separate', { count: carryover.total })}</p>
        <ul className="flex flex-wrap gap-2" aria-label={carryoverTranslator(uiLanguage)('title')}>
          {carryover.byLevel.map(item => <li key={item.level} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[var(--foreground)]">
            <span>{item.level}</span><span aria-hidden="true"> · </span><span>{item.total}</span>
          </li>)}
        </ul>
      </div>}
      </LernkastenGuide>
    </SitovLearningBox>
    <PhaseInspector phase={openPhase} bucket={openBucket} origin={origin} level={level} uiLanguage={uiLanguage} translations={translations} onClose={close} />
  </>
}
