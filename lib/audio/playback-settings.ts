import type { AudioWordTiming } from '@/lib/types/audio'

export const PLAYBACK_RATES = [0.75, 0.85, 1, 1.25] as const
export function defaultPlaybackRate(level?: string): number {
  return /^A[12](?:[.\s]|$)/i.test(level?.trim() ?? '') ? 0.85 : 1
}

/** Use the media clock: playbackRate already changes how quickly it advances. */
export function currentWordIndex(timings: readonly AudioWordTiming[], seconds: number): number | null {
  const index = timings.findIndex(word => seconds >= word.start && seconds < word.end)
  return index < 0 ? null : index
}

export function validWordTimings(value: unknown, text?: string): AudioWordTiming[] | undefined {
  if (!Array.isArray(value) || !value.length || value.length > 1500) return undefined
  if (text && value.length !== text.trim().split(/\s+/u).length) return undefined
  let previousEnd = 0
  for (const word of value) {
    if (!word || typeof word.start !== 'number' || typeof word.end !== 'number'
      || !Number.isFinite(word.start) || !Number.isFinite(word.end)
      || word.start < previousEnd || word.end < word.start || word.end > 1200) return undefined
    previousEnd = word.end
  }
  return value.map(({ start, end }) => ({ start, end }))
}
