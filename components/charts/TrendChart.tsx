'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

/**
 * Zeitreihen-Diagramm ohne Fremdbibliothek: Balken (optional gestapelt) und
 * Linien, links eine Werteachse, rechts optional eine Prozentachse (0–100 %).
 * Gezeichnet wird in echter Pixelbreite (ResizeObserver) – Schrift und Linien
 * bleiben auf jedem Gerät scharf. Maus, Finger und Pfeiltasten wählen einen
 * Tag; der Tooltip zeigt alle Werte dieses Tages. Farben kommen aus den
 * Design-Tokens, damit Hell, Dunkel und hoher Kontrast automatisch passen.
 */
export interface ChartSeries {
  key: string
  label: string
  /** CSS-Farbe, z. B. `var(--success)`. */
  color: string
  type: 'bar' | 'line'
  /** Balken mit gleichem Stapel liegen übereinander. */
  stack?: string
  /** Linien auf der Prozentachse rechts. */
  axis?: 'value' | 'percent'
  dashed?: boolean
  /** Fläche unter einer Linie leicht tönen. */
  area?: boolean
  /** Deckkraft der Balkenfüllung. */
  opacity?: number
  /** Nur im Tooltip zeigen, nicht zeichnen. */
  hidden?: boolean
}
export interface ChartPoint { date: string; values: Record<string, number | null> }

const MARGIN = { top: 14, bottom: 28, left: 34 }
const PERCENT_TICKS = [0, 50, 100]

function niceStep(maximum: number, ticks: number) {
  const raw = Math.max(1, maximum) / ticks
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(factor => factor * power).find(candidate => candidate >= raw) ?? raw
  return Math.max(1, Math.ceil(step))
}

function tickIndexes(count: number, width: number) {
  const room = Math.max(2, Math.floor(width / 64))
  if (count <= room) return Array.from({ length: count }, (_, index) => index)
  const step = (count - 1) / (room - 1)
  return Array.from(new Set(Array.from({ length: room }, (_, index) => Math.round(index * step))))
}

