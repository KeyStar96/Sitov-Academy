import { z } from 'zod'
import { SOFT_ERROR_REASONS, ORTHOGRAPHY_HINTS, ARTICLE_FEEDBACK } from '@/lib/answer-grading'
import type { DueVocabularyCard } from '@/lib/types/vocabulary'
import type { LeitnerPhase } from '@/lib/leitner'
import type { SoftErrorReason, OrthographyHint, ArticleFeedback } from '@/lib/answer-grading'

const phase = z.number().int().min(1).max(6).transform(value => value as LeitnerPhase)
const id = z.string().min(1).max(100)
export type VocabularyFeedback = { correct: boolean; solution: string; isAlternative: boolean; softError: SoftErrorReason | null; hint: OrthographyHint | null; feedback: ArticleFeedback | null }
export const vocabularyFeedbackSchema = z.object({
  correct: z.boolean(), solution: z.string().max(4000), isAlternative: z.boolean(),
  softError: z.enum(SOFT_ERROR_REASONS).nullable(), hint: z.enum(ORTHOGRAPHY_HINTS).nullable(),
  feedback: z.enum(ARTICLE_FEEDBACK).nullable(),
}) as z.ZodType<VocabularyFeedback>

/** Display state only. Grades and review dates remain in the server's progress tables. */
export const vocabularyCheckpointSchema = z.object({
  version: z.literal(1),
  language: z.enum(['de', 'en', 'ru', 'uk', 'tr']), lesson: z.string().max(200).nullable(),
  plan: z.array(id).max(10000), deferredCount: z.number().int().nonnegative(),
  size: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(40), z.literal(50), z.literal('all')]),
  round: z.object({ number: z.number().int().positive(), start: z.number().int().nonnegative(), length: z.number().int().nonnegative() }),
  // Compact plan indexes keep even an "all cards" round within the account payload limit.
  queue: z.array(z.tuple([z.number().int().nonnegative(), phase, z.boolean()])).max(20000),
  index: z.number().int().nonnegative(), retryCount: z.number().int().nonnegative(),
  moves: z.array(z.object({ from: phase, to: phase, learned: z.boolean() })).max(10000),
  roundMovesFrom: z.number().int().nonnegative(), lastAnswered: id.nullable(),
  answer: z.string().max(4000), feedback: vocabularyFeedbackSchema.nullable(),
  pending: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('typed'), progressId: id, requestId: z.string().uuid(), answer: z.string().min(1).max(4000) }),
    z.object({ kind: z.literal('self'), progressId: id, requestId: z.string().uuid(), known: z.boolean() }),
  ]).nullable(),
}).superRefine((state, context) => {
  const planned = new Set(state.plan)
  if (planned.size !== state.plan.length || state.round.start + state.round.length > state.plan.length
    || state.index > state.queue.length || state.roundMovesFrom > state.moves.length
    || state.queue.some(item => item[0] >= state.plan.length)
    || (state.pending && state.pending.progressId !== state.plan[state.queue[state.index]?.[0]])) {
    context.addIssue({ code: 'custom', message: 'Invalid vocabulary checkpoint' })
  }
})
export type VocabularyCheckpoint = z.infer<typeof vocabularyCheckpointSchema>

/** Never restore card content from JSON. Rehydrate it from currently authorized server rows. */
export function restoreVocabularyCheckpoint(raw: unknown, cards: readonly DueVocabularyCard[]) {
  const parsed = vocabularyCheckpointSchema.safeParse(raw)
  if (!parsed.success) return null
  const state = parsed.data
  const byId = new Map(cards.map(card => [card.progressId, card]))
  if (state.plan.some(progressId => !byId.has(progressId))) return null
  return {
    state,
    plan: { cards: state.plan.map(progressId => byId.get(progressId)!), deferredCount: state.deferredCount },
    queue: state.queue.map(([at, phase, retry], index) => ({ card: { ...byId.get(state.plan[at])!, phase, box: phase }, retry, key: `${state.plan[at]}:${index}` })),
  }
}
