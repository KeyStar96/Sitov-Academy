import translations from './feedback-translations.json'
import rest from './feedback-rest-translations.json'
import { hasSitovSimulationFeedbackTranslation, sitovSimulationFeedbackCopy } from '@/lib/exam-simulation/feedback-copy'
import { toUiLocale } from '@/lib/locale-routing'

const messages: Record<string, Record<'en' | 'ru' | 'uk' | 'tr', string>> = { ...translations, ...rest }

/** Source examples stay German; assessment explanations use the interface language. */
export function localizeExamPrepExplanation(lang: string, source: string): string {
  const locale = toUiLocale(lang)
  if (locale === 'de') return source
  return messages[source]?.[locale] ?? sitovSimulationFeedbackCopy(locale, source) ?? source
}

export function hasExamPrepExplanationTranslation(source: string): boolean {
  return Object.hasOwn(messages, source) || hasSitovSimulationFeedbackTranslation(source)
}
