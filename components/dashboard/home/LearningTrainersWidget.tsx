import Link from 'next/link'
import { ArrowUpRight, BookOpen, Lock, Mic, PenTool, Video } from 'lucide-react'
import { hasLevelAccess, hasTrainerAccess, type LevelAccessProfile, type Trainer } from '@/lib/access/levels'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import { dashboardHomeTranslator } from '@/lib/dashboard-home-i18n'

const CATEGORIES = [
  { id: 'vocabulary', titleKey: 'cat_vocabulary_title', path: 'vocabulary', icon: BookOpen },
  { id: 'exercises', titleKey: 'cat_exercises_title', path: 'exercises', icon: PenTool },
  { id: 'pronunciation', titleKey: 'cat_pronunciation_title', path: 'pronunciation', icon: Mic },
  { id: 'videos', titleKey: 'cat_videos_title', path: 'videos', icon: Video },
] as const

/**
 * Schnellzugriff auf die vier Lern-Trainer (Vokabeln, Grammatik, Aussprache,
 * Videos) für das empfohlene Niveau. Sperrlogik spiegelt `LevelTrainerCards`:
 * die deutschsprachige Oberfläche benötigt zuvor eine Lernsprache.
 */
export default function LearningTrainersWidget({ lang, level, profile, translations, className = '' }: {
  lang: string
  level: string | null
  profile: LevelAccessProfile | null
  translations: DashboardTranslations
  className?: string
}) {
  const t = createDashboardTranslator(translations)
  const home = dashboardHomeTranslator(lang)
  const languageLocked = lang === 'de'

  return (
    <section aria-labelledby="dashboard-trainers-title" className={`flex min-w-0 flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-7 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="dashboard-trainers-title" className="text-xl font-bold text-[var(--foreground)]">{home('trainers_title')}</h2>
        <Link href={`/${lang}/dashboard`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-base font-semibold text-[var(--violet)] underline underline-offset-4 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]">
          {home('trainers_all')}<ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <p className="mt-2 text-base leading-relaxed text-[var(--muted)]">
        {level ? home('trainers_intro', { level }) : home('trainers_no_level')}
      </p>
      {level && (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CATEGORIES.map(cat => {
            const locked = cat.id === 'videos'
              ? !hasLevelAccess(profile, level)
              : languageLocked || !hasTrainerAccess(profile, level, cat.id as Trainer)
            const content = (
              <>
                <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${locked ? 'bg-[var(--surface-muted)] text-[var(--muted)]' : 'bg-[var(--surface-muted)] text-[var(--violet)]'}`}>
                  {locked ? <Lock size={26} aria-hidden="true" /> : <cat.icon size={26} aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-lg font-bold leading-snug text-[var(--foreground)]">{t(cat.titleKey)}</span>
                  <span className={`mt-1 flex items-center gap-1.5 text-base font-semibold ${locked ? 'text-[var(--muted)]' : 'text-[var(--violet)]'}`}>
                    {locked ? <><Lock size={15} aria-hidden="true" />{home('trainer_locked')}</> : <>{home('trainer_open')}<ArrowUpRight size={16} aria-hidden="true" /></>}
                  </span>
                </span>
              </>
            )
            if (locked) {
              return (
                <div key={cat.id} aria-disabled="true" className="flex min-h-20 min-w-0 items-center gap-4 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4">
                  {content}
                </div>
              )
            }
            return (
              <Link key={cat.id} href={`/${lang}/dashboard/level/${level}/${cat.path}`}
                className="flex min-h-20 min-w-0 items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--violet)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]">
                {content}
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
