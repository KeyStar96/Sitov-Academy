import 'server-only'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/utils/supabase/admin'
import { checkDatabaseError } from '@/lib/actions/backend'

/** user must come from auth.getUser(). A persisted link survives email changes.
 * Save the verified association before requesting an email change. No matching
 * by mutable names and no fallback to the first member of a shared email.
 */
export async function resolveLegacyProfile(user: User, remember = false): Promise<{ id: string | null; unresolved: boolean }> {
  const admin = createAdminClient()
  const profile = await admin.from('profiles').select('legacy_user_id').eq('id', user.id).single()
  checkDatabaseError(profile.error)
  if (profile.data?.legacy_user_id) return { id: profile.data.legacy_user_id, unresolved: false }
  if (!user.email || !user.email_confirmed_at) return { id: null, unresolved: false }
  const email = user.email.replace(/[\\%_]/g, value => `\\${value}`)
  const people = await admin.from('users').select('id').ilike('email', email).limit(2)
  checkDatabaseError(people.error)
  const id = people.data?.length === 1 ? people.data[0].id : null
  if (id && remember) {
    const saved = await admin.from('profiles').update({ legacy_user_id: id })
      .eq('id', user.id).is('legacy_user_id', null)
    checkDatabaseError(saved.error)
  }
  return { id, unresolved: (people.data?.length ?? 0) > 1 }
}
