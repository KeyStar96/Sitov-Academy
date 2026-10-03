import Link from 'next/link'
import { notFound } from 'next/navigation'
import TodayPlan, { type TodayItem } from '@/components/dashboard/home/TodayPlan'
import ProgressTeaser from '@/components/dashboard/home/ProgressTeaser'
import LevelCard from '@/components/dashboard/home/LevelCard'
import SupportWidget from '@/components/dashboard/home/SupportWidget'
import SitovPreviewAppearance from '@/components/dashboard/SitovPreviewAppearance'
import LearningProgressView from '@/components/progress/LearningProgressView'
import SitovProgressHeader from '@/components/progress/SitovProgressHeader'
import MotionProvider from '@/components/motion/MotionProvider'
import { getDictionary } from '@/lib/dictionary'
import { createDashboardTranslator } from '@/lib/dashboard-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { learningProgressSchema, progressRangeFrom, type LearningProgress, type ProgressDay } from '@/lib/learning-progress'
import '@/components/dashboard/student.css'

function sitovProgress(days: number, empty: boolean): LearningProgress {
  const today = '2026-10-03'
  const end = new Date(`${today}T12:00:00Z`)
  const daily: ProgressDay[] = Array.from({ length: days }, (_, index) => {
    const date = new Date(end.getTime() - (days - index - 1) * 86400000).toISOString().slice(0, 10)
    const active = !empty && (index % 5 !== 1 || index === days - 1)
    const answers = active ? 12 + index % 17 : 0
    const pathAnswers = active ? 3 + index % 6 : 0
    return {
      date,
      vocabulary: { answers, correct: Math.floor(answers * .85), learned: active ? 2 : 0, seconds: active ? 260 + index * 9 : 0 },
      focus: { answers: active ? 4 : 0, correct: active ? 3 : 0 },
      path: { answers: pathAnswers, correct: Math.floor(pathAnswers * .9), stations: active ? 1 : 0, seconds: active ? 140 : 0 },
      pronunciation: { recordings: active && index % 3 === 0 ? 1 : 0, replies: active && index % 4 === 0 ? 1 : 0, seconds: active && index % 3 === 0 ? 120 : 0 },
      media: { views: active && index % 4 === 0 ? 1 : 0 },
    }
  })
  return learningProgressSchema.parse({
    studentId: '00000000-0000-4000-8000-000000000001', level: null, days, today, timezone: 'Europe/Berlin', daily,
    vocabulary: { totalWords: 240, inBox: empty ? 0 : 128, learnedWords: empty ? 0 : 87, learnedTotal: empty ? 0 : 190, overallPercent: empty ? 0 : 58,
      buckets: [1, 2, 3, 4, 5, 6, 'learned'].map((key, index) => ({ key, count: empty ? 0 : [18, 26, 32, 24, 16, 12, 87][index] })) },
    focus: { active: 0, due: 0, mastered: 0, articleWords: 0, words: [] },
    path: { totalStations: 60, completedStations: empty ? 0 : 24, totalUnits: 8, completedUnits: empty ? 0 : 3,
      tests: empty ? [] : [{ completedAt: '2026-10-02T12:00:00Z', percentage: 88, passed: true, title: 'Artikel-Test' }] },
    pronunciation: { totalTexts: 18, practicedTexts: empty ? 0 : 8, recordings: empty ? 0 : 14, awaitingReply: empty ? 0 : 1 },
    media: { totalMedia: 20, viewedMedia: empty ? 0 : 7, recent: empty ? [] : [{ kind: 'video', title: 'Ein Tag in Hannover', viewedAt: '2026-10-02T12:00:00Z', views: 2 }] },
  })
}

