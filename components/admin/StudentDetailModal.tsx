'use client'

import type { ReactNode } from 'react'
import { useAdminTranslator } from './AdminI18nProvider'
import BlackboardEditor from './BlackboardEditor'
import AdminDialog from './AdminDialog'
import { formatStudentAddress, type AdminStudentRow } from '@/lib/types/admin-staff'

export default function StudentDetailModal({ student, onClose, children }: {
  student: AdminStudentRow
  onClose: () => void
  children?: ReactNode
}) {
  const t = useAdminTranslator()
  const name = student.name || t('unknown_name')
  const address = formatStudentAddress(student)
  return (
    <AdminDialog title={name} subtitle={t('detail_title')} onClose={onClose}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6" data-lenis-prevent>
        <section className="mb-6" aria-label={t('detail_contact')}>
          <h3 className="text-base font-bold">{t('detail_contact')}</h3>
          <dl className="mt-3 grid gap-3 text-base leading-relaxed sm:grid-cols-2">
            {[[t('email'), student.email], [t('phone'), student.phone || t('not_specified')], [t('street'), address || t('not_specified')]].map(([label, value]) => <div key={label}><dt className="font-semibold text-[var(--muted)]">{label}</dt><dd className="break-words">{value}</dd></div>)}
          </dl>
        </section>
        <BlackboardEditor studentId={student.id} studentName={name} />
        {children}
      </div>
    </AdminDialog>
  )
}
