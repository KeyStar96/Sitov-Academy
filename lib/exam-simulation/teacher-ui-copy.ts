import { sitovSimulationError } from './ui-copy'

// UI labels only; source tasks, learner answers and authored feedback are never passed here.
import translations from './teacher-ui-translations.json'

// Presentation-only strings. Task/source/answer data is never transformed.
const messages: Record<string, readonly string[]> = translations


export function sitovTeacherText(lang: string, text: string, values: Record<string, string | number> = {}): string {
 const index = Math.max(0, ['de','en','ru','uk','tr'].indexOf(lang))
 return (messages[text]?.[index] ?? text).replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token))
}
export function hasSitovTeacherTranslation(text: string): boolean { return Object.hasOwn(messages,text) }
export function sitovTeacherError(lang: string, text?: string): string {
 if (!text) return sitovSimulationError(lang)
 if (Object.values(messages).some(values => values.includes(text))) return sitovTeacherText(lang,text)
 const translated = sitovTeacherText(lang,text)
 return translated !== text || lang === 'de' ? translated : sitovSimulationError(lang,text)
}
