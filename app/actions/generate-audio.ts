'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { hasTrainerAccess } from '@/lib/access/levels'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { rateLimit } from '@/lib/ratelimit'
import { findCachedAudio, generateCachedAudio, neuralAudioPath } from '@/lib/audio/neural-cache'
import { AUDIO_MAX_TEXT_LENGTH, normalizeAudioText, vocabularyAudioText } from '@/lib/audio/neural-config'
import type { GenerateAudioInput, GenerateAudioResult } from '@/lib/types/audio'

const inputSchema = z.object({
  text: z.string().trim().min(1).max(AUDIO_MAX_TEXT_LENGTH).refine(text => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)),
  language: z.enum(['de', 'ru', 'uk', 'en', 'tr']),
  cardId: z.string().uuid().optional(),
}).strict()

export async function generateAudio(input: GenerateAudioInput): Promise<GenerateAudioResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'unauthorized' }
    const profile = await loadLevelAccessProfile(supabase, user.id)
    if (!profile || !['student', 'teacher', 'admin'].includes(profile.role ?? '')) return { success: false, error: 'forbidden' }

    const { language, cardId } = parsed.data
    const text = normalizeAudioText(parsed.data.text)
    let card: { id: string; word_de: string; article: string | null; level: string; audio_url: string | null } | null = null
    if (cardId) {
      const result = await supabase.from('learning_vocabulary_cards').select('id,word_de,article,audio_url,unit:learning_units!inner(level)').eq('id', cardId).maybeSingle()
      if (result.error || !result.data || !hasTrainerAccess(profile, result.data.unit.level, 'vocabulary')) return { success: false, error: 'forbidden' }
      card = { ...result.data, level: result.data.unit.level }
      // audio_url represents only the canonical German headword, never translations or arbitrary text.
      if (language === 'de' && text !== vocabularyAudioText(card)) return { success: false, error: 'invalid_input' }
    }
    if (!(await rateLimit(`audio-read:${user.id}`, 120, '60 s')).success) return { success: false, error: 'rate_limited' }
    const path = neuralAudioPath(text, language)
    const cachedUrl = await findCachedAudio(path)
    let audioUrl = cachedUrl
    if (!audioUrl) {
      if (!(await rateLimit(`audio-generate:${user.id}`, 20, '60 s')).success) return { success: false, error: 'rate_limited' }
      audioUrl = await generateCachedAudio(text, language, path)
    }
    if (card && language === 'de' && !card.audio_url) {
      // Guard against a concurrent content edit or teacher-supplied recording. Never overwrite either.
      let update = createAdminClient().from('learning_vocabulary_cards').update({ audio_url: audioUrl })
        .eq('id', card.id).eq('word_de', card.word_de).is('audio_url', null)
      update = card.article === null ? update.is('article', null) : update.eq('article', card.article)
      const { error } = await update
      if (error) throw error
    }
    return { success: true, audioUrl, cached: Boolean(cachedUrl) }
  } catch (error) {
    console.error('Neural audio generation failed:', error instanceof Error ? error.message : 'provider or storage error')
    return { success: false, error: 'audio_unavailable' }
  }
}
