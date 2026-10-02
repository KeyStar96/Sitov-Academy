export type NeuralAudioLanguage = 'de' | 'ru' | 'uk' | 'en' | 'tr'
export type GermanAudioVoice = 'male' | 'female'

/** Seconds on the media timeline, one entry per whitespace-delimited token. */
export interface AudioWordTiming { start: number; end: number }
export interface NeuralSpeechAsset { audioUrl: string; wordTimings?: AudioWordTiming[] }

export interface GenerateAudioInput {
  text: string
  language: NeuralAudioLanguage
  /** Only a matching German word recording may update this card's audio_url. */
  cardId?: string
  /** German scene persona. Omission retains the vocabulary voice. */
  voice?: GermanAudioVoice
}

export type GenerateAudioResult =
  | { success: true; audioUrl: string; cached: boolean; wordTimings?: AudioWordTiming[] }
  | { success: false; error: 'invalid_input' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'audio_unavailable' }
