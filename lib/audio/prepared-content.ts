import type { Json } from '@/supabase/database.types'
import type { Trainer } from '@/lib/access/levels'
import type { NeuralSpeechAsset } from '@/lib/types/audio'
import { normalizeAudioText, vocabularyAudioText } from './neural-config'
import { validWordTimings } from './playback-settings'

export const SITOV_PREPARED_AUDIO_REQUIRED = 'prepared_audio_required'

export class SitovPreparedAudioRequiredError extends Error {
  readonly code = SITOV_PREPARED_AUDIO_REQUIRED
  constructor() {
    super(`Content publication failed: ${SITOV_PREPARED_AUDIO_REQUIRED}`)
    this.name = 'SitovPreparedAudioRequiredError'
  }
}

function object(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/** The same German utterances requested by the trainer audio controls. */
export function preparedLearningAudioTexts(trainer: Trainer, input: Json): string[] {
  const form = object(input)
  const texts: string[] = []
  const add = (value: Json | undefined) => { if (typeof value === 'string' && value.trim()) texts.push(normalizeAudioText(value)) }
  if (trainer === 'vocabulary') {
    if (typeof form.word_de === 'string') add(vocabularyAudioText({ word_de: form.word_de, article: typeof form.article === 'string' ? form.article : null }))
    add(form.chunk_de)
    add(form.context_sentence_de)
  }
  if (trainer === 'pronunciation') add(form.sentence_de)
  if (trainer === 'exercises') {
    const content = object(form.content)
    const answer = typeof content.correct_answer === 'string' ? content.correct_answer : ''
    if (form.type === 'fill_in_blank') {
      add(answer)
      add(`${typeof content.text_before === 'string' ? content.text_before : ''}${answer}${typeof content.text_after === 'string' ? content.text_after : ''}`)
    } else if (form.type === 'multiple_choice') {
      const question = typeof content.question === 'string' ? content.question : ''
      add(question.includes('___') ? question.replace('___', answer) : `${question} ${answer}`)
    } else if (form.type === 'sentence_building') add(answer)
  }
  return [...new Set(texts)]
}

/** Read prepared assets only. Publishing never starts model inference. */
export async function requirePreparedGermanAudio(texts: readonly string[]): Promise<Map<string, NeuralSpeechAsset>> {
  const unique = [...new Set(texts.map(normalizeAudioText).filter(Boolean))]
  const assets = new Map<string, NeuralSpeechAsset>()
  if (!unique.length) return assets
  // The imported cache is server-only. Pure payload extraction remains usable
  // by authoring tools without loading admin credentials or a storage client.
  const { findCachedAudio, neuralAudioPath } = await import('./neural-cache')
  const missing: string[] = []
  for (let offset = 0; offset < unique.length; offset += 8) {
    const batch = await Promise.all(unique.slice(offset, offset + 8).map(async text => {
      const asset = await findCachedAudio(neuralAudioPath(text, 'de'), text)
      if (!asset || !validWordTimings(asset.wordTimings, text)) {
        missing.push(text)
        return null
      }
      return [text, asset] as const
    }))
    for (const entry of batch) if (entry) assets.set(...entry)
  }
  if (missing.length) {
    const { requestGermanAudioPreparation } = await import('./preparation-queue')
    for (let offset = 0; offset < missing.length; offset += 8) {
      await Promise.all(missing.slice(offset, offset + 8).map(text => requestGermanAudioPreparation(text)))
    }
    throw new SitovPreparedAudioRequiredError()
  }
  return assets
}
