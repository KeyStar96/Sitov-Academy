'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

/** Skeleton in der Silhouette der Vokabel-Übersicht – kein Layout-Sprung. */
export default function VocabularyLoading() {
  const copy = useRouteFeedback('vocabulary')
  return (
    <div
      className="mx-auto max-w-4xl rounded-3xl bg-[var(--surface)] p-4 sm:p-8 shadow-sm ring-1 ring-[var(--border)]"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">{copy.loading}</span>

      <div aria-hidden="true" className="mb-6 h-40 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />

      <div className="mb-6 h-8 w-48 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />

      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        ))}
      </div>
    </div>
  )
}
