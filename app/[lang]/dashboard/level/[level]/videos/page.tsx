import Link from 'next/link'
import { ArrowLeft, BookOpenCheck, ExternalLink, PlayCircle } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createVideoTranslator, type VideoTranslations } from '@/lib/videos-i18n'
import { stripLessonPrefix } from '@/lib/utils'
import type { Database } from '@/supabase/database.types'

type VideoRow = Database['public']['Tables']['videos']['Row']

export default async function VideosOverviewPage({
  params,
}: {
  params: Promise<{ lang: string; level: string }>
}) {
  const { lang, level } = await params
  const decodedLevel = decodeURIComponent(level)
  const levelSegment = encodeURIComponent(decodedLevel)
  const dict = await getDictionary(lang)
  const t = createVideoTranslator((dict.videos ?? {}) as VideoTranslations)
  const levelHref = `/${lang}/dashboard/level/${levelSegment}`

  let videos: VideoRow[] = []

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('level', decodedLevel)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Videos konnten nicht geladen werden:', error.message)
    } else {
      videos = data ?? []
    }
  } catch (err) {
    console.error('Videos konnten nicht geladen werden:', err)
  }

  const internalVideos = videos.filter((video) => !video.is_external)
  const externalVideos = videos.filter((video) => Boolean(video.is_external && video.external_url))

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl space-y-10 py-8">
      <Link
        href={levelHref}
        className="inline-flex min-h-12 items-center gap-2 text-lg font-medium text-[var(--violet)] transition-colors hover:text-[var(--violet)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
      >
        <ArrowLeft size={24} aria-hidden="true" /> {t('back_to_level')}
      </Link>

      <section className="rounded-3xl bg-[var(--surface)] p-5 shadow-sm ring-1 ring-[var(--border)] sm:p-8">
        <h1 className="mb-2 break-words text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
          {t('internal_title')}
        </h1>
        <p className="mb-8 text-lg leading-relaxed text-[var(--muted)]">
          {t('internal_subtitle')}
        </p>

        {internalVideos.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-muted)] py-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--surface-muted)]">
              <BookOpenCheck className="h-10 w-10 text-[var(--violet)]" aria-hidden="true" />
            </div>
            <p className="text-xl font-bold text-[var(--foreground)]">{t('empty_internal')}</p>
            <p className="mx-auto mt-2 max-w-md text-lg text-[var(--muted)]">
              {t('empty_internal_hint')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {internalVideos.map((video) => (
              <Link
                key={video.id}
                href={`/${lang}/dashboard/level/${levelSegment}/videos/${video.id}`}
                className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] transition-all hover:shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
              >
                <div className="relative flex aspect-video items-center justify-center bg-[var(--surface-muted)]">
                  <PlayCircle className="h-16 w-16 text-[var(--muted)] transition-colors group-hover:text-[var(--violet)]" aria-hidden="true" />
                  {!video.video_url && (
                    <span className="absolute top-4 right-4 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold tracking-wide text-amber-800 uppercase">
                      {t('coming_soon')}
                    </span>
                  )}
                </div>
                <div className="min-w-0 p-5 sm:p-6">
                  <div className="mb-1 text-sm font-semibold text-[var(--violet)]">
                    {t('lesson_label', { lesson: stripLessonPrefix(video.lesson) })}
                  </div>
                  <h2 className="mb-2 break-words text-xl font-bold text-[var(--foreground)]">{video.title}</h2>
                  {video.description ? (
                    <p className="break-words text-[var(--muted)]">{video.description}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-[var(--surface-muted)] p-5 shadow-sm ring-1 ring-[var(--violet)] sm:p-8">
        <div className="mb-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <h2 className="break-words text-xl font-bold text-[var(--violet)] sm:text-2xl">
            {t('external_title')}
          </h2>
          <span className="rounded bg-[var(--surface-muted)] px-2 py-1 text-xs font-bold text-[var(--violet)]">
            {t('external_badge')}
          </span>
        </div>
        <p className="mb-8 text-lg leading-relaxed text-[var(--violet)]">
          {t('external_subtitle')}
        </p>

        {externalVideos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--violet)] bg-[var(--surface)] py-10 text-center">
            <p className="text-lg text-[var(--violet)]">{t('empty_external')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {externalVideos.map((video) => (
              <a
                key={video.id}
                href={video.external_url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('open_external_aria', { title: video.title })}
                className="group flex min-h-16 flex-col gap-4 rounded-2xl border border-[var(--violet)] bg-[var(--surface)] p-5 shadow-sm transition-all hover:shadow-md focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] sm:flex-row sm:items-center sm:justify-between sm:p-6"
              >
                <div className="min-w-0">
                  <div className="mb-1 text-sm font-semibold text-[var(--violet)]">
                    {t('lesson_label', { lesson: stripLessonPrefix(video.lesson) })}
                  </div>
                  <h3 className="break-words text-xl font-bold text-[var(--foreground)] transition-colors group-hover:text-[var(--violet)]">
                    {video.title}
                  </h3>
                  {video.description ? (
                    <p className="mt-1 break-words text-[var(--muted)]">{video.description}</p>
                  ) : null}
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[var(--violet)] transition-colors group-hover:bg-[var(--violet)] group-hover:text-[var(--surface)]">
                  <ExternalLink size={24} aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
