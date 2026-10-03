import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { getTeacherStudentDetail } from '@/app/actions/teacher-dashboard'
import { getStudentLearningProgress } from '@/app/actions/learning-progress'
import { getDictionary } from '@/lib/dictionary'
import { createClient } from '@/utils/supabase/server'
import { TEACHER_TABS, teacherTabSchema } from '@/lib/teacher-dashboard-contract'
import { teacherDashboardT } from '@/lib/teacher-dashboard-i18n'
import { studentsAdminCopy } from '@/lib/students-admin-i18n'
import TeacherDashboardFailure from '@/components/admin/TeacherDashboardFailure'
import TeacherStudentOverview from '@/components/admin/TeacherStudentOverview'
import StudentProgressSnapshot from '@/components/admin/StudentProgressSnapshot'
import TeacherStudentPath from '@/components/admin/TeacherStudentPath'
import { TeacherStudentVocabulary, TeacherStudentPronunciation, TeacherStudentActivity } from '@/components/admin/TeacherStudentPanels'
import { PageHeader, adminChip, adminFocus } from '@/components/admin/ui'
import SitovPronunciationAccess from '@/components/admin/SitovPronunciationAccess'
import { getSitovPronunciationReadiness } from '@/app/actions/sitov-pronunciation-access'

export default async function TeacherStudentPage({ params, searchParams }: {
  params: Promise<{ lang: string; id: string }>; searchParams: Promise<{ tab?: string }>
}) {
  const [{ lang, id }, query] = await Promise.all([params, searchParams])
  const t = teacherDashboardT(lang)
  const s = studentsAdminCopy(lang)
  // Unbekannte oder entfernte Tabs (z. B. das frühere „notes“) fallen auf den Überblick zurück.
  const activeTab = teacherTabSchema.safeParse(query.tab).data ?? 'overview'
  const back = { href: `/${lang}/admin/students`, label: s.backToList }
  const [overview, dictionary] = await Promise.all([getTeacherStudentDetail(id, 'overview', lang), getDictionary(lang)])
  if (!overview.data) {
    return <div className="min-w-0 space-y-5"><PageHeader back={back} title={t('students')} /><TeacherDashboardFailure lang={lang} error={overview.error} /></div>
  }
  const student = overview.data
  const name = student.person?.display_name || student.person?.email || t('students')
  const address = student.person?.street ? [student.person.street, [student.person.postal_code, student.person.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') : null

  async function content() {
    if (activeTab === 'overview') {
      const client = await createClient()
      const [{ data: { user } }, snapshot] = await Promise.all([
        client.auth.getUser(),
        // Heute & 7 Tage: ein Zusatz – ein Ladefehler blendet ihn nur aus.
        student.role === 'student' ? getStudentLearningProgress({ studentId: id, level: null, days: 7 }) : Promise.resolve(null),
      ])
      const { data: profile } = user ? await client.from('profiles').select('role').eq('id', user.id).single() : { data: null }
      return <div className="min-w-0 space-y-4 sm:space-y-5">
        {snapshot?.success && <StudentProgressSnapshot progress={snapshot.data} lang={lang} />}
        <TeacherStudentOverview key={JSON.stringify(student)} student={student} lang={lang} currentUserId={user?.id ?? ''} currentUserRole={profile?.role ?? ''} />
      </div>
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
      const [result, readiness] = await Promise.all([getTeacherStudentDetail(id, 'pronunciation', lang), student.allowed_levels[0] ? getSitovPronunciationReadiness(student.allowed_levels[0], id) : Promise.resolve(null)])
      return result.data ? <div className="space-y-5">{student.role === 'student' && <SitovPronunciationAccess studentId={id} levels={student.allowed_levels} lang={lang} initialReadiness={readiness} />}<TeacherStudentPronunciation data={result.data} lang={lang} /></div> : <TeacherDashboardFailure lang={lang} error={result.error} />
    }
    const result = await getTeacherStudentDetail(id, 'activity', lang)
    return result.data ? <TeacherStudentActivity data={result.data} lang={lang} /> : <TeacherDashboardFailure lang={lang} error={result.error} />
  }

  const contactLink = `inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md text-sm ${adminFocus}`
  return (
    <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
      <PageHeader
        back={back}
        title={name}
        description={
          <span className="flex flex-col gap-x-5 sm:flex-row sm:flex-wrap" aria-label={s.contact}>
            {student.person?.email && <a href={`mailto:${student.person.email}`} className={contactLink}><Mail size={15} aria-hidden="true" className="shrink-0" /><span className="sr-only">{s.email}: </span><span className="truncate">{student.person.email}</span></a>}
            {student.person?.phone && <a href={`tel:${student.person.phone.replace(/[^\d+]/g, '')}`} className={contactLink}><Phone size={15} aria-hidden="true" className="shrink-0" /><span className="sr-only">{s.phone}: </span>{student.person.phone}</a>}
            {address && <span className="inline-flex min-h-11 min-w-0 items-center gap-2 text-sm"><MapPin size={15} aria-hidden="true" className="shrink-0" /><span className="sr-only">{s.address}: </span><span className="break-words">{address}</span></span>}
          </span>
        }
      />
      <nav aria-label={s.sections} className="-mx-4 sm:mx-0">
        <ul className="admin-scroll-x flex gap-2 px-4 sm:flex-wrap sm:px-0">
          {TEACHER_TABS.map(tab => (
            <li key={tab} className="shrink-0">
              <Link href={`/${lang}/admin/students/${id}?tab=${tab}`} aria-current={tab === activeTab ? 'page' : undefined} className={adminChip(tab === activeTab)}>{t(tab)}</Link>
            </li>
          ))}
        </ul>
      </nav>
      {await content()}
    </div>
  )
}
