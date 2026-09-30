import { ADMIN_FALLBACKS } from '@/lib/admin-i18n'

/** Ruhiges Skelett im Admin-Raster: Kopfzeile, Kennzahlen, Liste. */
export default function AdminLoading() {
  const block = 'animate-pulse rounded-xl bg-[var(--surface-muted)] motion-reduce:animate-none'
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{ADMIN_FALLBACKS.loading}</span>
      <div className="space-y-2">
        <div className={`h-3 w-28 ${block}`} />
        <div className={`h-7 w-56 max-w-full ${block}`} />
        <div className={`h-4 w-80 max-w-full ${block}`} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(index => <div key={index} className={`h-28 ${block}`} />)}
      </div>
      <div className={`h-72 ${block}`} />
    </div>
  )
}
