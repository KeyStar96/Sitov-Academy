'use client'

import { useProfileTranslator } from '@/components/dashboard/ProfileI18nProvider'

export default function ProfileLoading() {
  const t = useProfileTranslator()
  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6" aria-busy="true" role="status">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true" className="h-24 w-full max-w-xl animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div aria-hidden="true" className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1].map(index => <div key={index} className="min-h-[52rem] min-w-0 space-y-6 rounded-3xl bg-white p-4 sm:min-h-[36rem] sm:p-7 dark:bg-slate-900">
          <div className="h-12 w-3/4 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
          {[0, 1, 2, 3].map(row => <div key={row} className="h-16 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
        </div>)}
      </div>
    </div>
  )
}
