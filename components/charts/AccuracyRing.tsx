/**
 * Kreis für eine Quote (0–100 %). Ohne Wert bleibt der Kreis leer und zeigt
 * einen Gedankenstrich – „keine Antworten" ist nicht dasselbe wie 0 %.
 */
export default function AccuracyRing({ value, label, size = 84, color = 'var(--success)' }: {
  value: number | null
  label: string
  size?: number
  color?: string
}) {
  const stroke = Math.max(6, Math.round(size / 11))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const share = value === null ? 0 : Math.min(100, Math.max(0, value)) / 100
  return <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true" focusable="false">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
      {value !== null && <circle className="accuracy-ring__value" cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${circumference * share} ${circumference}`} />}
    </svg>
    <span className="absolute text-lg font-semibold tabular-nums text-[var(--foreground)]" aria-hidden="true">{value === null ? '–' : `${value} %`}</span>
  </div>
}
