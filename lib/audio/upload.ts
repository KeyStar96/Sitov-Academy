import { createClient, SupabaseConfigError } from '@/utils/supabase/client'

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
  | { success: true; publicUrl: string }
  | { success: false; reason: 'not_authenticated' | 'upload_failed' | 'not_configured' }

/** Compatibility for the earlier recorder controls; both use the same private store. */
export function uploadStudentRecording(blob: Blob): Promise<AudioUploadResult> {
  return uploadPrivatePronunciationRecording(blob)
}
export function uploadFeedbackRecording(blob: Blob, _submissionId: string): Promise<AudioUploadResult> {
  return uploadPrivatePronunciationRecording(blob)
}

/** Private recordings use immutable owner folders; only participants receive signed playback URLs. */
export async function uploadPrivatePronunciationRecording(blob: Blob): Promise<AudioUploadResult> {
  try {
    const contentType = baseMimeType(blob.type)
    if (blob.size === 0 || blob.size > 25 * 1024 * 1024 || !['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'].includes(contentType)) {
      return { success: false, reason: 'upload_failed' }
    }
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return { success: false, reason: 'not_authenticated' }
    const path = `${user.id}/${crypto.randomUUID()}.${extensionForMimeType(contentType)}`
    const { error: uploadError } = await supabase.storage.from('pronunciation_audio').upload(path, blob, { contentType, upsert: false })
    if (uploadError) {
      console.error('Private pronunciation upload failed', { userId: user.id, message: uploadError.message })
      return { success: false, reason: 'upload_failed' }
    }
    return { success: true, publicUrl: `storage://pronunciation_audio/${path}` }
  } catch (error) {
    if (error instanceof SupabaseConfigError) return { success: false, reason: 'not_configured' }
    console.error('Private pronunciation upload failed', error)
    return { success: false, reason: 'upload_failed' }
  }
}
