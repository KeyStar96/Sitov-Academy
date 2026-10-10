/** @jest-environment node */
import { createHash } from 'node:crypto'
import { neuralAudioPath, SITOV_QWEN_PROFILE_FINGERPRINT } from '@/lib/audio/neural-identity'
import { AUDIO_FORMAT, AUDIO_RATE } from '@/lib/audio/neural-config'
const replacements = ['Bist', 'einkauft', 'Marchenko', 'Lwiw', 'sieh', 'neuen']
it.each(replacements)('uses a separate immutable key for reviewed %s', text => {
  const base = { text, voice: 'sitov-qwen-male-de-v1', rate: AUDIO_RATE, format: AUDIO_FORMAT, leadIn: .35, profile: SITOV_QWEN_PROFILE_FINGERPRINT }
  const key = (value: unknown) => `sitov-qwen-v1/de/${createHash('sha256').update(JSON.stringify(value)).digest('hex')}.mp3`
  expect(neuralAudioPath(text, 'de')).toBe(key({ ...base, variant: 'sitov-audio-repair-20261010-v2' }))
  expect(neuralAudioPath(text, 'de')).not.toBe(key(base))
  expect(neuralAudioPath(` \u00a0${text}\n `, 'de')).toBe(neuralAudioPath(text, 'de'))
})
it('keeps earlier approved variants stable and does not apply repairs to nearby words', () => {
  expect(neuralAudioPath('esst', 'de')).toBe('sitov-qwen-v1/de/9b12d09d782e799cc1c8319efea2cd0b654ad91171fc9f411b20ad6a08fd8ece.mp3')
  expect(neuralAudioPath('wollte', 'de')).toBe('sitov-qwen-v1/de/a247eb64e156ac01dadbb76db20637e6570311f93fb1b0dad063ea5348e4195e.mp3')
  for (const text of ['bist', 'Neuen', 'neuen.', 'Guten Morgen.']) {
    const base = { text, voice: 'sitov-qwen-male-de-v1', rate: AUDIO_RATE, format: AUDIO_FORMAT, leadIn: .35, profile: SITOV_QWEN_PROFILE_FINGERPRINT }
    expect(neuralAudioPath(text, 'de')).toBe(`sitov-qwen-v1/de/${createHash('sha256').update(JSON.stringify(base)).digest('hex')}.mp3`)
  }
})
