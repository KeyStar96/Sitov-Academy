import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'
import { AUDIO_MAX_TEXT_LENGTH, normalizeAudioText } from './neural-config'
import { neuralAudioPath, SITOV_QWEN_PROFILE_FINGERPRINT } from './neural-identity'

/** Internal only: callers must authorize the learner or author before enqueueing. */
export async function requestGermanAudioPreparation(input: string): Promise<void> {
  const text = normalizeAudioText(input)
  if (!text || text.length > AUDIO_MAX_TEXT_LENGTH || [...text].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new Error('invalid_audio_preparation_text')
  }
  const { error } = await createAdminClient().from('sitov_audio_preparation_requests').upsert({
    cache_path: neuralAudioPath(text, 'de'),
    text,
    profile_fingerprint: SITOV_QWEN_PROFILE_FINGERPRINT,
  }, { onConflict: 'cache_path', ignoreDuplicates: true })
  // A repeated request never reopens an already prepared job.
  if (error) throw new Error('audio_preparation_queue_unavailable')
}
