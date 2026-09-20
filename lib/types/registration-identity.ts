import { z } from 'zod'
import { uuidSchema } from './backend'

export const identityConflictSchema = z.object({
  person_id: uuidSchema, display_name: z.string(), email: z.string(), booking_count: z.number().int().nonnegative(),
  candidates: z.array(z.object({ auth_user_id: uuidSchema, display_name: z.string(), email: z.string(), can_assign: z.boolean() })),
})
export const identityConflictListSchema = z.object({ conflicts: z.array(identityConflictSchema) })
export const identityAssignmentSchema = z.object({ personId: uuidSchema, authUserId: uuidSchema, confirmed: z.literal(true) }).strict()
export const identityAssignmentResultSchema = z.object({ person_id: uuidSchema, auth_user_id: uuidSchema, resolved: z.literal(true) })
export type IdentityConflict = z.infer<typeof identityConflictSchema>
