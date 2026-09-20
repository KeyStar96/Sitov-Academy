'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { performLearningReset } from '@/lib/reset-user-progress'
import { resetUserProgressSchema, type ResetUserProgressInput, type ResetUserProgressResult } from '@/lib/types/reset-progress'

/** Identity always comes from the verified session, never from form fields. */
export async function resetUserProgress(input: ResetUserProgressInput): Promise<ResetUserProgressResult> {
  if (!resetUserProgressSchema.safeParse(input).success) return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { success: false, reason: 'not_authenticated' }
    const result = await performLearningReset(supabase)
    if (result.success) {
      try {
        revalidatePath('/[lang]/dashboard', 'layout')
        revalidatePath('/[lang]/admin/submissions', 'page')
      } catch {
        console.error('[learning-reset] Completed reset could not refresh route cache')
      }
    }
    return result
  } catch (error) {
    console.error("[learning-reset] Reset could not complete")
    return { success: false, reason: 'reset_failed' }
  }
}
