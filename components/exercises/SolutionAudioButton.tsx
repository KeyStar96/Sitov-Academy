'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject, type SyntheticEvent } from 'react'
import { Loader2, Pause, Play, RotateCcw, Volume2 } from 'lucide-react'
import { useAudioFeedback } from '@/components/layout/RouteFeedbackProvider'
import { cachedNeuralAudio, cachedNeuralWordTimings, invalidateNeuralAudio, neuralAudioKey, resolveNeuralAudio, type NeuralAudioSource } from '@/lib/audio/neural-client'
import { requestPlaybackAudioSession } from '@/lib/audio/web-audio'
import { currentWordIndex, PLAYBACK_RATES } from '@/lib/audio/playback-settings'
import { usePlaybackRate } from '@/lib/audio/usePlaybackRate'
import type { NeuralAudioLanguage } from '@/lib/types/audio'
import type { SitovAudioReference } from '@/lib/audio/sitov-audio-reference'
import { cn } from '@/lib/utils'
import styles from './SolutionAudioButton.module.css'

export interface SitovAudioControl { pause: () => void }

interface SolutionAudioButtonProps {
  text: string
  audioUrl?: string | null
  cardId?: string
  reference?: SitovAudioReference
  language?: NeuralAudioLanguage
  level?: string
  onWordChange?: (index: number | null) => void
  label: string
  ariaLabel: string
  variant?: 'primary' | 'secondary'
  onUnsupported?: () => void
  /** Abspielstand (0–1) für die Mitlese-Hervorhebung; `null`, sobald nichts mehr läuft. */
  onProgress?: (fraction: number | null) => void
  /** Position loaded from the learner's account; applied once to native playback. */
  initialProgress?: number
  /** A reading groups playback, replay and speed into one responsive control bar. */
  layout?: 'compact' | 'reading'
  resumeLabel?: string
  restartLabel?: string
  restartAriaLabel?: string
  controlRef?: RefObject<SitovAudioControl | null>
}

// 10 ms of PCM silence. An actual play() in the tap unlocks this same native
// media element on Safari while neural synthesis is still in flight.
const SILENT_AUDIO = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='
let activePlayer: { element: HTMLAudioElement; cancel: () => void } | null = null

function stopCardInteraction(event: SyntheticEvent) {
  // The whole audio area owns its taps, including labels, gaps and native
  // media controls. Keep native playback/select defaults and gesture activation.
  event.stopPropagation()
}

export default function SolutionAudioButton(props: SolutionAudioButtonProps) {
  const copy = useAudioFeedback()
  const [rate, setManualRate] = usePlaybackRate(props.level)
  const language = props.language ?? 'de'
  const recording = props.reference?.kind !== 'reading_text' && props.audioUrl && !props.audioUrl.includes('/audio_cache/') ? props.audioUrl : null
  const source = { text: props.text, cardId: props.cardId, reference: props.reference, language,
    audioUrl: recording,
    aligned: Boolean(props.onWordChange && !recording) }
  return <div className={props.layout === 'reading' ? styles.sitovReadingControls : 'flex min-w-0 flex-wrap items-center justify-center gap-2'} data-card-interactive
    onClick={stopCardInteraction} onPointerDown={stopCardInteraction} onPointerUp={stopCardInteraction}
    onTouchStart={stopCardInteraction} onTouchEnd={stopCardInteraction} onKeyDown={stopCardInteraction}>
    <NeuralAudioPlayer key={neuralAudioKey(source)} {...props} {...source} rate={rate} onSlowReplay={() => setManualRate(0.75)} />
    <div className={props.layout === 'reading' ? styles.sitovSpeed : 'flex max-w-full flex-wrap justify-center gap-2'}>
      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
        <span>{copy.speed}</span>
        <select aria-label={copy.speed} value={rate} onChange={event => setManualRate(Number(event.target.value))}
          style={{ height: 48, minHeight: 48 }}
          className="h-12 min-h-12 cursor-pointer appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[var(--foreground)]">
          {PLAYBACK_RATES.map(value => <option key={value} value={value}>{String(value)}×</option>)}
        </select>
        <span aria-hidden="true">▾</span>
      </label>
    </div>
  </div>
}

