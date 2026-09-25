import { getAllLevelsProgress } from '@/app/actions/progress'
import { getUnseenFeedbackSummary } from '@/app/actions/feedback'
import { getDictionary } from '@/lib/dictionary'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import type { PronunciationTranslations } from '@/lib/pronunciation-i18n'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasLevelAccess } from '@/lib/access/levels'
import { loadProfileMonthlyState } from '@/lib/profile-dashboard-server'
import { loadProfileCourseCalendar } from '@/lib/profile-course-calendar-server'
import { formatCalendarDate } from '@/lib/profile-course-calendar'
import { nextUpcomingEvent } from '@/lib/dashboard-next-course'
import { formatProfileMonth } from '@/lib/profile-month'
import { loadLevelLearningStatus, loadWeekActivity, modeLock } from '@/lib/learning-status-server'
import { loadLastActiveLevel } from '@/lib/last-active-level'
import { lessonsHref, levelHref, modeHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { teacherFirstName } from '@/lib/teacher-portraits'
import TodayPlan, { type TodayItem } from '@/components/dashboard/home/TodayPlan'
import MailboxPreview from '@/components/dashboard/home/MailboxPreview'
import TrainerStatusTiles from '@/components/dashboard/TrainerStatusTiles'
import SupportWidget from '@/components/dashboard/home/SupportWidget'
import LevelCard from '@/components/dashboard/home/LevelCard'
import AuthStatusMessage from '@/components/auth/AuthStatusMessage'
import { authStatusMessage, authTranslations, createAuthTranslator } from '@/lib/auth-i18n'
import { parseAuthStatus } from '@/lib/types/auth'

const CONTINUE_TO = { vocabulary: 'continue_to_vocabulary', path: 'continue_to_path', pronunciation: 'continue_to_pronunciation', media: 'continue_to_media' } as const

export default async function DashboardPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { lang } = await params
  const confirmed = parseAuthStatus((await searchParams)?.status) === 'confirm_success'
  const supabase = await createClient()
  const [{ data: { user } }, progressMap, unseenFeedback, dict, lastActive] = await Promise.all([
    supabase.auth.getUser(), getAllLevelsProgress(), getUnseenFeedbackSummary(), getDictionary(lang), loadLastActiveLevel(),
  ])
  const [accessProfile, profileRow] = user
    ? await Promise.all([
        loadLevelAccessProfile(supabase, user.id),
        supabase.from('profiles').select('person:people(display_name)').eq('id', user.id).single(),
      ])
    : [null, null]

  const t = createDashboardTranslator(dict.dashboard as DashboardTranslations)
  const auth = createAuthTranslator(authTranslations(dict))
  const s = studentTranslator(lang)
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
  // Das zuletzt gelernte Niveau entscheidet PostgreSQL (Migration 32). Nur wenn
  // die Abfrage scheitert, gilt der alte Rückfall: erstes angefangenes Niveau.
  const recommended = accessible.find(level => level.id === lastActive?.level)
    || accessible.find(level => (progressMap[level.id] || 0) > 0 && (progressMap[level.id] || 0) < 100) || accessible.find(level => (progressMap[level.id] || 0) < 100) || accessible[0]

  // Kalender, Buchung, Lernstand und Lerntage sind unabhängige Zusätze: Ein
  // Ladefehler darf die Startseite nie mitreißen (wie auf der Profilseite).
  const [monthly, calendar, status, week] = user ? await Promise.all([
    loadProfileMonthlyState(supabase, user).catch(() => { console.error('[dashboard] Course plan could not be loaded'); return null }),
    loadProfileCourseCalendar(supabase, user).catch(() => { console.error('[dashboard] Course calendar could not be loaded'); return null }),
    recommended ? loadLevelLearningStatus({ supabase, userId: user.id, profile: accessProfile, level: recommended.id, lang }) : Promise.resolve(null),
    loadWeekActivity(supabase, user.id),
  ]) : [null, null, null, null]

  const levelBase = recommended ? levelHref(lang, recommended.id) : null
  const items: TodayItem[] = []
  const vocabulary = status?.vocabulary
  if (levelBase && vocabulary && !vocabulary.locked) {
    if (vocabulary.due > 0) items.push({ kind: 'vocabulary', label: s.count('today_vocab', vocabulary.due), href: `${levelBase}/vocabulary`, actionable: true })
    // Lektionen werden im Modus Vokabeln unter „Lektionen" eingeschaltet — dorthin führt die Einrichtung.
    else if (vocabulary.total > 0 && vocabulary.activeWords + vocabulary.learned === 0) items.push({ kind: 'vocabulary', label: s('today_vocab_setup'), href: lessonsHref(lang, recommended!.id), actionable: true })
  }
  if (unseenFeedback.count > 0 && unseenFeedback.latestLevel) {
    const name = teacherFirstName(unseenFeedback.latest?.senderName) ?? s('teacher_fallback')
    items.push({ kind: 'feedback', label: s.count('today_feedback', unseenFeedback.count, { name }),
      href: `/${lang}/dashboard/level/${encodeURIComponent(unseenFeedback.latestLevel)}/pronunciation?tab=mailbox`, actionable: true })
  }
  const grammar = status?.grammar
  if (levelBase && grammar && !grammar.locked && grammar.openTopics > 0) {
    items.push({ kind: 'grammar', label: s.count('today_grammar', grammar.openTopics), href: modeHref(lang, recommended!.id, 'path'), actionable: true })
  }
  const next = nextUpcomingEvent(calendar)
  if (next) {
    const { event, relation } = next
    items.push({ kind: 'course', actionable: false, href: `/${lang}/dashboard/calendar`,
      label: relation === 'today' ? s('today_course_today', { time: event.startTime })
        : relation === 'tomorrow' ? s('today_course_tomorrow', { time: event.startTime })
          : s('today_course_date', { date: formatCalendarDate(event.date, lang, { weekday: 'long', day: 'numeric', month: 'long' }), time: event.startTime }) })
  }
  if (monthly && (monthly.source === 'empty' || monthly.source === 'unresolved')) {
    items.push({ kind: 'booking', actionable: false, href: `/${lang}/dashboard/calendar#booking`,
      label: s('today_booking', { month: formatProfileMonth(monthly.targetMonth, lang) }) })
  }

  // „Zum Lernpfad" bzw. zum zuletzt genutzten Modus dieses Niveaus; ist er
  // gesperrt, führt der Knopf zur Übersicht des Niveaus.
  const lastMode = lastActive?.levels.find(entry => entry.level === recommended?.id)?.mode ?? null
  const continueMode = lastMode ?? 'path'
  const areasContinue = recommended
    ? modeLock(accessProfile, recommended.id, lang, continueMode) === null
      ? { href: modeHref(lang, recommended.id, continueMode), label: s(CONTINUE_TO[continueMode]) }
      : { href: levelHref(lang, recommended.id), label: s('continue_to_level', { level: recommended.id }) }
    : undefined

  const supportLabels = {
    whatsapp: copy.support_whatsapp,
    phone: dict.Footer.Contact.phone,
    phoneLabel: dict.Footer.Contact.phone_label,
    telegram: dict.Footer.Contact.telegram_button,
    email: dict.Footer.Contact.email,
    emailLabel: dict.Footer.Contact.email_button,
  }

  return <div className="space-y-8">
    {confirmed && <AuthStatusMessage status="confirm_success" title={auth('signup_thanks')} message={authStatusMessage(auth, 'confirm_success')} />}
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-7">
        <TodayPlan lang={lang} name={displayName} items={items} fallbackHref={levelBase} week={week} noLevel={!recommended} />
      </div>
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
        <MailboxPreview summary={unseenFeedback} lang={lang} translations={dict.pronunciation as PronunciationTranslations} />
        {recommended && <TrainerStatusTiles lang={lang} level={recommended.id} status={status} languageLocked={lang === 'de'}
          title={s('areas_title_level', { level: recommended.id })} continueLink={areasContinue} />}
      </div>
    </div>

    <section aria-labelledby="academy-levels-title">
      <div className="academy-level-heading"><h2 id="academy-levels-title">{copy.dashboard_levels}</h2><span>A1—B1</span></div>
      <div className="academy-level-grid">
        {levels.map((level, index) => <LevelCard key={level.id} id={level.id} title={level.title} description={level.description}
          index={index} href={`/${lang}/dashboard/level/${level.id}`} locked={!hasLevelAccess(accessProfile, level.id)}
          progress={Math.max(0, Math.min(100, progressMap[level.id] || 0))}
          copy={{ start: t('start'), continueLearning: t('continue_learning'), lockedHint: t('level_locked_hint') }} />)}
      </div>
    </section>

    <SupportWidget lang={lang} labels={supportLabels} />
  </div>
}
