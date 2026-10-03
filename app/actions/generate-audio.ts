'use server'

import type { Tables } from '@/supabase/database.types'

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
  voice: z.literal('male').optional(),
}).strict()

export async function generateAudio(input: GenerateAudioInput): Promise<GenerateAudioResult> {
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success || (parsed.data.voice && parsed.data.language !== 'de')) return { success: false, error: 'invalid_input' }
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return { success: false, error: 'unauthorized' }
    const profile = await loadLevelAccessProfile(supabase, user.id)
    if (!profile || !['student', 'teacher', 'admin'].includes(profile.role ?? '')) return { success: false, error: 'forbidden' }

    const { language, cardId, voice } = parsed.data
    const text = normalizeAudioText(parsed.data.text)
    let card: { id: string; word_de: string; article: Tables<'learning_vocabulary_cards'>['article']; level: string; audio_url: string | null } | null = null
    let isGermanHeadword = false
    if (cardId) {
      const result = await supabase.from('learning_vocabulary_cards')
        .select('id,word_de,article,chunk_de,audio_url,unit:learning_units!inner(level),translations:vocabulary_translations(locale,context_sentence)')
        .eq('id', cardId).eq('translations.locale', 'de').maybeSingle()
      if (result.error || !result.data || !hasTrainerAccess(profile, result.data.unit.level, 'vocabulary')) return { success: false, error: 'forbidden' }
      card = { ...result.data, level: result.data.unit.level }
      if (language === 'de') {
        isGermanHeadword = text === vocabularyAudioText(card)
        // The revealed card plays its stored usage chunk and German example.
        // Foreign translations and caller-provided text never authorize these.
        const usageTexts = [result.data.chunk_de,
          ...(result.data.translations ?? []).filter(translation => translation.locale === 'de').map(translation => translation.context_sentence),
        ]
        if (!isGermanHeadword && !usageTexts.some(value => typeof value === 'string' && normalizeAudioText(value) === text)) {
          return { success: false, error: 'invalid_input' }
        }
      }
    }
    if (!(await rateLimit(`audio-read:${user.id}`, 120, '60 s')).success) return { success: false, error: 'rate_limited' }
    const path = voice ? neuralAudioPath(text, language, voice) : neuralAudioPath(text, language)
    const cachedAsset = language === 'de' ? await findCachedAudio(path, text) : await findCachedAudio(path)
    let asset = cachedAsset
    if (!asset) {
      // German audio is produced and aligned on the author's Mac before publication.
      // Student requests must never start inference or fall back to a different voice.
      if (language === 'de') return { success: false, error: 'audio_unavailable' }
      if (!(await rateLimit(`audio-generate:${user.id}`, 20, '60 s')).success) return { success: false, error: 'rate_limited' }
      asset = voice ? await generateCachedAudio(text, language, path, voice) : await generateCachedAudio(text, language, path)
    }
    if (card && isGermanHeadword && !card.audio_url) {
      // Guard against a concurrent content edit or teacher-supplied recording. Never overwrite either.
      let update = createAdminClient().from('learning_vocabulary_cards').update({ audio_url: asset.audioUrl })
        .eq('id', card.id).eq('word_de', card.word_de).is('audio_url', null)
      update = card.article === null ? update.is('article', null) : update.eq('article', card.article)
      const { error } = await update
      if (error) throw error
    }
    return { success: true, ...asset, cached: Boolean(cachedAsset) }
  } catch {
    console.error("Neural audio generation failed:")
    return { success: false, error: 'audio_unavailable' }
  }
}
