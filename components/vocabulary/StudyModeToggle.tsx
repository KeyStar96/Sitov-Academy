'use client'

import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Keyboard, Layers } from 'lucide-react'
import type { VocabularyTranslator } from '@/lib/vocabulary-i18n'
import { cn } from '@/lib/utils'

/** Der vom Lernenden gewählte Weg durch eine Karte. */
export type StudyMode = 'flashcard' | 'typed'

const OPTIONS: ReadonlyArray<{ mode: StudyMode; icon: typeof Layers; label: 'mode_flashcard' | 'mode_typing'; hint: 'mode_flashcard_hint' | 'mode_typing_hint' }> = [
  { mode: 'flashcard', icon: Layers, label: 'mode_flashcard', hint: 'mode_flashcard_hint' },
  { mode: 'typed', icon: Keyboard, label: 'mode_typing', hint: 'mode_typing_hint' },
]

interface Props {
  mode: StudyMode
  onChange: (mode: StudyMode) => void
  disabled?: boolean
  t: VocabularyTranslator
}

/**
 * Umschalter zwischen Karteikarte und Ausschreiben.
 *
 * Die gefüllte Pille wandert per `layoutId` zwischen den beiden Optionen —
 * dieselbe Fläche bewegt sich, statt dass eine verschwindet und eine andere
 * erscheint. Genau daran erkennt man, dass es ein Schalter ist und nicht zwei
 * Knöpfe.
 *
 * Bedient wird er als Radiogruppe: Es ist eine Wahl zwischen zwei Wegen zu
 * derselben Karte, kein Ein/Aus.
 */
export default function StudyModeToggle({ mode, onChange, disabled = false, t }: Props) {
  const reduced = useReducedMotion() ?? false
  const groupId = useId()

  return (
    <div className="learning-mode-toggle">
      <span id={groupId} className="sr-only">{t('mode_toggle_label')}</span>
      <div role="radiogroup" aria-labelledby={groupId} className="learning-mode-track">
        {OPTIONS.map(({ mode: option, icon: Icon, label, hint }) => {
          const active = option === mode
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => { if (!active) onChange(option) }}
              className={cn('learning-mode-option', active && 'is-active')}
            >
              {active && (
                <motion.span
                  aria-hidden="true"
                  layoutId={reduced ? undefined : 'learning-mode-pill'}
                  className="learning-mode-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
                />
              )}
              <span className="learning-mode-face">
                <Icon size={16} aria-hidden="true" />
                <span>{t(label)}</span>
              </span>
              <span className="sr-only">{t(hint)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
