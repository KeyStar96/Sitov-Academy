import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fortschritt als Ring — die runde Schwester des Fortschrittsbands.
 *
 * Der Wert kommt vom Server; die Füllbewegung beim ersten Erscheinen liefert
 * CSS (`st-ring-fill`), deshalb braucht der Ring kein Client-JavaScript.
 * Farbe heißt: Orange = Fortschritt, Grün = abgeschlossen.
 */
export default function ProgressRing({ value, size = 64, stroke = 7, tone = 'accent', label, children, className }: {
  /** 0 bis 1. */
  value: number
  size?: number
  stroke?: number
  tone?: 'accent' | 'success' | 'violet' | 'muted'
  /** Ohne Beschriftung ist der Ring rein dekorativ. */
  label?: string
  children?: ReactNode
  className?: string
}) {
  const radius = (size - stroke) / 2
  const length = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <span className={cn('st-ring', className)} style={{ width: size, height: size }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle className="st-ring__track" cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
        <circle className="st-ring__value" data-tone={tone} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke}
          strokeDasharray={length} strokeDashoffset={length * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ '--st-ring-length': length } as CSSProperties} />
      </svg>
      {children && <span className="st-ring__center">{children}</span>}
    </span>
  )
}
