import translations from './ui-translations.json'
import { toUiLocale } from '@/lib/locale-routing'
import type { ExamSkill } from './types'

const messages: Record<string, Record<'en' | 'ru' | 'uk' | 'tr', string>> = translations

/** Interface descriptions and assessment criteria are UI; German task source is separate. */
export function examPrepText(lang: string, source: string, values: Record<string, string | number> = {}): string {
  const locale = toUiLocale(lang)
  const text = locale === 'de' ? source : messages[source]?.[locale] ?? source
  return text.replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token))
}

export function hasExamPrepUiTranslation(source: string): boolean {
  return Object.hasOwn(messages, source)
}

/** Unknown server diagnostics must not force the interface back into German. */
export function examPrepError(lang: string, source: string | undefined, fallback: string): string {
  return examPrepText(lang, source && (toUiLocale(lang) === 'de' || hasExamPrepUiTranslation(source)) ? source : fallback)
}

export function getExamPrepUi(lang: string) {
  const t = (source: string, values?: Record<string, string | number>) => examPrepText(lang, source, values)
  const skillLabels: Record<ExamSkill, string> = {
    vocabulary: t('Wortschatz'), listening: t('Hören'), reading: t('Lesen'), writing: t('Schreiben'), speaking: t('Sprechen'),
  }
  return { t, skillLabels, lang: toUiLocale(lang) }
}

/** This authored evidence is UI prose; other evidence remains exact German source or solution. */
export function isExamPrepEvidenceExplanation(source: string): boolean {
  return source === 'Wörter und Erklärungen gehören jeweils zusammen.'
}
