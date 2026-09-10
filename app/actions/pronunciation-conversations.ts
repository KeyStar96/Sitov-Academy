'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import {
  createPronunciationSubmissionSchema, pronunciationMessageSchema, pronunciationAudioObjectPath,
  isOwnedPronunciationAudio, PRIVATE_PRONUNCIATION_BUCKET,
  type CreatePronunciationSubmissionInput, type SendPronunciationMessageInput,
  type PronunciationMutationResult, type PronunciationConversation, type PronunciationMessage,
} from '@/lib/pronunciation-conversations'

type Client = Awaited<ReturnType<typeof createClient>>
function refreshPronunciation() {
  revalidatePath('/[lang]/dashboard/level/[level]/pronunciation', 'page')
  revalidatePath('/[lang]/admin/submissions', 'page')
  revalidatePath('/[lang]/dashboard', 'page')
}
async function playbackUrl(client: Client, reference: string | null): Promise<string | null> {
  if (!reference) return null
  const path = pronunciationAudioObjectPath(reference)
  if (!path) return reference.startsWith('https://') ? reference : null
  try {
    const { data, error } = await client.storage.from(PRIVATE_PRONUNCIATION_BUCKET).createSignedUrl(path, 3600)
    if (error) { console.error('Signing pronunciation recording failed', error.message); return null }
    return data.signedUrl
  } catch (error) { console.error('Signing pronunciation recording failed', error); return null }
}
export async function createPronunciationSubmission(input: CreatePronunciationSubmissionInput): Promise<PronunciationMutationResult> {
  const parsed = createPronunciationSubmissionSchema.safeParse(input)
  if (!parsed.success) return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: 'not_authenticated' }
    if (!isOwnedPronunciationAudio(parsed.data.audioPath, user.id)) return { success: false, reason: 'invalid_input' }
    const { data, error } = await supabase.rpc('create_pronunciation_submission', { p_prompt_id: parsed.data.promptId, p_audio_path: parsed.data.audioPath })
    if (error) { console.error('Creating pronunciation conversation failed', { userId: user.id, message: error.message }); return { success: false, reason: 'save_failed' } }
    refreshPronunciation()
    return { success: true, id: data }
  } catch (error) { console.error('Creating pronunciation conversation failed', error); return { success: false, reason: 'save_failed' } }
}
export async function sendPronunciationMessage(input: SendPronunciationMessageInput): Promise<PronunciationMutationResult> {
  const parsed = pronunciationMessageSchema.safeParse(input)
  if (!parsed.success) return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: 'not_authenticated' }
    if (parsed.data.audioPath && !isOwnedPronunciationAudio(parsed.data.audioPath, user.id)) return { success: false, reason: 'invalid_input' }
    // Database policies and a trigger validate membership, sender role and immutable recording ownership.
    const { data, error } = await supabase.from('pronunciation_messages').insert({ submission_id: parsed.data.submissionId, sender_id: user.id, text_content: parsed.data.text, audio_path: parsed.data.audioPath ?? null }).select('id').single()
    if (error) { console.error('Sending pronunciation message failed', { userId: user.id, message: error.message }); return { success: false, reason: 'save_failed' } }
    refreshPronunciation()
    return { success: true, id: data.id }
  } catch (error) { console.error('Sending pronunciation message failed', error); return { success: false, reason: 'save_failed' } }
}
export async function markPronunciationSeen(submissionId: string): Promise<PronunciationMutationResult> {
  if (!z.uuid().safeParse(submissionId).success) return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('mark_pronunciation_seen', { p_submission_id: submissionId })
    if (error) { console.error('Marking pronunciation messages read failed', error.message); return { success: false, reason: 'save_failed' } }
    await supabase.rpc('mark_feedback_seen', { p_submission_id: submissionId })
    revalidatePath('/[lang]/dashboard', 'page')
    return { success: true }
  } catch (error) { console.error('Marking pronunciation messages read failed', error); return { success: false, reason: 'save_failed' } }
}
export async function getPronunciationConversations(level?: string, submissionId?: string): Promise<PronunciationConversation[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const staff = profile?.role === 'teacher' || profile?.role === 'admin'
    let query = supabase.from('submissions').select(`id,user_id,level,prompt_title,text_content,content_url,status,created_at,
      profiles:user_id(name,email),teacher_feedback(id,feedback_text,feedback_audio_url,created_at,seen_at),
      pronunciation_messages(id,sender_role,text_content,audio_path,created_at,seen_at)`)
    if (!staff) query = query.eq('user_id', user.id)
    if (level) query = query.eq('level', level)
    if (submissionId) query = query.eq('id', submissionId)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) { console.error('Loading pronunciation conversations failed', { userId: user.id, message: error.message }); return [] }
    const conversations = await Promise.all((data ?? []).map(async (row): Promise<PronunciationConversation> => {
      const messages: PronunciationMessage[] = [{ id: `recording-${row.id}`, senderRole: 'student', text: '', audioUrl: await playbackUrl(supabase, row.content_url), createdAt: row.created_at ?? '', unseen: false }]
      for (const feedback of row.teacher_feedback ?? []) messages.push({ id: feedback.id, senderRole: 'teacher', text: feedback.feedback_text, audioUrl: await playbackUrl(supabase, feedback.feedback_audio_url), createdAt: feedback.created_at ?? '', unseen: !staff && !feedback.seen_at })
      for (const message of row.pronunciation_messages ?? []) {
        const senderRole = message.sender_role === 'teacher' || message.sender_role === 'admin' ? message.sender_role : 'student'
        messages.push({ id: message.id, senderRole, text: message.text_content, audioUrl: await playbackUrl(supabase, message.audio_path), createdAt: message.created_at, unseen: !message.seen_at && (staff ? senderRole === 'student' : senderRole !== 'student') })
      }
      messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      return { id: row.id, level: row.level, title: row.prompt_title, readingText: row.text_content, status: row.status ?? 'pending', studentName: row.profiles?.name ?? null, studentEmail: staff ? row.profiles?.email ?? null : null, createdAt: row.created_at ?? '', messages, hasUnseen: messages.some((message) => message.unseen) }
    }))
    return conversations.sort((a, b) => (b.messages.at(-1)?.createdAt ?? '').localeCompare(a.messages.at(-1)?.createdAt ?? ''))
  } catch (error) { console.error('Loading pronunciation conversations failed', error); return [] }
}
