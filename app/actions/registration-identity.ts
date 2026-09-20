'use server'
import { checkDatabaseError, checkRpcError, revalidateBackendPages, withBackendSession } from '@/lib/actions/backend'
import { identityAssignmentResultSchema, identityAssignmentSchema, identityConflictListSchema } from '@/lib/types/registration-identity'

export async function getRegistrationIdentityConflicts() {
  return withBackendSession(async ({ supabase }) => {
    const { data, error } = await supabase.rpc('list_registration_identity_conflicts')
    checkDatabaseError(error)
    checkRpcError(data)
    return identityConflictListSchema.parse(data).conflicts
  }, 'staff')
}

export async function resolveRegistrationIdentity(input: unknown) {
  return withBackendSession(async ({ supabase }) => {
    const parsed = identityAssignmentSchema.parse(input)
    const { data, error } = await supabase.rpc('resolve_registration_identity', {
      p_person_id: parsed.personId, p_auth_user_id: parsed.authUserId,
    })
    checkDatabaseError(error)
    checkRpcError(data)
    const result = identityAssignmentResultSchema.parse(data)
    revalidateBackendPages()
    return result
  }, 'staff')
}
