import { z } from 'zod'
import { sitovPronunciationPretestCatalogSchema, type SitovPronunciationPretestActionResult, type SitovPronunciationPretestCatalogEntry } from '@/lib/sitov-pronunciation-pretest-contract'
import type { SitovLearningTargetError } from '@/lib/learning/sitov-learning-target-i18n'

/** Absence preserves normal selection; an explicit request must resolve exactly. */
export function sitovPronunciationTargetError(raw: string | string[] | undefined, level: string, catalog?: SitovPronunciationPretestActionResult<SitovPronunciationPretestCatalogEntry[]>): SitovLearningTargetError | null {
  if (raw === undefined) return null
  if (!z.string().uuid().safeParse(raw).success) return 'unavailable'
  if (!catalog) return 'retryable'
  if (catalog.ok === false) return catalog.retryable ? 'retryable' : 'unavailable'
  const parsed = sitovPronunciationPretestCatalogSchema.safeParse(catalog.data)
  if (!parsed.success) return 'retryable'
  const exact = parsed.data.filter(entry => entry.textId === raw && entry.level === level)
  return exact.length === 1 && exact[0].target ? null : 'unavailable'
}
