import { publicStorageUrl } from '@/lib/storage-public-url'
import 'server-only'
import { createHash } from 'node:crypto'

import { createAdminClient } from '@/utils/supabase/admin'
import { validWordTimings } from './playback-settings'
import type { GermanAudioVoice, NeuralSpeechAsset, NeuralAudioLanguage } from '@/lib/types/audio'
import { AUDIO_CACHE_BUCKET, AUDIO_CACHE_VERSION, SITOV_QWEN_PROFILE, normalizeAudioText } from './neural-config'
import { SITOV_QWEN_PROFILE_FINGERPRINT } from './neural-identity'
export { neuralAudioPath } from './neural-identity'
import { synthesizeNeuralSpeech } from './edge-tts'

export async function findCachedAudio(path: string, text?: string): Promise<NeuralSpeechAsset | null> {
  // A legacy German object must never become a fallback for a new module.
  if (/^[^/]+\/de\//u.test(path) && !path.startsWith(`${AUDIO_CACHE_VERSION}/de/`)) return null
  const storage = createAdminClient().storage.from(AUDIO_CACHE_BUCKET)
  const { data, error } = await storage.info(path)
  if (error) {
    if ('statusCode' in error && ['400', '404'].includes(String(error.statusCode))) return null
    throw error
  }
  if (!data) return null
  const wordTimings = validWordTimings(data.metadata?.wordTimings, text ? normalizeAudioText(text) : undefined)
  if (path.startsWith(`${AUDIO_CACHE_VERSION}/de/`) && (!wordTimings
    || data.metadata?.engine !== SITOV_QWEN_PROFILE.engine
    || data.metadata?.voice !== SITOV_QWEN_PROFILE.voice
    || data.metadata?.revision !== SITOV_QWEN_PROFILE.revision
    || data.metadata?.profileFingerprint !== SITOV_QWEN_PROFILE_FINGERPRINT
    || (text && data.metadata?.textSha256 !== createHash('sha256').update(normalizeAudioText(text)).digest('hex')))) return null
  return { audioUrl: publicStorageUrl(storage.getPublicUrl(path).data.publicUrl), ...(wordTimings ? { wordTimings } : {}) }
}

// Deduplicate simultaneous requests in one worker; immutable paths handle cross-worker races.
const inFlight = new Map<string, Promise<NeuralSpeechAsset>>()

export function generateCachedAudio(text: string, language: NeuralAudioLanguage, path: string, voice?: GermanAudioVoice): Promise<NeuralSpeechAsset> {
  if (language === 'de') return Promise.reject(new Error('German audio requires local preparation'))
  const pending = inFlight.get(path)
  if (pending) return pending
  const work = (async () => {
    const storage = createAdminClient().storage.from(AUDIO_CACHE_BUCKET)
    const { audio, wordTimings } = await (voice ? synthesizeNeuralSpeech(text, language, voice) : synthesizeNeuralSpeech(text, language))
    const { error } = await storage.upload(path, audio, {
      contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false,
      ...(wordTimings ? { metadata: { wordTimings } } : {}),
    })
    if (error) {
      // Another request may have filled the same content-addressed key first.
      const winner = await findCachedAudio(path)
      if (winner) return winner
      throw error
    }
    return { audioUrl: publicStorageUrl(storage.getPublicUrl(path).data.publicUrl), ...(wordTimings ? { wordTimings } : {}) }
  })().finally(() => { inFlight.delete(path) })
  inFlight.set(path, work)
  return work
}
