import type germanDictionary from '@/dictionaries/de.json'
import type { Day } from '@/lib/course-config'
import { formatCalendarDate } from '@/lib/profile-course-calendar'
import { addCivilDays } from '@/lib/registration-start-dates'

export type RegistrationDictionary = Pick<typeof germanDictionary, 'registration' | 'timetable' | 'academy'>
export type FlowCopy = RegistrationDictionary['registration']['flow']

const LOCALE_TAGS: Record<string, string> = { de: 'de-DE', en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA', tr: 'tr-TR' }
const WEEKDAY_OFFSET: Record<Day, number> = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 }

export const localeTag = (lang: string) => LOCALE_TAGS[lang] ?? 'de-DE'

/** Replaces `{name}` placeholders; unknown placeholders stay visible. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => key in values ? String(values[key]) : match)
}

/** Plural forms carry one/few/many/other in every language (Russian and Ukrainian need all four). */
export function countLabel(forms: FlowCopy['costs']['sessions'], count: number, lang: string): string {
  const rule = new Intl.PluralRules(localeTag(lang)).select(count)
  return fill(rule in forms ? forms[rule as keyof typeof forms] : forms.other, { count })
}

// Prices keep the German format the academy invoices in (e.g. "75,00 €").
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
export const formatEuro = (value: number) => euro.format(value)

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

/** "Dienstag, 29. September" – with the year only when it differs from `referenceYear`. */
export function formatDay(iso: string, lang: string, referenceYear?: string): string {
  const withYear = referenceYear !== undefined && iso.slice(0, 4) !== referenceYear
  return capitalize(formatCalendarDate(iso, localeTag(lang), { weekday: 'long', day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }))
}

export function formatMonth(iso: string, lang: string): string {
  return capitalize(formatCalendarDate(iso, localeTag(lang), { month: 'long', year: 'numeric' }))
}

/** Short leaf parts for the calendar sheet: weekday, day number and month. */
export function leafParts(iso: string, lang: string) {
  const tag = localeTag(lang)
  return {
    weekday: formatCalendarDate(iso, tag, { weekday: 'short' }).replace('.', ''),
    day: Number(iso.slice(8, 10)),
    month: formatCalendarDate(iso, tag, { month: 'short' }).replace('.', ''),
  }
}

export function weekdayName(day: Day, lang: string): string {
  // 2024-01-01 was a Monday; only the weekday of the offset date matters.
  return capitalize(formatCalendarDate(addCivilDays('2024-01-01', WEEKDAY_OFFSET[day]), localeTag(lang), { weekday: 'long' }))
}
