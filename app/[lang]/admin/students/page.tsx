import { getTeacherStudents } from '@/app/actions/teacher-dashboard'
import StudentList from '@/components/admin/StudentList'
import TeacherDashboardFailure from '@/components/admin/TeacherDashboardFailure'
import { PageHeader } from '@/components/admin/ui'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'

export default async function AdminStudentsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [result, dict] = await Promise.all([getTeacherStudents(), getDictionary(lang)])
  const t = createAdminTranslator(dict.admin)
  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader title={t('students_title')} description={t('students_intro')} />
      {result.data ? <StudentList initialStudents={result.data} lang={lang} /> : <TeacherDashboardFailure lang={lang} error={result.error} />}
    </div>
  )
}
