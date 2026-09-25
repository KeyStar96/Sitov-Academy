import { Info } from 'lucide-react'
import { exercises } from '@/dictionaries/de.json'
import type { SoftErrorReason, SoftErrorTranslations } from '@/lib/answer-grading'
import { learningFeedback } from '@/lib/learning-feedback-i18n'

export default function SoftErrorBadge({ reason, translations }: {
  reason: SoftErrorReason
  translations?: SoftErrorTranslations
}) {
  return <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--warning)] p-4 text-[var(--warning-foreground)]">
    <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
    <span>{translations?.[reason] || exercises.soft_error[reason]}</span>
  </p>
}

/** Neutral spelling guidance is separate from a soft-error warning. */
export function OrthographyNote({ lang, solution }: { lang: string; solution: string }) {
  return <p role="note" className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-lg text-[var(--foreground)]">
    {learningFeedback(lang).spelling} <span lang="de" translate="no">{solution}</span>
  </p>
}
