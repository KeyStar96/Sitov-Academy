import translations from './criterion-translations.json'
import { sitovSimulationCopy } from './ui-copy'

/** Assessment guidance after the exam; task rubrics keep their original German. */
export function sitovSimulationCriterion(lang: string, source: string): string {
  const copy = sitovSimulationCopy(lang)
  if (copy.lang === 'de') return source
  const messages: Record<string, Record<'en' | 'ru' | 'uk' | 'tr', string>> = translations
  return messages[source]?.[copy.lang] ?? copy.t('criterionFallback')
}

export function hasSitovSimulationCriterionTranslation(source: string): boolean {
  return Object.hasOwn(translations, source)
}
