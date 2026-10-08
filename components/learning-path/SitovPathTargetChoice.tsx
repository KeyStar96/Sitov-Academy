'use client'
import { useEffect, useRef } from 'react'
import type { PathMap, PathNode } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import { resolveSitovPathRecommendationTarget } from '@/lib/learning/sitov-learning-recommendations-path-target'
import { sitovLearningTargetCopy } from '@/lib/learning/sitov-learning-target-i18n'
import { useReducedMotionSafe } from '@/lib/motion'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import PressableCard from '@/components/motion/PressableCard'
import styles from './learning-path.module.css'
import targetStyles from './SitovPathTargetChoice.module.css'

export default function SitovPathTargetChoice({ raw, level, map, lang, busy, onOpen, onRetry }: {
  raw?: string | string[]; level: string; map?: PathMap; lang: string; busy: boolean
  onOpen: (node: PathNode, title: string, pathId: string) => void; onRetry: () => void
}) {
  const result = resolveSitovPathRecommendationTarget(raw, level, map)
  const selected = result && 'target' in result ? result.target : undefined
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotionSafe()
  const copy = sitovLearningTargetCopy(lang)
  const t = pathTranslator(lang)
  useEffect(() => {
    if (raw === undefined) return
    const frame = requestAnimationFrame(() => {
      ref.current?.focus({ preventScroll: true })
      ref.current?.scrollIntoView?.({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [raw, selected?.node.id, reduced, result?.error])
  if (!result) return null
  return <SitovMotionStage>
    <div ref={ref} tabIndex={-1} className={`${styles.card} ${targetStyles.target}`} aria-label={copy.selected} data-sitov-path-target>
      {selected ? <>
        <p>{copy.selected}</p>
        <h3 lang="de" translate="no">{selected.node.title}</h3>
        <PressableCard type="button" className={`${styles.primary} ${targetStyles.action}`} disabled={busy}
          onClick={() => onOpen(selected.node, selected.title, selected.pathId)}>
          {t(selected.node.status === 'in_progress' ? 'resume' : selected.node.kind === 'test' ? 'sitov_test_action' : 'begin')}
        </PressableCard>
      </> : <><p role="alert">{copy[result.error!]}</p>
        {result.error === 'retryable' && <button type="button" className={styles.secondary} disabled={busy} onClick={onRetry}>{copy.retry}</button>}
      </>}
    </div>
  </SitovMotionStage>
}
