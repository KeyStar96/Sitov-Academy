'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  blobTypeForRecorder,
  browserPrefersMp4Recording,
  createAnalyserNode,
  decodeFromSource,
  ensureAudioContext,
  ensureMicContext,
  isMicrophonePermissionDenied,
  pickRecorderMimeType,
  requestMicrophoneStream,
  resumeAudioContextWithoutBlocking,
} from '@/lib/audio/web-audio'
import { mixDownToMono, wavBlobFromMono } from '@/lib/audio/wav'
import { appendLevel, levelFromTimeDomain, WAVEFORM_BAR_COUNT } from '@/lib/audio/waveform'

/**
 * Gemeinsame Aufnahme-Logik für Schüler und Lehrkraft.
 *
 * Kapselt `getUserMedia`, `MediaRecorder` und den `AnalyserNode` für die
 * live mitlaufende Tonspur. Der AudioContext wird geteilt und nicht
 * geschlossen – auf iOS führt `close()` sonst zu stummer Wiedergabe.
 */

export type RecorderStatus =
  /** Noch nichts aufgenommen. */
  | 'idle'
  /** Warten auf die Mikrofon-Freigabe des Browsers. */
  | 'requesting'
  | 'recording'
  /** Aufnahme liegt als Blob bereit. */
  | 'ready'
  /** Der Browser kann nicht aufnehmen (z.B. sehr alter iOS-Safari). */
  | 'unsupported'
  /** Der Nutzer hat den Mikrofon-Zugriff abgelehnt. */
  | 'denied'
  /** Technischer Fehler während der Aufnahme. */
  | 'failed'

export interface UseAudioRecorderResult {
  status: RecorderStatus
  /** Pegelwerte 0–1 für die laufende Tonspur. */
  levels: readonly number[]
  elapsedSeconds: number
  /** Object-URL der fertigen Aufnahme, für Wiedergabe im Browser. */
  audioUrl: string | null
  audioBlob: Blob | null
  isRecording: boolean
  hasRecording: boolean
  /**
   * Live-Zugriff auf den `AnalyserNode` der laufenden Aufnahme, für eigene
   * Visualisierungen (z.B. die Canvas-Siri-Wave in `LiveWaveform`).
   * `current` ist nur während der Aufnahme gesetzt und wird beim Stoppen
   * automatisch wieder auf `null` gesetzt (siehe `teardown`).
   */
  analyserRef: RefObject<AnalyserNode | null>
  start: () => Promise<void>
  stop: () => void
  /** Verwirft die Aufnahme und gibt den Object-URL frei. */
  reset: () => void
}

/** Abstand zwischen zwei Balken der laufenden Tonspur. */
const LEVEL_SAMPLE_INTERVAL_MS = 110

