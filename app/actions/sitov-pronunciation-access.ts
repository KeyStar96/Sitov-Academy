'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { requestSession } from '@/lib/request-session'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { loadSitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness-server'
import { sitovPronunciationModeSchema, type SitovPronunciationMode, type SitovPronunciationReadiness } from '@/lib/sitov-pronunciation-readiness'

export async function getSitovPronunciationReadiness(level: string, studentId?: string): Promise<SitovPronunciationReadiness | null> {
  if (!z.enum(ACCESS_LEVELS).safeParse(level).success || (studentId && !z.uuid().safeParse(studentId).success)) return null
  try {
    const { supabase, user } = await requestSession()
    return user ? loadSitovPronunciationReadiness(supabase, level, studentId) : null
  } catch { return null }
}

/** Staff identity and student/level permissions are checked again inside the RPC. */
export async function setSitovPronunciationAccess(input: { studentId: string; level: string; mode: SitovPronunciationMode }): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = z.object({ studentId: z.uuid(), level: z.enum(ACCESS_LEVELS), mode: sitovPronunciationModeSchema }).strict().safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return { success: false, error: 'authentication_required' }
    const { data, error } = await client.rpc('sitov_set_pronunciation_access', { p_student_id: parsed.data.studentId, p_level: parsed.data.level, p_mode: parsed.data.mode })
    if (error || !z.object({ success: z.literal(true) }).safeParse(data).success) {
      const failure = z.object({ error: z.string() }).safeParse(data)
      return { success: false, error: failure.success ? failure.data.error : 'request_failed' }
    }
    try {
      revalidatePath('/[lang]/admin/students/[id]', 'page')
      revalidatePath('/[lang]/dashboard/level/[level]/pronunciation', 'page')
    } catch { /* The committed setting remains successful when cache refresh fails. */ }
    return { success: true }
  } catch { return { success: false, error: 'request_failed' } }
}
