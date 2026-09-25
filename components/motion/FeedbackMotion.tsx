'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { popVariants, shakeVariants, useReducedMotionSafe } from '@/lib/motion'

/**
 * Rückmeldung nach einer Antwort (D5/D11): richtig → einmaliger kurzer Pop,
 * falsch → sanftes horizontales Wackeln (±4 px, 320 ms) statt roter Fläche.
 * Das Ergebnis selbst entscheidet PostgreSQL; die Bewegung ersetzt nie den
 * Text. Unter „weniger Bewegung" steht die Rückmeldung einfach still da.
 */
export default function FeedbackMotion({ correct, children, className }: {
  correct: boolean
  children: ReactNode
  className?: string
}) {
  const reduced = useReducedMotionSafe()
  const variants = correct ? popVariants : shakeVariants
  return (
    <motion.div className={className} data-feedback={correct ? 'correct' : 'incorrect'}
      variants={reduced ? undefined : variants} initial={reduced ? false : 'rest'} animate={reduced ? undefined : correct ? 'pop' : 'shake'}>
      {children}
    </motion.div>
  )
}
