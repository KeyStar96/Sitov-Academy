import Link from 'next/link'
import { ArrowUpRight, ChevronRight, Lock, Sparkles } from 'lucide-react'
import { getAllLevelsProgress } from '@/app/actions/progress'
import { getUnseenFeedbackSummary } from '@/app/actions/feedback'
import { getDictionary } from '@/lib/dictionary'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import { createProfileTranslator } from '@/lib/profile-i18n'
import type { PronunciationTranslations } from '@/lib/pronunciation-i18n'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasLevelAccess } from '@/lib/access/levels'
import { loadProfileMonthlyState } from '@/lib/profile-dashboard-server'
import { loadProfileCourseCalendar } from '@/lib/profile-course-calendar-server'
import FeedbackNotificationCard from '@/components/dashboard/FeedbackNotificationCard'
import ProfileCourseCalendar from '@/components/dashboard/ProfileCourseCalendar'
import GreetingClock from '@/components/dashboard/home/GreetingClock'
import ThemeSwitch from '@/components/dashboard/home/ThemeSwitch'
import NextCourseCard from '@/components/dashboard/home/NextCourseCard'
import CoursePlanner from '@/components/dashboard/home/CoursePlanner'
import LearningTrainersWidget from '@/components/dashboard/home/LearningTrainersWidget'
import SupportWidget from '@/components/dashboard/home/SupportWidget'

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const supabase = await createClient()
  const [{ data: { user } }, progressMap, unseenFeedback, dict] = await Promise.all([
    supabase.auth.getUser(), getAllLevelsProgress(), getUnseenFeedbackSummary(), getDictionary(lang),
  ])
  const [accessProfile, profileRow] = user
    ? await Promise.all([
        loadLevelAccessProfile(supabase, user.id),
        supabase.from('profiles').select('person:people(display_name)').eq('id', user.id).single(),
      ])
    : [null, null]

  // Booking and calendar are optional widgets: a load failure must not take the
  // whole dashboard down, so each is guarded independently (as on the profile page).
  const profileT = createProfileTranslator(dict.profile)
  let monthly: Awaited<ReturnType<typeof loadProfileMonthlyState>> | null = null
  let calendar: Awaited<ReturnType<typeof loadProfileCourseCalendar>> | null = null
  if (user) {
    try { monthly = await loadProfileMonthlyState(supabase, user) }
    catch { console.error('[dashboard] Course plan could not be loaded') }
    try { calendar = await loadProfileCourseCalendar(supabase, user) }
    catch { console.error('[dashboard] Course calendar could not be loaded') }
  }
  const courseTitles = Object.fromEntries((monthly?.courses ?? []).map(course => [
    course.id, course.translations.find(item => item.locale === lang)?.title || course.title || profileT('course_fallback'),
  ]))

  const t = createDashboardTranslator(dict.dashboard as DashboardTranslations)
  const copy = dict.academy
  const displayName = profileRow?.data?.person?.display_name || user?.email || ''
  const levels = [
    { id: 'A1.1', title: dict.dashboard.level_a11_title, description: dict.dashboard.level_a11_desc },
    { id: 'A1.2', title: dict.dashboard.level_a12_title, description: dict.dashboard.level_a12_desc },
    { id: 'A2.1', title: dict.dashboard.level_a21_title, description: dict.dashboard.level_a21_desc },
    { id: 'A2.2', title: dict.dashboard.level_a22_title, description: dict.dashboard.level_a22_desc },
    { id: 'B1.1', title: dict.dashboard.level_b11_title, description: dict.dashboard.level_b11_desc },
    { id: 'B1.2', title: dict.dashboard.level_b12_title, description: dict.dashboard.level_b12_desc },
  ]
  const accessible = levels.filter(level => hasLevelAccess(accessProfile, level.id))
  const recommended = accessible.find(level => (progressMap[level.id] || 0) > 0 && (progressMap[level.id] || 0) < 100) || accessible.find(level => (progressMap[level.id] || 0) < 100) || accessible[0]
  const progress = recommended ? Math.max(0, Math.min(100, progressMap[recommended.id] || 0)) : 0
  const supportLabels = {
    whatsapp: copy.support_whatsapp,
    phone: dict.Footer.Contact.phone,
    phoneLabel: dict.Footer.Contact.phone_label,
    telegram: dict.Footer.Contact.telegram_button,
    email: dict.Footer.Contact.email,
    emailLabel: dict.Footer.Contact.email_button,
  }

  return <div className="space-y-6">
    <FeedbackNotificationCard summary={unseenFeedback} translations={dict.pronunciation as PronunciationTranslations} lang={lang} />

    <GreetingClock name={displayName} lang={lang}><ThemeSwitch /></GreetingClock>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <section className="academy-next-step !rounded-3xl lg:col-span-7">
        <div>
          <p className="academy-eyebrow"><Sparkles size={16} aria-hidden="true" />{copy.dashboard_recommended}</p>
          <h2>{recommended?.title || copy.learn_title}</h2>
          <p>{recommended?.description || copy.dashboard_no_access}</p>
          {recommended && <Link className="academy-button academy-button-primary" href={`/${lang}/dashboard/level/${recommended.id}`}>{copy.dashboard_cta}<ArrowUpRight size={19} aria-hidden="true" /></Link>}
        </div>
        <div className="academy-progress-disc" role="img" aria-label={`${copy.dashboard_progress}: ${progress}%`} style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><span><strong>{progress}%</strong><small>{copy.dashboard_progress}</small></span></div>
      </section>

      <NextCourseCard calendar={calendar} lang={lang} className="lg:col-span-5" />

      {monthly
        ? <CoursePlanner calendar={calendar} monthly={monthly} lang={lang} translations={dict.profile} courseTitles={courseTitles} />
        : <>
            <div className="min-w-0 lg:col-span-7"><ProfileCourseCalendar initial={calendar} lang={lang} bookingRevision="" /></div>
            <section className="min-w-0 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-800 dark:bg-amber-950 lg:col-span-5">
              <h2 className="text-xl font-bold text-[var(--foreground)]">{profileT('next_month_title')}</h2>
              <p role="alert" className="mt-3 text-amber-900 dark:text-amber-200">{profileT('booking_load_failed')}</p>
              <a href={`/${lang}/dashboard`} className="mt-4 inline-flex min-h-12 min-w-12 items-center rounded-xl border border-amber-500 px-4 py-2 font-bold text-amber-950 dark:text-amber-100">{profileT('reload')}</a>
            </section>
          </>}

      <LearningTrainersWidget lang={lang} level={recommended?.id ?? null} profile={accessProfile} translations={dict.dashboard as DashboardTranslations} className="lg:col-span-8" />
      <SupportWidget lang={lang} labels={supportLabels} className="lg:col-span-4" />
    </div>

    <section aria-labelledby="academy-levels-title"><div className="academy-level-heading"><h2 id="academy-levels-title">{copy.dashboard_levels}</h2><span>A1—B1</span></div><div className="academy-level-grid">{levels.map((level, index) => {
      const locked = !hasLevelAccess(accessProfile, level.id)
      const value = Math.max(0, Math.min(100, progressMap[level.id] || 0))
      const content = <><div className="academy-level-top"><span className="academy-level-code">{level.id}</span>{locked ? <Lock size={18} aria-hidden="true" /> : <span className="academy-level-number" aria-hidden="true">0{index + 1}</span>}</div><h3>{level.title}</h3><p>{level.description}</p><div className="academy-level-bottom">{locked ? <span>{t('level_locked_hint')}</span> : <><span>{value > 0 ? t('continue_learning') : t('start')}<ChevronRight size={17} aria-hidden="true" /></span><span>{value}%</span></>}</div>{!locked && <div className="academy-level-track" aria-hidden="true"><span style={{ width: `${value}%` }} /></div>}</>
      return locked ? <article key={level.id} className="academy-level-card academy-level-locked" aria-disabled="true">{content}</article> : <Link key={level.id} href={`/${lang}/dashboard/level/${level.id}`} className="academy-level-card">{content}</Link>
    })}</div></section>
  </div>
}
