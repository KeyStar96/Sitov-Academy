import { getStudents, getAllStudentsProgressData } from '@/app/actions/admin'
import { getStaffBlackboardNotes } from '@/app/actions/admin-operations'
import StudentList from '@/components/admin/StudentList'
import { BlackboardProvider } from '@/components/admin/BlackboardProvider'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import type { AdminStudentRow } from '@/lib/types/admin-staff'

export default async function AdminStudentsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [students, progressData, notesResult, dict] = await Promise.all([
    getStudents(),
    getAllStudentsProgressData(),
    getStaffBlackboardNotes(),
    getDictionary(lang),
  ])
  const t = createAdminTranslator(dict.admin)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user ? await supabase.from('profiles').select('role').eq('id', user.id).single() : { data: null }
  const rows: AdminStudentRow[] = students.map(student => ({
    id: student.id,
    name: student.name,
    email: student.email,
    role: student.role,
    allowed_levels: student.allowed_levels,
    student_trainer_access: student.student_trainer_access,
    created_at: student.created_at,
    phone: student.phone,
    street: student.street,
    zip_code: student.zip_code,
    city: student.city,
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t('students_title')}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t('students_intro')}</p>
      </div>
      <BlackboardProvider initialNotes={notesResult.success === true ? notesResult.data : {}}>
        <StudentList
          initialStudents={rows}
          currentUserId={user?.id}
          currentUserRole={profile?.role ?? undefined}
          progressData={progressData}
          lang={lang}
        />
      </BlackboardProvider>
    </div>
  )
}
