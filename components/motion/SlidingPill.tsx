'use client'

import { motion } from 'framer-motion'
import { SPRING, useReducedMotionSafe } from '@/lib/motion'

/**
 * Wandernde Pille hinter dem aktiven Eintrag (D5): Sie gleitet per
 * `layoutId` vom alten zum neuen Eintrag. Jede Gruppe braucht einen eigenen
 * Namen (`group`, z. B. aus `useId`), sonst springen Pillen zwischen
 * verschiedenen Leisten hin und her.
 *
 * Nur zu rendern, wo der aktive Eintrag ist. Unter „weniger Bewegung" steht
 * sie sofort an ihrem Platz. Rein dekorativ: Der aktive Zustand muss immer
 * auch als Text/ARIA erkennbar sein (`aria-current`, `aria-pressed`).
 */
export default function SlidingPill({ group, className }: { group: string; className?: string }) {
  const reduced = useReducedMotionSafe()
  return (
    <motion.span aria-hidden="true" className={className} data-sliding-pill=""
      layoutId={reduced ? undefined : `${group}-pill`} initial={false}
      transition={reduced ? { duration: 0 } : SPRING} />
  )
}
