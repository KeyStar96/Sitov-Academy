import { sitovTeacherText, sitovTeacherError, hasSitovTeacherTranslation } from '../exam-simulation/teacher-ui-copy'
import { examPrepText, hasExamPrepUiTranslation } from './ui-copy'

import translations from './teacher-ui-translations.json'

// Presentation-only strings. Task/source/answer data is never transformed.
const messages: Record<string, readonly string[]> = translations


export function sitovPrepTeacherText(lang: string, text: string, values: Record<string, string | number> = {}): string {
 const index = Math.max(0, ['de','en','ru','uk','tr'].indexOf(lang))
 const translated = messages[text]?.[index] ?? (hasExamPrepUiTranslation(text) ? examPrepText(lang,text) : sitovTeacherText(lang,text))
 return translated.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token))
}
export function hasSitovPrepTeacherTranslation(text: string): boolean { return Object.hasOwn(messages,text) || hasExamPrepUiTranslation(text) || hasSitovTeacherTranslation(text) }
export function sitovPrepTeacherError(lang: string, text?: string): string {
 if (text && (Object.hasOwn(messages,text) || Object.values(messages).some(values => values.includes(text)))) return sitovPrepTeacherText(lang,text)
 if (text && hasExamPrepUiTranslation(text)) return examPrepText(lang,text)
 return sitovTeacherError(lang,text)
}
export function sitovPrepTeacherLocale(lang: string): string { return ({de:'de-DE',en:'en-GB',ru:'ru-RU',uk:'uk-UA',tr:'tr-TR'} as Record<string,string>)[lang] ?? 'de-DE' }
