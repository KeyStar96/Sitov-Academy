'use client'

import { useEffect, useRef, type ReactNode, type Ref } from 'react'
import { ArrowLeft } from 'lucide-react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import './learning.css'

/** Die vier Texte des Rahmens. Vokabeln reichen ihren Übersetzer durch, die Grammatik eigene Texte. */
export type LearningScreenKey = 'exit_learning' | 'theme_light' | 'theme_dark' | 'overall_progress_label'

interface LearningScreenProps {
  title: string
  subtitle?: string
  progress: number
  onExit: () => void
  exitDisabled?: boolean
  t: (key: LearningScreenKey) => string
  /** Scrollfläche des Arbeitsbereichs, z. B. um bei jeder neuen Aufgabe nach oben zu springen. */
  workspaceRef?: Ref<HTMLDivElement>
  /** Dashboard exercises stay in document flow with the common header and navigation. */
  presentation?: 'embedded' | 'fullscreen'
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

/** Embedded rounds scroll the document; isolated rounds scroll their own workspace. */
export function scrollLearningWorkspace(workspace: HTMLElement | null, behavior: ScrollBehavior = 'instant') {
  const frame = workspace?.closest<HTMLElement>(".learning-screen[data-presentation='embedded']")
  if (frame) frame.scrollIntoView?.({ block: 'start', behavior })
  else workspace?.scrollTo?.({ top: 0, behavior })
}

/** Shared exercise frame. Fullscreen is reserved for explicitly isolated experiences. */
export default function LearningScreen({ title, subtitle, progress, onExit, exitDisabled = false, t, workspaceRef, presentation = 'embedded', children }: LearningScreenProps) {
  const screen = useRef<HTMLElement>(null)
  useEffect(() => {
    if (presentation === 'embedded') {
      screen.current?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
      screen.current?.focus({ preventScroll: true })
      return
    }
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
  }, [presentation])

  return (
    <section ref={screen} tabIndex={-1} className="learning-screen" data-presentation={presentation} aria-label={title}>
      <header className="learning-header">
        <button type="button" className="learning-exit" onClick={onExit} disabled={exitDisabled}>
          <ArrowLeft size={18} aria-hidden="true" /><span>{t('exit_learning')}</span>
        </button>
        <div className="learning-heading"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        {presentation === 'fullscreen' && <ThemeToggle lightLabel={t('theme_light')} darkLabel={t('theme_dark')} />}
      </header>
      <div className="learning-progress" role="progressbar" aria-label={t('overall_progress_label')}
        aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <div ref={workspaceRef} className="learning-workspace">{children}</div>
    </section>
  )
}
