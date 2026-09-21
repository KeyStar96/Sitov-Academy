'use client'

import Link from 'next/link'
import TrainerLanguageRequired from './TrainerLanguageRequired'
import { getTrainerLanguageCopy } from '@/lib/trainer-language-i18n'
import { BookOpen, Video, Mic, PenTool, Lock } from 'lucide-react'
import { hasTrainerAccess, type LevelAccessProfile } from '@/lib/access/levels'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import { hasLevelAccess } from '@/lib/access/levels'
import { mediaCopy } from '@/lib/media-i18n'

const CATEGORIES = [
  {
    id: 'vocabulary',
    titleKey: 'cat_vocabulary_title',
    descKey: 'cat_vocabulary_desc',
    icon: BookOpen,
    path: 'vocabulary',
  },
  {
    id: 'exercises',
    titleKey: 'cat_exercises_title',
    descKey: 'cat_exercises_desc',
    icon: PenTool,
    path: 'exercises',
  },
  {
    id: 'pronunciation',
    titleKey: 'cat_pronunciation_title',
    descKey: 'cat_pronunciation_desc',
    icon: Mic,
    path: 'pronunciation',
  },
  {
    id: 'videos',
    titleKey: 'cat_videos_title',
    descKey: 'cat_videos_desc',
    icon: Video,
    path: 'videos',
  },
] as const

export default function LevelTrainerCards({ lang, level, profile, translations }: {
  lang: string; level: string; profile: LevelAccessProfile | null; translations: DashboardTranslations
}) {
  const t = createDashboardTranslator(translations)
  const languageLocked = lang === 'de'
  const languageCopy = getTrainerLanguageCopy(lang)
  return (
    <div className="space-y-8">
      {languageLocked && <TrainerLanguageRequired lang={lang} />}
      {hasLevelAccess(profile, decodeURIComponent(level)) && <Link href={`/${lang}/dashboard/level/${level}/media`} className="sl-card flex min-h-16 flex-col justify-center gap-2 p-5 pl-6"><span className="text-xl font-semibold">{mediaCopy(lang).title}</span><span className="text-[var(--muted)]">{mediaCopy(lang).intro}</span></Link>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {CATEGORIES.map((cat) => {
          const locked = cat.id === 'videos' ? !hasLevelAccess(profile, decodeURIComponent(level)) : languageLocked || !hasTrainerAccess(profile, decodeURIComponent(level), cat.id)
          const content = <>
            <div className="sl-icon-tile h-16 w-16" data-tone={locked ? 'muted' : undefined}>
              {locked ? <Lock size={32} aria-hidden="true" /> : <cat.icon size={32} aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <h2 className="mb-2 break-words text-xl font-bold text-[var(--foreground)] sm:text-2xl">{t(cat.titleKey)}</h2>
              <p className="text-base leading-relaxed text-[var(--muted)] sm:text-lg">{languageLocked && cat.id !== 'videos' ? languageCopy.locked : locked ? t('trainer_locked_text', { level: decodeURIComponent(level) }) : t(cat.descKey)}</p>
              {locked && <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 font-semibold text-[var(--foreground)]"><Lock size={16} aria-hidden="true" />{t('trainer_locked_badge')}</span>}
            </div>
          </>
          if (locked) return <article key={cat.id} aria-disabled="true" data-disabled="true" className={`${cat.id === 'videos' ? 'md:col-span-3' : ''} sl-card flex flex-col items-start gap-6 rounded-3xl p-5 sm:p-6`}>{content}</article>
          return (
          <Link
            key={cat.id}
            href={`/${lang}/dashboard/level/${level}/${cat.path}`}
            className={`${cat.id === 'videos' ? 'md:col-span-3' : ''} sl-card group flex min-h-[5.5rem] flex-col items-start gap-4 rounded-3xl p-5 pl-6 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:gap-6 sm:p-6 sm:pl-7`}
          >
            {content}
          </Link>
        )})}
      </div>
    </div>
  )
}
