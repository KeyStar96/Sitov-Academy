'use server'

import { createClient } from '@/utils/supabase/server'
import { loadReplySenderNames, pronunciationPlaybackUrl } from '@/lib/pronunciation-playback-server'
import type { UnseenFeedbackSummary } from '@/lib/types/feedback'

export async function getUnseenFeedbackSummary(): Promise<UnseenFeedbackSummary> {
  const empty: UnseenFeedbackSummary = { count: 0, latestLevel: null, latest: null }
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return empty
    const { data, error } = await client.from('pronunciation_messages')
      .select('created_at,text_content,audio_path,sender_id,submission_id,submissions!inner(level,auth_user_id,prompt:learning_reading_texts(unit:learning_units(label)))')
      .is('seen_at', null).in('sender_role', ['teacher', 'admin']).eq('submissions.auth_user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    const newest = data?.[0]
    if (!newest) return empty
    const [audioUrl, names] = await Promise.all([pronunciationPlaybackUrl(client, newest.audio_path), loadReplySenderNames(client)])
    return {
      count: data.length,
      latestLevel: newest.submissions?.level ?? null,
      latest: {
        submissionId: newest.submission_id, level: newest.submissions?.level ?? '', title: newest.submissions?.prompt?.unit?.label ?? null,
        text: newest.text_content, audioUrl, createdAt: newest.created_at, senderName: names.get(newest.sender_id) ?? null,
      },
    }
  } catch (error) { console.error("Unread feedback unavailable"); return empty }
}
