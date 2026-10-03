import { z } from 'zod'

const id = z.string().uuid()
const shortText = z.string().min(1).max(500)
const text = z.string().min(1).max(3000)
const stepId = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/)
export const dailyQuestDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const dailyQuestLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
export const sitovQuestTemplateKeySchema = z.string().min(1).max(120).regex(/^sitov-[a-z0-9-]+$/)
export const sitovQuestCatalogSchema = z.object({
  success: z.literal(true), templates: z.array(z.object({
    templateKey: sitovQuestTemplateKeySchema, level: dailyQuestLevelSchema,
    title: shortText, subtitle: text, day: z.number().int().min(0).max(100),
  })).max(1000),
})
export type SitovQuestCatalog = z.infer<typeof sitovQuestCatalogSchema>
export const dailyQuestStreakSchema = z.object({
  current: z.number().int().min(0), longest: z.number().int().min(0),
  lastCompletedDate: dailyQuestDateSchema.nullable(),
})
export const dailyQuestStepSchema = z.discriminatedUnion('kind', [
  z.object({ id: stepId, kind: z.literal('discover'), instruction: text,
    words: z.array(z.object({ id: stepId, text: shortText, audioText: text })).min(1).max(12) }),
  z.object({ id: stepId, kind: z.literal('sentence_build'), speakerId: stepId, prompt: text,
    pieces: z.array(z.object({ id: stepId, text: shortText })).min(2).max(20), audioText: text }),
  z.object({ id: stepId, kind: z.literal('dialogue_choice'), speakerId: stepId, prompt: text,
    options: z.array(z.object({ id: stepId, text })).min(2).max(8), audioText: text }),
])
/** An explicit allowlist: authoring solutions and row ownership never reach the client. */
export const dailyQuestSchema = z.object({
  id, date: dailyQuestDateSchema, status: z.enum(['active', 'completed', 'skipped']),
  level: dailyQuestLevelSchema, templateKey: shortText, title: shortText, subtitle: text,
  scene: z.object({ backgroundKey: z.string().regex(/^[a-z0-9_-]{1,80}$/),
    backgroundImage: z.string().max(300).regex(/^\/Bilder\/deutschreise\/[a-z0-9_/-]+\.(png|webp|jpe?g)$/), imageAlt: shortText,
    location: shortText, audioText: text, speakerId: stepId,
    characters: z.array(z.object({ id: stepId, name: shortText, voice: z.literal('male') })).min(1).max(6) }),
  personalization: z.object({ source: z.enum(['box1', 'recent_wrong', 'fallback']), cardId: id.nullable() }),
  steps: z.array(dailyQuestStepSchema).min(1).max(12), completedStepIds: z.array(stepId).max(12),
  completion: z.object({ title: shortText, text }),
})
export const dailyQuestLoadSchema = z.object({
  success: z.literal(true), enabled: z.boolean(), quest: dailyQuestSchema.nullable(), streak: dailyQuestStreakSchema,
})
export const dailyQuestStatusSchema = z.object({
  success: z.literal(true), enabled: z.boolean(), streak: dailyQuestStreakSchema,
  today: z.object({ assignmentId: id, status: z.enum(['active', 'completed', 'skipped']) }).nullable(),
})
export const dailyQuestLoginSchema = z.object({
  success: z.literal(true), enabled: z.boolean(), shouldRedirect: z.boolean(), assignmentId: id.nullable(), date: dailyQuestDateSchema,
})
export const dailyQuestMutationSchema = z.object({ success: z.literal(true), quest: dailyQuestSchema, streak: dailyQuestStreakSchema })
export const dailyQuestStepResultSchema = dailyQuestMutationSchema.extend({ correct: z.boolean(), feedback: z.string().max(3000) })
export const dailyQuestStepAnswerSchema = z.union([
  z.object({ wordIds: z.array(stepId).min(1).max(12) }).strict(),
  z.object({ pieceIds: z.array(stepId).min(2).max(20) }).strict(),
  z.object({ optionId: stepId }).strict(),
])
export const dailyQuestSubmissionSchema = z.object({ assignmentId: id, stepId, answer: dailyQuestStepAnswerSchema }).strict()

/** Staff-only authoring preview. Never use this schema for student responses. */
export const dailyQuestPreviewSchema = z.object({
  success: z.literal(true), quest: dailyQuestSchema,
  answerKey: z.object({ steps: z.record(stepId, z.object({
    accepted: z.array(z.array(stepId).min(1).max(20)).max(12).optional(), optionId: stepId.optional(),
  })) }),
})

export type DailyQuest = z.infer<typeof dailyQuestSchema>
export type DailyQuestStep = z.infer<typeof dailyQuestStepSchema>
export type DailyQuestStreak = z.infer<typeof dailyQuestStreakSchema>
export type DailyQuestStatus = z.infer<typeof dailyQuestStatusSchema>
export type DailyQuestStepAnswer = z.infer<typeof dailyQuestStepAnswerSchema>
export type DailyQuestStepResult = z.infer<typeof dailyQuestStepResultSchema>
export type DailyQuestMutation = z.infer<typeof dailyQuestMutationSchema>
export type DailyQuestLoad = z.infer<typeof dailyQuestLoadSchema>
export type DailyQuestPreview = z.infer<typeof dailyQuestPreviewSchema>
export type DailyQuestResult<T> = { data: T; error?: never } | { error: string; data?: never }
