'use client'

import { type CSSProperties, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Archive, ArrowLeftRight, CalendarCheck, Check, RotateCcw, Sparkles, X, type LucideIcon } from 'lucide-react'
import { LEITNER_PHASES, PHASE_INTERVALS_IN_DAYS } from '@/lib/leitner'
import { phaseTone } from '@/lib/vocabulary-box'
import type { createVocabularyTranslator } from '@/lib/vocabulary-i18n'
import { cn } from '@/lib/utils'
import { EASE_OUT_SOFT, MOTION, staggerDelay, useReducedMotionSafe } from '@/lib/motion'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import { sitovTrainerHelpCopy } from '@/lib/sitov-trainer-help-copy'

type Translator = ReturnType<typeof createVocabularyTranslator>
type StepKey = 'new' | 'right' | 'wrong' | 'both' | 'learned'

/** Die gemeinsamen Lernboxregeln, in der Reihenfolge, in der eine Karte sie erlebt. */
const STEPS: readonly { key: StepKey; icon: LucideIcon; tone: 'accent' | 'success' | 'danger' | 'violet' }[] = [
  { key: 'new', icon: Sparkles, tone: 'accent' },
  { key: 'right', icon: Check, tone: 'success' },
  { key: 'wrong', icon: RotateCcw, tone: 'danger' },
  { key: 'both', icon: ArrowLeftRight, tone: 'violet' },
  { key: 'learned', icon: Archive, tone: 'success' },
]

/**
 * Die Mini-Box: sechs Fächer und das Archiv, darunter die Pause je Fach. Eine
 * Karte wandert hindurch – zweimal vorwärts, einmal falsch zurück in Fach 1,
 * dann Fach für Fach bis ins Archiv. Reine Veranschaulichung (aria-hidden); die
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
 * Box. Der gemeinsame Schalter zeigt zusätzliche Regeln erst auf Wunsch.
 */
export default function LernkastenGuide({ t, lang, defaultOpen = false, title, children }: { t: Translator; lang: string; defaultOpen?: boolean; title?: string; children?: ReactNode }) {
  const reduced = useReducedMotionSafe()
  const help = sitovTrainerHelpCopy(lang)

  return (
    <section aria-label={help.vocabulary}>
    <SitovTrainerHelp title={help.label} defaultOpen={defaultOpen}>
      <h3 className="font-semibold">{title && title !== help.label ? title : help.vocabulary}</h3>
      {children}
      <GuideTrack t={t} />
      <ol className="lb-guide__steps">
        {STEPS.map(({ key, icon: Icon, tone }, index) => (
          <motion.li
            key={key}
            className="lb-guide__step"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : MOTION.slow, ease: EASE_OUT_SOFT, delay: reduced ? 0 : staggerDelay(index) }}
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
        transition={{ duration: reduced ? 0 : MOTION.slow, ease: EASE_OUT_SOFT, delay: reduced ? 0 : staggerDelay(STEPS.length) }}
      >
        <CalendarCheck size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
        <span>{t('box_guide_tip')}</span>
      </motion.p>
    </SitovTrainerHelp>
    </section>
  )
}
