import { createClient, SupabaseConfigError } from '@/utils/supabase/client'
import { z } from 'zod'
import { createSitovPronunciationUploadTicket, createSitovPronunciationReplyUploadTicket } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPronunciationPretestUploadTicketSchema } from '@/lib/sitov-pronunciation-pretest-contract'

/** All recordings are private and use immutable owner folders. */
export const AUDIO_BUCKET = 'pronunciation_audio'

/**
 * Reduziert einen `MediaRecorder`-MIME-Type auf den reinen Basistyp ohne
 * Codec-Parameter, z.B. `audio/webm;codecs=opus` → `audio/webm`.
 * Der volle String eignet sich nicht zuverlässig als HTTP-`Content-Type`
 * für den Storage-Upload; der Basistyp ist das, was Supabase Storage und
 * der `<audio>`-Tag beim Abspielen erwarten.
 */
export function baseMimeType(mimeType: string | undefined | null): string {
  if (!mimeType) return 'audio/webm'
  const base = mimeType.split(';')[0]?.trim()
  return base || 'audio/webm'
}

/** Dateiendung passend zum aufgenommenen MIME-Type (`audio/webm` → `webm`, `audio/mp4` → `mp4`). */
export function extensionForMimeType(mimeType: string): string {
  const base = baseMimeType(mimeType)
  if (base.includes('mpeg')) return 'mp3'
  if (base.includes('wav')) return 'wav'
  if (base.includes('mp4')) return 'mp4'
  if (base.includes('ogg')) return 'ogg'
  return 'webm'
}

export type AudioUploadResult =
  | { success: true; audioPath: string }
  | { success: false; reason: 'not_authenticated' | 'upload_failed' | 'not_configured' }

export type SitovRecordingPurpose = { purpose: 'target'; textId: string; textVersion?: string }
  | { purpose: 'reply'; submissionId: string }
const replyTicketSchema = sitovPronunciationPretestUploadTicketSchema.omit({ textVersion: true }).extend({ submissionId: z.uuid(), purpose: z.literal('reply') }).strict()
type PendingUpload = { requestId: string; ticket?: { path: string; expiresAt: string }; uploaded: boolean }
const sitovPendingUploads = new WeakMap<Blob, Map<string, PendingUpload>>()

/** Private recordings use immutable owner folders; only participants receive signed playback URLs. */
export async function uploadPrivatePronunciationRecording(blob: Blob, scope?: SitovRecordingPurpose): Promise<AudioUploadResult> {
  try {
    const contentType = baseMimeType(blob.type)
    if (blob.size === 0 || blob.size > 25 * 1024 * 1024 || !['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'].includes(contentType)) {
      return { success: false, reason: 'upload_failed' }
    }
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { success: false, reason: 'not_authenticated' }
    if (!scope || !z.uuid().safeParse(scope.purpose === 'target' ? scope.textId : scope.submissionId).success) return { success: false, reason: 'upload_failed' }
    const key = `${user.id}:${scope.purpose}:${scope.purpose === 'target' ? `${scope.textId}:${scope.textVersion ?? ''}` : scope.submissionId}`
    const slots = sitovPendingUploads.get(blob) ?? new Map<string, PendingUpload>()
    sitovPendingUploads.set(blob, slots)
    let slot = slots.get(key)
    if (!slot || (slot.ticket && Date.parse(slot.ticket.expiresAt) <= Date.now())) {
      slot = { requestId: crypto.randomUUID(), uploaded: false }; slots.set(key, slot)
    }
    if (!slot.ticket) {
      const extension = extensionForMimeType(contentType)
      const response = scope.purpose === 'target'
        ? await createSitovPronunciationUploadTicket({ textId: scope.textId, requestId: slot.requestId, extension })
        : await createSitovPronunciationReplyUploadTicket({ submissionId: scope.submissionId, requestId: slot.requestId, extension })
      if (response.ok === false) return { success: false, reason: response.error === 'authentication_required' ? 'not_authenticated' : 'upload_failed' }
      const ticket = scope.purpose === 'target' ? sitovPronunciationPretestUploadTicketSchema.safeParse(response.data) : replyTicketSchema.safeParse(response.data)
      if (!ticket.success || !ticket.data.path.startsWith(`${user.id}/`) || !ticket.data.path.endsWith(`.${extension}`)
        || Date.parse(ticket.data.expiresAt) <= Date.now()
        || (scope.purpose === 'reply' && (!('submissionId' in ticket.data) || ticket.data.submissionId !== scope.submissionId))
        || (scope.purpose === 'target' && scope.textVersion && (!('textVersion' in ticket.data) || ticket.data.textVersion !== scope.textVersion))) {
        slots.delete(key); return { success: false, reason: 'upload_failed' }
      }
      slot.ticket = ticket.data
    }
    // Recheck identity after the asynchronous server ticket call. No cached
    // upload can cross accounts; the server repeats purpose/version on consume.
    const current = await supabase.auth.getUser()
    if (current.error || current.data.user?.id !== user.id) { slots.delete(key); return { success: false, reason: 'not_authenticated' } }
    const path = slot.ticket.path
    if (Date.parse(slot.ticket.expiresAt) <= Date.now()) { slots.delete(key); return { success: false, reason: 'upload_failed' } }
    if (slot.uploaded) return { success: true, audioPath: `storage://${AUDIO_BUCKET}/${path}` }
    const { error: uploadError } = await supabase.storage.from('pronunciation_audio').upload(path, blob, { contentType, upsert: false })
    if (uploadError) {
      // The previous Storage response may have been lost after the insert.
      // Immutable-ticket retries accept only exactly the same captured bytes.
      if (String(uploadError.statusCode) === '409' || uploadError.message === 'The resource already exists') {
        const existing = await supabase.storage.from(AUDIO_BUCKET).download(path)
        if (!existing.error && existing.data?.size === blob.size) {
          const [expected, actual] = await Promise.all([blob.arrayBuffer(), existing.data.arrayBuffer()])
          const left = new Uint8Array(expected), right = new Uint8Array(actual)
          if (left.length === right.length && left.every((byte, index) => byte === right[index])) {
            slot.uploaded = true
            return { success: true, audioPath: `storage://${AUDIO_BUCKET}/${path}` }
          }
        }
      }
      console.error("Private pronunciation upload failed")
      return { success: false, reason: 'upload_failed' }
    }
    slot.uploaded = true
    return { success: true, audioPath: `storage://pronunciation_audio/${path}` }
  } catch (error) {
    if (error instanceof SupabaseConfigError) return { success: false, reason: 'not_configured' }
    console.error("Private pronunciation upload failed")
    return { success: false, reason: 'upload_failed' }
  }
}
