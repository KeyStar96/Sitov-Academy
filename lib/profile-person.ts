import 'server-only'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { BackendError, checkDatabaseError } from '@/lib/actions/backend'

/** user must come from auth.getUser(). A persisted link survives email changes.
 * Save the verified association before requesting an email change. No matching
 * by mutable names and no fallback to the first member of a shared email.
 */
export async function resolveVerifiedPerson(user: User): Promise<{ id: string | null; unresolved: boolean }> {
  if (!user.email_confirmed_at) return { id: null, unresolved: false }
  const supabase = await createClient()
  // No email or ID argument: the database derives identity from verified Auth.
  const { data, error } = await supabase.rpc('claim_verified_person')
  checkDatabaseError(error)
  const failure = z.object({ error: z.string(), message: z.string() }).safeParse(data)
  if (failure.success) throw new BackendError(failure.data.error === 'not_authenticated' ? 'not_authenticated' : 'request_failed')
  const parsed = z.object({ id: z.string().uuid().nullable(), unresolved: z.boolean() }).parse(data)
  return { id: parsed.id ?? null, unresolved: parsed.unresolved }
}
