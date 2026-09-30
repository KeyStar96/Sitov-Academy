'use client'
import { useRouter } from 'next/navigation'
import { teacherDashboardError, teacherDashboardT } from '@/lib/teacher-dashboard-i18n'
import { Notice, adminButton } from './ui'

export default function TeacherDashboardFailure({ lang, error }: { lang: string; error: string }) {
  const router = useRouter()
  return (
    <Notice tone="warning" role="alert" action={<button type="button" className={adminButton('secondary', 'sm')} onClick={() => router.refresh()}>{teacherDashboardT(lang)('retry')}</button>}>
      {teacherDashboardError(lang, error)}
    </Notice>
  )
}