export default function TrendChart({ points, series, lang, label, height = 220, emptyLabel, formatValue, formatPercent, detail }: {
  points: readonly ChartPoint[]
  series: readonly ChartSeries[]
  lang: string
  /** Name des Diagramms für Screenreader. */
  label: string
  height?: number
  /** Hinweis im Diagramm, wenn es im Zeitraum keinen einzigen Wert gibt. */
  emptyLabel?: string
  formatValue?: (value: number, series: ChartSeries) => string
  formatPercent?: (value: number) => string
  /** Zusatzzeilen im Tooltip, z. B. „83 % richtig". */
  detail?: (index: number) => string | null
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(360)
  const [active, setActive] = useState<number | null>(null)
  const [pinned, setPinned] = useState(false)
  const describedBy = useId()

  useEffect(() => {
    const element = wrapper.current
    if (!element) return
    const measure = () => setWidth(Math.max(240, Math.round(element.getBoundingClientRect().width)))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const visible = series.filter(item => !item.hidden)
  const hasPercent = visible.some(item => item.axis === 'percent')
  const right = hasPercent ? 48 : 10
  const plotWidth = Math.max(40, width - MARGIN.left - right)
  const plotHeight = height - MARGIN.top - MARGIN.bottom
  const count = Math.max(1, points.length)
  const band = plotWidth / count

  const stacks = Array.from(new Set(visible.filter(item => item.type === 'bar').map(item => item.stack ?? item.key)))
  let maximum = 0
  for (const point of points) {
    for (const stack of stacks) {
      const total = visible.filter(item => item.type === 'bar' && (item.stack ?? item.key) === stack)
        .reduce((sum, item) => sum + Math.max(0, point.values[item.key] ?? 0), 0)
      maximum = Math.max(maximum, total)
    }
    for (const item of visible) if (item.type === 'line' && item.axis !== 'percent') maximum = Math.max(maximum, point.values[item.key] ?? 0)
  }
  const empty = points.every(point => series.every(item => !point.values[item.key]))
  const step = niceStep(maximum, 4)
  const top = step * Math.max(1, Math.ceil(maximum / step))

  const y = (value: number) => MARGIN.top + plotHeight - Math.max(0, value) / top * plotHeight
  const yPercent = (value: number) => MARGIN.top + plotHeight - Math.min(100, Math.max(0, value)) / 100 * plotHeight
  const xCenter = (index: number) => MARGIN.left + band * index + band / 2
  const groupWidth = Math.min(band * 0.72, 22 * Math.max(1, stacks.length))
  const barWidth = Math.max(1.5, groupWidth / Math.max(1, stacks.length))
  const date = (value: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang, { ...options, timeZone: 'Europe/Berlin' }).format(new Date(`${value}T12:00:00Z`))
  const shortDate = (value: string) => date(value, points.length <= 7 ? { weekday: 'short' } : { day: '2-digit', month: '2-digit' })
  const valueText = (value: number, item: ChartSeries) => formatValue ? formatValue(value, item) : new Intl.NumberFormat(lang).format(value)
  const percentText = (value: number) => formatPercent ? formatPercent(value) : `${value} %`

  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step)
  const labels = tickIndexes(points.length, plotWidth)

  function pick(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width * width
    const index = Math.floor((x - MARGIN.left) / band)
    setActive(index >= 0 && index < points.length ? index : null)
  }
  function key(event: KeyboardEvent<HTMLDivElement>) {
    const last = points.length - 1
    const current = active ?? last
    const next = event.key === 'ArrowLeft' ? Math.max(0, current - 1) : event.key === 'ArrowRight' ? Math.min(last, current + 1)
      : event.key === 'Home' ? 0 : event.key === 'End' ? last : null
    if (event.key === 'Escape') { setActive(null); setPinned(false); return }
    if (next === null) return
    event.preventDefault()
    setActive(next); setPinned(true)
  }

  const current = active !== null ? points[active] : null
  const tooltipLeft = active !== null ? Math.min(Math.max(xCenter(active) / width * 100, 18), 82) : 0
  const tooltipRows = current ? series.map(item => {
    const value = current.values[item.key]
    return value === null || value === undefined ? null : { item, text: item.axis === 'percent' ? percentText(value) : valueText(value, item) }
  }).filter(Boolean) as { item: ChartSeries; text: string }[] : []
  const extra = active !== null && detail ? detail(active) : null
  const announcement = current ? [date(current.date, { weekday: 'long', day: 'numeric', month: 'long' }), ...tooltipRows.map(row => `${row.item.label}: ${row.text}`), extra].filter(Boolean).join(', ') : ''

  return <div ref={wrapper} className="trend-chart relative min-w-0 select-none" role="group" aria-label={label} aria-describedby={describedBy}
    tabIndex={0} onKeyDown={key} onBlur={() => { if (pinned) { setActive(null); setPinned(false) } }}>
    <p id={describedBy} className="sr-only">{announcement}</p>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block max-w-full touch-pan-y" aria-hidden="true" focusable="false"
      onPointerMove={pick} onPointerDown={pick} onPointerLeave={event => { if (event.pointerType === 'mouse' && !pinned) setActive(null) }}>
      {ticks.map(tick => <g key={tick}>
        <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={y(tick)} y2={y(tick)} stroke="var(--chart-grid, var(--border))" strokeOpacity={tick === 0 ? 0.9 : 0.35} strokeDasharray={tick === 0 ? undefined : '3 4'} />
        <text x={MARGIN.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" fill="var(--muted)" fontSize="11" className="tabular-nums">{new Intl.NumberFormat(lang, { notation: tick >= 10000 ? 'compact' : 'standard' }).format(tick)}</text>
      </g>)}
      {hasPercent && PERCENT_TICKS.map(tick => <text key={`p${tick}`} x={MARGIN.left + plotWidth + 6} y={yPercent(tick)} dy="0.32em" fill="var(--muted)" fontSize="11" className="tabular-nums">{tick} %</text>)}
      {active !== null && <rect x={MARGIN.left + band * active} y={MARGIN.top} width={band} height={plotHeight} fill="var(--foreground)" fillOpacity={0.06} rx={3} />}
      {points.map((point, index) => stacks.map((stack, stackIndex) => {
        let base = 0
        const x = xCenter(index) - groupWidth / 2 + barWidth * stackIndex
        return visible.filter(item => item.type === 'bar' && (item.stack ?? item.key) === stack).map(item => {
          const value = Math.max(0, point.values[item.key] ?? 0)
          if (!value) return null
          const from = y(base), to = y(base + value)
          base += value
          return <rect key={`${point.date}-${item.key}`} className="trend-chart__bar" x={x + (barWidth > 4 ? 0.5 : 0)} width={Math.max(1, barWidth - (barWidth > 4 ? 1 : 0))}
            y={to} height={Math.max(0.5, from - to)} fill={item.color} fillOpacity={active === null || active === index ? item.opacity ?? 0.9 : (item.opacity ?? 0.9) * 0.45} rx={barWidth > 6 ? 2 : 0} />
        })
      }))}
      {visible.filter(item => item.type === 'line').map(item => {
        const scale = item.axis === 'percent' ? yPercent : y
        const segments: [number, number][][] = []
        points.forEach((point, index) => {
          const value = point.values[item.key]
          if (value === null || value === undefined) { segments.push([]); return }
          if (!segments.length) segments.push([])
          segments[segments.length - 1].push([xCenter(index), scale(value)])
        })
        return <g key={item.key}>
          {segments.filter(segment => segment.length).map((segment, index) => <g key={index}>
            {item.area && segment.length > 1 && <path d={`M${segment[0][0]},${MARGIN.top + plotHeight} ${segment.map(([x, value]) => `L${x},${value}`).join(' ')} L${segment[segment.length - 1][0]},${MARGIN.top + plotHeight}Z`} fill={item.color} fillOpacity={0.12} />}
            {segment.length > 1 && <polyline points={segment.map(([x, value]) => `${x},${value}`).join(' ')} fill="none" stroke={item.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={item.dashed ? '5 4' : undefined} />}
            {(segment.length === 1 || points.length <= 31) && segment.map(([x, value]) => <circle key={x} cx={x} cy={value} r={segment.length === 1 ? 3 : 2.25} fill="var(--surface)" stroke={item.color} strokeWidth={1.75} />)}
          </g>)}
          {active !== null && points[active].values[item.key] !== null && points[active].values[item.key] !== undefined &&
            <circle cx={xCenter(active)} cy={scale(points[active].values[item.key]!)} r={4.5} fill={item.color} stroke="var(--surface)" strokeWidth={2} />}
        </g>
      })}
      {labels.map(index => <text key={points[index].date} x={xCenter(index)} y={height - 8} textAnchor={index === 0 && points.length > 7 ? 'start' : index === points.length - 1 && points.length > 7 ? 'end' : 'middle'}
        fill={index === active ? 'var(--foreground)' : 'var(--muted)'} fontSize="11" className="tabular-nums">{shortDate(points[index].date)}</text>)}
    </svg>
    {empty && emptyLabel && <p className="pointer-events-none absolute inset-x-0 top-[38%] px-6 text-center text-sm text-[var(--muted)]">{emptyLabel}</p>}
    {current && <div className="pointer-events-none absolute top-1 z-10 w-max min-w-36 max-w-[15rem] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs shadow-[var(--shadow-md)]"
      style={{ left: `${tooltipLeft}%` }} aria-hidden="true">
      <p className="font-semibold text-[var(--foreground)]">{date(current.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      <ul className="mt-1 space-y-0.5">{tooltipRows.map(row => <li key={row.item.key} className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[var(--muted)]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: row.item.color }} />{row.item.label}</span>
        <span className="font-semibold tabular-nums text-[var(--foreground)]">{row.text}</span></li>)}</ul>
      {extra && <p className="mt-1 border-t border-[var(--border)] pt-1 font-medium text-[var(--foreground)]">{extra}</p>}
    </div>}
  </div>
}

/** Farbpunkte mit Namen unter bzw. über einem Diagramm. */
export function ChartLegend({ series }: { series: readonly ChartSeries[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]" aria-hidden="true">
    {series.filter(item => !item.hidden).map(item => <li key={item.key} className="flex items-center gap-1.5">
      {item.type === 'line'
        ? <span className="h-0.5 w-4 rounded-full" style={{ background: item.color, opacity: item.dashed ? 0.8 : 1 }} />
        : <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color, opacity: item.opacity ?? 0.9 }} />}
      {item.label}
    </li>)}
  </ul>
}
