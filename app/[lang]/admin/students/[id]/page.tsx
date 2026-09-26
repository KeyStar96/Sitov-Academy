import Link from 'next/link'
import { getTeacherStudentDetail } from '@/app/actions/teacher-dashboard'
import { getDictionary } from '@/lib/dictionary'
import { createClient } from '@/utils/supabase/server'
import { TEACHER_TABS, teacherTabSchema } from '@/lib/teacher-dashboard-contract'
import { teacherDashboardT } from '@/lib/teacher-dashboard-i18n'
import TeacherDashboardFailure from '@/components/admin/TeacherDashboardFailure'
import TeacherStudentOverview from '@/components/admin/TeacherStudentOverview'
import TeacherStudentPath from '@/components/admin/TeacherStudentPath'
import { TeacherStudentVocabulary, TeacherStudentPronunciation, TeacherStudentActivity, TeacherStudentNotes } from '@/components/admin/TeacherStudentPanels'
import { dashboardButton as button } from '@/components/admin/TeacherDashboardShared'

export default async function TeacherStudentPage({ params, searchParams }: {
  params: Promise<{ lang: string; id: string }>; searchParams: Promise<{ tab?: string }>
}) {
  const [{ lang, id }, query] = await Promise.all([params, searchParams])
  const t = teacherDashboardT(lang)
  const activeTab = teacherTabSchema.safeParse(query.tab).data ?? 'overview'
  const [overview, dictionary] = await Promise.all([getTeacherStudentDetail(id, 'overview', lang), getDictionary(lang)])
  if (!overview.data) return <div className="space-y-4"><Link href={`/${lang}/admin/students`} className={button}>{t('students')}</Link><TeacherDashboardFailure lang={lang} error={overview.error} /></div>
  const student = overview.data
  const name = student.person?.display_name || student.person?.email || t('students')
  async function content() {
    if (activeTab === 'overview') {
      const client = await createClient()
      const { data: { user } } = await client.auth.getUser()
      const { data: profile } = user ? await client.from('profiles').select('role').eq('id', user.id).single() : { data: null }
      return <TeacherStudentOverview key={JSON.stringify(student)} student={student} lang={lang} currentUserId={user?.id ?? ''} currentUserRole={profile?.role ?? ''} />
    }
    if (activeTab === 'vocabulary') {
      const result = await getTeacherStudentDetail(id, 'vocabulary', lang)
      return result.data ? <TeacherStudentVocabulary data={result.data} lang={lang} translations={dictionary.vocabulary} /> : <TeacherDashboardFailure lang={lang} error={result.error} />
    }
    if (activeTab === 'path') {
      const result = await getTeacherStudentDetail(id, 'path', lang)
      return result.data ? <TeacherStudentPath data={result.data} studentId={id} studentName={name} lang={lang} canIntervene={student.role === 'student'} /> : <TeacherDashboardFailure lang={lang} error={result.error} />
    }
    if (activeTab === 'pronunciation') {
      const result = await getTeacherStudentDetail(id, 'pronunciation', lang)
      return result.data ? <TeacherStudentPronunciation data={result.data} lang={lang} /> : <TeacherDashboardFailure lang={lang} error={result.error} />
    }
    if (activeTab === 'activity') {
      const result = await getTeacherStudentDetail(id, 'activity', lang)
      return result.data ? <TeacherStudentActivity data={result.data} lang={lang} /> : <TeacherDashboardFailure lang={lang} error={result.error} />
    }
    const result = await getTeacherStudentDetail(id, 'notes', lang)
    return result.data ? <TeacherStudentNotes data={result.data} studentId={id} studentName={name} lang={lang} /> : <TeacherDashboardFailure lang={lang} error={result.error} />
  }
  return <div className="min-w-0 space-y-5 text-base text-[var(--foreground)]">
    <nav aria-label={t('start')}><ol className="flex flex-wrap items-center gap-2"><li><Link className="inline-flex min-h-12 items-center underline underline-offset-4" href={`/${lang}/admin`}>{t('start')}</Link></li><li aria-hidden="true">›</li><li><Link className="inline-flex min-h-12 items-center underline underline-offset-4" href={`/${lang}/admin/students`}>{t('students')}</Link></li><li aria-hidden="true">›</li><li>{name}</li><li aria-hidden="true">›</li><li aria-current="page">{t(activeTab)}</li></ol></nav>
    <header><h1 className="break-words text-3xl font-semibold">{name}</h1><p className="mt-2 break-all">{student.person?.email}</p>{student.person?.phone && <p>{student.person.phone}</p>}{student.person?.street && <p>{[student.person.street, student.person.postal_code, student.person.city].filter(Boolean).join(' · ')}</p>}</header>
    <nav aria-label={t('overview')} className="flex flex-wrap gap-2">{TEACHER_TABS.map(tab => <Link key={tab} href={`/${lang}/admin/students/${id}?tab=${tab}`} aria-current={tab === activeTab ? 'page' : undefined} className={`${button} ${tab === activeTab ? 'bg-[var(--accent-strong)] text-[var(--accent-foreground)]' : 'bg-[var(--surface)]'}`}>{t(tab)}</Link>)}</nav>
    {await content()}
  </div>
}
