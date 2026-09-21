'use client'

import { useRef, type RefObject } from 'react'
import FluidWaveform from '@/components/audio/FluidWaveform'
import { useAnalyserFrame } from '@/lib/audio/useAnalyserFrame'
import { formatDuration } from '@/lib/audio/waveform'

/**
 * Siri-artige, fließende Tonspur der laufenden Aufnahme.
 *
 * Liest Lautstärke und Stimmlage direkt aus dem Mikrofon-`AnalyserNode`.
 * Ohne Analyser fällt die Amplitude auf den letzten `levels`-Wert zurück.
 */
export default function LiveWaveform({
  levels,
  isActive,
  elapsedSeconds,
  ariaLabel,
  analyserRef,
  compact = false,
}: {
  levels: readonly number[]
  isActive: boolean
  elapsedSeconds: number
  ariaLabel: string
  analyserRef?: RefObject<AnalyserNode | null>
  /** Einzeilige Variante für die schmale Aufnahmeleiste auf dem Handy. */
  compact?: boolean
}) {
  const levelsRef = useRef<readonly number[]>(levels)
  levelsRef.current = levels
  const emptyAnalyserRef = useRef<AnalyserNode | null>(null)
  const frame = useAnalyserFrame(analyserRef ?? emptyAnalyserRef)

  const getVolume = (): number => {
    if (analyserRef?.current) return frame.getVolume()
    const fallback = levelsRef.current
    return fallback.length > 0 ? (fallback[fallback.length - 1] ?? 0) : 0
  }

  if (compact) {
    return (
      <div className="flex w-full min-w-0 items-center gap-3">
        <div
          role="img"
          aria-label={ariaLabel}
          className="h-10 min-w-0 flex-1 overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))]"
        >
          <FluidWaveform getVolume={getVolume} getTone={frame.getTone} isActive={isActive} />
        </div>
        <span className="shrink-0 text-base font-bold tabular-nums text-[var(--foreground)]">
          {formatDuration(elapsedSeconds)}
        </span>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div
        role="img"
        aria-label={ariaLabel}
        className="h-24 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-orange-50 to-slate-100 dark:from-slate-800 dark:to-slate-900"
      >
        <FluidWaveform getVolume={getVolume} getTone={frame.getTone} isActive={isActive} />
      </div>

      <p className="mt-2 text-center text-lg font-semibold tabular-nums text-slate-600 dark:text-slate-300">
        {formatDuration(elapsedSeconds)}
      </p>
    </div>
  )
}