function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [levels, setLevels] = useState<readonly number[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const startPendingRef = useRef(false)
  const generationRef = useRef(0)
  const mountedRef = useRef(true)
  const streamRef = useRef<MediaStream | null>(null)
  const recordStreamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastSampleAtRef = useRef(0)
  const startedAtRef = useRef(0)
  const objectUrlRef = useRef<string | null>(null)

  const releaseObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  /** Gibt Mikrofon, Knoten und die Animationsschleife frei – nicht den Context. */
  const teardown = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect()
      } catch {
        // Bereits getrennt.
      }
      sourceNodeRef.current = null
    }

    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect()
      } catch {
        // Bereits getrennt.
      }
      analyserRef.current = null
    }

    const stopStream = (stream: MediaStream | null) => {
      if (!stream) return
      for (const track of stream.getTracks()) {
        track.stop()
      }
    }
    stopStream(recordStreamRef.current)
    recordStreamRef.current = null
    stopStream(streamRef.current)
    streamRef.current = null
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      startPendingRef.current = false
      teardown()
      releaseObjectUrl()
    }
  }, [releaseObjectUrl, teardown])

  const start = useCallback(async () => {
    if (startPendingRef.current || recorderRef.current?.state === 'recording') return
    if (!isRecordingSupported()) {
      setStatus('unsupported')
      return
    }

    startPendingRef.current = true
    const generation = ++generationRef.current
    // Prepare playback during the gesture; recording itself never waits for autoplay.
    try {
      resumeAudioContextWithoutBlocking(ensureAudioContext())
    } catch (error) {
      console.error('Wiedergabe-Context konnte nicht vorbereitet werden:', error)
    }

    releaseObjectUrl()
    setAudioUrl(null)
    setAudioBlob(null)
    setLevels([])
    setElapsedSeconds(0)
    setStatus('requesting')

    let stream: MediaStream
    try {
      stream = await requestMicrophoneStream()
    } catch (err) {
      console.error('Mikrofon-Zugriff nicht möglich:', err)
      if (mountedRef.current && generation === generationRef.current) setStatus(isMicrophonePermissionDenied(err) ? 'denied' : 'failed')
      startPendingRef.current = false
      return
    }

    if (!mountedRef.current || generation !== generationRef.current) {
      stream.getTracks().forEach((track) => track.stop())
      startPendingRef.current = false
      return
    }
    streamRef.current = stream

    try {

      const preferMp4 = browserPrefersMp4Recording()
      const mimeType = pickRecorderMimeType(
        (candidate) => MediaRecorder.isTypeSupported(candidate),
        preferMp4
      )
      let recordStream = stream
      try {
        recordStream = stream.clone()
      } catch (err) {
        console.error('MediaStream.clone() nicht möglich, nutze denselben Stream:', err)
      }
      recordStreamRef.current = recordStream

      const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        if (!mountedRef.current || generation !== generationRef.current) return
        teardown()
        void (async () => {
          const type = blobTypeForRecorder(recorder.mimeType, mimeType, preferMp4)
          let output = new Blob(chunksRef.current, { type })
          try {
            const running = ensureAudioContext()
            if (running) {
              const decoded = await decodeFromSource(running, '', output)
              const channels: Float32Array[] = []
              for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
                channels.push(decoded.getChannelData(channel))
              }
              const wav = wavBlobFromMono(mixDownToMono(channels), decoded.sampleRate)
              if (wav.size > 0) output = wav
            }
          } catch (err) {
            console.error('Aufnahme konnte nicht nach WAV gewandelt werden:', err)
          }

          if (!mountedRef.current || generation !== generationRef.current) return
          const url = URL.createObjectURL(output)
          objectUrlRef.current = url
          setAudioBlob(output)
          setAudioUrl(url)
          setStatus(output.size > 0 ? 'ready' : 'failed')
          teardown()
        })()
      }

      recorder.onerror = () => {
        if (!mountedRef.current || generation !== generationRef.current) return
        console.error('MediaRecorder hat die Aufnahme abgebrochen.')
        setStatus('failed')
        teardown()
      }

      // Native capture is independent of the optional Web Audio visualization.
      // timeslice also makes Safari flush chunks before the final stop event.
      recorder.start(250)
      startedAtRef.current = performance.now()
      lastSampleAtRef.current = 0
      setStatus('recording')

      // Deliberately created AFTER getUserMedia: Safari must see the microphone sample rate.
      try {
        const analyserContext = ensureMicContext()
        if (analyserContext && analyserContext.state !== 'closed') {
          resumeAudioContextWithoutBlocking(analyserContext)
          const analyser = createAnalyserNode(analyserContext)
          const source = analyserContext.createMediaStreamSource(stream)
          source.connect(analyser)
          sourceNodeRef.current = source
          analyserRef.current = analyser
        }
      } catch (error) {
        // A visualizer failure must not discard an otherwise valid microphone recording.
        console.error('Mikrofon-Waveform konnte nicht verbunden werden:', error)
      }
      const buffer = new Uint8Array(analyserRef.current?.fftSize ?? 2048)
      const tick = () => {
        if (!mountedRef.current || generation !== generationRef.current || recorder.state !== 'recording') return
        const now = performance.now()
        setElapsedSeconds((now - startedAtRef.current) / 1000)
        if (now - lastSampleAtRef.current >= LEVEL_SAMPLE_INTERVAL_MS) {
          lastSampleAtRef.current = now
          const analyser = analyserRef.current
          if (analyser) analyser.getByteTimeDomainData(buffer)
          const level = analyser ? levelFromTimeDomain(buffer) : 0
          setLevels((previous) => appendLevel(previous, level, WAVEFORM_BAR_COUNT))
        }
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
    } catch (err) {
      console.error('Aufnahme konnte nicht gestartet werden:', err)
      teardown()
      if (mountedRef.current && generation === generationRef.current) setStatus('failed')
    } finally {
      startPendingRef.current = false
    }
  }, [releaseObjectUrl, teardown])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      teardown()
    }
  }, [teardown])

  const reset = useCallback(() => {
    generationRef.current += 1
    startPendingRef.current = false
    teardown()
    releaseObjectUrl()
    setAudioBlob(null)
    setAudioUrl(null)
    setLevels([])
    setElapsedSeconds(0)
    setStatus('idle')
  }, [releaseObjectUrl, teardown])

  return {
    status,
    levels,
    elapsedSeconds,
    audioUrl,
    audioBlob,
    isRecording: status === 'recording',
    hasRecording: status === 'ready' && audioBlob !== null,
    analyserRef,
    start,
    stop,
    reset,
  }
}
