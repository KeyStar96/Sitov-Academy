import { z } from 'zod'

export const ANSWER_STATUSES = ['EXACT', 'SOFT_ERROR', 'INCORRECT'] as const
export const SOFT_ERROR_REASONS = ['umlaut', 'typo'] as const
export type AnswerStatus = typeof ANSWER_STATUSES[number]
export type SoftErrorReason = typeof SOFT_ERROR_REASONS[number]
export const ORTHOGRAPHY_HINTS = ['capitalization', 'punctuation', 'capitalization_punctuation'] as const
export type OrthographyHint = typeof ORTHOGRAPHY_HINTS[number]
export const ARTICLE_FEEDBACK = ['article_missing', 'article_wrong'] as const
export type ArticleFeedback = typeof ARTICLE_FEEDBACK[number]

/** The database owns the result; clients validate and display this contract. */
export const answerGradeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('EXACT'), matched: z.string(), reason: z.null(), hint: z.enum(ORTHOGRAPHY_HINTS).nullable().optional() }),
  z.object({ status: z.literal('SOFT_ERROR'), matched: z.string(), reason: z.enum(SOFT_ERROR_REASONS), hint: z.null().optional() }),
  z.object({ status: z.literal('INCORRECT'), matched: z.null(), reason: z.null(), hint: z.null().optional() }),
])
export type AnswerGrade = z.infer<typeof answerGradeSchema>
export type SoftErrorTranslations = Partial<Record<SoftErrorReason, string>>
