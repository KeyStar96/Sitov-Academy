'use client'

import { useEffect } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { useAdminTranslator } from '@/components/admin/AdminI18nProvider'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useAdminTranslator()
  useEffect(() => {
    console.error('Lehrer-Bereich konnte nicht gerendert werden:', error.digest ?? error.message)
  }, [error])

  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-900/5">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
        <TriangleAlert className="h-10 w-10 text-amber-600" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('error_title')}</h1>
      <p className="mt-3 text-lg text-gray-600">{t('error_description')}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-16 items-center gap-3 rounded-2xl bg-blue-600 px-8 py-4 text-xl font-bold text-white shadow-md transition-colors hover:bg-blue-500"
      >
        <RefreshCw size={28} aria-hidden="true" />
        {t('error_retry')}
      </button>
    </div>
  )
}
