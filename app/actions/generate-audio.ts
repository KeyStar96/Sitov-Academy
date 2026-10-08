'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { rateLimit } from '@/lib/ratelimit'
import { findCachedAudio, generateCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { AUDIO_MAX_TEXT_LENGTH, normalizeAudioText } from '@/lib/audio/neural-config'
import { sitovAudioGatewayUrl, sitovAudioReferenceSchema } from '@/lib/audio/sitov-audio-reference'
import { resolveSitovAuthoredAudio, resolveSitovVocabularyAudio } from '@/lib/audio/sitov-audio-access-server'
import { pronunciationAudioObjectPath } from '@/lib/pronunciation-conversations'
import type { GenerateAudioInput, GenerateAudioResult } from '@/lib/types/audio'

const inputSchema = z.object({
  text: z.string().trim().min(1).max(AUDIO_MAX_TEXT_LENGTH).refine(text => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)),
  language: z.enum(['de', 'ru', 'uk', 'en', 'tr']),
  cardId: z.string().uuid().optional(),
  reference: sitovAudioReferenceSchema.optional(),
  voice: z.literal('male').optional(),
}).strict()

/** Retrieve prepared German audio from an authorized authored identity only. */
export async function generateAudio(input: GenerateAudioInput): Promise<GenerateAudioResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success || (parsed.data.voice && parsed.data.language !== 'de')) return { success: false, error: 'invalid_input' }
  const { language, cardId, reference, voice } = parsed.data
  if ((!reference && !cardId) || (language !== 'de' && reference && reference.kind !== 'vocabulary_card')
    || (reference && cardId && (reference.kind !== 'vocabulary_card' || reference.id !== cardId))) return { success: false, error: 'invalid_input' }
  try {
    const client = await createClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (error || !user) return { success: false, error: 'unauthorized' }
    const text = normalizeAudioText(parsed.data.text)
    const source = reference ? await resolveSitovAuthoredAudio(client, reference, language)
      : await resolveSitovVocabularyAudio(client, cardId!, language, text)
    if (!source) return { success: false, error: 'forbidden' }
    if (source.text !== text) return { success: false, error: 'invalid_input' }
    if (!(await rateLimit(`audio-read:${user.id}`, 120, '60 s')).success) return { success: false, error: 'rate_limited' }
    const audioUrl = sitovAudioGatewayUrl(source.reference, language, source.textSha256)
    if (source.recording) {
      const path = pronunciationAudioObjectPath(source.recording)
      if (!path) return { success: false, error: 'audio_unavailable' }
      const result = await createAdminClient().storage.from('pronunciation_audio').info(path)
      return result.error || !result.data ? { success: false, error: 'audio_unavailable' }
        : { success: true, audioUrl, cached: true }
    }
    const path = voice ? neuralAudioPath(text, language, voice) : neuralAudioPath(text, language)
    const cachedAsset = await findCachedAudio(path, language === 'de' ? text : undefined)
    let asset = cachedAsset
    if (!asset) {
      // Inference for German is exclusively in the local, audited authoring workflow.
      if (language === 'de') return { success: false, error: 'audio_unavailable' }
      if (!(await rateLimit(`audio-generate:${user.id}`, 20, '60 s')).success) return { success: false, error: 'rate_limited' }
      const quota = await createAdminClient().rpc('sitov_reserve_audio_generation', { p_user_id: user.id, p_characters: text.length })
      if (quota.error) return { success: false, error: 'audio_unavailable' }
      if (quota.data !== true) return { success: false, error: 'rate_limited' }
      asset = await generateCachedAudio(text, language, path)
    }
    if (source.reference.kind === 'vocabulary_card' && source.reference.part === 'headword' && language === 'de') {
      const current = await client.from('learning_vocabulary_cards').select('id,word_de,article,audio_url').eq('id', source.reference.id).maybeSingle()
      if (!current.error && current.data && !current.data.audio_url) {
        const card = current.data
        let update = createAdminClient().from('learning_vocabulary_cards').update({ audio_url: asset.audioUrl })
          .eq('id', card.id).eq('word_de', card.word_de).is('audio_url', null)
        update = card.article === null ? update.is('article', null) : update.eq('article', card.article)
        if ((await update).error) throw new Error('audio_metadata_update_failed')
      }
    }
    return { success: true, audioUrl, cached: Boolean(cachedAsset), ...(asset.wordTimings ? { wordTimings: asset.wordTimings } : {}) }
  } catch {
    console.error('Authored audio retrieval failed')
    return { success: false, error: 'audio_unavailable' }
  }
}
