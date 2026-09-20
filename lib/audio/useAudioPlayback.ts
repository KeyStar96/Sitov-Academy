'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  analysePcmWindow,
  mixDownToMono,
  wavBlobFromMono,
} from '@/lib/audio/wav'
import {
  browserPrefersMp4Recording,
  decodeFromSource,
  ensureAudioContext,
  prepareHtmlAudioElement,
  requestPlaybackAudioSession,
} from '@/lib/audio/web-audio'
import { guessAudioMimeType } from '@/lib/audio/waveform'

/**
 * Wiedergabe ausschließlich über ein natives `<audio>`-Element.
 *
 * Web-Audio-Ausgabe (`AudioBufferSourceNode` / `createMediaElementSource`)
 * bleibt auf dem iPhone stumm, sobald der Ring/Silent-Schalter an ist –
 * die Zeitanzeige läuft trotzdem. HTML-Audio plus WAV-Umkodierung und
 * `navigator.audioSession.type = 'playback'` umgeht das.
 */

export type PlaybackError = null | 'format' | 'load'

export interface UseAudioPlaybackResult {
  error: PlaybackError
  isPlaying: boolean
  isBuffering: boolean
  currentTime: number
  duration: number
  htmlAudioRef: RefObject<HTMLAudioElement | null>
  getVolume: () => number
  getTone: () => number
  play: () => Promise<void>
  pause: () => void
  seek: (seconds: number) => void
}

