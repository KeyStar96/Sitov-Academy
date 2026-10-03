import { createHash } from 'node:crypto'
import type { GermanAudioVoice, NeuralAudioLanguage } from '../types/audio'
import { AUDIO_CACHE_VERSION, AUDIO_FORMAT, AUDIO_RATE, SITOV_LEGACY_AUDIO_CACHE_VERSION, SITOV_LEGACY_AUDIO_RATE, SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS, SITOV_QWEN_PROFILE, neuralVoiceName, normalizeAudioText } from './neural-config'

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => [key, canonical(entry)]))
  return value
}

/** Matches Python json.dumps(profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False). */
export const SITOV_QWEN_PROFILE_FINGERPRINT = createHash('sha256').update(JSON.stringify(canonical(SITOV_QWEN_PROFILE))).digest('hex')

/** Shared by the web cache and the Mac catalog/import CLI. */
export function neuralAudioPath(text: string, language: NeuralAudioLanguage, voice?: GermanAudioVoice): string {
  const german = language === 'de'
  const hash = createHash('sha256').update(JSON.stringify({
    text: normalizeAudioText(text), voice: neuralVoiceName(language, voice),
    rate: german ? AUDIO_RATE : SITOV_LEGACY_AUDIO_RATE, format: AUDIO_FORMAT,
    ...(german ? { leadIn: SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS, profile: SITOV_QWEN_PROFILE_FINGERPRINT } : {}),
  })).digest('hex')
  return `${german ? AUDIO_CACHE_VERSION : SITOV_LEGACY_AUDIO_CACHE_VERSION}/${language}/${hash}.mp3`
}
