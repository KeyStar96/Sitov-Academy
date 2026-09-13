'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { queueTransactionalEmail } from '@/lib/mail'
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
  if (!path) return null
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
async function notifyPronunciationFeedback(supabase: Client, senderId: string, submissionId: string, messageId: string): Promise<void> {
  try {
    const { data: sender } = await supabase.from('profiles').select('role').eq('id', senderId).single()
    if (sender?.role !== 'teacher' && sender?.role !== 'admin') return
    const { data: thread } = await supabase.from('submissions').select('user_id,level').eq('id', submissionId).single()
    if (!thread) return
    const { data: learner } = await supabase.from('profile_details').select('name,email,ui_language').eq('id', thread.user_id).single()
    if (!learner?.email) return
    const locale = z.enum(['de', 'en', 'ru', 'uk', 'tr']).catch('en').parse(learner.ui_language)
    const queued = await queueTransactionalEmail({ dedupeKey: `pronunciation-message:${messageId}`, kind: 'feedback_available', to: learner.email, locale,
      payload: { name: learner.name ?? '', path: `/${locale}/dashboard/level/${encodeURIComponent(thread.level)}/pronunciation` } })
    if (!queued.success) console.error('Pronunciation notification could not be queued', { messageId })
  } catch { console.error('Pronunciation notification could not be queued', { messageId }) }
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
    // The recording is already committed. Mail failures must not turn a successful
    // send into a retry that creates a second chat message.
    await notifyPronunciationFeedback(supabase, user.id, parsed.data.submissionId, data.id)
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
      pronunciation_messages(id,sender_role,text_content,audio_path,created_at,seen_at)`)
    if (!staff) query = query.eq('user_id', user.id)
    if (level) query = query.eq('level', level)
    if (submissionId) query = query.eq('id', submissionId)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) { console.error('Loading pronunciation conversations failed', { userId: user.id, message: error.message }); return [] }
    const studentIds = [...new Set((data ?? []).map(row => row.user_id))]
    const { data: profiles } = studentIds.length ? await supabase.from('profile_details').select('id,name,email').in('id', studentIds) : { data: [] }
    const people = new Map((profiles ?? []).map(profile => [profile.id, profile]))
    const conversations = await Promise.all((data ?? []).map(async (row): Promise<PronunciationConversation> => {
      const messages: PronunciationMessage[] = [{ id: `recording-${row.id}`, senderRole: 'student', text: '', audioUrl: await playbackUrl(supabase, row.content_url), createdAt: row.created_at ?? '', unseen: false }]
      for (const message of row.pronunciation_messages ?? []) {
        const senderRole = message.sender_role === 'teacher' || message.sender_role === 'admin' ? message.sender_role : 'student'
        messages.push({ id: message.id, senderRole, text: message.text_content, audioUrl: await playbackUrl(supabase, message.audio_path), createdAt: message.created_at, unseen: !message.seen_at && (staff ? senderRole === 'student' : senderRole !== 'student') })
      }
      messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      return { id: row.id, level: row.level, title: row.prompt_title, readingText: row.text_content, status: row.status ?? 'pending', studentName: people.get(row.user_id)?.name ?? null, studentEmail: staff ? people.get(row.user_id)?.email ?? null : null, createdAt: row.created_at ?? '', messages, hasUnseen: messages.some((message) => message.unseen) }
    }))
    return conversations.sort((a, b) => (b.messages.at(-1)?.createdAt ?? '').localeCompare(a.messages.at(-1)?.createdAt ?? ''))
  } catch (error) { console.error('Loading pronunciation conversations failed', error); return [] }
}
