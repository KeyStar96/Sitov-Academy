import { getTeacherStudents } from '@/app/actions/teacher-dashboard'
import StudentList from '@/components/admin/StudentList'
import TeacherDashboardFailure from '@/components/admin/TeacherDashboardFailure'
import { Notice, PageHeader } from '@/components/admin/ui'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { studentsAdminCopy } from '@/lib/students-admin-i18n'

export default async function AdminStudentsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ deleted?: string }> }) {
  const [{ lang }, query] = await Promise.all([params, searchParams])
  const [result, dict] = await Promise.all([getTeacherStudents(), getDictionary(lang)])
  const t = createAdminTranslator(dict.admin)
  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader title={t('students_title')} description={t('students_intro')} />
      {/* Rückmeldung nach „Profil löschen" auf der Detailseite – ohne Namen in der Adresse. */}
      {query.deleted === '1' && <Notice tone="success" role="status">{studentsAdminCopy(lang).profileDeleted}</Notice>}
      {result.data ? <StudentList initialStudents={result.data} lang={lang} /> : <TeacherDashboardFailure lang={lang} error={result.error} />}
    </div>
  )
}
