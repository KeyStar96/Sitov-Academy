import 'server-only'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import {
  profileRoleSchema,
  type ProfileRole, type BackendActionError, type BackendActionResult,
} from '@/lib/types/backend'

export class BackendError extends Error {
  constructor(public readonly code: BackendActionError) { super(code) }
}
export interface BackendContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  user: User
  role: ProfileRole | null
}

/** Validates the session using Auth, then reads authorization from the DB.
 * Uses the cookie client throughout: every data query remains subject to RLS.
 */
export async function withBackendSession<T>(
  work: (context: BackendContext) => Promise<T>,
  access: 'user' | 'staff' | 'admin' = 'user',
): Promise<BackendActionResult<T>> {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new BackendError('not_authenticated')
    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('role').eq('id', user.id).single()
    if (profileError || !profile) throw new BackendError('not_authorized')
    const parsedRole = profileRoleSchema.nullable().safeParse(profile.role)
    if (parsedRole.success === false) throw new BackendError('not_authorized')
    const role = parsedRole.data
    if (access === 'admin' && role !== 'admin') throw new BackendError('not_authorized')
    if (access === 'staff' && role !== 'teacher' && role !== 'admin') throw new BackendError('not_authorized')
    return { success: true, data: await work({ supabase, userId: user.id, user, role }) }
  } catch (error: unknown) {
    if (error instanceof BackendError) return { success: false, error: error.code }
    if (error instanceof z.ZodError) return { success: false, error: 'invalid_input' }
    // Do not expose database errors or contact/note text to clients or logs.
    console.error('[backend] Request failed')
    return { success: false, error: 'request_failed' }
  }
}
export function checkDatabaseError(error: { code: string } | null): void {
  if (!error) return
  const codes: Record<string, BackendActionError> = {
    '23505': 'conflict', '23503': 'invalid_input', '23514': 'invalid_input',
    '23502': 'invalid_input', '42501': 'not_authorized', PGRST116: 'not_found',
    '40001': 'conflict', '22008': 'month_changed',
  }
  throw new BackendError(codes[error.code] ?? 'request_failed')
}
export function revalidateBackendPages(): void {
  revalidatePath('/[lang]/dashboard', 'layout')
  revalidatePath('/[lang]/admin', 'layout')
}
