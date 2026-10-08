'use client'

import { useId } from 'react'
import type { LucideIcon } from 'lucide-react'
import PressableCard from './PressableCard'
import SlidingPill from './SlidingPill'
import styles from './SitovTrainerTabs.module.css'

type SitovTrainerTabBase = {
  id: string
  label: string
  icon: LucideIcon
  selected: boolean
}

export type SitovTrainerTab = SitovTrainerTabBase & (
  | { href: string; onClick?: never; disabled?: never }
  | { href?: never; onClick: () => void; disabled?: boolean }
)

type SitovTrainerTabsProps = {
  label: string
  mode: 'vocabulary' | 'verbs'
  items: readonly SitovTrainerTab[]
  className?: string
}

/** Shared overview navigation; routes stay links and local views stay buttons. */
export default function SitovTrainerTabs({ label, mode, items, className }: SitovTrainerTabsProps) {
  const group = useId()
  return (
    <nav aria-label={label} className={[styles.sitovTabs, className].filter(Boolean).join(' ')}
      data-count={items.length} data-sitov-trainer-tabs={mode} data-sitov-vocabulary-tabs={mode === 'vocabulary' ? '' : undefined}>
      {items.map(item => {
        const Icon = item.icon
        const content = <>
          {item.selected && <SlidingPill group={`sitov-trainer-tabs-${group}`} className={styles.sitovPill} />}
          <Icon className={styles.sitovIcon} size={20} aria-hidden="true" />
          <span className={styles.sitovLabel}>{item.label}</span>
        </>
        return item.href !== undefined ? (
          <PressableCard key={item.id} href={item.href} className={styles.sitovTab} data-sitov-trainer-tab={item.id}
            aria-current={item.selected ? 'page' : undefined}>
            {content}
          </PressableCard>
        ) : (
          <PressableCard key={item.id} className={styles.sitovTab} data-sitov-trainer-tab={item.id}
            aria-pressed={item.selected} onClick={item.onClick} disabled={item.disabled}>
            {content}
          </PressableCard>
        )
      })}
    </nav>
  )
}
