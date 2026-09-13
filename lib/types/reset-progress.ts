import { z } from 'zod'

export const resetUserProgressSchema = z.object({ confirmation: z.literal('RESET_LEARNING_DATA') }).strict()
export type ResetUserProgressInput = z.infer<typeof resetUserProgressSchema>
export type ResetUserProgressResult =
  | { success: true }
  | { success: false; reason: 'invalid_input' | 'not_authenticated' | 'reset_failed' | 'reset_in_progress' }

export const learningResetBatchSchema = z.array(z.object({
  bucket_id: z.literal('pronunciation_audio'),
  object_name: z.string().min(1),
}))
