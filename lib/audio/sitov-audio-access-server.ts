import 'server-only'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { dailyQuestLoadSchema, dailyQuestPreviewSchema, type DailyQuest } from '@/lib/daily-quest-contract'
import { sitovPronunciationPretestActionResultSchema, sitovPronunciationPretestCatalogSchema } from '@/lib/sitov-pronunciation-pretest-contract'
import { normalizeAudioText, vocabularyAudioText } from './neural-config'
import { sitovAudioReferenceSchema, type SitovAudioReference } from './sitov-audio-reference'
import type { NeuralAudioLanguage } from '@/lib/types/audio'

type Client = Awaited<ReturnType<typeof createClient>>
export interface SitovAuthorizedAudio {
  reference: SitovAudioReference
  language: NeuralAudioLanguage
  text: string
  textSha256: string
  /** Human recordings remain authored references; never substitute synthesized speech. */
  recording: string | null
}

function authorized(reference: SitovAudioReference, language: NeuralAudioLanguage, text: string, recording: string | null = null): SitovAuthorizedAudio {
  const normalized = normalizeAudioText(text)
  return { reference, language, text: normalized,
    textSha256: createHash('sha256').update(normalized).digest('hex'), recording }
}

function questText(quest: DailyQuest, part: string): string | null {
  if (part === 'scene') return quest.scene.audioText
  const [kind, stepId, wordId, extra] = part.split(':')
  if (extra !== undefined) return null
  const step = quest.steps.find(item => item.id === stepId)
  if (!step) return null
  if (kind === 'step' && wordId === undefined && step.kind !== 'discover') return step.audioText
  if (kind === 'word' && wordId && step.kind === 'discover') return step.words.find(word => word.id === wordId)?.audioText ?? null
  return null
}

/** Authenticated RLS reads only. No service role, caller-selected path, learner ID or proof. */
export async function resolveSitovAuthoredAudio(
  client: Client, reference: SitovAudioReference, language: NeuralAudioLanguage,
): Promise<SitovAuthorizedAudio | null> {
  const parsed = sitovAudioReferenceSchema.safeParse(reference)
  if (!parsed.success) return null
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  const profile = await loadLevelAccessProfile(client, user.id)
  if (!profile || !['student', 'teacher', 'admin'].includes(profile.role ?? '')) return null
  const staff = profile.role === 'teacher' || profile.role === 'admin'
  reference = parsed.data

  if (reference.kind === 'vocabulary_card') {
    const { data: card, error: cardError } = await client.from('learning_vocabulary_cards')
      .select('id,word_de,article,chunk_de,translations:vocabulary_translations(locale,translation,chunk_translation,context_sentence)')
      .eq('id', reference.id).eq('translations.locale', language).maybeSingle()
    if (cardError || !card) return null
    const translation = card.translations?.find(item => item.locale === language)
    const texts: Record<string, string | null | undefined> = language === 'de'
      ? { headword: vocabularyAudioText(card), chunk: card.chunk_de, example: translation?.context_sentence }
      : { translation: translation?.translation, translation_chunk: translation?.chunk_translation, example: translation?.context_sentence }
    const text = texts[reference.part]
    return typeof text === 'string' && text.trim() ? authorized(reference, language, text) : null
  }

  if (reference.kind === 'reading_text') {
    if (language !== 'de') return null
    const { data: reading, error: readingError } = await client.from('learning_reading_texts')
      .select('id,sentence_de,audio_url,unit:learning_units!inner(level)').eq('id', reference.id).maybeSingle()
    if (readingError || !reading) return null
    // The explicit persisted proof check also closes legacy hard/readiness reads
    // during migration. New RLS must repeat it for direct client table requests.
    if (!staff) {
      const result = await client.rpc('sitov_get_pronunciation_pretests', { p_level: reading.unit.level })
      if (result.error) return null
      const catalog = sitovPronunciationPretestActionResultSchema(sitovPronunciationPretestCatalogSchema).safeParse(result.data)
      const exactBodyVersion = createHash('sha256').update(reading.sentence_de).digest('hex')
      if (!catalog.success || catalog.data.ok === false
        || !catalog.data.data.some(entry => entry.textId === reference.id && entry.status === 'passed'
          && entry.proof && entry.textVersion === exactBodyVersion)) return null
    }
    const recording = reading.audio_url && !reading.audio_url.includes('/audio_cache/') ? reading.audio_url : null
    return authorized(reference, language, reading.sentence_de, recording)
  }

  if (language !== 'de') return null
  let quest: DailyQuest | null = null
  if (reference.kind === 'daily_quest') {
    if (staff) return null
    const result = await client.rpc('get_daily_quest')
    const parsedQuest = dailyQuestLoadSchema.safeParse(result.data)
    if (result.error || !parsedQuest.success || parsedQuest.data.quest?.id !== reference.id) return null
    quest = parsedQuest.data.quest
  } else {
    if (!staff) return null
    const result = await client.rpc('get_sitov_daily_quest_preview', { p_level: reference.level, p_template_key: reference.id })
    const parsedQuest = dailyQuestPreviewSchema.safeParse(result.data)
    if (result.error || !parsedQuest.success || parsedQuest.data.quest.templateKey !== reference.id) return null
    quest = parsedQuest.data.quest
  }
  const text = quest ? questText(quest, reference.part) : null
  return text ? authorized(reference, language, text) : null
}

/** Compatibility for existing vocabulary controls. Match only actual authored parts. */
export async function resolveSitovVocabularyAudio(client: Client, cardId: string, language: NeuralAudioLanguage, text: string) {
  if (!z.string().uuid().safeParse(cardId).success) return null
  const parts = language === 'de' ? ['headword', 'chunk', 'example'] : ['translation', 'translation_chunk', 'example']
  for (const part of parts) {
    const result = await resolveSitovAuthoredAudio(client, { kind: 'vocabulary_card', id: cardId, part }, language)
    if (result?.text === normalizeAudioText(text)) return result
  }
  return null
}
