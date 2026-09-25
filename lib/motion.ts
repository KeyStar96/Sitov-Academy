import { useSyncExternalStore } from 'react'
import type { Transition, Variants } from 'framer-motion'

/**
 * Bewegung im Lernraum (D4/D5, Phase 2).
 *
 * Die CSS-Gegenstücke stehen als `--motion-*` in `app/globals.css`; CSS
 * rechnet in Millisekunden, Framer in Sekunden. Bewegt werden nur
 * `transform` und `opacity`. Keine Bewegung ersetzt Text oder Symbol, und
 * unter „weniger Bewegung" wird jeder Zustand sofort gezeigt.
 */
export const MOTION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  slower: 0.5,
} as const

/** Standardkurve `--ease-out-soft`. */
export const EASE_OUT_SOFT = [0.22, 1, 0.36, 1] as const

/**
 * Feder für Pille und Knoten-Pop (D4). Eine Feder hat keine feste Dauer; die
 * Ruhe-Schwellen beenden sie, sobald die Restbewegung unter 1 px liegt. So
 * endet auch eine Layout-Bewegung (Framer rechnet dort 0 → 1000) nach
 * höchstens 500 ms (D13) — nachgemessen in `__tests__/motion.test.tsx`.
 */
export const SPRING = { type: 'spring', stiffness: 420, damping: 34, restDelta: 1, restSpeed: 20 } as const satisfies Transition

/** Gestaffeltes Einblenden: 40 ms je Element, höchstens acht Elemente. */
export const STAGGER = 0.04
export const STAGGER_LIMIT = 8

/** Druck auf Karten und Knöpfe. */
export const PRESS_SCALE = 0.97

/** Verzögerung des n-ten Elements; ab dem neunten erscheint alles zugleich. */
export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER_LIMIT - 1) * STAGGER
}

/** Einblenden aus 8 px (D5). */
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: (index: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: MOTION.slow, ease: EASE_OUT_SOFT, delay: staggerDelay(index) },
  }),
}

/** Einmaliger Pop auf 1,08 — Erfolg, neuer Zähler. */
export const popVariants: Variants = {
  rest: { scale: 1 },
  pop: { scale: [1, 1.08, 1], transition: { duration: MOTION.slow, ease: EASE_OUT_SOFT } },
}

/** Sanftes horizontales Wackeln ±4 px in 320 ms, statt rot zu blinken. */
export const shakeVariants: Variants = {
  rest: { x: 0 },
  shake: { x: [0, -4, 4, -4, 4, 0], transition: { duration: MOTION.slow, ease: 'easeInOut' } },
}

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(REDUCED_QUERY)
  query.addEventListener?.('change', onChange)
  return () => query.removeEventListener?.('change', onChange)
}

function readPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia(REDUCED_QUERY).matches
}

/**
 * `true`, solange Bewegung nicht ausdrücklich erlaubt ist.
 *
 * Auf dem Server und während der Hydration ist die Vorliebe unbekannt — dann
 * gilt „ruhig": Inhalte erscheinen ohne verdeckten Anfangszustand. Danach
 * folgt der Wert der Systemeinstellung und reagiert auf Änderungen.
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(subscribe, readPreference, () => true)
}

const noSubscription = () => () => {}

/**
 * `true` auf dem Server und während der Hydration, danach `false`.
 *
 * Einblend-Bewegungen gelten nur für Elemente, die nach dem Laden neu
 * erscheinen (Seitenwechsel, neue Brotkrume). Was aus dem Server-HTML kommt,
 * steht sofort sichtbar da — kein Aufblitzen, kein verzögerter Seiteninhalt.
 */
export function useIsHydrating(): boolean {
  return useSyncExternalStore(noSubscription, () => false, () => true)
}
