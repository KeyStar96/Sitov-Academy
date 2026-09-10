'use client'

/**
 * Gemeinsamer Web-Audio-Zugang für Aufnahme und Wiedergabe.
 *
 * iOS/Safari-Regeln, die hier gekapselt sind:
 *  - Ein `AudioContext` startet fast immer als `suspended` und muss aus
 *    einer Nutzer-Geste (`resume`) kommen – *bevor* `await getUserMedia`.
 *  - Playback und Mikrofon verwenden jeweils einen wiederverwendeten Context.
 *    Der Mic-Context entsteht erst nach getUserMedia wegen der Safari-Sample-Rate.
 *  - Die Contexts werden nach Aufnahmen nicht geschlossen; MediaRecorder wartet
 *    nicht auf deren durch Autoplay-Regeln möglicherweise ausstehendes resume().
 *  - Safari nimmt zuverlässig `audio/mp4` auf, nicht `audio/webm`.
 */

interface WindowWithLegacyAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext
}

const SAFARI_MIME_CANDIDATES = [
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/aac',
  'audio/webm;codecs=opus',
  'audio/webm',
] as const

const STANDARD_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const

let sharedContext: AudioContext | null = null
let sharedMicContext: AudioContext | null = null

export function prefersMp4Recording(userAgent: string, maxTouchPoints: number): boolean {
  const ua = userAgent
  const iOSDevice = /iPad|iPhone|iPod/.test(ua)
  const iPadOsDesktopUa = /Macintosh/.test(ua) && maxTouchPoints > 1
  const safari =
    /Safari/.test(ua) && !/Chrome|Chromium|Android|Edg|OPR|Firefox|CriOS|FxiOS/.test(ua)
  return iOSDevice || iPadOsDesktopUa || safari
}

export function recorderMimeCandidates(preferMp4: boolean): readonly string[] {
  return preferMp4 ? SAFARI_MIME_CANDIDATES : STANDARD_MIME_CANDIDATES
}

export function pickRecorderMimeType(
  isTypeSupported: (mime: string) => boolean,
  preferMp4: boolean
): string | undefined {
  for (const candidate of recorderMimeCandidates(preferMp4)) {
    if (isTypeSupported(candidate)) return candidate
  }
  return undefined
}

export function blobTypeForRecorder(
  recorderMimeType: string,
  pickedMimeType: string | undefined,
  preferMp4: boolean
): string {
  const raw = recorderMimeType || pickedMimeType || ''
  const base = raw.split(';')[0]?.trim()
  if (base) return base
  return preferMp4 ? 'audio/mp4' : 'audio/webm'
}

function audioContextConstructor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  const legacy = (window as WindowWithLegacyAudioContext).webkitAudioContext
  return window.AudioContext ?? legacy
}

/**
 * Erzeugt den gemeinsamen Context synchron – muss im Klick-Handler
 * *vor* dem ersten `await` stehen, sonst verfällt die iOS-Geste.
 */
export function ensureAudioContext(): AudioContext | null {
  if (sharedContext && sharedContext.state !== 'closed') return sharedContext
  const Ctor = audioContextConstructor()
  if (!Ctor) return null
  sharedContext = new Ctor()
  return sharedContext
}

/**
 * Ein separater AudioContext für die Mikrofon-Visualisierung. 
 * Löst einen iOS-Safari-Bug, bei dem `MediaStreamAudioSourceNode` stumm
 * bleibt, wenn der Context *vor* getUserMedia (mit einer abweichenden
 * Sample-Rate) erzeugt wurde. Wird *nach* getUserMedia initialisiert.
 */
export function ensureMicContext(): AudioContext | null {
  if (sharedMicContext && sharedMicContext.state !== 'closed') return sharedMicContext
  const Ctor = audioContextConstructor()
  if (!Ctor) return null
  sharedMicContext = new Ctor()
  return sharedMicContext
}

/** Resume is best-effort for capture: autoplay policies must never block MediaRecorder. */
export function resumeAudioContextWithoutBlocking(context: AudioContext | null): void {
  if (!context || context.state === 'closed' || context.state === 'running') return
  try {
    void context.resume().catch((error: unknown) => {
      console.error('AudioContext konnte nicht fortgesetzt werden:', error)
    })
  } catch (error) {
    console.error('AudioContext konnte nicht fortgesetzt werden:', error)
  }
}

export async function unlockAudioContext(): Promise<AudioContext | null> {
  const context = ensureAudioContext()
  if (!context) return null
  if (context.state === 'suspended') {
    try {
      await context.resume()
    } catch (err) {
      console.error('AudioContext konnte nicht fortgesetzt werden:', err)
    }
  }
  return context
}

