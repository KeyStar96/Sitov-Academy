'use client'

import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import { FastForward, Loader2, Pause, Play, RotateCcw } from 'lucide-react'
import FluidWaveform from '@/components/audio/FluidWaveform'
import { useAudioPlayback } from '@/lib/audio/useAudioPlayback'
import { formatDuration, playbackProgress } from '@/lib/audio/waveform'
import { PLAYBACK_RATES } from '@/lib/audio/playback-settings'
import { usePlaybackRate } from '@/lib/audio/usePlaybackRate'
import { FAST_PLAYBACK_RATE, useFastPlayback } from '@/lib/audio/useFastPlayback'
import {
  createPronunciationTranslator,
  type PronunciationTranslator,
} from '@/lib/pronunciation-i18n'

/** Sprung pro Pfeiltaste – bewusst grob, damit Nachjustieren leicht bleibt. */
const KEYBOARD_SEEK_SECONDS = 5

/** Greift nur, wenn kein Übersetzer übergeben wird (z.B. in der Lehrer-Ansicht). */
const defaultTranslator = createPronunciationTranslator({})

export default function WaveformPlayer({
  src,
  blob,
  t,
  label,
  level,
  compact = false,
  fastToggle = false,
  onProgress,
}: {
  src: string | null
  /** Rohdaten der eigenen Aufnahme – auf iOS zuverlässiger zu dekodieren als nur die Blob-URL. */
  blob?: Blob | null
  /** Übersetzer aus `lib/pronunciation-i18n.ts`. */
  t?: PronunciationTranslator
  label?: string
  /** A-Niveaus starten verlangsamt; ab B-Niveau gilt das natürliche Tempo. */
  level?: string
  compact?: boolean
  /** Lehrkräfte: ein Umschalter für doppeltes Tempo statt der Tempo-Auswahl der Lernenden. */
  fastToggle?: boolean
  /** Abspielstand für Mitlese-Hervorhebung und „gehört"-Markierung. */
  onProgress?: (state: { playing: boolean; fraction: number; ended: boolean }) => void
}) {
  const translate: PronunciationTranslator = t ?? defaultTranslator
  const [learnerSpeed, setSpeed] = usePlaybackRate(level)
  const [fast, setFast] = useFastPlayback()
  const speed = fastToggle ? (fast ? FAST_PLAYBACK_RATE : 1) : learnerSpeed

  const playback = useAudioPlayback(src, speed, blob)
  useEffect(() => () => playback.pause(), [playback.pause])
  const progressCallback = useRef(onProgress)
  progressCallback.current = onProgress
  const fraction = playbackProgress(playback.currentTime, playback.duration)
  const ended = !playback.isPlaying && playback.duration > 0 && playback.currentTime >= playback.duration - 0.05
  useEffect(() => {
    progressCallback.current?.({ playing: playback.isPlaying, fraction, ended })
  }, [playback.isPlaying, fraction, ended])

  const getVolume = useCallback((): number => {
    if (!playback.isPlaying) return 0
    return playback.getVolume()
  }, [playback])

  const getTone = useCallback((): number => playback.getTone(), [playback])

  const togglePlayback = useCallback(() => {
    if (playback.error === 'format') return
    if (playback.isPlaying) {
      playback.pause()
      return
    }
    void playback.play()
  }, [playback])

  const handleRetry = useCallback(() => {
    void playback.play()
  }, [playback])
  const handleSeekByKeyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (playback.duration <= 0) return
    let target: number
    switch (event.key) {
      case 'ArrowLeft': case 'ArrowDown': target = playback.currentTime - KEYBOARD_SEEK_SECONDS; break
      case 'ArrowRight': case 'ArrowUp': target = playback.currentTime + KEYBOARD_SEEK_SECONDS; break
      case 'Home': target = 0; break
      case 'End': target = playback.duration; break
      default: return
    }
    event.preventDefault()
    playback.seek(Math.max(0, Math.min(playback.duration, target)))
  }
  if (!src) return null

  const progress = fraction
  const playbackBlocked = playback.error !== null

  return (
    <div className="min-w-0 w-full break-words">
      {label && (
        <p className="mb-2 text-base font-bold uppercase tracking-wide text-[var(--muted)]">
          {label}
        </p>
      )}

      <div className="grid grid-cols-[auto_minmax(48px,1fr)] items-center gap-3 sm:grid-cols-[auto_minmax(48px,1fr)_auto] sm:gap-4">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={playbackBlocked}
          aria-label={playback.isPlaying ? translate('pause_aria') : translate('play_aria')}
          aria-busy={playback.isBuffering}
          className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-strong)] text-[var(--accent-foreground)] shadow-sm transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 ${
            compact ? 'h-12 w-12' : 'h-16 w-16'
          }`}
        >
          {playback.isBuffering ? (
            <Loader2 size={compact ? 22 : 30} className="animate-spin" aria-hidden="true" />
          ) : playback.isPlaying ? (
            <Pause size={compact ? 22 : 30} aria-hidden="true" />
          ) : (
            <Play size={compact ? 22 : 30} aria-hidden="true" />
          )}
        </button>

        <div
          className={`relative min-w-12 overflow-hidden rounded-2xl bg-[var(--surface-muted)] focus-within:outline focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-[var(--accent)] ${
            compact ? 'h-12' : 'h-16'
          }`}
        >
          <FluidWaveform getVolume={getVolume} getTone={getTone} isActive={playback.isPlaying} />

          <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--border)]">
            <div
              className="h-full bg-[var(--accent-strong)] transition-[width] duration-150"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={playback.duration || 100}
            step={0.01}
            value={playback.currentTime}
            disabled={playback.duration <= 0 || playbackBlocked}
            onKeyDown={handleSeekByKeyboard}
            onChange={(e) => {
              if (playback.duration > 0) playback.seek(Number(e.target.value))
            }}
            aria-label={translate('waveform_aria')}
            aria-valuetext={`${formatDuration(playback.currentTime)} / ${formatDuration(playback.duration)}`}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end sm:gap-1">
          <span className="text-base font-semibold tabular-nums text-[var(--muted)]">
            {formatDuration(playback.currentTime)} / {formatDuration(playback.duration)}
          </span>
          {fastToggle ? (
            <button
              type="button"
              aria-pressed={fast}
              onClick={() => setFast(!fast)}
              aria-label={translate('fast_playback')}
              title={translate('fast_playback')}
              className={`inline-flex h-12 min-w-16 items-center justify-center gap-1.5 rounded-xl px-3 text-base font-bold tabular-nums transition-colors focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                fast
                  ? 'bg-[var(--accent-strong)] text-[var(--accent-foreground)] hover:bg-[var(--accent-strong-hover)]'
                  : 'bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface)]'
              }`}
            >
              <FastForward size={18} aria-hidden="true" />
              <span aria-hidden="true">{FAST_PLAYBACK_RATE}×</span>
            </button>
          ) : (
            <div className="relative">
              <select
                value={speed}
                onChange={event => setSpeed(Number(event.target.value))}
                aria-label={translate('speed_aria', { speed: `${speed}×` })}
                style={{ height: 48, minHeight: 48 }}
                className="h-12 min-h-12 min-w-12 cursor-pointer appearance-none rounded-xl bg-[var(--surface-muted)] pl-4 pr-8 text-base font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {PLAYBACK_RATES.map(rate => <option key={rate} value={rate}>{translate('speed_label', { speed: `${rate}×` })}</option>)}
              </select>
              <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">▾</span>
            </div>
          )}
        </div>
      </div>

      {playback.isBuffering && !playbackBlocked && (
        <p className="mt-2 flex items-center gap-2 text-base text-[var(--muted)]" role="status">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          {translate('audio_loading')}
        </p>
      )}

      {playbackBlocked && (
        <div
          role="alert"
          className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4"
        >
          <p className="text-base text-[var(--danger)]">
            {playback.error === 'format' ? translate('audio_format_unsupported') : translate('audio_unavailable')}
          </p>
          {playback.error === 'load' && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--surface)] px-5 py-2 text-base font-semibold text-[var(--danger)] shadow-sm transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <RotateCcw size={18} aria-hidden="true" />
              {translate('audio_retry')}
            </button>
          )}
        </div>
      )}

      <audio ref={playback.htmlAudioRef} playsInline preload="auto" className="hidden" />
    </div>
  )
}
