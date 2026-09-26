import { getTeacherStudents } from '@/app/actions/teacher-dashboard'
import StudentList from '@/components/admin/StudentList'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import TeacherDashboardFailure from '@/components/admin/TeacherDashboardFailure'

export default async function AdminStudentsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [result, dict] = await Promise.all([getTeacherStudents(), getDictionary(lang)])
  const t = createAdminTranslator(dict.admin)
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold text-[var(--foreground)]">{t('students_title')}</h1><p className="mt-2 text-base text-[var(--muted)]">{t('students_intro')}</p></div>
    {result.data ? <StudentList initialStudents={result.data} lang={lang} /> : <TeacherDashboardFailure lang={lang} error={result.error} />}
  </div>
}
