'use client'

import { useId, useState, type CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Archive, ArrowLeftRight, CalendarCheck, Check, ChevronDown, Lightbulb, RotateCcw, Sparkles, X, type LucideIcon } from 'lucide-react'
import { LEITNER_PHASES, PHASE_INTERVALS_IN_DAYS } from '@/lib/leitner'
import { phaseTone } from '@/lib/vocabulary-box'
import type { createVocabularyTranslator } from '@/lib/vocabulary-i18n'
import { cn } from '@/lib/utils'

type Translator = ReturnType<typeof createVocabularyTranslator>
type StepKey = 'new' | 'right' | 'wrong' | 'both' | 'learned'

const EASE = [0.22, 1, 0.36, 1] as const

/** Die Regeln aus `22_vocabulary_phase6_rules.sql`, in der Reihenfolge, in der eine Karte sie erlebt. */
const STEPS: readonly { key: StepKey; icon: LucideIcon; tone: 'accent' | 'success' | 'danger' | 'violet' }[] = [
  { key: 'new', icon: Sparkles, tone: 'accent' },
  { key: 'right', icon: Check, tone: 'success' },
  { key: 'wrong', icon: RotateCcw, tone: 'danger' },
  { key: 'both', icon: ArrowLeftRight, tone: 'violet' },
  { key: 'learned', icon: Archive, tone: 'success' },
]

/**
 * Die Mini-Box: sechs Fächer und das Archiv, darunter die Pause je Fach. Eine
 * Karte wandert hindurch – zweimal vorwärts, einmal falsch und ein Fach
 * zurück, dann bis ins Archiv. Reine Veranschaulichung (aria-hidden); die
 * Regeln stehen vollständig im Text daneben.
 */
function GuideTrack({ t }: { t: Translator }) {
  return (
    <div className="lb-guide__track" aria-hidden="true">
      <div className="lb-guide__slots">
        {LEITNER_PHASES.map((phase, index) => (
          <span key={phase} className="lb-guide__slot" style={{ '--i': String(index) } as CSSProperties}>
            <span className={cn('lb-guide__numeral', phaseTone(phase).text)}>{phase}</span>
          </span>
        ))}
        <span className="lb-guide__slot" data-archive style={{ '--i': '6' } as CSSProperties}>
          <span className={cn('lb-guide__numeral', phaseTone('learned').text)}><Check size={13} strokeWidth={3.5} /></span>
        </span>
        <span className="lb-guide__card">
          <span className="lb-guide__paper" />
          <span className="lb-guide__mark lb-guide__mark--wrong"><X size={11} strokeWidth={4} /></span>
          <span className="lb-guide__mark lb-guide__mark--right"><Check size={11} strokeWidth={4} /></span>
        </span>
      </div>
      <div className="lb-guide__days">
        {LEITNER_PHASES.map((phase) => <span key={phase}>{PHASE_INTERVALS_IN_DAYS[phase]}</span>)}
        <span>–</span>
      </div>
      <p className="lb-guide__caption">{t('box_guide_track_caption')}</p>
    </div>
  )
}

/**
 * „Wie funktioniert dein Lernkasten?" – aufklappbare Kurzanleitung unter der
 * Box. Zugeklappt stört sie den Start-Knopf nicht; bei einem noch leeren
 * Kasten steht sie offen, weil dann genau diese Frage ansteht.
 */
export default function LernkastenGuide({ t, defaultOpen = false }: { t: Translator; defaultOpen?: boolean }) {
  const reduced = useReducedMotion() ?? false
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const toggleId = `${id}-toggle`
  const panelId = `${id}-panel`

  return (
    <div className="lb-guide" data-open={open || undefined}>
      <button
        id={toggleId}
        type="button"
        className="lb-guide__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="lb-guide__icon" aria-hidden="true"><Lightbulb size={22} strokeWidth={2.25} /></span>
        <span className="min-w-0 flex-1">{t('box_guide_title')}</span>
        <ChevronDown size={22} aria-hidden="true" className="lb-guide__chevron" />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={toggleId}
            className="lb-guide__panel"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.42, ease: EASE }}
          >
            <div className="lb-guide__body">
              <GuideTrack t={t} />
              <ol className="lb-guide__steps">
                {STEPS.map(({ key, icon: Icon, tone }, index) => (
                  <motion.li
                    key={key}
                    className="lb-guide__step"
                    initial={reduced ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: EASE, delay: reduced ? 0 : 0.12 + index * 0.06 }}
                  >
                    <span className="lb-guide__step-icon" data-tone={tone} aria-hidden="true"><Icon size={18} strokeWidth={2.5} /></span>
                    <span><b>{t(`box_guide_${key}_label`)}:</b> {t(`box_guide_${key}`)}</span>
                  </motion.li>
                ))}
              </ol>
              <motion.p
                className="lb-guide__tip"
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE, delay: reduced ? 0 : 0.12 + STEPS.length * 0.06 }}
              >
                <CalendarCheck size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
                <span>{t('box_guide_tip')}</span>
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
