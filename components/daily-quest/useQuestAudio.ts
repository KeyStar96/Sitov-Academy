'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cachedNeuralAudio, invalidateNeuralAudio, neuralAudioKey, resolveNeuralAudio, type NeuralAudioSource } from '@/lib/audio/neural-client'
import { requestPlaybackAudioSession } from '@/lib/audio/web-audio'

// Unlock the same native element synchronously in the tap on iPhone, while
// the existing neural engine resolves its recording. No AudioContext output.
const SILENT_AUDIO = 'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='
type AudioPhase = 'idle' | 'loading' | 'playing' | 'ready' | 'error'
type AudioState = { phase: AudioPhase; key: string | null; text: string }
const IDLE: AudioState = { phase: 'idle', key: null, text: '' }
function stopNativePlayer(player: HTMLAudioElement | null) {
  if (!player) return
  player.pause()
  player.currentTime = 0
}

/** One player owns scene and word playback; sources themselves stay separate. */
export function useQuestAudio(scopeKey: string, playbackRate: number) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const alive = useRef(true)
  const generation = useRef(0)
  const priming = useRef(false)
  const active = useRef<{ key: string; text: string; phase: AudioPhase; element: HTMLAudioElement } | null>(null)
  const failedKey = useRef<string | null>(null)
  const rateRef = useRef(playbackRate)
  const [state, setState] = useState<AudioState>(IDLE)

  useEffect(() => {
    rateRef.current = playbackRate
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  const stop = useCallback(() => {
    generation.current += 1
    priming.current = false
    const player = active.current?.element ?? audioRef.current
    active.current = null
    stopNativePlayer(player)
    if (alive.current) setState(IDLE)
  }, [])

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; stop() }
  }, [stop])

  useEffect(() => () => stop(), [scopeKey, stop])

  const play = useCallback((source: NeuralAudioSource) => {
    const player = audioRef.current
    if (!player || !source.text.trim()) return
    const key = neuralAudioKey(source)
    // A second tap cancels loading as well as playback. Late synthesis stays
    // cached by the shared engine, but cannot restart this cancelled request.
    if (active.current?.key === key && (active.current.phase === 'loading' || active.current.phase === 'playing')) {
      stop()
      return
    }
    stop()
    const request = ++generation.current
    active.current = { key, text: source.text, phase: 'loading', element: player }
    requestPlaybackAudioSession()
    setState({ phase: 'loading', key, text: source.text })
    const ownsRequest = () => alive.current && generation.current === request && active.current?.key === key
    const reportError = (reason: unknown) => {
      if (!ownsRequest()) return
      priming.current = false
      if (reason instanceof DOMException && reason.name === 'AbortError') { stop(); return }
      const phase = reason instanceof DOMException && reason.name === 'NotAllowedError' ? 'ready' : 'error'
      if (active.current) active.current.phase = phase
      if (phase === 'error') failedKey.current = key
      setState({ phase, key, text: source.text })
    }
    const start = async (url: string) => {
      if (!ownsRequest()) return
      priming.current = false
      if (player.getAttribute('src') !== url) player.src = url
      player.preservesPitch = true
      player.playbackRate = rateRef.current
      try {
        await player.play()
        if (ownsRequest()) {
          if (active.current) active.current.phase = 'playing'
          failedKey.current = null; setState({ phase: 'playing', key, text: source.text })
        }
      } catch (reason: unknown) { reportError(reason) }
    }
    const retry = failedKey.current === key
    const cached = retry ? null : cachedNeuralAudio(source)
    if (cached) { void start(cached); return }
    if (retry) invalidateNeuralAudio(source)
    priming.current = true
    player.src = SILENT_AUDIO
    let unlocked: Promise<void>
    try { unlocked = player.play().catch(() => undefined) } catch { unlocked = Promise.resolve() }
    void (async () => {
      try {
        const [url] = await Promise.all([resolveNeuralAudio(source, retry), unlocked])
        await start(url)
      } catch (reason: unknown) { reportError(reason) }
    })()
  }, [stop])

  const finish = () => {
    if (priming.current || active.current?.phase !== 'playing') return
    active.current = null
    generation.current += 1
    setState(IDLE)
  }

  return {
    audioRef, state, play, stop,
    audioEvents: {
      onPlaying: () => {
        const current = active.current
        if (!priming.current && current) { current.phase = 'playing'; setState({ phase: 'playing', key: current.key, text: current.text }) }
      },
      onEnded: finish,
      onPause: () => {
        const current = active.current
        if (!priming.current && current && current.phase === 'playing') { current.phase = 'idle'; setState(IDLE) }
      },
      onError: () => {
        const current = active.current
        if (!priming.current && current) {
          generation.current += 1
          failedKey.current = current.key
          current.phase = 'error'
          setState({ phase: 'error', key: current.key, text: current.text })
        }
      },
    },
  }
}