function NeuralAudioPlayer({ text, audioUrl, cardId, reference, language, aligned, rate, onSlowReplay, label, ariaLabel, variant = 'primary', onUnsupported, onProgress, onWordChange, initialProgress = 0, layout, resumeLabel, restartLabel, restartAriaLabel, controlRef }: SolutionAudioButtonProps & { language: NeuralAudioLanguage; aligned?: boolean; rate: number; onSlowReplay: () => void }) {
  const copy = useAudioFeedback()
  const source = useRef<NeuralAudioSource>({ text, audioUrl, cardId, reference, language, aligned }).current
  const [url, setUrl] = useState(() => cachedNeuralAudio(source))
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [paused, setPaused] = useState(initialProgress > 0 && initialProgress < 0.99)
  const audioRef = useRef<HTMLAudioElement>(null)
  const aliveRef = useRef(true)
  const requestRef = useRef(0)
  const pendingRef = useRef(false)
  const primingRef = useRef(false)
  const restoreRef = useRef(initialProgress > 0 && initialProgress < 0.99 ? initialProgress : null)
  const restorePosition = useCallback(() => {
    const audio = audioRef.current
    if (!audio || primingRef.current || restoreRef.current === null || !Number.isFinite(audio.duration) || audio.duration <= 0) return
    try { audio.currentTime = audio.duration * restoreRef.current; restoreRef.current = null }
    catch { /* A later metadata event retries a source that is not ready yet. */ }
  }, [])

  const rateRef = useRef(rate)
  rateRef.current = rate
  const progressRef = useRef({ onProgress, onWordChange })
  progressRef.current = { onProgress, onWordChange }
  const frameRef = useRef<number | null>(null)
  const lastWordRef = useRef<number | null>(null)
  const stopFollowing = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    lastWordRef.current = null
    progressRef.current.onProgress?.(null)
    progressRef.current.onWordChange?.(null)
  }, [])
  const reportNativePosition = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio || primingRef.current) return
    if (Number.isFinite(audio.duration) && audio.duration > 0) progressRef.current.onProgress?.(Math.min(1, audio.currentTime / audio.duration))
    const index = currentWordIndex(cachedNeuralWordTimings(source) ?? [], audio.currentTime)
    if (lastWordRef.current !== index) {
      lastWordRef.current = index
      progressRef.current.onWordChange?.(index)
    }
  }, [source])
  const reportPosition = useCallback(() => reportNativePosition(audioRef.current), [reportNativePosition])
  useEffect(() => {
    if (!isPlaying) return
    const follow = () => { reportPosition(); frameRef.current = requestAnimationFrame(follow) }
    frameRef.current = requestAnimationFrame(follow)
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); frameRef.current = null }
  }, [isPlaying, reportPosition])
  useEffect(() => {
    const audio = audioRef.current
    if (audio) { audio.preservesPitch = true; audio.playbackRate = rate }
  }, [rate])

  const cancel = useCallback((audio = audioRef.current) => {
    reportNativePosition(audio)
    requestRef.current += 1
    pendingRef.current = false
    primingRef.current = false
    if (activePlayer?.element === audio) activePlayer = null
    stopFollowing()
    audio?.pause()
    if (aliveRef.current) { setLoading(false); setIsPlaying(false) }
  }, [reportNativePosition, stopFollowing])

  useEffect(() => {
    if (!controlRef) return
    const controls = { pause: () => cancel() }
    controlRef.current = controls
    return () => { if (controlRef.current === controls) controlRef.current = null }
  }, [cancel, controlRef])

  useLayoutEffect(() => {
    aliveRef.current = true
    const audio = audioRef.current
    const capturePosition = () => { reportNativePosition(audio); stopFollowing() }
    const hidden = () => { if (document.visibilityState === 'hidden') capturePosition() }
    window.addEventListener('pagehide', capturePosition)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', capturePosition)
      document.removeEventListener('visibilitychange', hidden)
      aliveRef.current = false; cancel(audio)
    }
  }, [cancel, reportNativePosition, stopFollowing])

  useEffect(() => {
    if (url || !text.trim()) return
    let cancelled = false
    void (async () => {
      try {
        const nextUrl = await resolveNeuralAudio(source)
        if (!cancelled) setUrl(nextUrl)
      } catch { /* An explicit tap owns error/retry feedback. */ }
    })()
    return () => { cancelled = true }
  }, [source, text, url])

  useEffect(() => {
    const audio = audioRef.current
    // Do not replace the silent source until its play promise has settled.
    if (audio && url && !pendingRef.current && audio.getAttribute('src') !== url) audio.src = url
  }, [url])

  const ownsRequest = (audio: HTMLAudioElement, request: number) => aliveRef.current
    && requestRef.current === request && activePlayer?.element === audio

  const play = async (audio: HTMLAudioElement, nextUrl: string, request: number) => {
    if (!ownsRequest(audio, request)) return
    primingRef.current = false
    setUrl(nextUrl)
    setError(false)
    setNeedsGesture(false)
    if (audio.getAttribute('src') !== nextUrl) {
      // The silent unlock has its own media clock. Never carry that position
      // into speech: only the learner's explicit saved checkpoint may seek.
      audio.pause()
      audio.src = nextUrl
      audio.currentTime = 0
    } else if (audio.ended) {
      audio.currentTime = 0
      restoreRef.current = null
    }
    audio.preservesPitch = true
    audio.playbackRate = rateRef.current
    restorePosition()
    try {
      await audio.play()
    } catch (reason: unknown) {
      if (!ownsRequest(audio, request)) return
      setLoading(false)
      setIsPlaying(false)
      pendingRef.current = false
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      if (reason instanceof DOMException && reason.name === 'NotAllowedError') {
        // Respect an explicit browser autoplay block; native controls remain a fallback.
        setNeedsGesture(true)
      } else { setError(true); onUnsupported?.() }
    }
  }

  const handleClick = () => {
    const audio = audioRef.current
    if (!audio) return
    if (pendingRef.current || isPlaying) { cancel(); return }
    activePlayer?.cancel()
    activePlayer = { element: audio, cancel }
    const request = ++requestRef.current
    requestPlaybackAudioSession()
    setLoading(true)
    setNeedsGesture(false)
    pendingRef.current = true
    const available = error ? null : url || cachedNeuralAudio(source)
    if (available) { void play(audio, available, request); return }
    if (error) invalidateNeuralAudio(source)
    setError(false)
    primingRef.current = true
    audio.src = SILENT_AUDIO
    // Both calls begin synchronously. Keeping playback native preserves iPhone
    // playback with the ring/silent switch enabled; no AudioContext output is used.
    let unlocked: Promise<void>
    try { unlocked = audio.play().catch(() => undefined) } catch { unlocked = Promise.resolve() }
    void (async () => {
      try {
        const [nextUrl] = await Promise.all([resolveNeuralAudio(source, error), unlocked])
        await play(audio, nextUrl, request)
      } catch {
        if (ownsRequest(audio, request)) {
          cancel()
          setError(true)
          onUnsupported?.()
        }
      }
    })()
  }

  return (
    <div className={layout === 'reading' ? styles.sitovPlayer : 'flex min-w-0 flex-col items-center gap-2'}>
      <button type="button" onClick={handleClick} aria-label={error ? copy.retry : isPlaying || loading ? copy.pause : paused && resumeLabel ? resumeLabel : ariaLabel}
        aria-pressed={isPlaying} aria-busy={loading}
        className={cn('academy-button min-h-12 min-w-12 w-full sm:w-auto', layout === 'reading' && styles.sitovPlay, variant === 'primary' ? 'academy-button-primary' : 'academy-button-outline')}>
        {loading ? <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : isPlaying ? <Pause size={20} aria-hidden="true" /> : paused && resumeLabel ? <Play size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        <span>{error ? copy.retry : loading ? copy.loading : isPlaying ? copy.pause : paused && resumeLabel ? resumeLabel : label}</span>
      </button>
      {(onProgress || onWordChange) && <button type="button" aria-label={copy.slow_repeat}
        style={{ height: 48, minHeight: 48 }}
          className={cn('h-12 min-h-12 cursor-pointer appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--foreground)]', layout === 'reading' && styles.sitovSlow)}
        onClick={() => {
          onSlowReplay()
          rateRef.current = 0.75
          const audio = audioRef.current
          if (!audio) return
          audio.playbackRate = 0.75
          if (!primingRef.current) audio.currentTime = 0
          restoreRef.current = null
          lastWordRef.current = null
          progressRef.current.onWordChange?.(null)
          if (!isPlaying && !pendingRef.current) handleClick()
        }}>{copy.slow_repeat}</button>}
      {restartLabel && <button type="button" className={styles.sitovRestart} aria-label={restartAriaLabel ?? restartLabel}
        onClick={() => {
          const audio = audioRef.current
          if (!audio) return
          restoreRef.current = null
          if (!primingRef.current) audio.currentTime = 0
          setPaused(false)
          lastWordRef.current = null
          progressRef.current.onWordChange?.(null)
          if (!isPlaying && !pendingRef.current) handleClick()
        }}><RotateCcw size={17} aria-hidden="true" /><span>{restartLabel}</span></button>}
      <audio ref={audioRef} preload="auto" playsInline controls={needsGesture} aria-label={ariaLabel}
        className={needsGesture ? 'h-12 min-w-0 w-full max-w-full rounded-xl' : 'hidden'}
        onPlay={() => {
          const audio = audioRef.current
          if (!audio || primingRef.current) return
          if (needsGesture) {
            if (activePlayer?.element !== audio) activePlayer?.cancel()
            activePlayer = { element: audio, cancel }
            setNeedsGesture(false)
          } else if (activePlayer?.element !== audio) audio.pause()
        }}
        onPlaying={() => {
          if (!primingRef.current && activePlayer?.element === audioRef.current) {
            setIsPlaying(true); setLoading(false); setPaused(false); pendingRef.current = false
          }
        }}
        onTimeUpdate={reportPosition}
        onLoadedMetadata={restorePosition}
        onCanPlay={restorePosition}
        onSeeked={reportPosition}
        onWaiting={() => { if (!primingRef.current) { setLoading(true); setIsPlaying(false); stopFollowing() } }}
        onPause={() => { if (!primingRef.current) { reportPosition(); setIsPlaying(false); setPaused(Boolean(audioRef.current && audioRef.current.currentTime > 0 && !audioRef.current.ended)); stopFollowing() } }}
        onEnded={() => { if (!primingRef.current) { reportPosition(); setIsPlaying(false); setPaused(false); setLoading(false); stopFollowing() } }}
        onError={() => {
          if (!primingRef.current && audioRef.current?.getAttribute('src')) {
            cancel(); setError(true)
          }
        }} />
      {error && <p role="alert" className={cn('text-sm text-[var(--danger)]', styles.sitovNotice)}>{copy.error}</p>}
      {needsGesture && <p role="status" className={cn('text-sm text-[var(--muted)]', styles.sitovNotice)}>{copy.ready}</p>}
    </div>
  )
}
