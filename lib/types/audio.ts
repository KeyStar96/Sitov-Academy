import type { SitovAudioReference } from '@/lib/audio/sitov-audio-reference'

export type NeuralAudioLanguage = 'de' | 'ru' | 'uk' | 'en' | 'tr'
export type GermanAudioVoice = 'male'

/** Seconds on the media timeline, one entry per whitespace-delimited token. */
export interface AudioWordTiming { start: number; end: number }
export interface NeuralSpeechAsset { audioUrl: string; wordTimings?: AudioWordTiming[] }

export interface GenerateAudioInput {
  text: string
  language: NeuralAudioLanguage
  /** Only a matching German word recording may update this card's audio_url. */
  cardId?: string
  /** Canonical authored context; German free-text requests are never sufficient. */
  reference?: SitovAudioReference
  /** The single male Qwen profile; omission uses the same profile. */
  voice?: GermanAudioVoice
}

export type GenerateAudioResult =
  | { success: true; audioUrl: string; cached: boolean; wordTimings?: AudioWordTiming[] }
  | { success: false; error: 'invalid_input' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'audio_unavailable' }
