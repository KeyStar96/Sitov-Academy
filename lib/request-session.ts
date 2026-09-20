import 'server-only'
import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'

/** React request memoization only: layouts and their page share one verified
 * Auth lookup. No cross-request cache, tokens or permissions survive a render.
 * Outside a React server render cache() calls through without memoization.
 */
export const requestSession = cache(async () => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return { supabase, user: error ? null : user }
})
