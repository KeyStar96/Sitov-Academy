'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import BlackboardEditor from './BlackboardEditor'
import { formatStudentAddress, type AdminStudentRow } from '@/lib/types/admin-staff'

export default function StudentDetailModal({
  student, onClose,
}: {
  student: AdminStudentRow
  onClose: () => void
}) {
  const t = useAdminTranslator()
  const name = student.name || t('unknown_name')
  const address = formatStudentAddress(student)
  const titleId = `student-detail-${student.id}`

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-lenis-prevent
        onClick={event => event.stopPropagation()}
        className="flex max-h-[calc(100vh-6rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-sm font-bold text-orange-800 dark:text-orange-300">{t('detail_title')}</p>
            <h2 id={titleId} className="break-words text-xl font-bold text-slate-900 dark:text-white">{name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close_details_aria')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:hover:bg-slate-800"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <section aria-labelledby={`${titleId}-contact`} className="mb-6">
            <h3 id={`${titleId}-contact`} className="text-base font-bold text-slate-900 dark:text-white">{t('detail_contact')}</h3>
            <dl className="mt-3 space-y-2 text-sm leading-relaxed">
              <div>
                <dt className="font-bold text-slate-500">{t('email')}</dt>
                <dd className="break-words text-slate-900 dark:text-slate-100">{student.email}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">{t('phone')}</dt>
                <dd className="text-slate-900 dark:text-slate-100">{student.phone || t('not_specified')}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">{t('street')}</dt>
                <dd className="break-words text-slate-900 dark:text-slate-100">{address || t('not_specified')}</dd>
              </div>
            </dl>
          </section>
          <BlackboardEditor studentId={student.id} studentName={name} />
        </div>
      </div>
    </div>
  )
}
