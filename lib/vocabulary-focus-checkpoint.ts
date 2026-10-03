import { z } from 'zod'
import { focusAnswerResultSchema, focusItemSchema, type VocabularyFocus } from '@/lib/vocabulary-focus'

export const vocabularyFocusCheckpointSchema = z.object({
  version: z.literal(1), language: z.enum(['en', 'ru', 'uk', 'tr']),
  queue: z.array(z.object({ key: z.string().min(1), item: focusItemSchema })).max(500),
  index: z.number().int().nonnegative(), requeued: z.array(z.string().uuid()).max(500),
  feedback: z.object({ answer: z.string().max(400), data: focusAnswerResultSchema, dueLabel: z.string().nullable(), again: z.boolean() }).nullable(),
  outcomes: z.array(z.object({ key: z.string(), word: z.string(), correct: z.boolean() })).max(500),
  pending: z.object({ key: z.string(), requestId: z.string().uuid(), answer: z.string().min(1).max(400) }).nullable(),
}).superRefine((state, context) => {
  if (state.index > state.queue.length || (state.pending && state.pending.key !== state.queue[state.index]?.key)) {
    context.addIssue({ code: 'custom', message: 'Invalid focus checkpoint' })
  }
})
export type VocabularyFocusCheckpoint = z.infer<typeof vocabularyFocusCheckpointSchema>

export function restoreVocabularyFocusCheckpoint(raw: unknown, current: VocabularyFocus | null, language: string) {
  const parsed = vocabularyFocusCheckpointSchema.safeParse(raw)
  if (!parsed.success || parsed.data.language !== language || !current) return null
  // The fresh RPC returned only this account's currently authorized focus words.
  const owned = new Set([...current.words.map(word => word.cardId), ...current.items.map(item => item.cardId)])
  return parsed.data.queue.every(entry => owned.has(entry.item.cardId)) ? parsed.data : null
}
