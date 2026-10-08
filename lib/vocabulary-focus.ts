import { z } from 'zod'

/**
 * Problemwörter (Phase 11.3, Migration 54): Wörter, die im Vokabeltrainer
 * mindestens dreimal falsch waren, und Nomen, deren Artikel mindestens
 * zweimal fehlte oder falsch war. Sie werden getrennt von der Lernbox
 * gespeichert und über eine eigene Leiter wiederholt:
 * Stufe 0 (sofort) → 1 Tag → 3 Tage → 7 Tage → gemeistert.
 * Falsch bedeutet immer: zurück auf Stufe 0.
 */
export const FOCUS_FORMATS = ['article', 'choice', 'build', 'type'] as const
export type FocusFormat = typeof FOCUS_FORMATS[number]
export const FOCUS_REASONS = ['article', 'hard'] as const
export type FocusReason = typeof FOCUS_REASONS[number]
/** Stufen bis „gemeistert" (4 richtige Antworten in Folge über wachsende Abstände). */
export const FOCUS_STAGES = 4

const count = z.number().int().nonnegative()
const timestamp = z.string().min(1)
const reasons = z.array(z.enum(FOCUS_REASONS))

export const focusWordSchema = z.object({
  cardId: z.string().uuid(), word: z.string(), article: z.string().nullable(), level: z.string(),
  translation: z.string().nullable(), status: z.enum(['active', 'mastered']), stage: z.number().int().min(0).max(4),
  dueAt: timestamp.nullable(), due: z.boolean(), wrongCount: count, articleErrors: count, masteredAt: timestamp.nullable(), reasons,
})
export type FocusWord = z.infer<typeof focusWordSchema>

const base = { cardId: z.string().uuid(), stage: z.number().int().min(0).max(3), level: z.string(), prompt: z.string().min(1), noun: z.boolean(), reasons }
export const focusItemSchema = z.discriminatedUnion('format', [
  z.object({ ...base, format: z.literal('article'), word: z.string().min(1), options: z.array(z.enum(['der', 'die', 'das'])).length(3) }),
  z.object({ ...base, format: z.literal('choice'), options: z.array(z.string().min(1)).length(4) }),
  z.object({ ...base, format: z.literal('build'), letters: z.array(z.string().min(1)).min(3).max(20), article: z.enum(['der', 'die', 'das']).nullable() }),
  z.object({ ...base, format: z.literal('type'), firstLetter: z.string().min(1), length: count }),
])
export type FocusItem = z.infer<typeof focusItemSchema>

export const vocabularyFocusSchema = z.object({
  learningSourceLanguage: z.enum(['en', 'ru', 'uk', 'tr']).optional(),
  level: z.string().nullable(),
  summary: z.object({ active: count, due: count, mastered: count, articleWords: count, nextDueAt: timestamp.nullable() }),
  words: z.array(focusWordSchema),
  items: z.array(focusItemSchema),
})
export type VocabularyFocus = z.output<typeof vocabularyFocusSchema>

export const focusAnswerResultSchema = z.object({
  correct: z.boolean(),
  format: z.enum(FOCUS_FORMATS),
  stage: z.number().int().min(0).max(4),
  status: z.enum(['active', 'mastered']),
  dueAt: timestamp.nullable(),
  solution: z.object({ display: z.string(), word: z.string(), article: z.string().nullable() }),
  feedback: z.enum(['article_missing', 'article_wrong']).nullable().optional(),
})
export type FocusAnswerResult = z.output<typeof focusAnswerResultSchema>

export const focusAnswerInputSchema = z.object({
  requestId: z.string().uuid(),
  cardId: z.string().uuid(),
  format: z.enum(FOCUS_FORMATS),
  answer: z.string().trim().min(1).max(400),
  lang: z.enum(['de', 'en', 'ru', 'uk', 'tr']),
  learningSourceLanguage: z.enum(['en', 'ru', 'uk', 'tr']).optional(),
  expectedLearnerId: z.string().uuid().optional(),
}).strict()

export type FocusFailure = 'not_due' | 'not_found' | 'language' | 'not_authenticated' | 'failed'

/** Nach einer falschen Antwort kommt die Karte in derselben Runde noch einmal – frühestens nach zwei anderen. */
export function requeue<T>(queue: readonly T[], index: number, item: T): T[] {
  const next = [...queue]
  const at = Math.min(next.length, index + 3)
  next.splice(at, 0, item)
  return next
}
