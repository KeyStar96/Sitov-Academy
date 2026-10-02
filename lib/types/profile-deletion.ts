import { z } from 'zod'

/** The confirmation words travel from the dialog to the database: no delete without them. */
export const deleteOwnProfileSchema = z.object({ confirmation: z.literal('DELETE_LEARNING_PROFILE') }).strict()
export const deleteStudentProfileSchema = z.object({
  studentId: z.uuid(), confirmation: z.literal('DELETE_STUDENT_PROFILE'),
}).strict()
export type DeleteOwnProfileInput = z.infer<typeof deleteOwnProfileSchema>
export type DeleteStudentProfileInput = z.infer<typeof deleteStudentProfileSchema>

export type ConfirmedDeleteFailure =
  | 'invalid_input' | 'not_authenticated' | 'not_authorized' | 'not_found' | 'conflict' | 'delete_failed'
export type ProfileDeletionResult = { success: true } | { success: false; reason: ConfirmedDeleteFailure }
