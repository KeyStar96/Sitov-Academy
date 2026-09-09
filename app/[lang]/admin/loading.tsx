import { ADMIN_FALLBACKS } from '@/lib/admin-i18n'

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{ADMIN_FALLBACKS.loading}</span>
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="h-5 w-96 max-w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />
    </div>
  )
}
