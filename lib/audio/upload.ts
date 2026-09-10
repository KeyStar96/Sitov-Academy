import { createClient, SupabaseConfigError } from '@/utils/supabase/client'

/**
 * Zentraler Upload-Pfad für Sprachaufnahmen.
 *
 * Die Pfad-Schemata sind absichtlich unverändert gegenüber der bisherigen
 * Inline-Logik, damit die bestehenden Storage-Policies weiter greifen:
 *   Schüler   `{userId}-{timestamp}.{ext}`
 *   Lehrkraft `feedback/{submissionId}_{timestamp}.{ext}`
 */

/**
 * Muss exakt mit dem Bucket in Supabase Storage übereinstimmen
 * (siehe `supabase/migrations/fix_audio_submissions_storage_policies.sql`).
 * Unterstrich, nicht Bindestrich – Storage-Bucket-Namen sind case- und
 * zeichensensitiv, ein Tippfehler hier führt zu einem stillen 404 beim Upload.
 */
export const AUDIO_BUCKET = 'audio_submissions'

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

/**
 * Liefert die für Logging hilfreichen Eckdaten eines Storage-Fehlers.
 * Der Supabase-JS-Client wirft für Storage-Aufrufe kein einheitliches
 * Error-Objekt (mal `StorageError`, mal ein rohes `Error` bei Netzwerkfehlern),
 * deshalb greifen wir defensiv auf mögliche Felder zu statt sie zu casten.
 */
function describeStorageError(err: unknown): Record<string, unknown> {
  if (err && typeof err === 'object') {
    const candidate = err as { message?: unknown; name?: unknown; status?: unknown; statusCode?: unknown }
    return {
      name: candidate.name,
      message: candidate.message,
      status: candidate.status ?? candidate.statusCode,
    }
  }
  return { message: String(err) }
}

async function uploadToBucket(blob: Blob, buildPath: (userId: string) => string): Promise<AudioUploadResult> {
  const contentType = baseMimeType(blob.type)
  let path = ''

  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('Audio-Upload: Sitzung nicht abrufbar.', describeStorageError(authError))
      return { success: false, reason: 'not_authenticated' }
    }

    if (!user) {
      console.error('Audio-Upload ohne angemeldeten Nutzer abgebrochen.')
      return { success: false, reason: 'not_authenticated' }
    }

    path = buildPath(user.id)

    const { error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(path, blob, { contentType, upsert: true })

    if (error) {
      // Transparentes Logging für Storage-Fehler (z.B. falscher Bucket-Name,
      // fehlende RLS-Policy, abgelaufene Sitzung) – niemals nur "es hat nicht
      // funktioniert" ohne Kontext für die Fehlersuche im Live-Betrieb.
      console.error('Audio-Upload zu Supabase Storage fehlgeschlagen:', {
        bucket: AUDIO_BUCKET,
        path,
        blobType: blob.type,
        contentType,
        blobSizeBytes: blob.size,
        ...describeStorageError(error),
      })
      return { success: false, reason: 'upload_failed' }
    }

    const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path)
    return { success: true, publicUrl: data.publicUrl }
  } catch (err) {
    // Fehlende NEXT_PUBLIC_-Konfiguration im Browser (siehe
    // `utils/supabase/client.ts`) ist ein Deployment-/Env-Problem, kein
    // Storage-Fehler – eigener Log-Text und eigener `reason`, damit sich das
    // in Produktion sofort von einem echten Upload-Fehler unterscheiden lässt.
    if (err instanceof SupabaseConfigError) {
      console.error('Audio-Upload abgebrochen: Supabase ist im Browser nicht konfiguriert.', {
        bucket: AUDIO_BUCKET,
        blobType: blob.type,
        contentType,
        blobSizeBytes: blob.size,
        message: err.message,
      })
      return { success: false, reason: 'not_configured' }
    }

    // Fängt Netzwerkfehler (Offline, Timeout, CORS) ab, die der
    // Supabase-Client als geworfene Exception statt als `{ error }` liefert.
    console.error('Unerwarteter Netzwerk- oder Laufzeitfehler beim Audio-Upload:', {
      bucket: AUDIO_BUCKET,
      path,
      blobType: blob.type,
      contentType,
      blobSizeBytes: blob.size,
      ...describeStorageError(err),
    })
    return { success: false, reason: 'upload_failed' }
  }
}

/** Aufnahme eines Schülers zur Korrektur. */
export function uploadStudentRecording(blob: Blob): Promise<AudioUploadResult> {
  const ext = extensionForMimeType(blob.type)
  return uploadToBucket(blob, (userId) => `${userId}-${Date.now()}.${ext}`)
}

/** Sprachnachricht der Lehrkraft zu einer Einreichung. */
export function uploadFeedbackRecording(blob: Blob, submissionId: string): Promise<AudioUploadResult> {
  const ext = extensionForMimeType(blob.type)
  return uploadToBucket(blob, () => `feedback/${submissionId}_${Date.now()}.${ext}`)
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
    console.error('Private pronunciation upload failed', error)
    return { success: false, reason: 'upload_failed' }
  }
}
