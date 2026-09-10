'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Volume2 } from 'lucide-react'
import { useAudioFeedback } from '@/components/layout/RouteFeedbackProvider'
import { cachedNeuralAudio, invalidateNeuralAudio, neuralAudioKey, resolveNeuralAudio, type NeuralAudioSource } from '@/lib/audio/neural-client'
import { requestPlaybackAudioSession } from '@/lib/audio/web-audio'
import type { NeuralAudioLanguage } from '@/lib/types/audio'
import { cn } from '@/lib/utils'

interface SolutionAudioButtonProps {
  text: string
  audioUrl?: string | null
  cardId?: string
  language?: NeuralAudioLanguage
  label: string
  ariaLabel: string
  variant?: 'primary' | 'secondary'
  onUnsupported?: () => void
}

// 10 ms of PCM silence. An actual play() in the tap unlocks this same native
// media element on Safari while neural synthesis is still in flight.
const SILENT_AUDIO = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='
let activePlayer: { element: HTMLAudioElement; cancel: () => void } | null = null

export default function SolutionAudioButton(props: SolutionAudioButtonProps) {
  const source = { ...props, language: props.language ?? 'de' }
  // A new card owns a new media element; late requests cannot start the previous card.
  return <NeuralAudioPlayer key={neuralAudioKey(source)} {...source} />
}

function NeuralAudioPlayer({ text, audioUrl, cardId, language, label, ariaLabel, variant = 'primary', onUnsupported }: SolutionAudioButtonProps & { language: NeuralAudioLanguage }) {
  const copy = useAudioFeedback()
  const source = useRef<NeuralAudioSource>({ text, audioUrl, cardId, language }).current
  const [url, setUrl] = useState(() => cachedNeuralAudio(source))
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const aliveRef = useRef(true)
  const requestRef = useRef(0)
  const pendingRef = useRef(false)
  const primingRef = useRef(false)

  const cancel = useCallback((audio = audioRef.current) => {
    requestRef.current += 1
    pendingRef.current = false
    primingRef.current = false
    if (activePlayer?.element === audio) activePlayer = null
    audio?.pause()
    if (aliveRef.current) { setLoading(false); setIsPlaying(false) }
  }, [])

  useEffect(() => {
    aliveRef.current = true
    const audio = audioRef.current
    return () => { aliveRef.current = false; cancel(audio) }
  }, [cancel])

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
    if (audio.getAttribute('src') !== nextUrl) audio.src = nextUrl
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
    <div className="flex min-w-0 flex-col items-center gap-2">
      <button type="button" onClick={handleClick} aria-label={error ? copy.retry : isPlaying || loading ? copy.pause : ariaLabel}
        aria-pressed={isPlaying} aria-busy={loading}
        className={cn('academy-button min-h-12 min-w-12 w-full sm:w-auto', variant === 'primary' ? 'academy-button-primary' : 'academy-button-outline')}>
        {loading ? <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : isPlaying ? <Pause size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        <span>{error ? copy.retry : loading ? copy.loading : isPlaying ? copy.pause : label}</span>
      </button>
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
            setIsPlaying(true); setLoading(false); pendingRef.current = false
          }
        }}
        onPause={() => { if (!primingRef.current) setIsPlaying(false) }}
        onEnded={() => { if (!primingRef.current) { setIsPlaying(false); setLoading(false) } }}
        onError={() => {
          if (!primingRef.current && audioRef.current?.getAttribute('src')) {
            cancel(); setError(true)
          }
        }} />
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{copy.error}</p>}
      {needsGesture && <p role="status" className="text-sm text-[var(--muted)]">{copy.ready}</p>}
    </div>
  )
}
