'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

/** Skeleton-Loader in der Silhouette der Übungskarte – kein Layout-Sprung. */
export default function ExercisesLoading() {
  const copy = useRouteFeedback('exercises')
  return (
    <div className="mx-auto max-w-4xl" aria-busy="true" aria-live="polite">
      <span className="sr-only">{copy.loading}</span>

      <div aria-hidden="true" className="mb-6 flex gap-5">
        {[0, 1, 2].map(index => <div key={index} className="h-14 w-20 animate-pulse rounded-xl bg-[var(--surface-muted)]" />)}
      </div>

      <div className="overflow-hidden rounded-3xl bg-[var(--surface)] shadow-lg ring-1 ring-[var(--border)]">
        <div className="h-24 animate-pulse bg-[var(--surface-muted)]" />
        <div className="space-y-8 p-4 sm:p-10">
          <div className="mx-auto h-10 w-3/4 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
          <div className="flex flex-wrap justify-center gap-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-16 w-32 animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
            ))}
          </div>
          <div className="ml-auto h-16 w-48 max-w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  )
}
