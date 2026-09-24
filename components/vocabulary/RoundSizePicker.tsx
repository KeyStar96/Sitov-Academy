'use client'

import { useId } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { countRounds, DEFAULT_ROUND_SIZE, ROUND_SIZE_OPTIONS, type RoundSize } from '@/lib/vocabulary-rounds'

/** Mehr Stapel zeichnen wir nicht — der Rest steht als „+N" daneben. */
const MAX_STACKS = 12

/**
 * „Karten pro Runde": Wie groß ist eine Lernrunde? Große Tasten statt eines
 * Schiebereglers, ein Satz Erklärung in einfacher Sprache und darunter der
 * heutige Stapel als kleine Karteikarten-Päckchen — man sieht, in wie viele
 * Runden er zerfällt. `size` ist `null`, solange die gespeicherte Wahl noch
 * nicht geladen ist; dann ist noch keine Taste markiert.
 */
export default function RoundSizePicker({ lang, due, size, onChange }: {
  lang: string
  due: number
  size: RoundSize | null
  onChange: (size: RoundSize) => void
}) {
  const s = studentTranslator(lang)
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const effective = size ?? DEFAULT_ROUND_SIZE
  const rounds = countRounds(due, effective)
  const perRound = effective === 'all' ? due : effective
  const partial = effective !== 'all' && due % effective !== 0
  const shown = rounds > MAX_STACKS ? MAX_STACKS - 1 : rounds

  return (
    <section className="lb-rounds" aria-labelledby={`${id}-title`}>
      <div className="lb-rounds__head">
        <span className="lb-rounds__icon" aria-hidden="true"><Layers size={22} strokeWidth={2.25} /></span>
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="lb-rounds__title">{s('round_picker_title')}</h3>
          <p id={`${id}-hint`} className="lb-rounds__hint">{s('round_picker_hint')}</p>
        </div>
      </div>

      <div role="radiogroup" aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`} className="lb-rounds__options">
        {ROUND_SIZE_OPTIONS.map(option => {
          const active = option === size
          return (
            <label key={option} className="lb-rounds__option" data-active={active || undefined}>
              <input type="radio" name={`${id}-size`} value={option} checked={active} onChange={() => onChange(option)} className="sr-only"
                aria-label={option === 'all' ? s('round_option_all_aria') : s('round_option_aria', { count: option })} />
              {active && <motion.span layoutId={`${id}-pill`} className="lb-rounds__pill" aria-hidden="true"
                initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="lb-rounds__value" aria-hidden="true">{option === 'all' ? s('round_option_all') : option}</span>
            </label>
          )
        })}
      </div>

      <div className="lb-rounds__plan">
        <div className="lb-rounds__stacks" aria-hidden="true">
          <AnimatePresence initial={false} mode="popLayout">
            {Array.from({ length: shown }, (_, index) => (
              <motion.span key={index} layout={!reduced} className="lb-rounds__stack"
                data-partial={partial && rounds <= MAX_STACKS && index === rounds - 1 ? true : undefined}
                initial={reduced ? false : { opacity: 0, y: -10, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduced ? undefined : { opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 26, delay: Math.min(index, 11) * 0.03 }} />
            ))}
            {rounds > MAX_STACKS && (
              <motion.span key="more" layout={!reduced} className="lb-rounds__more"
                initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduced ? undefined : { opacity: 0 }}>
                +{rounds - shown}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="lb-rounds__summary" aria-live="polite">
          {rounds > 1 ? s('round_plan', { total: due, rounds, size: perRound }) : s('round_plan_single', { total: due })}
        </p>
      </div>
    </section>
  )
}
