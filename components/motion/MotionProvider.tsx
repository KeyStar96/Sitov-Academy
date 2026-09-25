'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

/**
 * Framer folgt im ganzen Lernraum der Systemeinstellung „weniger Bewegung":
 * Transform- und Layout-Bewegungen entfallen dann. Die Bausteine in
 * `components/motion` schalten zusätzlich jede Deckkraft-Blende ab.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
