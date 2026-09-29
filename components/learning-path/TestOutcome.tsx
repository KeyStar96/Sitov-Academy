'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { LockOpen, Sprout, Target, Trophy } from 'lucide-react'
import type { PathNode, TestResult } from '@/lib/learning-path-contract'
import { pathTranslator } from '@/lib/learning-path-i18n'
import { useReducedMotionSafe } from '@/lib/motion'
import styles from './learning-path.module.css'

/** Bestehensgrenze; PostgreSQL entscheidet, hier nur für Anzeige und Abstand. */
const PASS_MARK = 80
const CONFETTI = ['var(--accent)', 'var(--gold-via)', 'var(--mode-path-text)', 'var(--success)', 'var(--violet)', 'var(--gold-from)']

/** Zählt die Prozentzahl hoch, im Takt des Rings; ohne Bewegung steht sie sofort da. */
function useCountUp(target: number, reduced: boolean): number {
  const [value, setValue] = useState(reduced ? target : 0)
  useEffect(() => {
    if (reduced) { setValue(target); return }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start - 200) / 1100)
      setValue(Math.round(target * (1 - Math.pow(1 - Math.max(0, progress), 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, reduced])
  return value
}

function ScoreRing({ value, goal }: { value: number; goal: string }) {
  const reduced = useReducedMotionSafe()
  const shown = useCountUp(value, reduced)
  // Markierung bei 80 % des Umfangs, Kreis beginnt oben (SVG ist um -90° gedreht).
  const angle = (PASS_MARK / 100) * 2 * Math.PI
  const tick = (radius: number) => ({ x: 50 + radius * Math.cos(angle), y: 50 + radius * Math.sin(angle) })
  const [inner, outer] = [tick(37), tick(53)]
  // Beschriftung außen neben der Markierung (ungedreht: im Uhrzeigersinn ab oben).
  const label = { left: `${50 + 62 * Math.sin(angle)}%`, top: `${50 - 62 * Math.cos(angle)}%` }
  return <div className={styles.ring}>
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle className={styles.ringTrack} cx="50" cy="50" r="42" />
      <circle className={styles.ringValue} cx="50" cy="50" r="42" pathLength={100} style={{ '--p': String(value) } as CSSProperties} />
      <line className={styles.ringGoal} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
    </svg>
    <div className={styles.ringLabel}>
      <span className={styles.ringNumber} aria-hidden="true">{shown}&thinsp;%</span>
    </div>
    <span className={styles.ringGoalLabel} style={label}><Target size={14} aria-hidden="true" /><span className="sr-only">{goal}</span><span aria-hidden="true">{PASS_MARK}</span></span>
  </div>
}

function Confetti() {
  return <div className={styles.confetti} aria-hidden="true">
    {Array.from({ length: 28 }, (_, index) => {
      // Goldener Winkel verteilt die Teilchen gleichmäßig, ohne Zufall im Render.
      const angle = index * 2.39996
      const distance = 90 + (index % 5) * 26
      return <span key={index} style={{
        '--x': `${Math.round(Math.cos(angle) * distance * 1.5)}px`, '--y': `${Math.round(Math.sin(angle) * distance - 70)}px`,
        '--r': `${(index % 2 ? 1 : -1) * (240 + index * 17)}deg`, '--d': `${120 + (index % 7) * 40}ms`, '--c': CONFETTI[index % CONFETTI.length],
      } as CSSProperties} />
    })}
  </div>
}

/**
 * Ergebnis eines Teil-Tests, fast ohne Text: Der Ring zeigt Ergebnis und
 * Ziel. Bestanden: Konfetti und die nun offenen Lektionen als Chips. Nicht
 * bestanden: ein ermutigender Satz und die Lektionen, die helfen — nie rot.
 */
export default function TestOutcome({ result, lang, lessons, recommended, actions, children }: {
  result: TestResult; lang: string
  /** Lektionen des Pfads, die ein bestandener Test freischaltet. */
  lessons: PathNode[]
  recommended: PathNode[]
  actions: ReactNode
  children?: ReactNode
}) {
  const t = pathTranslator(lang)
  const score = Math.floor(result.percentage)
  return <>
    <div className={styles.outcome} data-passed={result.passed} data-testid="path-test-outcome">
      {result.passed && <Confetti />}
      <ScoreRing value={score} goal={t('goal')} />
      <span className={styles.hero} aria-hidden="true">{result.passed ? <Trophy size={32} strokeWidth={2.4} /> : <Sprout size={32} strokeWidth={2.4} />}</span>
      <h3 className={styles.outcomeTitle} role="status">{t(result.passed ? 'passed' : 'not_ready_title')}</h3>
      <p className="sr-only">{t('percentage', { value: score })}</p>
      {result.passed ? <>
        {lessons.length > 0 && <ul className={styles.unlockList} aria-label={t('unlocked')}>
          {lessons.map((node, index) => <li key={node.id} style={{ '--i': String(index) } as CSSProperties}>
            <span className={styles.chip} data-tone="success"><LockOpen size={16} aria-hidden="true" />{node.title}</span>
          </li>)}
        </ul>}
      </> : <>
        <p className={styles.outcomeText}>{t('not_ready')}</p>
        {recommended.length > 0 && <>
          <ol className={styles.miniTrail} aria-label={t('recommendations')}>
            {recommended.map((node, index) => <li key={node.id}>
              <span className={styles.miniDot} aria-hidden="true">{index + 1}</span>
              <span className="font-semibold">{node.title}</span>
            </li>)}
          </ol>
        </>}
      </>}
      {actions}
    </div>
    {children}
  </>
}
