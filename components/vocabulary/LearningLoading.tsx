'use client'

import { useRouteFeedback } from '@/components/layout/RouteFeedbackProvider'
import './learning.css'

/** Reserve the exact viewport shell before either assessment or practice arrives. */
export default function LearningLoading() {
  const copy = useRouteFeedback('vocabulary')
  return <section className="learning-screen" aria-busy="true" role="status">
    <span className="sr-only">{copy.loading}</span>
    <div className="learning-header" aria-hidden="true">
      <div className="academy-skeleton h-11 w-24 max-w-full rounded-full" />
      <div className="academy-skeleton h-5 w-32 max-w-full rounded-lg" />
      <div className="academy-skeleton h-11 w-11 shrink-0 rounded-full" />
    </div>
    <div className="learning-progress" aria-hidden="true" />
    <div className="learning-workspace" aria-hidden="true">
      <div className="learning-meta"><div className="academy-skeleton h-6 w-32 max-w-full rounded-full" /></div>
      <div className="learning-card flex flex-col items-center justify-center gap-5 p-6">
        <div className="academy-skeleton h-7 w-2/3 rounded-xl" />
        <div className="academy-skeleton h-5 w-1/2 rounded-lg" />
      </div>
      <div className="learning-actions"><div className="academy-skeleton h-16 rounded-2xl" /><div className="academy-skeleton h-16 rounded-2xl" /></div>
      <div className="learning-status"><div className="academy-skeleton mx-auto h-3 w-1/2 rounded-full" /></div>
    </div>
  </section>
}
