'use client'

import { useId, type ReactNode } from 'react'
import { ArrowRight, BookOpen, Clapperboard, LoaderCircle, Mic, Route, Sparkles } from 'lucide-react'
import SitovMotionStage from './SitovMotionStage'
import PressableCard from './PressableCard'
import styles from './SitovTrainerHero.module.css'

export type SitovTrainerHeroMode = 'vocabulary' | 'verbs' | 'path' | 'media' | 'pronunciation'
export interface SitovTrainerHeroProps {
  mode: SitovTrainerHeroMode
  eyebrow: string
  level: string
  title: string
  headingLevel?: 1 | 2
  description?: ReactNode
  graphic?: ReactNode
  action?: { label: string; onClick?: () => void; href?: string; disabled?: boolean; busy?: boolean }
  options?: ReactNode
  children?: ReactNode
  compact?: boolean
  testId?: string
  className?: string
}

const sitovIcons = { vocabulary: BookOpen, verbs: Sparkles, path: Route, media: Clapperboard, pronunciation: Mic }

/** A shared entry with a real action and a reserved, decorative scene. */
export default function SitovTrainerHero({ mode, eyebrow, level, title, headingLevel = 1, description, graphic, action, options, children, compact = false, testId, className }: SitovTrainerHeroProps) {
  const sitovId = useId()
  const SitovHeading = headingLevel === 2 ? 'h2' : 'h1'
  const SitovIcon = sitovIcons[mode]
  const unavailable = Boolean(action?.disabled || action?.busy)
  const actionContent = action && <>
    {action.busy && <LoaderCircle size={19} className={styles.sitovSpinner} aria-hidden="true" />}
    <span>{action.label}</span><ArrowRight size={19} aria-hidden="true" />
  </>

  return <SitovMotionStage className={`${styles.sitovHero}${className ? ` ${className}` : ''}`}
    data-sitov-trainer-hero={mode} data-sitov-surface="" data-sitov-compact={compact || undefined}
    data-sitov-has-options={Boolean(options) || undefined}
    data-sitov-has-graphic={Boolean(graphic && !compact) || undefined} data-testid={testId}
    role="region" aria-labelledby={`${sitovId}-title`}>
    <div className={styles.sitovText}>
      <p className={styles.sitovEyebrow}><SitovIcon size={17} aria-hidden="true" /><span>{eyebrow}</span><span className={styles.sitovLevel}>{level}</span></p>
      <SitovHeading id={`${sitovId}-title`} className={styles.sitovTitle}>{title}</SitovHeading>
      {description && <div className={styles.sitovDescription}>{description}</div>}
    </div>
    {options && <div className={styles.sitovOptions}>{options}</div>}
    {(action || children) && <div className={styles.sitovControls}>
      {action && (action.href
        ? <PressableCard href={action.href} className={styles.sitovAction} data-sitov-hero-action="" aria-disabled={unavailable || undefined} aria-busy={action.busy || undefined}
            tabIndex={unavailable ? -1 : undefined} onClick={event => { if (unavailable) event.preventDefault(); else action.onClick?.() }}>
            {actionContent}
          </PressableCard>
        : <PressableCard className={styles.sitovAction} data-sitov-hero-action="" disabled={unavailable} aria-busy={action.busy || undefined} onClick={action.onClick}>
            {actionContent}
          </PressableCard>)}
      {children && <div className={styles.sitovDetails}>{children}</div>}
    </div>}
    {graphic && !compact && <div className={styles.sitovGraphic} aria-hidden="true">{graphic}</div>}
  </SitovMotionStage>
}
