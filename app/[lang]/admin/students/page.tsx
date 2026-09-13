import { getStudents, getAllStudentsProgressData } from '@/app/actions/admin'
import { getStaffBlackboardNotes } from '@/app/actions/admin-operations'
import StudentList from '@/components/admin/StudentList'
import { BlackboardProvider } from '@/components/admin/BlackboardProvider'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'

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


  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{t('students_title')}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t('students_intro')}</p>
      </div>
      <BlackboardProvider initialNotes={notesResult.success === true ? notesResult.data : {}}>
        <StudentList
          initialStudents={students}
          currentUserId={user?.id}
          currentUserRole={profile?.role ?? undefined}
          progressData={progressData}
          lang={lang}
        />
      </BlackboardProvider>
    </div>
  )
}
