'use client'

import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
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
  const [sitovTransition, setSitovTransition] = useState({ order, direction: 1 })
  if (sitovTransition.order !== order) setSitovTransition({ order, direction: order >= sitovTransition.order ? 1 : -1 })
  const direction = sitovTransition.direction

  return (
    <motion.div key={mode ?? 'overview'} className="st-mode-content"
      initial={hydrating || reduced ? false : { opacity: 0, x: 14 * direction, scale: .985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: MOTION.slower, ease: EASE_OUT_SOFT }}>
      <SitovMotionStage className="sitov-trainer-stage" data-mode={mode ?? 'overview'} data-sitov-surface="">{children}</SitovMotionStage>
    </motion.div>
  )
}
