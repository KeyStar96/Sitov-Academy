'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import type { VocabularyTranslator } from '@/lib/vocabulary-i18n'
import './learning.css'

interface LearningScreenProps {
  title: string
  subtitle?: string
  progress: number
  onExit: () => void
  exitDisabled?: boolean
  t: VocabularyTranslator
  children: ReactNode
}

/**
 * Zähler oben rechts über der Karte: kleine Beschriftung über der Zahl, Ziffern
 * mit fester Breite. So bleibt die Spalte auch bei vierstelligen Werten
 * („1000/3000") schmal genug, dass die Richtungs-Pille daneben in derselben
 * Zeile steht — früher rutschte der Zähler ab zwei Ziffern in eine eigene
 * Zeile. Screenreader lesen statt der Kurzform den ausgeschriebenen Satz.
 */
export function LearningStats({ label, items }: { label: string; items: Array<{ label: string; value: string }> }) {
  return (
    <div className="learning-stats">
      <span className="sr-only">{label}</span>
      {items.map(item => (
        <span key={item.label} className="learning-stat" aria-hidden="true">
          <span className="learning-stat-label">{item.label}</span>
          <span className="learning-stat-value">{item.value}</span>
        </span>
      ))}
    </div>
  )
}

/** Focused viewport shared by assessment and practice; background stays inert. */
export default function LearningScreen({ title, subtitle, progress, onExit, exitDisabled = false, t, children }: LearningScreenProps) {
  const screen = useRef<HTMLElement>(null)
  useEffect(() => {
    const changed: Array<{ element: HTMLElement; inert: boolean }> = []
    let branch: HTMLElement | null = screen.current
    while (branch?.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          changed.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      branch = branch.parentElement
      if (branch === document.body) break
    }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    screen.current?.focus({ preventScroll: true })
    return () => {
      changed.forEach(({ element, inert }) => { element.inert = inert })
      document.body.style.overflow = overflow
    }
  }, [])

  return (
    <section ref={screen} tabIndex={-1} className="learning-screen" aria-label={title}>
      <header className="learning-header">
        <button type="button" className="learning-exit" onClick={onExit} disabled={exitDisabled}>
          <ArrowLeft size={18} aria-hidden="true" /><span>{t('exit_learning')}</span>
        </button>
        <div className="learning-heading"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        <ThemeToggle lightLabel={t('theme_light')} darkLabel={t('theme_dark')} />
      </header>
      <div className="learning-progress" role="progressbar" aria-label={t('overall_progress_label')}
        aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <div className="learning-workspace">{children}</div>
    </section>
  )
}
