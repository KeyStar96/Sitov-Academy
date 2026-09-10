'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

/**
 * Skelett für die `loading.tsx` der Auth-Routen.
 *
 * Die Platzhalter haben dieselben Maße wie die späteren Felder, damit beim
 * Erscheinen des Formulars nichts springt.
 */
export default function AuthLoadingState({ fieldCount = 2 }: { fieldCount?: number }) {
  const copy = useRouteFeedback('auth')
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <span className="sr-only" role="status">
          {copy.loading}
        </span>

        <div className="mx-auto h-9 w-56 max-w-full animate-pulse rounded-xl bg-[var(--surface-muted)]" />

        <div className="space-y-6 rounded-3xl border-2 border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          <div className="space-y-3">
            <div className="h-8 w-2/3 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
            <div className="h-6 w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
          </div>

          {Array.from({ length: fieldCount }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-6 w-40 max-w-full animate-pulse rounded-lg bg-[var(--surface-muted)]" />
              <div className="h-14 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
            </div>
          ))}

          <div className="h-14 w-full animate-pulse rounded-2xl bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  )
}
