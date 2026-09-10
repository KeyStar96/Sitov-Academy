'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

/** Skeleton in der Silhouette der Aussprache-Seite – kein Layout-Sprung. */
export default function PronunciationLoading() {
  const copy = useRouteFeedback('pronunciation')
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{copy.loading}</span>

      <div aria-hidden="true" className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map(index => <div key={index} className="h-20 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />)}
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-8">
        <div className="mx-auto h-8 w-64 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="mx-auto mt-4 h-6 w-96 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="mx-auto mt-8 h-16 w-72 max-w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
      </div>

      <div className="space-y-4">
        <div className="h-8 w-72 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        {[0, 1].map((index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-3xl bg-[var(--surface-muted)]"
          />
        ))}
      </div>
    </div>
  )
}
