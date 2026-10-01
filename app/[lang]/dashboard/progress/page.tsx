import { redirect } from 'next/navigation'
import { getMyLearningProgress } from '@/app/actions/learning-progress'
import { getDictionary } from '@/lib/dictionary'
import { requestSession } from '@/lib/request-session'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { ACCESS_LEVELS, hasLevelAccess } from '@/lib/access/levels'
import { loadLastActiveLevel } from '@/lib/last-active-level'
import { learningProgressCopy } from '@/lib/learning-progress-i18n'
import StudentProgress from '@/components/progress/StudentProgress'

/**
 * „Mein Fortschritt" (Phase 11.3): Tageswerte mit Prozent, Verlauf und je
 * Lernmodus eigene Diagramme – dieselben Zahlen, die auch die Lehrkraft sieht.
 */
export default async function ProgressPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const { supabase, user } = await requestSession()
  if (!user) redirect(`/${lang}/login`)
  const [dict, access, lastActive, initial] = await Promise.all([
    getDictionary(lang), loadLevelAccessProfile(supabase, user.id), loadLastActiveLevel(),
    getMyLearningProgress({ level: null, days: 30 }),
  ])
  const t = learningProgressCopy(lang)
  const levels = ACCESS_LEVELS.filter(level => hasLevelAccess(access, level))
  // Problemwörter gehören zum Vokabeltrainer; der braucht eine andere Oberflächensprache als Deutsch.
  const focusLevel = lang === 'de' ? null : levels.find(level => level === lastActive?.level) ?? levels[0] ?? null
  return <div className="space-y-6">
    <header>
      <h1 className="st-path-hero__title">{t('student_title')}</h1>
      <p className="mt-1 text-lg text-[var(--muted)]">{t('student_intro')}</p>
    </header>
    <StudentProgress initial={initial.success ? initial.data : null} levels={levels} lang={lang} translations={dict.vocabulary ?? {}} focusLevel={focusLevel} />
  </div>
}
