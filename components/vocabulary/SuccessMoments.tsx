'use client'

import type { CSSProperties } from 'react'
import { ArrowDown, ArrowUp, Check } from 'lucide-react'
import ProgressRing from '@/components/ui/ProgressRing'
import { studentTranslator } from '@/lib/student-ui-i18n'
import type { LeitnerPhase } from '@/lib/leitner'

export interface SessionMove { from: LeitnerPhase; to: LeitnerPhase; learned: boolean }

const DRAWERS = [1, 2, 3, 4, 5, 6, 'learned'] as const
/** Mehr als so viele Kärtchen je Fach zeichnen wir nicht — die Zahl steht daneben. */
const MAX_CARDS = 5

/**
 * Ende einer Lernbox-Runde: sieben kleine Fächer, und jede Karte fällt
 * sichtbar in das Fach, in dem sie jetzt liegt. Darunter in Worten, was
 * aufgestiegen, was zurückgegangen und was nun sicher gelernt ist.
 */
export function SessionBoxMoves({ lang, moves }: { lang: string; moves: readonly SessionMove[] }) {
  const s = studentTranslator(lang)
  if (moves.length === 0) return null
  const arrivals = new Map<(typeof DRAWERS)[number], number>()
  for (const move of moves) {
    const key = move.learned ? 'learned' : move.to
    arrivals.set(key, (arrivals.get(key) ?? 0) + 1)
  }
  const up = moves.filter(move => move.learned || move.to > move.from).length
  const back = moves.filter(move => !move.learned && move.to < move.from).length
  const learned = moves.filter(move => move.learned).length
  let drop = 0

  return (
    <div className="st-moves">
      <p className="st-moves__title">{s('success_box_title')}</p>
      <ol className="st-moves__box" aria-hidden="true">
        {DRAWERS.map(key => {
          const count = arrivals.get(key) ?? 0
          return (
            <li key={key} className="st-moves__drawer" data-key={key} data-filled={count > 0}>
              <span className="st-moves__stack">
                {Array.from({ length: Math.min(count, MAX_CARDS) }, (_, index) => (
                  <span key={index} className="st-moves__card" style={{ '--d': drop++, '--n': index } as CSSProperties} />
                ))}
              </span>
              {count > 0 && <span className="st-moves__count" style={{ '--d': drop } as CSSProperties}>+{count}</span>}
              <span className="st-moves__label">{key === 'learned' ? <Check size={14} strokeWidth={3} /> : key}</span>
            </li>
          )
        })}
      </ol>
      <ul className="st-moves__facts">
        {up > 0 && <li data-tone="up"><ArrowUp size={18} aria-hidden="true" />{s.count('success_up', up)}</li>}
        {back > 0 && <li data-tone="back"><ArrowDown size={18} aria-hidden="true" />{s.count('success_back', back)}</li>}
        {learned > 0 && <li data-tone="learned"><Check size={18} aria-hidden="true" />{s.count('success_learned', learned)}</li>}
      </ul>
    </div>
  )
}

/**
 * Ende der Einstufung als Bild: Links füllt sich Fach 1 mit den neuen Wörtern,
 * rechts Fach 6 mit den schon bekannten — dazu der Satz „32 von 84 Wörtern
 * kennst du schon".
 */
export function AssessmentResult({ lang, known, fresh }: { lang: string; known: number; fresh: number }) {
  const s = studentTranslator(lang)
  const total = known + fresh
  if (total === 0) return null
  const height = (count: number) => `${Math.max(8, (count / Math.max(known, fresh)) * 100)}%`
  return (
    <div className="st-assess">
      <ProgressRing value={known / total} size={112} stroke={10} tone="success" label={s('assess_known', { known, total })}>
        <strong className="text-3xl font-extrabold tabular-nums">{known}</strong>
        <small className="text-sm font-semibold text-[var(--muted)]">/ {total}</small>
      </ProgressRing>
      <p className="st-assess__headline">{s('assess_known', { known, total })}</p>
      <div className="st-assess__drawers" aria-hidden="true">
        <span className="st-assess__drawer" data-tone="new">
          <span className="st-assess__fill" style={{ '--h': height(fresh) } as CSSProperties} />
          <span className="st-assess__number">1</span>
        </span>
        <span className="st-assess__drawer" data-tone="known">
          <span className="st-assess__fill" style={{ '--h': height(known) } as CSSProperties} />
          <span className="st-assess__number">6</span>
        </span>
      </div>
      <ul className="st-moves__facts">
        <li data-tone="up">{s('assess_new', { count: fresh })}</li>
        <li data-tone="learned">{s('assess_known_short', { count: known })}</li>
      </ul>
    </div>
  )
}
