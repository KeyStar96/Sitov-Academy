import { FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * „Beta" an jedem Einstieg in die Lernplattform: sichtbar kurz, für
 * Screenreader als Satz („Beta – die Lernplattform ist noch im Aufbau").
 * `tone="on-primary"` für die orangefarbenen Hauptknöpfe (weißes Etikett).
 */
export default function BetaBadge({ label, hint, tone = 'default', className }: {
  label: string
  hint: string
  tone?: 'default' | 'on-primary'
  className?: string
}) {
  return (
    <span className={cn('academy-beta', className)} data-tone={tone} title={hint}>
      <FlaskConical size={12} strokeWidth={2.5} aria-hidden="true" />
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{hint}</span>
    </span>
  )
}
