'use client'

import { useId, type CSSProperties, type ReactNode } from 'react'
import { Check, Layers } from 'lucide-react'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import PressableCard from '@/components/motion/PressableCard'
import CountUp from '@/components/motion/CountUp'
import styles from './SitovLearningBox.module.css'

export type SitovLearningBoxKey = 1 | 2 | 3 | 4 | 5 | 6 | 'learned'
export interface SitovLearningBoxBucket {
  key: SitovLearningBoxKey
  count: number
  due: number
  halfKnown?: number
  label: string
  interval: string
  countLabel: string
  dueLabel?: string
  halfKnownLabel?: string
  openLabel: string
}

interface Props {
  title: string
  intro: string
  scopeLabel?: string
  progressLabel: string
  percent: number
  tapHint: string
  stats: { key: string; label: string; value: number }[]
  buckets: SitovLearningBoxBucket[]
  selected?: SitovLearningBoxKey | null
  onOpen: (key: SitovLearningBoxKey, from: HTMLElement) => void
  action?: ReactNode
  children?: ReactNode
}

/** The stack has a visible layer even for one card, without suggesting cards in an empty box. */
export function sitovStackFill(count: number): number {
  return count <= 0 ? 0 : Math.min(1, Math.log2(1 + count / 2) / Math.log2(201))
}

export function sitovStackLines(count: number): number {
  return count <= 0 ? 0 : Math.max(1, Math.min(count, Math.round(sitovStackFill(count) * 28)))
}

/** Shared presentation only. Each trainer owns its evidence, inspector and mutations. */
export default function SitovLearningBox({ title, intro, scopeLabel, progressLabel, percent, tapHint, stats, buckets, selected = null, onOpen, action, children }: Props) {
  const sitovId = useId()
  const sitovPercent = Math.max(0, Math.min(100, percent))
  const sitovSummaryKeys = new Set([stats[0]?.key, 'learned'])

  return <section className={styles.sitovBox} aria-label={title} aria-describedby={`${sitovId}-intro`} data-sitov-learning-box="">
    <SitovMotionStage className={styles.sitovStage}>
      <header className={styles.sitovHeader}>
        <div className={styles.sitovHeading}>
          {scopeLabel && <span className={styles.sitovSrOnly}>{scopeLabel}</span>}
          <h2><Layers size={22} aria-hidden="true" />{title}</h2>
          <p id={`${sitovId}-intro`} className={styles.sitovSrOnly}>{intro}</p>
        </div>
        <div className={styles.sitovProgress}>
          <div className={styles.sitovProgressText}><span>{progressLabel}</span><b>{sitovPercent}%</b></div>
          <div className={styles.sitovProgressBar} role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={sitovPercent}>
            <span style={{ transform: `scaleX(${sitovPercent / 100})` }} />
          </div>
        </div>
      </header>

      {action && <div className={styles.sitovAction}>{action}</div>}
      <dl className={styles.sitovStats}>
        {stats.map(stat => <div key={stat.key} className={sitovSummaryKeys.has(stat.key) ? undefined : styles.sitovSrOnly} data-sitov-stat={stat.key}>
          <dt>{stat.label}</dt><dd><CountUp value={stat.value} /></dd>
        </div>)}
      </dl>

      <div className={styles.sitovShelves}>
        {buckets.map((bucket, index) => {
          const sitovArchive = bucket.key === 'learned'
          const sitovTone = sitovArchive || bucket.key === 6 ? 'success' : typeof bucket.key === 'number' && bucket.key >= 4 ? 'violet' : 'accent'
          return <PressableCard key={bucket.key} className={styles.sitovShelf}
            aria-label={bucket.openLabel} aria-describedby={`${sitovId}-${bucket.key}-details`} aria-haspopup="dialog"
            data-sitov-surface="" data-tone={sitovTone} data-empty={bucket.count === 0 || undefined}
            data-open={selected === bucket.key || undefined} data-sitov-due={bucket.due > 0 || undefined}
            data-sitov-box-key={bucket.key}
            style={{ '--fill': sitovStackFill(bucket.count).toFixed(3), '--sitov-stack-lines': sitovStackLines(bucket.count), '--sitov-index': index } as CSSProperties}
            onClick={event => onOpen(bucket.key, event.currentTarget)}>
            <span className={styles.sitovShelfLabel}>{bucket.label}{sitovArchive && <Check size={13} aria-hidden="true" />}</span>
            <span className={styles.sitovShelfCount}><CountUp value={bucket.count} /></span>
            <span className={styles.sitovStackScene} aria-hidden="true" data-sitov-box-graphic="">
              <span className={styles.sitovStackFloor} />
              {bucket.count > 0 && <span className={styles.sitovStack}>
                <span className={styles.sitovStackEdges} />
                <span className={styles.sitovPaper}><i /><i /><i />{bucket.due > 0 && <span className={styles.sitovPaperTab} />}</span>
              </span>}
            </span>
            <span id={`${sitovId}-${bucket.key}-details`} className={styles.sitovSrOnly}>
              <span>{bucket.countLabel}</span>{'. '}
              <span>{bucket.interval}</span>
              {bucket.due > 0 && bucket.dueLabel && <>{'. '}<span>{bucket.dueLabel}</span></>}
              {(bucket.halfKnown ?? 0) > 0 && bucket.halfKnownLabel && <>{'. '}<span>{bucket.halfKnownLabel}</span></>}
            </span>
          </PressableCard>
        })}
      </div>
      <p className={styles.sitovSrOnly}>{tapHint}</p>
      {children && <div className={styles.sitovFooter}>{children}</div>}
    </SitovMotionStage>
  </section>
}
