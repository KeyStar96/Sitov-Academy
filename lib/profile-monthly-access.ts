import 'server-only'
import type { createClient } from '@/utils/supabase/server'
import { checkDatabaseError } from '@/lib/actions/backend'

/** A verified account alone is not a confirmed course registration. Never
 * infer enrolment from names, email metadata, trial lessons or monthly drafts. */
export async function hasConfirmedCourseRegistration(supabase: Awaited<ReturnType<typeof createClient>>, personId: string): Promise<boolean> {
  const result = await supabase.from('bookings').select('id')
    .eq('person_id', personId).eq('kind', 'registration').neq('status', 'rejected')
    .or('status.eq.confirmed,confirmed_at.not.is.null')
    .limit(1).maybeSingle()
  checkDatabaseError(result.error)
  return !!result.data
}
