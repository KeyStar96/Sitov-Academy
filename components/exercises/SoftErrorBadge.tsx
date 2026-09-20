import { Info } from 'lucide-react'
import { exercises } from '@/dictionaries/de.json'
import type { SoftErrorReason, SoftErrorTranslations } from '@/lib/answer-grading'

export default function SoftErrorBadge({ reason, translations }: {
  reason: SoftErrorReason
  translations?: SoftErrorTranslations
}) {
  return <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--warning)] p-4 text-[var(--warning-foreground)]">
    <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
    <span>{translations?.[reason] || exercises.soft_error[reason]}</span>
  </p>
}
