'use client'

import { useEffect, useRef, useState } from 'react'
import { MOTION, useIsHydrating, useReducedMotionSafe } from '@/lib/motion'

/**
 * Zahl, die in 500 ms hochzählt (D5) — beim Erscheinen nach einem
 * Seitenwechsel und wenn sich der Wert ändert.
 *
 * Aus dem Server-HTML kommt immer der Endwert: Beim ersten Laden steht die
 * Zahl sofort da und springt nicht auf null zurück. Unter „weniger Bewegung"
 * zeigt sie immer sofort den Endwert. Screenreader hören nur den Endwert,
 * nie die Zwischenstände.
 */
export default function CountUp({ value, className, cap }: {
  value: number
  className?: string
  /** Obergrenze der Anzeige: darüber steht „999+". Nur Daten, keine Funktion — auch aus Server-Komponenten nutzbar. */
  cap?: number
}) {
  const format = (count: number) => cap !== undefined && count > cap ? `${cap}+` : String(count)
  const reduced = useReducedMotionSafe()
  const hydrating = useIsHydrating()
  const [shown, setShown] = useState(() => (hydrating || reduced ? value : 0))
  const from = useRef(shown)

  useEffect(() => {
    if (reduced) { from.current = value; setShown(value); return }
    const start = from.current
    if (start === value) return
    let frame = 0
    const began = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / (MOTION.slower * 1000))
      // Sanft auslaufend wie --ease-out-soft.
      const eased = 1 - (1 - progress) ** 3
      const next = Math.round(start + (value - start) * eased)
      from.current = next
      setShown(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, reduced])

  return (
    <span className={className} data-count-up={value}>
      <span aria-hidden="true">{format(reduced ? value : shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