export function useAudioPlayback(
  src: string | null,
  rate: number,
  blob?: Blob | null
): UseAudioPlaybackResult {
  const htmlAudioRef = useRef<HTMLAudioElement | null>(null)
  const samplesRef = useRef<Float32Array | null>(null)
  const sampleRateRef = useRef(44100)
  const wavUrlRef = useRef<string | null>(null)
  const isPlayingRef = useRef(false)
  const rateRef = useRef(rate)

  const [error, setError] = useState<PlaybackError>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  rateRef.current = rate
  isPlayingRef.current = isPlaying

  const releaseWavUrl = useCallback(() => {
    if (wavUrlRef.current) {
      URL.revokeObjectURL(wavUrlRef.current)
      wavUrlRef.current = null
    }
  }, [])

  const assignSrc = useCallback((audio: HTMLAudioElement, nextSrc: string) => {
    prepareHtmlAudioElement(audio, nextSrc)
    audio.muted = false
    audio.volume = 1
    audio.playbackRate = rateRef.current
    if (audio.src !== nextSrc) {
      audio.src = nextSrc
      audio.load()
    }
  }, [])

  useEffect(() => {
    setIsPlaying(false)
    isPlayingRef.current = false
    setIsBuffering(Boolean(src))
    setCurrentTime(0)
    setDuration(0)
    setError(null)
    samplesRef.current = null
    releaseWavUrl()

    const audio = htmlAudioRef.current
    if (!src || !audio) {
      setIsBuffering(false)
      return
    }

    const mime = guessAudioMimeType(src)
    const formatBlocked = Boolean(mime && audio.canPlayType(mime) === '')
    const iosLike = browserPrefersMp4Recording()

    if (!iosLike) {
      assignSrc(audio, src)
    }

    let cancelled = false

    void (async () => {
      try {
        const context = ensureAudioContext()
        if (!context) {
          if (formatBlocked) {
            setError('format')
          } else if (iosLike) {
            assignSrc(audio, src)
          }
          setIsBuffering(false)
          return
        }

        const decoded = await decodeFromSource(context, src, blob)
        if (cancelled) return

        const channels: Float32Array[] = []
        for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
          channels.push(decoded.getChannelData(channel))
        }
        const mono = mixDownToMono(channels)
        samplesRef.current = mono
        sampleRateRef.current = decoded.sampleRate
        setDuration(decoded.duration)

        const wavUrl = URL.createObjectURL(wavBlobFromMono(mono, decoded.sampleRate))
        if (cancelled) {
          URL.revokeObjectURL(wavUrl)
          return
        }
        releaseWavUrl()
        wavUrlRef.current = wavUrl
        if (!isPlayingRef.current) {
          assignSrc(audio, wavUrl)
        }
        setIsBuffering(false)
      } catch (err) {
        console.error("Audio konnte nicht in WAV gewandelt werden, Originalquelle wird genutzt:")
        if (cancelled) return
        if (formatBlocked) {
          setError('format')
        } else {
          assignSrc(audio, src)
        }
        setIsBuffering(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assignSrc, blob, releaseWavUrl, src])

  useEffect(() => {
    const audio = htmlAudioRef.current
    if (!audio) return

    const handleTime = () => setCurrentTime(audio.currentTime)
    const handleDuration = () => {
      const value = audio.duration
      if (value === Infinity || Number.isNaN(value)) {
        const forceDuration = () => {
          audio.removeEventListener('timeupdate', forceDuration)
          if (Number.isFinite(audio.duration)) setDuration(audio.duration)
          audio.currentTime = 0
        }
        audio.addEventListener('timeupdate', forceDuration)
        try {
          audio.currentTime = 1e101
        } catch {
          setDuration(0)
        }
        return
      }
      if (Number.isFinite(value) && value > 0) setDuration(value)
    }
    const handlePlay = () => {
      setIsPlaying(true)
      isPlayingRef.current = true
      setIsBuffering(false)
      setError(null)
    }
    const handlePause = () => {
      setIsPlaying(false)
      isPlayingRef.current = false
      setIsBuffering(false)
      setCurrentTime(audio.currentTime)
    }
    const handleEnded = () => {
      setIsPlaying(false)
      isPlayingRef.current = false
      setCurrentTime(0)
    }
    const handleWaiting = () => setIsBuffering(true)
    const handleCanPlay = () => setIsBuffering(false)
    const handleError = () => {
      setIsBuffering(false)
      setError('load')
    }

    audio.addEventListener('timeupdate', handleTime)
    audio.addEventListener('loadedmetadata', handleDuration)
    audio.addEventListener('durationchange', handleDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTime)
      audio.removeEventListener('loadedmetadata', handleDuration)
      audio.removeEventListener('durationchange', handleDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('error', handleError)
    }
  }, [src])

  useEffect(() => {
    const audio = htmlAudioRef.current
    if (audio) audio.playbackRate = rate
  }, [rate])

  useEffect(() => () => releaseWavUrl(), [releaseWavUrl])

  const getVolume = useCallback((): number => {
    if (!isPlayingRef.current) return 0
    const samples = samplesRef.current
    if (!samples) return 0.28
    const time = htmlAudioRef.current?.currentTime ?? 0
    return analysePcmWindow(samples, time, sampleRateRef.current).volume
  }, [])

  const getTone = useCallback((): number => {
    const samples = samplesRef.current
    if (!samples) return 0.5
    const time = htmlAudioRef.current?.currentTime ?? 0
    return analysePcmWindow(samples, time, sampleRateRef.current).tone
  }, [])

  const play = useCallback(async () => {
    const audio = htmlAudioRef.current
    if (!audio || !src || error === 'format') return

    requestPlaybackAudioSession()
    audio.muted = false
    audio.volume = 1
    audio.playbackRate = rateRef.current

    if (!audio.src) {
      assignSrc(audio, wavUrlRef.current ?? src)
    }

    setIsBuffering(true)
    try {
      await audio.play()
    } catch (err) {
      console.error("Wiedergabe nicht möglich:")
      setIsBuffering(false)
      setError('load')
    }
  }, [assignSrc, error, src])

  const pause = useCallback(() => {
    htmlAudioRef.current?.pause()
  }, [])

  const seek = useCallback(
    (seconds: number) => {
      const audio = htmlAudioRef.current
      if (!audio || duration <= 0) return
      audio.currentTime = Math.min(Math.max(0, seconds), duration)
      setCurrentTime(audio.currentTime)
    },
    [duration]
  )

  return {
    error,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    htmlAudioRef,
    getVolume,
    getTone,
    play,
    pause,
    seek,
  }
}