export function createAnalyserNode(context: AudioContext): AnalyserNode {
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.35
  return analyser
}

/**
 * `decodeAudioData` verbraucht den Puffer in älteren Safari-Versionen.
 * Wir kopieren vorher und unterstützen sowohl Promise- als auch Callback-API.
 */
export function decodeAudioDataCompat(
  context: AudioContext,
  data: ArrayBuffer
): Promise<AudioBuffer> {
  const copy = data.slice(0)
  return new Promise((resolve, reject) => {
    let settled = false
    const succeed = (buffer: AudioBuffer) => {
      if (settled) return
      settled = true
      resolve(buffer)
    }
    const fail = (reason: unknown) => {
      if (settled) return
      settled = true
      reject(reason)
    }

    try {
      const maybePromise = context.decodeAudioData(copy, succeed, fail)
      if (maybePromise && typeof maybePromise.then === 'function') {
        void maybePromise.then(succeed, fail)
      }
    } catch (err) {
      fail(err)
    }
  })
}

export async function decodeFromSource(
  context: AudioContext,
  src: string,
  blob?: Blob | null
): Promise<AudioBuffer> {
  if (blob) {
    const data = await blob.arrayBuffer()
    return decodeAudioDataCompat(context, data)
  }

  const response = await fetch(src)
  if (!response.ok) {
    throw new Error(`Audio konnte nicht geladen werden (${response.status}).`)
  }
  const data = await response.arrayBuffer()
  return decodeAudioDataCompat(context, data)
}

interface HtmlAudioWithPlaysInline extends HTMLAudioElement {
  playsInline: boolean
}

export function prepareHtmlAudioElement(audio: HTMLAudioElement, src: string): void {
  audio.setAttribute('playsinline', 'true')
  audio.setAttribute('webkit-playsinline', 'true')
  ;(audio as HtmlAudioWithPlaysInline).playsInline = true
  audio.preload = 'metadata'
  if (src.startsWith('http')) {
    audio.crossOrigin = 'anonymous'
  }
}

export function browserPrefersMp4Recording(): boolean {
  if (typeof navigator === 'undefined') return false
  return prefersMp4Recording(navigator.userAgent, navigator.maxTouchPoints ?? 0)
}

interface NavigatorAudioSession {
  type: string
}

interface NavigatorWithAudioSession extends Navigator {
  audioSession?: NavigatorAudioSession
}

export type AudioSessionKind = 'auto' | 'playback' | 'play-and-record'

export function setAudioSessionType(kind: AudioSessionKind): void {
  if (typeof navigator === 'undefined') return
  const session = (navigator as NavigatorWithAudioSession).audioSession
  if (!session) return
  try {
    session.type = kind
  } catch (err) {
    console.error('audioSession konnte nicht gesetzt werden:', { kind, err })
  }
}

/**
 * iOS 16.4+: Session auf „playback“, damit der Stummschalter die
 * Wiedergabe nicht verschluckt. Nur beim Abspielen verwenden – vor
 * `getUserMedia` würde `playback` den Mikrofon-Zugriff blockieren.
 */
export function requestPlaybackAudioSession(): void {
  setAudioSessionType('playback')
}

export function isMicrophonePermissionDenied(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err && typeof err.name === 'string' ? err.name : ''
  return name === 'NotAllowedError' || name === 'PermissionDeniedError'
}

const MIC_CONSTRAINT_ATTEMPTS: readonly MediaStreamConstraints[] = [
  { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } },
  { audio: true },
]

/**
 * Holt den Mikrofon-Stream. Auf iOS zuerst `play-and-record`, dann
 * `getUserMedia` – `playback` davor führt zu einem falschen „Zugriff verweigert“.
 * Zweiter Versuch ohne Constraints, falls Safari die ersten ablehnt.
 */
export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    throw new Error('getUserMedia ist nicht verfügbar')
  }

  setAudioSessionType('play-and-record')

  let lastError: unknown
  for (const constraints of MIC_CONSTRAINT_ATTEMPTS) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
      console.error('getUserMedia fehlgeschlagen:', {
        constraint: constraints.audio === true ? 'audio:true' : 'audio:processed',
        name: err && typeof err === 'object' && 'name' in err ? err.name : undefined,
        message: err instanceof Error ? err.message : String(err),
      })
      if (isMicrophonePermissionDenied(err)) break
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Mikrofon nicht verfügbar')
}
