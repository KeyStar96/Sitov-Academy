import 'server-only'

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import type { NeuralAudioLanguage } from '@/lib/types/audio'
import { AUDIO_CACHE_BUCKET, AUDIO_CACHE_VERSION, AUDIO_FORMAT, AUDIO_RATE, NEURAL_VOICES, normalizeAudioText } from './neural-config'
import { synthesizeNeuralAudio } from './edge-tts'

export function neuralAudioPath(text: string, language: NeuralAudioLanguage): string {
  const hash = createHash('sha256').update(JSON.stringify({
    text: normalizeAudioText(text), voice: NEURAL_VOICES[language].voice, rate: AUDIO_RATE, format: AUDIO_FORMAT,
  })).digest('hex')
  return `${AUDIO_CACHE_VERSION}/${language}/${hash}.mp3`
}

export async function findCachedAudio(path: string): Promise<string | null> {
  const storage = createAdminClient().storage.from(AUDIO_CACHE_BUCKET)
  const { data, error } = await storage.info(path)
  if (error) {
    if ('statusCode' in error && ['400', '404'].includes(String(error.statusCode))) return null
    throw error
  }
  if (!data) return null
  return storage.getPublicUrl(path).data.publicUrl
}

// Deduplicate simultaneous requests in one worker; immutable paths handle cross-worker races.
const inFlight = new Map<string, Promise<string>>()

export function generateCachedAudio(text: string, language: NeuralAudioLanguage, path: string): Promise<string> {
  const pending = inFlight.get(path)
  if (pending) return pending
  const work = (async () => {
    const storage = createAdminClient().storage.from(AUDIO_CACHE_BUCKET)
    const audio = await synthesizeNeuralAudio(text, language)
    const { error } = await storage.upload(path, audio, {
      contentType: 'audio/mpeg', cacheControl: '31536000', upsert: false,
    })
    if (error) {
      // Another request may have filled the same content-addressed key first.
      const winner = await findCachedAudio(path)
      if (winner) return winner
      throw error
    }
    return storage.getPublicUrl(path).data.publicUrl
  })().finally(() => { inFlight.delete(path) })
  inFlight.set(path, work)
  return work
}