/** Isolated visual QA with synthetic data; never available in production. */
export default async function SitovHomeMotionPreviewPage({ params, searchParams }: {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ state?: string; days?: string }>
}) {
  if (process.env.NODE_ENV !== 'development') notFound()
  const [{ lang }, query] = await Promise.all([params, searchParams])
  const dict = await getDictionary(lang)
  const t = createDashboardTranslator(dict.dashboard)
  const s = studentTranslator(lang)
  const empty = query.state === 'empty'
  const noLevel = query.state === 'no-access'
  const days = progressRangeFrom(query.days)
  const progress = sitovProgress(days, empty || noLevel)
  const base = `/${lang}/dashboard/level/A1.1`
  const items: TodayItem[] = noLevel ? [] : query.state === 'done' ? [] : [
    { kind: 'vocabulary', label: empty ? s('today_vocab_setup') : s.count('today_vocab', 24), href: `${base}/vocabulary`, actionable: true },
    { kind: 'booking', label: s('today_booking', { month: new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(new Date('2026-11-01T12:00:00Z')) }), href: `/${lang}/dashboard/calendar`, actionable: false },
  ]
  const week = {
    days: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    learned: empty || noLevel ? ['2026-10-03'] : ['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-03'],
    today: '2026-10-03',
  }
  const levels = [
    { id: 'A1.1', title: dict.dashboard.level_a11_title, description: dict.dashboard.level_a11_desc },
    { id: 'A1.2', title: dict.dashboard.level_a12_title, description: dict.dashboard.level_a12_desc },
    { id: 'A2.1', title: dict.dashboard.level_a21_title, description: dict.dashboard.level_a21_desc },
    { id: 'A2.2', title: dict.dashboard.level_a22_title, description: dict.dashboard.level_a22_desc },
    { id: 'B1.1', title: dict.dashboard.level_b11_title, description: dict.dashboard.level_b11_desc },
    { id: 'B1.2', title: dict.dashboard.level_b12_title, description: dict.dashboard.level_b12_desc },
  ]
  const support = {
    whatsapp: dict.academy.support_whatsapp, phone: dict.Footer.Contact.phone, phoneLabel: dict.Footer.Contact.phone_label,
    telegram: dict.Footer.Contact.telegram_button, email: dict.Footer.Contact.email, emailLabel: dict.Footer.Contact.email_button,
  }
  const route = `/${lang}/sitov-preview/home-motion`
  return <MotionProvider><div className="academy-student-shell" data-tabbar="hidden">
    <div className="academy-container academy-student-content space-y-8">
      <div className="space-y-3">
        <p className="text-lg font-bold">Sitov Academy · Home motion preview</p>
        <SitovPreviewAppearance />
        <nav aria-label="Preview fixtures" className="flex flex-wrap gap-2">
          {['active', 'empty', 'done', 'no-access'].map(state => <Link key={state} href={`${route}?state=${state}&days=${days}`} className="st-link-pill">{state}</Link>)}
          {[7, 30, 90].map(range => <Link key={range} href={`${route}?state=${query.state ?? 'active'}&days=${range}`} className="st-link-pill">{range} days</Link>)}
        </nav>
      </div>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7"><TodayPlan lang={lang} name="Dennis Kostjuk" items={items} fallbackHref={noLevel ? null : base} week={week} noLevel={noLevel} /></div>
        <div className="min-w-0 lg:col-span-5"><ProgressTeaser progress={progress} lang={lang} focus={null} /></div>
      </div>
      <section aria-labelledby="academy-levels-title">
        <div className="academy-level-heading"><h2 id="academy-levels-title">{dict.academy.dashboard_levels}</h2><span>A1—B1</span></div>
        <div className="academy-level-grid">{levels.map((level, index) => <LevelCard key={level.id} {...level} index={index}
          href={`/${lang}/dashboard/level/${level.id}`} locked={noLevel || index > (empty ? 0 : 1)} progress={empty ? 0 : index === 0 ? 58 : 12}
          fresh={!empty && index === 1} copy={{ start: t('start'), continueLearning: t('continue_learning'), lockedHint: t('level_locked_hint'), newLabel: s('media_new') }} />)}</div>
      </section>
      <SupportWidget lang={lang} labels={support} />
      <section id="sitov-progress-preview" className="space-y-6">
        <SitovProgressHeader lang={lang} />
        <LearningProgressView progress={progress} lang={lang} skin="student" audience="student" translations={dict.vocabulary ?? {}} />
      </section>
    </div>
  </div></MotionProvider>
}
