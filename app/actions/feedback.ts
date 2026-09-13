'use server'

import { publicStorageUrl } from '@/lib/storage-public-url'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'
import { createPronunciationSubmission, markPronunciationSeen, sendPronunciationMessage } from './pronunciation-conversations'
import { pronunciationAudioObjectPath, PRIVATE_PRONUNCIATION_BUCKET } from '@/lib/pronunciation-conversations'
import type { FeedbackActionResult, StudentSubmission, SubmissionParent, SubmitAudioInput,
  SubmitTeacherFeedbackInput, TeacherSubmission, TeacherFeedbackEntry, UnseenFeedbackSummary } from '@/lib/types/feedback'

type Client = Awaited<ReturnType<typeof createClient>>

/** Compatibility endpoint for the earlier recorder: replies belong to their existing conversation. */
export async function submitAudioUrl(input: SubmitAudioInput): Promise<FeedbackActionResult> {
  if (input.parentId) {
    return sendPronunciationMessage({ submissionId: input.parentId, text: '', audioPath: input.url })
  }
  if (!input.promptId) return { success: false, reason: 'invalid_input' }
  return createPronunciationSubmission({ promptId: input.promptId, audioPath: input.url })
}

async function signRecording(client: Client, reference: string | null): Promise<string | null> {
  if (!reference) return null
  const path = pronunciationAudioObjectPath(reference)
  if (!path) return null
  const { data, error } = await client.storage.from(PRIVATE_PRONUNCIATION_BUCKET).createSignedUrl(path, 3600)
  return error ? null : publicStorageUrl(data.signedUrl)
}

/** The chat message is the only stored feedback; the older cards receive a mapped DTO. */
async function loadFeedback(client: Client, submissionIds: string[]): Promise<Map<string, TeacherFeedbackEntry[]>> {
  const result = new Map<string, TeacherFeedbackEntry[]>()
  if (!submissionIds.length) return result
  const { data, error } = await client.from('pronunciation_messages')
    .select('submission_id,text_content,audio_path,created_at,seen_at')
    .in('submission_id', submissionIds).in('sender_role', ['teacher', 'admin']).order('created_at', { ascending: false })
  if (error) throw error
  for (const row of data ?? []) {
    const entries = result.get(row.submission_id) ?? []
    entries.push({ feedback_text: row.text_content, feedback_audio_url: await signRecording(client, row.audio_path), created_at: row.created_at, seen_at: row.seen_at })
    result.set(row.submission_id, entries)
  }
  return result
}

export async function getStudentSubmissions(level?: string): Promise<StudentSubmission[]> {
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return []
    let query = client.from('submissions').select('id,content_url,text_content,status,created_at,level,attempt_number,parent_id').eq('user_id', user.id)
    if (level) query = query.eq('level', level)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error
    const rows = data ?? []
    const feedback = await loadFeedback(client, rows.map(row => row.id))
    const parentIds = new Set(rows.flatMap(row => row.parent_id ? [row.parent_id] : []))
    return Promise.all(rows.map(async row => ({ ...row, content_url: await signRecording(client, row.content_url),
      attempt_number: row.attempt_number ?? 1, teacher_feedback: feedback.get(row.id) ?? [],
      hasResubmission: parentIds.has(row.id), hasUnseenFeedback: (feedback.get(row.id) ?? []).some(entry => entry.seen_at === null) })))
  } catch (error) { console.error('Student recordings unavailable', error); return [] }
}

/** Counts each teacher chat message once, irrespective of the compatibility feedback view. */
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

export async function markFeedbackSeen(submissionId: string): Promise<FeedbackActionResult> {
  return markPronunciationSeen(submissionId)
}

async function loadTeacherSubmissions(status: 'pending' | 'reviewed'): Promise<TeacherSubmission[]> {
  try {
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return []
    const { data: actor } = await client.from('profiles').select('role').eq('id', user.id).single()
    if (actor?.role !== 'teacher' && actor?.role !== 'admin') return []
    const { data, error } = await client.from('submissions')
      .select('id,user_id,type,content_url,text_content,status,created_at,level,parent_id,attempt_number')
      .eq('status', status).order('created_at', { ascending: status === 'pending' })
    if (error) throw error
    const rows = data ?? []
    const userIds = [...new Set(rows.map(row => row.user_id))]
    const parentIds = [...new Set(rows.flatMap(row => row.parent_id ? [row.parent_id] : []))]
    const [{ data: profiles, error: profilesError }, { data: parentRows, error: parentsError }, feedback] = await Promise.all([
      userIds.length ? client.from('profile_details').select('id,name,email,native_language').in('id', userIds) : { data: [], error: null },
      parentIds.length ? client.from('submissions').select('id,content_url,created_at,attempt_number').in('id', parentIds) : { data: [], error: null },
      loadFeedback(client, [...rows.map(row => row.id), ...parentIds]),
    ])
    if (profilesError || parentsError) throw profilesError ?? parentsError
    const people = new Map((profiles ?? []).map(profile => [profile.id, profile]))
    const parents = new Map<string, SubmissionParent>()
    for (const parent of parentRows ?? []) parents.set(parent.id, { ...parent, content_url: await signRecording(client, parent.content_url), teacher_feedback: feedback.get(parent.id) ?? [] })
    return Promise.all(rows.map(async row => {
      const person = people.get(row.user_id)
      return { ...row, content_url: await signRecording(client, row.content_url),
        profiles: person ? { name: person.name, email: person.email ?? '', native_language: person.native_language } : null,
        teacher_feedback: feedback.get(row.id) ?? [], parent: row.parent_id ? parents.get(row.parent_id) ?? null : null }
    }))
  } catch (error) { console.error('Teacher recordings unavailable', error); return [] }
}

export async function getPendingSubmissions(): Promise<TeacherSubmission[]> { return loadTeacherSubmissions('pending') }
export async function getCompletedSubmissions(): Promise<TeacherSubmission[]> { return loadTeacherSubmissions('reviewed') }

export async function submitTeacherFeedback(input: SubmitTeacherFeedbackInput): Promise<FeedbackActionResult> {
  try {
    if (!z.uuid().safeParse(input.submissionId).success) return { success: false, reason: 'invalid_input' }
    const client = await createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return { success: false, reason: 'not_authenticated' }
    const { data: actor } = await client.from('profiles').select('role').eq('id', user.id).single()
    if (actor?.role !== 'teacher' && actor?.role !== 'admin') return { success: false, reason: 'not_authenticated' }
    return sendPronunciationMessage({ submissionId: input.submissionId, text: input.feedbackText, audioPath: input.feedbackAudioUrl ?? null })
  } catch (error) { console.error('Teacher feedback could not be saved', error); return { success: false, reason: 'save_failed' } }
}
