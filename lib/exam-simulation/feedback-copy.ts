import translations from './feedback-translations.json'
import { toUiLocale } from '@/lib/locale-routing'

/** Assessment prose is translated; quoted German terms keep their spelling. */
export function sitovSimulationFeedbackCopy(lang: string, source: string): string | null {
  const locale = toUiLocale(lang)
  if (locale === 'de') return source
  const messages: Record<string, Record<'en' | 'ru' | 'uk' | 'tr', string>> = translations
  return messages[source]?.[locale] ?? null
}

export function hasSitovSimulationFeedbackTranslation(source: string): boolean {
  return Object.hasOwn(translations, source)
}
