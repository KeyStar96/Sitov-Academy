'use client'

import { useEffect } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useAdminTranslator } from '@/components/admin/AdminI18nProvider'
import { adminButton } from '@/components/admin/ui'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useAdminTranslator()
  useEffect(() => {
    console.error("Lehrer-Bereich konnte nicht gerendert werden:")
  }, [error])

  return (
    <div role="alert" className="mx-auto max-w-lg rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] px-5 py-10 text-center">
      <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--warning)] text-[var(--warning-foreground)]">
        <TriangleAlert size={22} aria-hidden="true" />
      </span>
      <h1 className="text-lg font-semibold">{t('error_title')}</h1>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{t('error_description')}</p>
      <button type="button" onClick={reset} className={adminButton('primary', 'md', 'mt-6 w-full sm:w-auto')}>
        <RefreshCw size={16} aria-hidden="true" />
        {t('error_retry')}
      </button>
    </div>
  )
}
