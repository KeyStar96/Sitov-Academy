'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

export default function VideosLoading() {
  const copy = useRouteFeedback('videos')
  return (
    <div className="mx-auto max-w-5xl space-y-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">{copy.loading}</span>
      <div className="h-6 w-48 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
      <div className="rounded-3xl bg-[var(--surface)] p-4 sm:p-8 shadow-sm ring-1 ring-[var(--border)]">
        <div className="mb-4 h-8 w-64 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="mb-8 h-6 w-80 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="aspect-video animate-pulse bg-[var(--surface-muted)]" />
              <div className="space-y-3 p-6">
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]" />
                <div className="h-6 w-3/4 animate-pulse rounded bg-[var(--surface-muted)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
