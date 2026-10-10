import { createHash } from 'node:crypto'
import { neuralAudioPath } from '../neural-identity'
import { normalizeAudioText, neuralVoiceName, AUDIO_FORMAT, AUDIO_RATE, SITOV_LEGACY_AUDIO_RATE, SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS } from '../neural-config'
import { SITOV_QWEN_PROFILE_FINGERPRINT } from '../neural-identity'
import type { NeuralAudioLanguage } from '../../types/audio'
const golden: Record<string, string> = {
  "sind": "sitov-qwen-v1/de/fecd6cec0867225c8887edf4ad57bd71e11318983f7c5ea91e1f23dac3e5be61.mp3",
  "stehe": "sitov-qwen-v1/de/8f6a6116076d1d0afc06239850e75f03bd1cf75d54e7630b61da2bdd4669c714.mp3",
  "wollte": "sitov-qwen-v1/de/a247eb64e156ac01dadbb76db20637e6570311f93fb1b0dad063ea5348e4195e.mp3",
  "des": "sitov-qwen-v1/de/89137d72d3f65e8d2589e0f9532beeb322a2805aaeaf8030d9684bae2b0921a2.mp3",
  "ihrer": "sitov-qwen-v1/de/3829dc7759b63983b26570c2832515852424e86ad266b591abd8a89098afece0.mp3",
  "meiste": "sitov-qwen-v1/de/88b6999624c9f3cde59987001dfd4980545eaf5720e271da307b1816a251a381.mp3"
}
function legacy(text: string, language: NeuralAudioLanguage) {
 const de = language === 'de'
 const identity = { text: normalizeAudioText(text), voice: neuralVoiceName(language), rate: de ? AUDIO_RATE : SITOV_LEGACY_AUDIO_RATE, format: AUDIO_FORMAT, ...(de ? { leadIn: SITOV_GERMAN_AUDIO_LEAD_IN_SECONDS, profile: SITOV_QWEN_PROFILE_FINGERPRINT } : {}) }
 return `${de ? 'sitov-qwen-v1' : 'piper-local-v2'}/${language}/${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}.mp3`
}
test('exactly six German golden keys change and normalized aliases agree', () => {
 for (const [text, path] of Object.entries(golden)) {
  expect(neuralAudioPath(text, 'de')).toBe(path)
  expect(neuralAudioPath(` \u00a0${text}\n `, 'de', 'male')).toBe(path)
  expect(path).not.toBe(legacy(text, 'de'))
 }
})
test('all foreign languages and unlisted German text preserve old identity', () => {
 for (const language of ['en', 'ru', 'uk', 'tr'] as NeuralAudioLanguage[]) for (const text of Object.keys(golden)) expect(neuralAudioPath(text, language)).toBe(legacy(text, language))
 for (const text of ['Sind', 'sind.', 'Guten Morgen.', 'Cafe\u0301', '']) expect(neuralAudioPath(text, 'de')).toBe(legacy(text, 'de'))
})
