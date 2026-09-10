'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

/** Reserve the recommendation and level grid used by the loaded page. */
export default function DashboardLoading() {
  const copy = useRouteFeedback('auth')
  return <div className="academy-dashboard" role="status" aria-busy="true">
    <span className="sr-only">{copy.loading}</span>
    <div className="academy-next-step" aria-hidden="true">
      <div className="w-full max-w-xl space-y-5"><div className="academy-skeleton h-4 w-40 max-w-full rounded-lg" /><div className="academy-skeleton h-8 w-3/4 rounded-xl" /><div className="academy-skeleton h-6 w-full rounded-lg" /><div className="academy-skeleton h-12 w-40 max-w-full rounded-full" /></div>
      <div className="academy-skeleton h-28 w-28 shrink-0 rounded-full sm:h-40 sm:w-40" />
    </div>
    <div aria-hidden="true">
      <div className="academy-level-heading"><div className="academy-skeleton h-7 w-48 max-w-full rounded-lg" /></div>
      <div className="academy-level-grid">{[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="academy-level-card min-h-64 gap-5">
        <div className="flex justify-between gap-4"><div className="academy-skeleton h-9 w-16 rounded-lg" /><div className="academy-skeleton h-6 w-6 rounded-full" /></div>
        <div className="academy-skeleton h-6 w-3/4 rounded-lg" />
        <div className="space-y-2"><div className="academy-skeleton h-4 w-full rounded" /><div className="academy-skeleton h-4 w-4/5 rounded" /></div>
        <div className="academy-skeleton mt-auto h-5 w-32 max-w-full rounded" />
      </div>)}</div>
    </div>
  </div>
}
