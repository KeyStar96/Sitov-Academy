'use client'

import { useEffect, useRef } from 'react'
import { smoothTowards } from '@/lib/audio/waveform'

/** Eine phasenverschobene Sinus-Schicht der Siri-Wave. */
interface WaveLayer {
  /** Anzahl der Wellenberge über die volle Breite. */
  frequency: number
  /** Phasengeschwindigkeit relativ zur Basisgeschwindigkeit (Vorzeichen = Richtung). */
  speed: number
  /** Anteil der maximalen Auslenkung, den diese Schicht nutzt. */
  scale: number
  /** Deckkraft der Linie in der Mitte des Farbverlaufs. */
  alpha: number
  /** Linienbreite in CSS-Pixeln. */
  lineWidth: number
}

/**
 * Drei überlagerte, unterschiedlich schnelle Wellen ergeben zusammen die
 * organische, "atmende" Siri-Optik statt einer einzelnen starren Sinuskurve.
 */
const WAVE_LAYERS: readonly WaveLayer[] = [
  { frequency: 1.1, speed: 1, scale: 1, alpha: 0.95, lineWidth: 3.2 },
  { frequency: 1.6, speed: -1.4, scale: 0.7, alpha: 0.55, lineWidth: 2.4 },
  { frequency: 2.3, speed: 1.8, scale: 0.45, alpha: 0.35, lineWidth: 1.8 },
]

/** Anzahl der Geradenstücke pro Welle – 64 reicht für glatte Kurven bei üblicher Kartenbreite. */
const CURVE_STEPS = 64

/**
 * Wiederverwendbare Siri-artige, fließende Tonspur auf `<canvas>`.
 *
 * Lautstärke steuert die Amplitude, Stimmlage die Wellendichte.
 * Die beiden dominanten Sinuslinien begrenzen eine dezente, geschlossene Fläche.
 * Die dritte Linie bleibt als feiner Akzent erhalten.
 */
