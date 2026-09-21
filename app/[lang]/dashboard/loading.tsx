'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'

/** Reserve the header, bento widgets and level grid used by the loaded page. */
export default function DashboardLoading() {
  const copy = useRouteFeedback('auth')
  return <div className="space-y-6" role="status" aria-busy="true">
    <span className="sr-only">{copy.loading}</span>
    <div aria-hidden="true" className="flex flex-col gap-6 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
      <div className="w-full space-y-4"><div className="academy-skeleton h-9 w-2/3 max-w-md rounded-xl" /><div className="academy-skeleton h-5 w-full max-w-lg rounded-lg" /></div>
      <div className="flex shrink-0 items-center gap-5"><div className="academy-skeleton h-14 w-40 rounded-xl" /><div className="academy-skeleton h-11 w-20 rounded-full" /></div>
    </div>
    <div aria-hidden="true" className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="academy-skeleton h-56 rounded-3xl lg:col-span-7" />
      <div className="academy-skeleton h-56 rounded-3xl lg:col-span-5" />
      <div className="academy-skeleton h-96 rounded-3xl lg:col-span-7" />
      <div className="academy-skeleton h-96 rounded-3xl lg:col-span-5" />
      <div className="academy-skeleton h-64 rounded-3xl lg:col-span-8" />
      <div className="academy-skeleton h-64 rounded-3xl lg:col-span-4" />
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
