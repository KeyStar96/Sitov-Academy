'use server'

import { createClient } from '@/utils/supabase/server'
import type { UnseenFeedbackSummary } from '@/lib/types/feedback'

export async function getUnseenFeedbackSummary(): Promise<UnseenFeedbackSummary> {
  const empty: UnseenFeedbackSummary = { count: 0, latestLevel: null }
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return empty
    const { data, error } = await client.from('pronunciation_messages')
      .select('created_at, submissions!inner(level,user_id)')
      .is('seen_at', null).in('sender_role', ['teacher', 'admin']).eq('submissions.user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return { count: data?.length ?? 0, latestLevel: data?.[0]?.submissions?.level ?? null }
  } catch (error) { console.error('Unread feedback unavailable', error); return empty }
}
