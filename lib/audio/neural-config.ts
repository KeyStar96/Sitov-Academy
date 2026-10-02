import type { GermanAudioVoice, NeuralAudioLanguage } from '@/lib/types/audio'

export const NEURAL_VOICES = {
  de: { voice: 'de_DE-thorsten-high', locale: 'de-DE' },
  ru: { voice: 'ru_RU-denis-medium', locale: 'ru-RU' },
  uk: { voice: 'uk_UA-ukrainian_tts-medium-speaker2', locale: 'uk-UA' },
  en: { voice: 'en_US-ljspeech-high', locale: 'en-US' },
  tr: { voice: 'espeak-ng-tr', locale: 'tr-TR' },
} as const satisfies Record<NeuralAudioLanguage, { voice: string; locale: string }>

// MLS speaker 2037 (Piper ID 2), female in the original MLS metadata.
export const GERMAN_FEMALE_VOICE = 'de_DE-mls-medium-speaker2'
export function neuralVoiceName(language: NeuralAudioLanguage, voice?: GermanAudioVoice): string {
  return language === 'de' && voice === 'female' ? GERMAN_FEMALE_VOICE : NEURAL_VOICES[language].voice
}

export const AUDIO_CACHE_BUCKET = 'audio_cache'
export const AUDIO_CACHE_VERSION = 'piper-local-v2'
export const AUDIO_MAX_BYTES = 2 * 1024 * 1024
export const AUDIO_MAX_TEXT_LENGTH = 3000
export const AUDIO_RATE = 'piper-length-1-espeak-145-word-timings'
export const AUDIO_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

export function normalizeAudioText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

export function vocabularyAudioText(card: { article: string | null; word_de: string }): string {
  const article = card.article && card.article !== 'none' ? card.article : ''
  return normalizeAudioText(`${article} ${card.word_de}`)
}
