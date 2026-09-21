'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

type Props = {
  children: ReactNode
  className?: string
  id?: string
  /** Verzögerung in Sekunden für einen sanften Staged-Effekt. */
  delay?: number
}

/**
 * Dezenter Fade-up beim Scroll-in (Subtle Luxury, im Hero-Stil).
 * Rendert als der übergebene Layout-Container (className wird durchgereicht),
 * fügt also KEIN zusätzliches DOM-Element ein und bricht keine Grids.
 * Respektiert prefers-reduced-motion (dann komplett statisch).
 */
export default function Reveal({ children, className, id, delay = 0 }: Props) {
  const reduced = useReducedMotion()
  const anim = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, margin: '-60px' },
        transition: { duration: 0.6, ease: EASE, delay },
      }
  return (
    <motion.div id={id} className={className} {...anim}>
      {children}
    </motion.div>
  )
}
