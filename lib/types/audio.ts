export type NeuralAudioLanguage = 'de' | 'ru' | 'uk' | 'en' | 'tr'

export interface GenerateAudioInput {
  text: string
  language: NeuralAudioLanguage
  /** Only a matching German word recording may update this card's audio_url. */
  cardId?: string
}

export type GenerateAudioResult =
  | { success: true; audioUrl: string; cached: boolean }
  | { success: false; error: 'invalid_input' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'audio_unavailable' }
