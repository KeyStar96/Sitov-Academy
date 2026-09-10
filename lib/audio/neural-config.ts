import type { NeuralAudioLanguage } from '@/lib/types/audio'

export const NEURAL_VOICES = {
  de: { voice: 'de-DE-KatjaNeural', locale: 'de-DE' },
  ru: { voice: 'ru-RU-SvetlanaNeural', locale: 'ru-RU' },
  uk: { voice: 'uk-UA-PolinaNeural', locale: 'uk-UA' },
  en: { voice: 'en-US-AriaNeural', locale: 'en-US' },
  tr: { voice: 'tr-TR-EmelNeural', locale: 'tr-TR' },
} as const satisfies Record<NeuralAudioLanguage, { voice: string; locale: string }>

export const AUDIO_CACHE_BUCKET = 'audio_cache'
export const AUDIO_CACHE_VERSION = 'edge-v1'
export const AUDIO_MAX_BYTES = 1024 * 1024
export const AUDIO_MAX_TEXT_LENGTH = 800
export const AUDIO_RATE = '-10%'
export const AUDIO_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

export function normalizeAudioText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

export function vocabularyAudioText(card: { article: string | null; word_de: string }): string {
  const article = card.article && card.article !== 'none' ? card.article : ''
  return normalizeAudioText(`${article} ${card.word_de}`)
}
