import Link from 'next/link'
import { ArrowUpRight, ChevronRight, Lock, Sparkles } from 'lucide-react'
import { getAllLevelsProgress } from '@/app/actions/progress'
import { getUnseenFeedbackSummary } from '@/app/actions/feedback'
import { getDictionary } from '@/lib/dictionary'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import type { PronunciationTranslations } from '@/lib/pronunciation-i18n'
import { createClient } from '@/utils/supabase/server'
import { loadLevelAccessProfile } from '@/lib/access/server'
import { hasLevelAccess } from '@/lib/access/levels'
import FeedbackNotificationCard from '@/components/dashboard/FeedbackNotificationCard'

export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const supabase = await createClient()
  const [{ data: { user } }, progressMap, unseenFeedback, dict] = await Promise.all([
    supabase.auth.getUser(), getAllLevelsProgress(), getUnseenFeedbackSummary(), getDictionary(lang),
  ])
  const accessProfile = user ? await loadLevelAccessProfile(supabase, user.id) : null
  const t = createDashboardTranslator(dict.dashboard as DashboardTranslations)
  const copy = dict.academy
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
  return <div className="academy-dashboard">
    <FeedbackNotificationCard summary={unseenFeedback} translations={dict.pronunciation as PronunciationTranslations} lang={lang} />
    <section className="academy-next-step"><div><p className="academy-eyebrow"><Sparkles size={16} aria-hidden="true" />{copy.dashboard_recommended}</p><h2>{recommended?.title || copy.learn_title}</h2><p>{recommended?.description || copy.dashboard_no_access}</p>{recommended && <Link className="academy-button academy-button-primary" href={`/${lang}/dashboard/level/${recommended.id}`}>{copy.dashboard_cta}<ArrowUpRight size={19} aria-hidden="true" /></Link>}</div><div className="academy-progress-disc" role="img" aria-label={`${copy.dashboard_progress}: ${progress}%`} style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><span><strong>{progress}%</strong><small>{copy.dashboard_progress}</small></span></div></section>
    <section aria-labelledby="academy-levels-title"><div className="academy-level-heading"><h2 id="academy-levels-title">{copy.dashboard_levels}</h2><span>A1—B1</span></div><div className="academy-level-grid">{levels.map((level, index) => {
      const locked = !hasLevelAccess(accessProfile, level.id)
      const value = Math.max(0, Math.min(100, progressMap[level.id] || 0))
      const content = <><div className="academy-level-top"><span className="academy-level-code">{level.id}</span>{locked ? <Lock size={18} aria-hidden="true" /> : <span className="academy-level-number" aria-hidden="true">0{index + 1}</span>}</div><h3>{level.title}</h3><p>{level.description}</p><div className="academy-level-bottom">{locked ? <span>{t('level_locked_hint')}</span> : <><span>{value > 0 ? t('continue_learning') : t('start')}<ChevronRight size={17} aria-hidden="true" /></span><span>{value}%</span></>}</div>{!locked && <div className="academy-level-track" aria-hidden="true"><span style={{ width: `${value}%` }} /></div>}</>
      return locked ? <article key={level.id} className="academy-level-card academy-level-locked" aria-disabled="true">{content}</article> : <Link key={level.id} href={`/${lang}/dashboard/level/${level.id}`} className="academy-level-card">{content}</Link>
    })}</div></section>
  </div>
}