export default function FluidWaveform({
  getVolume,
  getTone,
  isActive,
  className,
}: {
  /** Liefert bei jedem Frame den aktuellen Pegel (0..1). Wird per Ref gehalten, kein Trigger für Effect-Neustarts. */
  getVolume: () => number
  /**
   * Optionaler Stimmlage-Wert (0..1) aus `getByteFrequencyData`.
   * Höhere Werte verdichten die Welle (mehr Berge), tiefe Stimmen strecken sie.
   */
  getTone?: () => number
  /** Ob gerade Ton läuft. `false` zeichnet einmalig eine ruhige Linie statt dauerhaft zu animieren. */
  isActive: boolean
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const getVolumeRef = useRef(getVolume)
  getVolumeRef.current = getVolume
  const getToneRef = useRef(getTone)
  getToneRef.current = getTone

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameHandle: number | null = null
    let disposed = false
    let amplitude = 0
    let tone = 0.5
    let phase = 0

    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
    const motionPreference = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    let reducedMotion = motionPreference?.matches ?? false
    let previousTimestamp: number | null = null
    let elapsedSeconds = 0
    let fillOpacity = 0.24
    // Reuse the exact same sampled coordinates for contour strokes and fill.
    const curves = WAVE_LAYERS.map(() => new Float32Array(CURVE_STEPS + 1))

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
    }
    resize()

    const drawFrame = () => {
      const width = canvas.width
      const height = canvas.height
      if (width === 0 || height === 0) return

      ctx.clearRect(0, 0, width, height)

      const midY = height / 2
      const maxSwing = height * 0.42
      const swingFactor = amplitude
      const density = 0.7 + tone * 0.9

      WAVE_LAYERS.forEach((layer, index) => {
        const curve = curves[index]
        for (let step = 0; step <= CURVE_STEPS; step += 1) {
          const t = step / CURVE_STEPS
          curve[step] = midY +
            Math.sin(t * Math.PI * 2 * layer.frequency * density + phase * layer.speed) *
              maxSwing * layer.scale * swingFactor
        }
      })

      // Trace one existing contour forwards and the other backwards. Even-odd
      // filling keeps every lobe precisely between the lines at intersections.
      ctx.beginPath()
      for (let step = 0; step <= CURVE_STEPS; step += 1) {
        const x = (step / CURVE_STEPS) * width
        if (step === 0) ctx.moveTo(x, curves[0][step])
        else ctx.lineTo(x, curves[0][step])
      }
      for (let step = CURVE_STEPS; step >= 0; step -= 1) {
        ctx.lineTo((step / CURVE_STEPS) * width, curves[1][step])
      }
      ctx.closePath()
      const fillGradient = ctx.createLinearGradient(0, 0, width, 0)
      fillGradient.addColorStop(0, 'rgba(255, 122, 26, 0)')
      fillGradient.addColorStop(0.35, 'rgba(235, 128, 73, 0.85)')
      fillGradient.addColorStop(0.65, 'rgba(255, 173, 108, 0.85)')
      fillGradient.addColorStop(1, 'rgba(255, 122, 26, 0)')
      ctx.fillStyle = fillGradient
      ctx.globalAlpha = fillOpacity
      // Only the existing contour strokes glow; the fill must not bleed out.
      ctx.shadowBlur = 0
      ctx.fill('evenodd')
      ctx.globalAlpha = 1

      WAVE_LAYERS.forEach((layer, index) => {
        ctx.beginPath()
        for (let step = 0; step <= CURVE_STEPS; step += 1) {
          const x = (step / CURVE_STEPS) * width
          if (step === 0) ctx.moveTo(x, curves[index][step])
          else ctx.lineTo(x, curves[index][step])
        }

        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        gradient.addColorStop(0, 'rgba(255, 92, 0, 0)')
        gradient.addColorStop(0.5, `rgba(255, 122, 26, ${layer.alpha})`)
        gradient.addColorStop(1, 'rgba(255, 92, 0, 0)')

        ctx.strokeStyle = gradient
        ctx.lineWidth = layer.lineWidth * dpr
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.shadowColor = 'rgba(255, 122, 26, 0.55)'
        ctx.shadowBlur = 10 * dpr
        ctx.stroke()
      })
    }

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            resize()
            if (frameHandle === null) drawFrame()
          })
        : null
    resizeObserver?.observe(container)

    const animate = (timestamp: number) => {
      if (disposed || reducedMotion || !isActive) return
      const deltaSeconds = previousTimestamp === null ? 1 / 60 : Math.min((timestamp - previousTimestamp) / 1000, 0.05)
      previousTimestamp = timestamp
      elapsedSeconds += deltaSeconds
      const smoothing = 1 - Math.pow(1 - 0.18, deltaSeconds * 60)
      amplitude = smoothTowards(amplitude, getVolumeRef.current(), smoothing)
      const toneTarget = getToneRef.current ? getToneRef.current() : 0.5
      tone = smoothTowards(tone, toneTarget, smoothing)
      phase += 2.7 * deltaSeconds * (0.7 + amplitude * 0.6)
      // A slow 3.8-second breath, driven by the existing animation loop only.
      fillOpacity = 0.24 + 0.045 * Math.sin((elapsedSeconds / 3.8) * Math.PI * 2)
      drawFrame()
      frameHandle = requestAnimationFrame(animate)
    }

    const updateMotion = () => {
      if (frameHandle !== null) cancelAnimationFrame(frameHandle)
      frameHandle = null
      previousTimestamp = null
      reducedMotion = motionPreference?.matches ?? false
      if (isActive && !reducedMotion) {
        frameHandle = requestAnimationFrame(animate)
      } else {
        // A fixed contour under reduced motion, a calm line when paused.
        amplitude = isActive ? 0.35 : 0
        tone = 0.5
        phase = 0
        fillOpacity = 0.24
        drawFrame()
      }
    }
    updateMotion()
    motionPreference?.addEventListener('change', updateMotion)

    return () => {
      disposed = true
      if (frameHandle !== null) cancelAnimationFrame(frameHandle)
      resizeObserver?.disconnect()
      motionPreference?.removeEventListener('change', updateMotion)
    }
  }, [isActive])

  return (
    <div ref={containerRef} className={className ?? 'h-full w-full'}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  )
}
