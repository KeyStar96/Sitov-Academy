'use client'
import { useRouter } from 'next/navigation'
import { teacherDashboardError, teacherDashboardT } from '@/lib/teacher-dashboard-i18n'
import { dashboardButton, dashboardPanel } from './TeacherDashboardShared'

export default function TeacherDashboardFailure({ lang, error }: { lang: string; error: string }) {
  const router = useRouter()
  return <div className={`${dashboardPanel} space-y-4`}><p role="alert">{teacherDashboardError(lang, error)}</p><button type="button" className={dashboardButton} onClick={() => router.refresh()}>{teacherDashboardT(lang)('retry')}</button></div>
}
