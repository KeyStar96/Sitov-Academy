'use server'

import { loadReplySenderNames, loadStaffPronunciationView, pronunciationPlaybackUrl } from '@/lib/pronunciation-playback-server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getRpcError } from '@/lib/rpc-errors'
import {
  createPronunciationSubmissionSchema, pronunciationMessageSchema,
  isOwnedPronunciationAudio, staffConversationStatus,
  type CreatePronunciationSubmissionInput, type SendPronunciationMessageInput,
  type PronunciationMutationResult, type PronunciationConversation, type PronunciationMessage,
  type PronunciationHideResult,
} from '@/lib/pronunciation-conversations'

type Client = Awaited<ReturnType<typeof createClient>>
function refreshPronunciation() {
  // The recording/message has already committed. A cache refresh cannot undo it
  // and must not invite a duplicate submission by reporting a failed save.
  try {
    revalidatePath('/[lang]/dashboard/level/[level]/pronunciation', 'page')
    revalidatePath('/[lang]/admin/submissions', 'page')
    revalidatePath('/[lang]/dashboard', 'page')
  } catch { console.error('Pronunciation saved, but route cache could not refresh') }
}
const playbackUrl = pronunciationPlaybackUrl
export async function createPronunciationSubmission(input: CreatePronunciationSubmissionInput): Promise<PronunciationMutationResult> {
  const parsed = createPronunciationSubmissionSchema.safeParse(input)
  if (!parsed.success) return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: 'not_authenticated' }
    if (!isOwnedPronunciationAudio(parsed.data.audioPath, user.id)) return { success: false, reason: 'invalid_input' }
    const { data, error } = await supabase.rpc('create_pronunciation_submission', { p_prompt_id: parsed.data.promptId, p_audio_path: parsed.data.audioPath })
    if (error) { console.error("Creating pronunciation conversation failed"); return { success: false, reason: 'save_failed' } }
    if (getRpcError(data)) return { success: false, reason: 'save_failed' }
    const id = z.uuid().parse(data)
    refreshPronunciation()
    return { success: true, id }
  } catch (error) { console.error("Creating pronunciation conversation failed"); return { success: false, reason: 'save_failed' } }
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
    if (error) { console.error("Sending pronunciation message failed"); return { success: false, reason: 'save_failed' } }
    // The teacher-reply mail is queued by a database trigger (migration 41), where the
    // learner's notification switch is enforced; nothing to do here.
    refreshPronunciation()
    return { success: true, id: data.id }
  } catch (error) { console.error("Sending pronunciation message failed"); return { success: false, reason: 'save_failed' } }
}
export async function markPronunciationSeen(submissionId: string): Promise<PronunciationMutationResult> {
  if (!z.uuid().safeParse(submissionId).success) return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('mark_pronunciation_seen', { p_submission_id: submissionId })
    if (error) { console.error("Marking pronunciation messages read failed"); return { success: false, reason: 'save_failed' } }
    if (getRpcError(data)) return { success: false, reason: 'save_failed' }
    try { revalidatePath('/[lang]/dashboard', 'page') }
    catch { console.error('Pronunciation receipt saved, but route cache could not refresh') }
    return { success: true }
  } catch (error) { console.error("Marking pronunciation messages read failed"); return { success: false, reason: 'save_failed' } }
}
/** Staff only – the database checks the role itself. Nothing is deleted: the learner keeps everything. */
async function setHidden(id: string, hidden: boolean, save: (supabase: Client, id: string) => PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<PronunciationHideResult> {
  const parsed = z.uuid().safeParse(id)
  if (!parsed.success || typeof hidden !== 'boolean') return { success: false, reason: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, reason: 'not_authenticated' }
    const { data, error } = await save(supabase, parsed.data)
    const failure = getRpcError(data)
    if (error || failure) {
      console.error("Changing the staff pronunciation view failed")
      const reason = (['not_authenticated', 'not_authorized', 'invalid_input', 'not_found'] as const).find(code => code === failure?.error)
      return { success: false, reason: reason ?? 'save_failed' }
    }
    if (!z.object({ success: z.literal(true), hidden: z.literal(hidden) }).safeParse(data).success) return { success: false, reason: 'save_failed' }
    // Saved; a cache failure must not report it as failed.
    try { revalidatePath('/[lang]/admin', 'layout') }
    catch { console.error("Staff pronunciation view could not refresh route cache") }
    return { success: true }
  } catch { console.error("Changing the staff pronunciation view failed"); return { success: false, reason: 'save_failed' } }
}
/** Entfernt eine Einreichung samt Gespräch aus der Lehreransicht (`hidden`) oder holt sie zurück. */
export async function setPronunciationSubmissionHidden(submissionId: string, hidden: boolean): Promise<PronunciationHideResult> {
  return setHidden(submissionId, hidden, (supabase, id) => supabase.rpc('set_pronunciation_submission_hidden', { p_submission_id: id, p_hidden: hidden }))
}
/** Entfernt eine einzelne Nachricht eines Lernenden aus der Lehreransicht oder holt sie zurück. */
export async function setPronunciationMessageHidden(messageId: string, hidden: boolean): Promise<PronunciationHideResult> {
  return setHidden(messageId, hidden, (supabase, id) => supabase.rpc('set_pronunciation_message_hidden', { p_message_id: id, p_hidden: hidden }))
}
export async function getPronunciationConversations(level?: string, submissionId?: string): Promise<PronunciationConversation[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const staff = profile?.role === 'teacher' || profile?.role === 'admin'
    let query = supabase.from('submissions').select(`id,auth_user_id,level,text_content,content_url,status,created_at,prompt_id,
      prompt:learning_reading_texts(unit:learning_units(label)),
      pronunciation_messages(id,sender_id,sender_role,text_content,audio_path,created_at,seen_at)`)
    if (!staff) query = query.eq('auth_user_id', user.id)
    if (level) query = query.eq('level', level)
    if (submissionId) query = query.eq('id', submissionId)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) { console.error("Loading pronunciation conversations failed"); return [] }
    const studentIds = [...new Set((data ?? []).map(row => row.auth_user_id))]
    const [{ data: profiles }, senderNames, staffView] = await Promise.all([
      studentIds.length ? supabase.from('people').select('auth_user_id,display_name,email').in('auth_user_id', studentIds) : Promise.resolve({ data: [] }),
      staff ? Promise.resolve(new Map<string, string>()) : loadReplySenderNames(supabase),
      // Lehrkräfte sehen nicht, was sie aus ihrer Ansicht entfernt haben; Lernende sehen immer alles.
      staff ? loadStaffPronunciationView(supabase) : Promise.resolve(null),
    ])
    const people = new Map((profiles ?? []).map(profile => [profile.auth_user_id, profile]))
    const rows = (data ?? []).filter(row => !staffView?.hiddenSubmissions.has(row.id))
    const conversations = await Promise.all(rows.map(async (row): Promise<PronunciationConversation> => {
      const all = row.pronunciation_messages ?? []
      const visible = all.filter(message => !staffView?.hiddenMessages.has(message.id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      const status = staffView ? staffConversationStatus(row.status ?? 'pending', visible.map(message => message.sender_role), all.length - visible.length) : row.status ?? 'pending'
      const messages: PronunciationMessage[] = [{ id: `recording-${row.id}`, senderRole: 'student', text: '', audioUrl: await playbackUrl(supabase, row.content_url), createdAt: row.created_at ?? '', unseen: false }]
      for (const message of visible) {
        const senderRole = message.sender_role === 'teacher' || message.sender_role === 'admin' ? message.sender_role : 'student'
        messages.push({ id: message.id, senderRole, text: message.text_content, audioUrl: await playbackUrl(supabase, message.audio_path), createdAt: message.created_at, unseen: !message.seen_at && (staff ? senderRole === 'student' : senderRole !== 'student'),
          ...(staff || senderRole === 'student' ? {} : { senderName: senderNames.get(message.sender_id) ?? null }) })
      }
      messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      return { id: row.id, level: row.level, title: row.prompt?.unit?.label ?? null, promptId: row.prompt_id, readingText: row.text_content, status, studentName: people.get(row.auth_user_id)?.display_name ?? null, studentEmail: staff ? people.get(row.auth_user_id)?.email ?? null : null, createdAt: row.created_at ?? '', messages, hasUnseen: messages.some((message) => message.unseen) }
    }))
    return conversations.sort((a, b) => (b.messages.at(-1)?.createdAt ?? '').localeCompare(a.messages.at(-1)?.createdAt ?? ''))
  } catch (error) { console.error("Loading pronunciation conversations failed"); return [] }
}
