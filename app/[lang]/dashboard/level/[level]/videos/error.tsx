'use client'

import { useEffect } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

export default function VideosError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const copy = useRouteFeedback('videos')
  useEffect(() => {
    console.error("Videoseite konnte nicht gerendert werden:")
  }, [error])

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center sm:p-8">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full vocabulary-phase-new">
        <TriangleAlert className="h-10 w-10 text-[var(--accent)]" aria-hidden="true" />
      </div>
      <h1 className="break-words text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{copy.error_title}</h1>
      <p className="mt-3 text-base leading-relaxed text-[var(--muted)] sm:text-lg">{copy.error_description}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-[var(--accent)] px-5 py-4 text-base sm:text-xl font-bold text-[var(--accent-foreground)] shadow-md transition-colors hover:bg-[var(--accent-hover)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
      >
        <RefreshCw size={28} aria-hidden="true" />
        {copy.error_retry}
      </button>
    </div>
  )
}
