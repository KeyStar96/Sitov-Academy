'use client'

import { useId, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Lightbulb } from 'lucide-react'
import { EASE_OUT_SOFT, MOTION, useReducedMotionSafe } from '@/lib/motion'
import { cn } from '@/lib/utils'
import PressableCard from './PressableCard'
import SitovMotionStage from './SitovMotionStage'
import styles from './SitovTrainerHelp.module.css'

export interface SitovTrainerHelpProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

/** Shared disclosure; each trainer keeps its own learning rules inside. */
export default function SitovTrainerHelp({ title, children, defaultOpen = false, className }: SitovTrainerHelpProps) {
  const reduced = useReducedMotionSafe()
  const [open, setOpen] = useState(defaultOpen)
  const [mounted, setMounted] = useState(defaultOpen)
  const id = useId()
  const toggleId = `sitov-help-${id}-toggle`
  const panelId = `sitov-help-${id}-panel`

  function toggle() {
    const next = !open
    if (next) setMounted(true)
    else if (reduced) setMounted(false)
    setOpen(next)
  }

  return <SitovMotionStage className={cn(styles.sitovHelp, className)} data-sitov-trainer-help data-open={open}>
    <PressableCard id={toggleId} type="button" className={styles.sitovToggle} data-sitov-trainer-help-toggle
      aria-expanded={open} aria-controls={panelId} onClick={toggle}>
      <span className={styles.sitovIcon} aria-hidden="true"><Lightbulb size={22} strokeWidth={2.25} /></span>
      <span className={styles.sitovTitle}>{title}</span>
      <ChevronDown size={22} aria-hidden="true" className={styles.sitovChevron} />
    </PressableCard>
    {mounted && <motion.div id={panelId} role="region" aria-labelledby={toggleId}
      aria-hidden={!open || undefined} inert={!open} className={styles.sitovPanel}
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : MOTION.slow, ease: EASE_OUT_SOFT }}
      onAnimationComplete={() => { if (!open) setMounted(false) }}>
      <div className={styles.sitovBody}>{children}</div>
    </motion.div>}
  </SitovMotionStage>
}
