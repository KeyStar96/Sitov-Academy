import { Suspense } from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle2, LibraryBig, Map, MessageSquareText, UserCheck, UserPlus, Users, CalendarRange, ClipboardCheck } from 'lucide-react'
import { MediaStorageUsage } from '@/components/admin/MediaStorageUsage'
import { ListCard, ListLink, Notice, PageHeader, StatTile, adminButton } from '@/components/admin/ui'
import { getAdminStats } from '@/app/actions/admin'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createAdminTranslator } from '@/lib/admin-i18n'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'

/**
 * Startseite des Lehrer-Dashboards: nur, was täglich zählt.
 * Neue Registrierungen ohne Niveau stehen ganz oben, darunter vier Kennzahlen
 * (Schüler, Freischaltungen, offene Korrekturen, Medienspeicher) und die
 * Einstiege in die Bereiche. Bescheinigungen und Rechnungen liegen bewusst
 * unter „Verwaltung“, nicht hier.
 */
export default async function AdminDashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const supabase = await createClient()
  const [stats, dict, { data: { user } }] = await Promise.all([getAdminStats(), getDictionary(lang), supabase.auth.getUser()])
  const { data: person } = user
    ? await supabase.from('people').select('display_name').eq('auth_user_id', user.id).maybeSingle()
    : { data: null }
  const t = createAdminTranslator(dict.admin)
  const dailyCopy = getDailyQuestCopy(lang)
  const base = `/${lang}/admin`
  const firstName = person?.display_name?.trim().split(/\s+/)[0]
  const today = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' }).format(new Date())
  const share = stats.studentCount > 0 ? Math.round((stats.activatedCount / stats.studentCount) * 100) : 0

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow={today}
        title={firstName ? t('overview_hello', { name: firstName }) : t('nav_overview')}
        description={t('overview_intro')}
      />

      <section aria-labelledby="teacher-quest-title" className="flex flex-col gap-4 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="flex min-w-0 items-start gap-3"><Map size={22} aria-hidden="true" className="mt-1 shrink-0 text-[var(--accent-text)]" />
          <div className="min-w-0"><h2 id="teacher-quest-title" className="text-lg font-semibold">{dailyCopy.previewTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{dailyCopy.previewNotice}</p></div>
        </div>
        <Link href={`${base}/daily-quest`} className={adminButton('secondary', 'md', 'w-full shrink-0 sm:ml-auto sm:w-auto')}>
          {dailyCopy.previewEntry}<ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {stats.newStudentCount > 0 ? (
        <section aria-labelledby="new-students-heading" className="relative min-w-0 overflow-hidden rounded-xl border border-[var(--accent)] bg-[var(--surface)]">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
          <div className="flex flex-col gap-4 p-4 pl-5 sm:flex-row sm:items-center sm:gap-5 sm:p-5 sm:pl-6">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)]">
                <UserPlus size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[1.75rem] font-semibold leading-none tabular-nums">{stats.newStudentCount}</p>
                <h2 id="new-students-heading" className="mt-1.5 text-[0.9375rem] font-semibold">{t('overview_new_title')}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t('overview_new_body')}</p>
              </div>
            </div>
            <Link href={`${base}/new-students`} className={adminButton('primary', 'md', 'w-full shrink-0 sm:ml-auto sm:w-auto')}>
              {t('overview_new_cta')}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : (
        <Notice tone="success" role="status">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={16} aria-hidden="true" />{t('overview_new_clear')}</span>
        </Notice>
      )}

      <section aria-labelledby="kpi-heading" className="space-y-3">
        <h2 id="kpi-heading" className="sr-only">{t('overview_kpi_title')}</h2>
        <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-4">
          <StatTile label={t('kpi_students')} value={stats.studentCount} hint={t('kpi_students_hint')} icon={Users} href={`${base}/students`} />
          <StatTile label={t('kpi_activated')} value={stats.activatedCount} hint={t('kpi_activated_share', { percent: share })} icon={UserCheck} href={`${base}/students`} />
          <StatTile
            label={t('kpi_pending')}
            value={stats.pendingSubmissions}
            hint={t('kpi_pending_hint')}
            icon={MessageSquareText}
            tone={stats.pendingSubmissions > 0 ? 'accent' : 'neutral'}
            href={`${base}/submissions`}
            className="col-span-2 lg:col-span-1"
          />
          <Suspense fallback={<div aria-hidden="true" className="col-span-2 min-h-32 animate-pulse rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] lg:col-span-1" />}>
            <MediaStorageUsage dictionary={dict} lang={lang} />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="areas-heading" className="space-y-3">
        <h2 id="areas-heading" className="text-sm font-semibold">{t('overview_areas_title')}</h2>
        <ListCard>
          <ListLink href={`${base}/students`} icon={Users} title={t('group_students')} description={t('area_students_desc')} />
          <ListLink href={`${base}/exam-simulation`} icon={ClipboardCheck} title={t('nav_exam_simulation')} description={t('area_exam_simulation_desc')} />
          <ListLink href={`${base}/courses`} icon={BookOpen} title={t('group_courses')} description={t('area_courses_desc')} />
          <ListLink href={`${base}/content`} icon={LibraryBig} title={t('group_content')} description={t('area_content_desc')} />
          <ListLink href={`${base}/finance`} icon={CalendarRange} title={t('group_administration')} description={t('area_administration_desc')} />
        </ListCard>
      </section>
    </div>
  )
}
