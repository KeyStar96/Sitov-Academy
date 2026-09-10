'use client'

import Link from 'next/link'
import { BookOpen, Video, Mic, PenTool, Lock } from 'lucide-react'
import { hasTrainerAccess, type LevelAccessProfile } from '@/lib/access/levels'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'

const CATEGORIES = [
  {
    id: 'vocabulary',
    titleKey: 'cat_vocabulary_title',
    descKey: 'cat_vocabulary_desc',
    icon: BookOpen,
    color: 'vocabulary-phase-new',
    path: 'vocabulary',
  },
  {
    id: 'exercises',
    titleKey: 'cat_exercises_title',
    descKey: 'cat_exercises_desc',
    icon: PenTool,
    color: 'vocabulary-phase-review',
    path: 'exercises',
  },
  {
    id: 'pronunciation',
    titleKey: 'cat_pronunciation_title',
    descKey: 'cat_pronunciation_desc',
    icon: Mic,
    color: 'vocabulary-phase-secure',
    path: 'pronunciation',
  },
  {
    id: 'videos',
    titleKey: 'cat_videos_title',
    descKey: 'cat_videos_desc',
    icon: Video,
    color: 'vocabulary-phase-review',
    path: 'videos',
  },
] as const

export default function LevelTrainerCards({ lang, level, profile, translations }: {
  lang: string; level: string; profile: LevelAccessProfile | null; translations: DashboardTranslations
}) {
  const t = createDashboardTranslator(translations)
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {CATEGORIES.map((cat) => {
          const locked = !hasTrainerAccess(profile, decodeURIComponent(level), cat.id)
          const content = <>
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${locked ? 'bg-[var(--surface-muted)] text-[var(--muted)]' : cat.color}`}>
              {locked ? <Lock size={32} aria-hidden="true" /> : <cat.icon size={32} aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <h2 className="mb-2 break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">{t(cat.titleKey)}</h2>
              <p className="text-base leading-relaxed text-[var(--muted)] sm:text-lg">{locked ? t('trainer_locked_text', { level: decodeURIComponent(level) }) : t(cat.descKey)}</p>
              {locked && <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 font-semibold text-[var(--foreground)]"><Lock size={16} aria-hidden="true" />{t('trainer_locked_badge')}</span>}
            </div>
          </>
          if (locked) return <article key={cat.id} aria-disabled="true" className={`${cat.id === 'videos' ? 'md:col-span-3' : ''} flex min-w-0 flex-col items-start gap-6 rounded-3xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-5 sm:p-6`}>{content}</article>
          return (
          <Link
            key={cat.id}
            href={`/${lang}/dashboard/level/${level}/${cat.path}`}
            className={`${cat.id === 'videos' ? 'md:col-span-3 bg-[var(--surface-muted)]' : ''} group flex min-w-0 min-h-[5.5rem] flex-col items-start gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-colors hover:border-[var(--violet)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:flex-col sm:items-start sm:gap-6 sm:p-6`}
          >
            {content}
          </Link>
        )})}
      </div>
    </div>
  )
}
