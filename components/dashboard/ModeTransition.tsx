'use client'

import { useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { LEARNING_MODES, modeFromPathname } from '@/lib/mode-targets'
import { EASE_OUT_SOFT, MOTION, useIsHydrating, useReducedMotionSafe } from '@/lib/motion'

/**
 * Wechsel zwischen den Modi (D6): Der neue Inhalt kommt 8 px aus der
 * Richtung des gewählten Reiters — nach rechts für einen Modus weiter
 * rechts im Dock, sonst nach links. Innerhalb eines Modus (Lernbox ↔
 * Lektionen) bleibt alles stehen. Beim ersten Laden und unter „weniger
 * Bewegung" erscheint der Inhalt sofort.
 */
export default function ModeTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const mode = modeFromPathname(pathname)
  const reduced = useReducedMotionSafe()
  const hydrating = useIsHydrating()
  const order = mode ? LEARNING_MODES.indexOf(mode) : -1
  const previous = useRef(order)
  const direction = order >= previous.current ? 1 : -1
  if (previous.current !== order) previous.current = order

  return (
    <motion.div key={mode ?? 'overview'} className="st-mode-content"
      initial={hydrating || reduced ? false : { opacity: 0, x: 8 * direction }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: MOTION.slow, ease: EASE_OUT_SOFT }}>
      {children}
    </motion.div>
  )
}
