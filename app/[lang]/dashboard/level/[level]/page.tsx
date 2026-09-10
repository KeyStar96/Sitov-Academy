import Link from 'next/link'
import { BookOpen, Video, Mic, PenTool, ArrowLeft } from 'lucide-react'
import { getDictionary } from '@/lib/dictionary'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'

const CATEGORIES = [
  {
    id: 'videos',
    titleKey: 'cat_videos_title',
    descKey: 'cat_videos_desc',
    icon: Video,
    color: 'vocabulary-phase-review',
    path: 'videos',
  },
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
] as const

export default async function LevelDashboard({
  params,
}: {
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const dict = await getDictionary(lang)
  const t = createDashboardTranslator((dict.dashboard ?? {}) as DashboardTranslations)

  return (
    <div className="space-y-8">
      <div className="mb-6 flex items-start gap-3 sm:mb-8 sm:items-center sm:gap-4">
        <Link
          href={`/${lang}/dashboard`}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
          aria-label={t('nav_back_aria')}
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-3xl md:text-4xl">
            {t('level_heading', { level: decodedLevel })
              .split(decodedLevel)
              .flatMap((part, index) =>
                index === 0
                  ? [part]
                  : [
                      <span key="level" className="text-[var(--accent)]">
                        {decodedLevel}
                      </span>,
                      part,
                    ]
              )}
          </h1>
          <p className="mt-1 text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            {t('level_subtitle')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={`/${lang}/dashboard/level/${level}/${cat.path}`}
            className="group flex min-w-0 min-h-[5.5rem] flex-col items-start gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-colors hover:border-[var(--violet)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:flex-row sm:items-center sm:gap-6 sm:p-6"
          >
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${cat.color}`}
            >
              <cat.icon size={32} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="mb-1 break-words text-xl font-bold text-[var(--foreground)] transition-colors group-hover:text-[var(--accent)] sm:mb-2 sm:text-2xl">
                {t(cat.titleKey)}
              </h2>
              <p className="text-base leading-relaxed text-[var(--muted)] sm:text-lg">
                {t(cat.descKey)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
