import { publicStorageUrl } from '@/lib/storage-public-url'
import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { validWordTimings } from './playback-settings'
import type { GermanAudioVoice, NeuralSpeechAsset, NeuralAudioLanguage } from '@/lib/types/audio'
import { AUDIO_CACHE_BUCKET, AUDIO_CACHE_VERSION, AUDIO_FORMAT, AUDIO_RATE, SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS, neuralVoiceName, normalizeAudioText } from './neural-config'
import { synthesizeNeuralSpeech } from './edge-tts'

export function neuralAudioPath(text: string, language: NeuralAudioLanguage, voice?: GermanAudioVoice): string {
  const hash = createHash('sha256').update(JSON.stringify({
    text: normalizeAudioText(text), voice: neuralVoiceName(language, voice), rate: AUDIO_RATE, format: AUDIO_FORMAT,
    ...(language === 'de' ? { leadIn: SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS } : {}),
  })).digest('hex')
  return `${AUDIO_CACHE_VERSION}/${language}/${hash}.mp3`
}

export async function findCachedAudio(path: string): Promise<NeuralSpeechAsset | null> {
  const storage = createAdminClient().storage.from(AUDIO_CACHE_BUCKET)
  const { data, error } = await storage.info(path)
  if (error) {
    if ('statusCode' in error && ['400', '404'].includes(String(error.statusCode))) return null
    throw error
  }
  if (!data) return null
  const wordTimings = validWordTimings(data.metadata?.wordTimings)
  return { audioUrl: publicStorageUrl(storage.getPublicUrl(path).data.publicUrl), ...(wordTimings ? { wordTimings } : {}) }
}

// Deduplicate simultaneous requests in one worker; immutable paths handle cross-worker races.
const inFlight = new Map<string, Promise<NeuralSpeechAsset>>()

export function generateCachedAudio(text: string, language: NeuralAudioLanguage, path: string, voice?: GermanAudioVoice): Promise<NeuralSpeechAsset> {
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
