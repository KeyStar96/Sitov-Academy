import { z } from 'zod'

export const ANSWER_STATUSES = ['EXACT', 'SOFT_ERROR', 'INCORRECT'] as const
export const SOFT_ERROR_REASONS = ['punctuation', 'capitalization', 'umlaut', 'typo'] as const
export type AnswerStatus = typeof ANSWER_STATUSES[number]
export type SoftErrorReason = typeof SOFT_ERROR_REASONS[number]

/** The database owns the result; clients validate and display this contract. */
export const answerGradeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('EXACT'), matched: z.string(), reason: z.null() }),
  z.object({ status: z.literal('SOFT_ERROR'), matched: z.string(), reason: z.enum(SOFT_ERROR_REASONS) }),
  z.object({ status: z.literal('INCORRECT'), matched: z.null(), reason: z.null() }),
])
export type AnswerGrade = z.infer<typeof answerGradeSchema>
export type SoftErrorTranslations = Partial<Record<SoftErrorReason, string>>
