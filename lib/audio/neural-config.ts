import type { GermanAudioVoice, NeuralAudioLanguage } from '@/lib/types/audio'
import qwenProfile from './models/sitov-qwen-male-de/config.json'

export const NEURAL_VOICES = {
  de: { voice: qwenProfile.voice, locale: 'de-DE' },
  ru: { voice: 'ru_RU-denis-medium', locale: 'ru-RU' },
  uk: { voice: 'uk_UA-ukrainian_tts-medium-speaker2', locale: 'uk-UA' },
  en: { voice: 'en_US-ljspeech-high', locale: 'en-US' },
  tr: { voice: 'espeak-ng-tr', locale: 'tr-TR' },
} as const satisfies Record<NeuralAudioLanguage, { voice: string; locale: string }>

export const SITOV_QWEN_PROFILE = qwenProfile
export const SITOV_QWEN_REVISION = qwenProfile.revision
export function neuralVoiceName(language: NeuralAudioLanguage, voice?: GermanAudioVoice): string {
  if (voice && (language !== 'de' || voice !== 'male')) throw new Error('Invalid synthesis voice')
  return NEURAL_VOICES[language].voice
}

export const AUDIO_CACHE_BUCKET = 'audio_cache'
export const AUDIO_CACHE_VERSION = 'sitov-qwen-v1'
export const SITOV_LEGACY_AUDIO_CACHE_VERSION = 'piper-local-v2'
export const AUDIO_MAX_BYTES = 2 * 1024 * 1024
export const AUDIO_MAX_TEXT_LENGTH = 3000
export const AUDIO_RATE = 'qwen-native-1-lufs-18-aligned-v1'
export const SITOV_LEGACY_AUDIO_RATE = 'piper-length-1-espeak-145-word-timings'
// Lets native mobile audio output wake before the first spoken phoneme.
export const SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS = 0.35
export const AUDIO_FORMAT = 'audio-24khz-48kbitrate-mono-mp3'

export function normalizeAudioText(text: string): string {
  return text.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

export function vocabularyAudioText(card: { article: string | null; word_de: string }): string {
  const article = card.article && card.article !== 'none' ? card.article : ''
  return normalizeAudioText(`${article} ${card.word_de}`)
}
