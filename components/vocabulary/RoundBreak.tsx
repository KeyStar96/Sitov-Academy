'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowRight, Check, Coffee } from 'lucide-react'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { SessionBoxMoves, type SessionMove } from './SuccessMoments'

const EASE = [0.22, 1, 0.36, 1] as const
/** Bis zu so vielen Runden zeigt der Tagesbalken einzelne Segmente. */
const MAX_SEGMENTS = 24

/**
 * Tagesfortschritt über alle Runden: je Runde ein Segment. Die gerade
 * beendete Runde füllt sich sichtbar, die früheren sind schon voll.
 */
export function TodayRounds({ lang, rounds, completed, done, previous, total }: {
  lang: string
  rounds: number
  /** Fertige Runden, die zuletzt beendete eingeschlossen. */
  completed: number
  /** Heute geschaffte Karten nach bzw. vor der zuletzt beendeten Runde. */
  done: number
  previous: number
  total: number
}) {
  const s = studentTranslator(lang)
  const reduced = useReducedMotion() ?? false
  const label = s('round_today_progress', { done, total })
  const segments = rounds <= MAX_SEGMENTS ? rounds : 1
  return (
    <div className="learning-round__meter">
      <div className="learning-round__track" role="progressbar" aria-label={s('round_progress_aria')} aria-valuetext={label}
        aria-valuenow={total ? Math.round(done / total * 100) : 100} aria-valuemin={0} aria-valuemax={100}>
        {Array.from({ length: segments }, (_, index) => {
          const share = segments === 1 ? (total ? done / total : 1) : index < completed ? 1 : 0
          const fresh = !reduced && (segments === 1 || index === completed - 1)
          return (
            <span key={index} className="learning-round__seg">
              <motion.span initial={fresh ? { scaleX: segments === 1 ? (total ? previous / total : 0) : 0 } : false}
                animate={{ scaleX: share }} transition={{ duration: 0.7, ease: EASE, delay: 0.35 }} />
            </span>
          )
        })}
      </div>
      <p className="learning-round__meter-label">{label}</p>
    </div>
  )
}

/**
 * Zwischen zwei Runden: kurz feiern, zeigen, wie weit der Tag ist, und die
 * Wahl lassen — weiterlernen oder Pause. Der Hinweis darunter nimmt die Sorge,
 * dass bei einer Pause etwas verloren geht.
 */
export default function RoundBreak({ lang, round, rounds, roundCards, done, total, nextCount, moves, onContinue, onPause }: {
  lang: string
  round: number
  rounds: number
  roundCards: number
  done: number
  total: number
  nextCount: number
  moves: readonly SessionMove[]
  onContinue: () => void
  onPause: () => void
}) {
  const s = studentTranslator(lang)
  const reduced = useReducedMotion() ?? false
  const heading = useRef<HTMLHeadingElement>(null)
  // Screenreader und Tastatur landen auf der Überschrift der Pause.
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [])
  const container: Variants = { hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: reduced ? 0 : 0.15 } } }
  const rise: Variants = reduced ? { hidden: {}, show: {} } : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } }

  return (
    <motion.div className="learning-card learning-complete learning-round" variants={container} initial="hidden" animate="show">
      <motion.span className="learning-round__badge" aria-hidden="true"
        initial={reduced ? false : { scale: 0.3, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 16 }}>
        <Check size={38} strokeWidth={3} />
      </motion.span>
      <motion.h2 ref={heading} tabIndex={-1} variants={rise}>{s('round_done_title', { round })}</motion.h2>
      <motion.p variants={rise}>{s.count('round_done_text', roundCards)}</motion.p>
      <motion.div variants={rise} className="w-full">
        <TodayRounds lang={lang} rounds={rounds} completed={round} done={done} previous={done - roundCards} total={total} />
      </motion.div>
      <motion.p variants={rise} className="learning-round__remaining">{s.count('round_remaining', total - done)}</motion.p>
      <motion.div variants={rise} className="learning-round__actions">
        <button type="button" className="learning-button learning-button-primary learning-button-wide" onClick={onContinue}>
          <span className="learning-round__label">{s.count('round_next', nextCount)}<ArrowRight size={20} aria-hidden="true" className="learning-round__arrow" /></span>
        </button>
        <button type="button" className="learning-button learning-button-secondary learning-button-wide" onClick={onPause}>
          <span className="learning-round__label"><Coffee size={20} aria-hidden="true" />{s('round_pause')}</span>
        </button>
      </motion.div>
      <motion.p variants={rise} className="learning-round__reassure">{s('round_pause_hint')}</motion.p>
      <motion.div variants={rise} className="w-full"><SessionBoxMoves lang={lang} moves={moves} /></motion.div>
    </motion.div>
  )
}
