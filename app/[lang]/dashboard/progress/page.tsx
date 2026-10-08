import { redirect } from 'next/navigation'
import { getMyLearningProgress } from '@/app/actions/learning-progress'
import { getDictionary } from '@/lib/dictionary'
import { requestSession } from '@/lib/request-session'
import { sitovLearningSourceLocale } from '@/lib/access/sitov-learning-source'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { ACCESS_LEVELS, hasLevelAccess, hasTrainerAccess } from '@/lib/access/levels'
import { loadLastActiveLevel } from '@/lib/last-active-level'
import StudentProgress from '@/components/progress/StudentProgress'
import SitovProgressHeader from '@/components/progress/SitovProgressHeader'
import { getExamState } from '@/app/actions/exam-preparation'
import { getPublicExamCatalog } from '@/lib/exam-preparation/server'
import ExamProgressCard from '@/components/exam-preparation/ExamProgressCard'

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
  const levels = ACCESS_LEVELS.filter(level => hasLevelAccess(access, level))
  const focusLevels = sitovLearningSourceLocale(lang, access?.native_language)
    ? levels.filter(level => hasTrainerAccess(access, level, 'vocabulary')) : []
  const focusLevel = focusLevels.find(level => level === lastActive?.level) ?? focusLevels[0] ?? null
  const exam = levels.some(level => level.startsWith('B1.')) ? await Promise.all([getExamState(),getPublicExamCatalog()]).catch(()=>null) : null
  return <div className="space-y-6">
    <SitovProgressHeader lang={lang} />
    <StudentProgress initial={initial.success ? initial.data : null} levels={levels} lang={lang} translations={dict.vocabulary ?? {}} focusLevel={focusLevel} focusLevels={focusLevels} />
    {exam && <ExamProgressCard lang={lang} state={exam[0]} modules={exam[1].modules} workshops={exam[1].workshops} />}
  </div>
}
