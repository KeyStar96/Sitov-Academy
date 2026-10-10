import type { AudioWordTiming, SitovSpokenAlignment } from '@/lib/types/audio'
import { normalizeAudioText } from './neural-config'
import { validWordTimings } from './playback-settings'

const small = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn']
const tens = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig']
function numeral(n: number): string {
  return n < 20 ? small[n] : n % 10 ? `${n % 10 === 1 ? 'ein' : small[n % 10]}und${tens[Math.floor(n / 10)]}` : tens[n / 10]
}
function clock(words: string[]): string[] | undefined {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)([.,!?;:]?)$/u.exec(words[0] ?? '')
  if (!match || words.length > 2 || (words.length === 2 && !/^Uhr[.,!?;:]?$/u.test(words[1]))) return undefined
  if (words.length === 2 && match[3]) return undefined
  const punctuation = words.length === 2 ? words[1].slice(3) : match[3]
  const hour = Number(match[1]), minute = Number(match[2])
  const result = [hour === 1 ? 'ein' : numeral(hour), 'Uhr', ...(minute ? [numeral(minute)] : [])]
  result[result.length - 1] += punctuation
  return result
}

/** Clock-only expansion; ranges cover both token streams once, in order. */
export function validSpokenAlignment(value: unknown, timings: unknown, text: string): SitovSpokenAlignment | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as SitovSpokenAlignment
  if (v.version !== 1 || typeof v.displayText !== 'string' || typeof v.spokenText !== 'string'
    || v.displayText !== normalizeAudioText(text) || v.spokenText !== normalizeAudioText(v.spokenText)
    || !v.spokenText || !Array.isArray(v.groups) || !v.groups.length || v.groups.length > 1500) return undefined
  const display = v.displayText.split(' '), spoken = v.spokenText.split(' ')
  const measured = validWordTimings(timings, v.spokenText)
  if (!measured || measured.some((t, i) => /[\p{L}\p{N}]/u.test(spoken[i]) && t.end <= t.start)) return undefined
  let d = 0, s = 0, changed = false
  for (const group of v.groups) {
    if (!group || !Array.isArray(group.display) || !Array.isArray(group.spoken)
      || group.display.length !== 2 || group.spoken.length !== 2
      || ![...group.display, ...group.spoken].every(Number.isInteger)) return undefined
    const [ds, de] = group.display, [ss, se] = group.spoken
    if (ds !== d || ss !== s || de <= ds || se <= ss || de > display.length || se > spoken.length) return undefined
    const before = display.slice(ds, de), after = spoken.slice(ss, se)
    if (before.join(' ') !== after.join(' ')) {
      if (clock(before)?.join(' ') !== after.join(' ')) return undefined
      changed = true
    }
    d = de; s = se
  }
  if (!changed || d !== display.length || s !== spoken.length) return undefined
  return { version: 1, displayText: v.displayText, spokenText: v.spokenText,
    groups: v.groups.map(g => ({ display: [...g.display], spoken: [...g.spoken] })) }
}

export function validPreparedAlignment(asset: { wordTimings?: AudioWordTiming[]; spokenAlignment?: SitovSpokenAlignment; spokenWordTimings?: AudioWordTiming[] }, text: string): boolean {
  return asset.spokenAlignment !== undefined
    ? Boolean(validSpokenAlignment(asset.spokenAlignment, asset.spokenWordTimings, text)) && asset.wordTimings === undefined
    : Boolean(validWordTimings(asset.wordTimings, text))
}
