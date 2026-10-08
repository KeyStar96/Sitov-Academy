'use client'

import { motion } from 'framer-motion'
import { BadgeCheck, CalendarCheck, Check, Layers3, RotateCcw, Route, X } from 'lucide-react'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import { EASE_OUT_SOFT, MOTION, staggerDelay, useReducedMotionSafe } from '@/lib/motion'
import { getSitovVerbCopy } from '@/lib/verbs/i18n'
import { SITOV_VERB_REVIEW_DAYS } from '@/lib/verbs/learning-box'
import { getSitovVerbBoxCopy } from '@/lib/verbs/learning-box-i18n'
import type { SitovVerbTense } from '@/lib/verbs/types'
import styles from './SitovVerbLearningGuide.module.css'

const SITOV_GUIDE_EXAMPLES: Record<SitovVerbTense, string> = {
  present: 'ich lerne',
  perfect: 'ich habe gelernt',
  past: 'ich lernte',
}

/** A demonstration of one form; the learner's actual progress stays in the box above. */
export default function SitovVerbLearningGuide({ lang, tenses }: { lang: string; tenses: readonly SitovVerbTense[] }) {
  const copy = getSitovVerbBoxCopy(lang)
  const verbCopy = getSitovVerbCopy(lang)
  const reduced = useReducedMotionSafe()
  const steps = [
    { key: 'new', icon: Layers3, tone: 'verb', label: copy.guideNewLabel, text: copy.guideText },
    { key: 'right', icon: Check, tone: 'success', label: copy.guideRightLabel, text: copy.guideRightText },
    { key: 'wrong', icon: RotateCcw, tone: 'danger', label: copy.guideWrongLabel, text: copy.guideWrongText },
    { key: 'learned', icon: BadgeCheck, tone: 'success', label: copy.guideLearnedLabel, text: copy.learnedRules },
  ] as const

  return <SitovMotionStage className={styles.sitovGuide} data-sitov-verb-guide-stage data-reduced={reduced}>
    <div className={styles.sitovDemoHead}>
      <span className={styles.sitovDemoLabel}><Route size={15} aria-hidden="true" />{copy.guideDemo}</span>
      <div className={styles.sitovExamples}>
        {tenses.map(tense => <span key={tense} className={styles.sitovExample} data-sitov-verb-guide-example={tense}>
          <span>{verbCopy[tense]}</span><b lang="de" translate="no">{SITOV_GUIDE_EXAMPLES[tense]}</b>
        </span>)}
      </div>
    </div>

    <div className={styles.sitovTrack} aria-hidden="true" data-sitov-verb-guide-track>
      <div className={styles.sitovSlots}>
        {SITOV_VERB_REVIEW_DAYS.map((_, index) => <span key={index + 1} className={styles.sitovSlot}
          data-sitov-verb-guide-slot={index + 1} data-learned={index === 6 || undefined}>
          <span className={styles.sitovNumeral}>{index + 1}{index === 6 && <Check size={10} strokeWidth={3.5} />}</span>
        </span>)}
        <span className={styles.sitovCard} data-sitov-verb-guide-card>
          <span className={styles.sitovPaper}><span /><span /><span /></span>
          <span className={`${styles.sitovFeedback} ${styles.sitovWrong}`} data-sitov-verb-guide-feedback="wrong"><X size={11} strokeWidth={3.5} /></span>
          <span className={`${styles.sitovFeedback} ${styles.sitovRight}`} data-sitov-verb-guide-feedback="right"><Check size={11} strokeWidth={3.5} /></span>
        </span>
      </div>
      <div className={styles.sitovDays}>{SITOV_VERB_REVIEW_DAYS.map((days, index) => <span key={index}>{days}</span>)}</div>
      <p className={styles.sitovCaption}>{copy.guideTrackCaption}</p>
      <div className={styles.sitovLegend}>
        <span><Check size={13} strokeWidth={3} />{copy.guideRight}<b>+1</b></span>
        <span><RotateCcw size={13} strokeWidth={2.5} />{copy.guideWrong}<b>→ 1</b></span>
      </div>
    </div>

    <ol className={styles.sitovSteps}>
      {steps.map(({ key, icon: Icon, tone, label, text }, index) => <motion.li key={key} className={styles.sitovStep}
        initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : MOTION.slow, ease: EASE_OUT_SOFT, delay: reduced ? 0 : staggerDelay(index) }}>
        <span className={styles.sitovStepIcon} data-tone={tone} aria-hidden="true"><Icon size={18} strokeWidth={2.5} /></span>
        <span><b>{label}:</b> {text}</span>
      </motion.li>)}
    </ol>
    <motion.p className={styles.sitovTip} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : MOTION.slow, ease: EASE_OUT_SOFT, delay: reduced ? 0 : staggerDelay(steps.length) }}>
      <CalendarCheck size={19} aria-hidden="true" /><span>{copy.guideTip}</span>
    </motion.p>
  </SitovMotionStage>
}
