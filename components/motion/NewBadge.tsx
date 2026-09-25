/**
 * „Neu"-Kennzeichen (D10): kleine beschriftete Pille mit Punkt. Der Punkt
 * pulsiert zweimal (zusammen unter 500 ms) und ruht dann; unter „weniger
 * Bewegung" ruht er sofort (siehe `.st-new-badge` in student.css).
 *
 * `variant="dot"` ist nur der Punkt — für enge Stellen wie die untere Leiste.
 * Die Beschriftung steht dann unsichtbar für Screenreader da.
 *
 * Wann etwas als gesehen gilt, entscheidet Phase 6; dieser Baustein zeigt
 * nur an, was ihm übergeben wird.
 */
export default function NewBadge({ label, variant = 'pill', className }: {
  label: string
  variant?: 'pill' | 'dot'
  className?: string
}) {
  return (
    <span className={['st-new-badge', className].filter(Boolean).join(' ')} data-variant={variant}>
      <span className="st-new-badge__dot" aria-hidden="true" />
      {variant === 'pill' ? <span className="st-new-badge__label">{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  )
}
