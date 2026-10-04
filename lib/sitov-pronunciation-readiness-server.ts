import 'server-only'
import { cache } from 'react'
import { z } from 'zod'
import { sitovPronunciationReadinessSchema, type SitovPronunciationReadiness } from './sitov-pronunciation-readiness'
import type { createClient } from '@/utils/supabase/server'

/** Share expensive evidence reads within this render only, keyed by the
 * authenticated client, level and optional student. No permissions are cached
 * between requests. Missing evidence still fails closed. */
const sitovPronunciationReadinessForRequest = cache(async (client: Awaited<ReturnType<typeof createClient>>, level: string, studentId: string | undefined): Promise<SitovPronunciationReadiness | null> => {
  try {
    const { data, error } = await client.rpc('sitov_get_pronunciation_readiness', {
      p_level: level, ...(studentId ? { p_student_id: studentId } : {}),
    })
    if (error) return null
    return sitovPronunciationReadinessSchema.safeParse(data).data ?? null
  } catch { return null }
})

export function loadSitovPronunciationReadiness(client: Awaited<ReturnType<typeof createClient>>, level: string, studentId?: string): Promise<SitovPronunciationReadiness | null> {
  // Normalize omitted and explicit undefined arguments to the same cache key.
  return sitovPronunciationReadinessForRequest(client, level, studentId)
}

/** Title-only metadata keeps past recordings identifiable when their current text is gated. */
export async function loadSitovPronunciationConversationTitles(client: Awaited<ReturnType<typeof createClient>>): Promise<Map<string, string>> {
  try {
    const result = await client.rpc('sitov_pronunciation_conversation_titles')
    if (!result || result.error) return new Map()
    const titles = z.array(z.object({ submission_id: z.uuid(), title: z.string() })).safeParse(result.data)
    return new Map(titles.success ? titles.data.map(row => [row.submission_id, row.title]) : [])
  } catch { return new Map() }
}
