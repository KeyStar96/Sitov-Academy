'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Pause, Volume2 } from 'lucide-react'
import { generateAudio } from '@/app/actions/generate-audio'
import { useAudioFeedback } from '@/components/layout/RouteFeedbackProvider'
import { normalizeAudioText } from '@/lib/audio/neural-config'
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

const resolvedUrls = new Map<string, string>()
const pendingUrls = new Map<string, Promise<string>>()
let playingAudio: HTMLAudioElement | null = null
let requestedAudio: HTMLAudioElement | null = null

function resolveUrl(key: string, text: string, language: NeuralAudioLanguage, cardId?: string): Promise<string> {
  const cached = resolvedUrls.get(key)
  if (cached) return Promise.resolve(cached)
  const pending = pendingUrls.get(key)
  if (pending) return pending
  const request = generateAudio({ text, language, ...(cardId ? { cardId } : {}) }).then(result => {
    if (result.success === false) throw new Error(result.error)
    if (resolvedUrls.size >= 256) {
      const oldest = resolvedUrls.keys().next().value
      if (oldest) resolvedUrls.delete(oldest)
    }
    resolvedUrls.set(key, result.audioUrl)
    return result.audioUrl
  }).finally(() => pendingUrls.delete(key))
  pendingUrls.set(key, request)
  return request
}

export default function SolutionAudioButton(props: SolutionAudioButtonProps) {
  const language = props.language ?? 'de'
  const cacheKey = JSON.stringify([props.cardId ?? null, language, normalizeAudioText(props.text), props.audioUrl ?? null])
  // A new card owns a new media element; late requests cannot start the previous card.
  return <NeuralAudioPlayer key={cacheKey} {...props} language={language} cacheKey={cacheKey} />
}

function NeuralAudioPlayer({ text, audioUrl, cardId, language, label, ariaLabel, variant = 'primary', onUnsupported, cacheKey }: SolutionAudioButtonProps & { language: NeuralAudioLanguage; cacheKey: string }) {
  const copy = useAudioFeedback()
  const [url, setUrl] = useState<string | null>(audioUrl || resolvedUrls.get(cacheKey) || null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    const audio = audioRef.current
    return () => {
      aliveRef.current = false
      audio?.pause()
      if (playingAudio === audio) playingAudio = null
      if (requestedAudio === audio) requestedAudio = null
    }
  }, [])

  const prepare = useCallback(async () => {
    const source = await resolveUrl(cacheKey, text, language, cardId)
    if (aliveRef.current) setUrl(source)
    return source
  }, [cacheKey, text, language, cardId])

  useEffect(() => {
    // Prepare only the visible word, so a cached tap plays within the user gesture on iOS.
    if (!url && !error && text.trim()) void prepare().catch(() => undefined)
  }, [url, error, text, prepare])

  const play = (source: string) => {
    const audio = audioRef.current
    if (!audio || !aliveRef.current || requestedAudio !== audio) return
    if (playingAudio && playingAudio !== audio) playingAudio.pause()
    playingAudio = audio
    if (audio.getAttribute('src') !== source) audio.src = source
    setError(false)
    setNeedsGesture(false)
    void audio.play().catch((reason: unknown) => {
      if (!aliveRef.current) return
      setIsPlaying(false)
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      if (reason instanceof DOMException && reason.name === 'NotAllowedError') {
        // Safari may require another tap when synthesis completed after the first gesture.
        setNeedsGesture(true)
      } else {
        setError(true)
        onUnsupported?.()
      }
    })
  }

  const handleClick = () => {
    if (loading) return
    if (isPlaying) { requestedAudio = null; audioRef.current?.pause(); return }
    // The last explicit choice wins, even when an earlier synthesis is still in flight.
    requestedAudio = audioRef.current
    if (url && !error) { play(url); return }
    if (error) resolvedUrls.delete(cacheKey)
    setLoading(true)
    void prepare().then(play).catch(() => {
      if (aliveRef.current) { setError(true); onUnsupported?.() }
    }).finally(() => { if (aliveRef.current) setLoading(false) })
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <button type="button" onClick={handleClick} aria-label={error ? copy.retry : isPlaying ? copy.pause : ariaLabel}
        aria-pressed={isPlaying} aria-busy={loading}
        className={cn('academy-button min-h-11 min-w-11 w-full sm:w-auto', variant === 'primary' ? 'academy-button-primary' : 'academy-button-outline')}>
        {loading ? <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : isPlaying ? <Pause size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
        <span>{error ? copy.retry : isPlaying ? copy.pause : label}</span>
        {loading && <span className="sr-only">{copy.loading}</span>}
      </button>
      <audio ref={audioRef} src={url ?? undefined} preload="auto" controls={needsGesture} aria-label={ariaLabel}
        className={needsGesture ? 'h-12 min-w-0 w-full max-w-full rounded-xl' : 'hidden'}
        onPlay={() => {
          const audio = audioRef.current
          if (!audio) return
          // Native Safari controls participate in the same single-player ownership.
          requestedAudio = audio
          if (playingAudio && playingAudio !== audio) playingAudio.pause()
          playingAudio = audio
          setIsPlaying(true)
        }}
        onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)}
        onError={() => { if (url) { setIsPlaying(false); setError(true) } }} />
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{copy.error}</p>}
      {needsGesture && <p role="status" className="text-sm text-[var(--muted)]">{copy.ready}</p>}
    </div>
  )
}
