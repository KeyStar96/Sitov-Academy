import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'
import { resolveSitovAuthoredAudio } from '@/lib/audio/sitov-audio-access-server'
import { sitovAudioRequestSchema, sitovAudioByteRange } from '@/lib/audio/sitov-audio-reference'
import { findCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { AUDIO_CACHE_BUCKET, AUDIO_MAX_BYTES } from '@/lib/audio/neural-config'
import { pronunciationAudioObjectPath } from '@/lib/pronunciation-conversations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
}
const unavailable = (status = 404) => new Response(null, { status, headers: privateHeaders })

/** Every byte request repeats session, canonical scope and the persisted current test check. */
async function audio(request: Request, head: boolean) {
  try {
    const query = new URL(request.url).searchParams
    if (query.size !== 3 || !['reference', 'language', 'textSha256'].every(key => query.getAll(key).length === 1)) return unavailable(400)
    const parsed = sitovAudioRequestSchema.safeParse({
      reference: JSON.parse(query.get('reference') ?? 'null'), language: query.get('language'), textSha256: query.get('textSha256'),
    })
    if (!parsed.success) return unavailable(400)
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return unavailable(401)
    if (!(await rateLimit(`sitov-audio-bytes:${user.id}`, 180, '60 s')).success) return unavailable(429)
    const source = await resolveSitovAuthoredAudio(client, parsed.data.reference, parsed.data.language)
    if (!source || source.textSha256 !== parsed.data.textSha256) return unavailable()

    let bucket = AUDIO_CACHE_BUCKET
    let path = neuralAudioPath(source.text, source.language)
    if (source.recording) {
      // Historical conversations have their own participant authorization.
      // A new target reference still requires this text's current passed test.
      const recordingPath = pronunciationAudioObjectPath(source.recording)
      if (!recordingPath) return unavailable()
      bucket = 'pronunciation_audio'
      path = recordingPath
    } else if (!(await findCachedAudio(path, source.language === 'de' ? source.text : undefined))) return unavailable()

    // Storage service credentials stay on the server. Never redirect to a
    // public or signed object URL: subsequent Range requests must reauthorize.
    const { data: blob, error: downloadError } = await createAdminClient().storage.from(bucket).download(path)
    if (downloadError || !blob || blob.size <= 0 || blob.size > (source.recording ? 25 * 1024 * 1024 : AUDIO_MAX_BYTES)) return unavailable()
    const range = sitovAudioByteRange(request.headers.get('range'), blob.size)
    if (range === 'unsatisfiable') return new Response(null, { status: 416,
      headers: { ...privateHeaders, 'Content-Range': `bytes */${blob.size}` } })
    const start = range?.start ?? 0, end = range?.end ?? blob.size - 1
    const headers = { ...privateHeaders, 'Accept-Ranges': 'bytes',
      'Content-Type': source.recording ? (blob.type || 'audio/webm') : 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${blob.size}` } : {}),
    }
    return new Response(head ? null : blob.slice(start, end + 1), { status: range ? 206 : 200, headers })
  } catch {
    return unavailable()
  }
}

export function GET(request: Request) { return audio(request, false) }
export function HEAD(request: Request) { return audio(request, true) }
