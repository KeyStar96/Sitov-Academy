'use client'

import { RotateCcw } from 'lucide-react'
import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

/** Localized error boundary sharing the opaque Academy surface. */
export default function AuthErrorState({ reset }: { reset: () => void }) {
  const copy = useRouteFeedback('auth')
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-4 py-12">
      <div className="w-full max-w-lg space-y-6 rounded-3xl border-2 border-[var(--border)] bg-[var(--surface)] p-5 text-center sm:p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          {copy.error_title}
        </h1>
        <p className="text-lg text-[var(--foreground)]">
          {copy.error_description}
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[var(--accent-strong)] px-6 text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:bg-[var(--accent-strong-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          <RotateCcw size={24} aria-hidden="true" />
          {copy.error_retry}
        </button>
      </div>
    </div>
  )
}
