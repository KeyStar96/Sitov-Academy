import Link from 'next/link'
import { ArrowLeft, Play } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getDictionary } from '@/lib/dictionary'
import { createVideoTranslator, type VideoTranslations } from '@/lib/videos-i18n'
import { stripLessonPrefix } from '@/lib/utils'
import VideoPlayer from '@/components/dashboard/VideoPlayer'

export default async function VideoPlayerPage({
  params,
}: {
  params: Promise<{ lang: string; level: string; id: string }>
}) {
  const { lang, level, id } = await params
  const decodedLevel = decodeURIComponent(level)
  const levelSegment = encodeURIComponent(decodedLevel)
  const overviewHref = `/${lang}/dashboard/level/${levelSegment}/videos`
  const dict = await getDictionary(lang)
  const t = createVideoTranslator((dict.videos ?? {}) as VideoTranslations)

  let videoTitle = ''
  let videoLesson = ''
  let videoDescription: string | null = null
  let videoUrl: string | null = null
  let found = false
  let externalUrl: string | null = null

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.from('videos').select('*').eq('id', id).maybeSingle()

    if (error) {
      console.error('Video konnte nicht geladen werden:', error.message)
    } else if (data) {
      if (data.is_external && data.external_url) {
        externalUrl = data.external_url
      } else {
        found = true
        videoTitle = data.title
        videoLesson = data.lesson
        videoDescription = data.description
        videoUrl = data.video_url
      }
    }
  } catch (err) {
    console.error('Video konnte nicht geladen werden:', err)
  }

  if (externalUrl) {
    redirect(externalUrl)
  }

  if (!found) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl bg-[var(--surface)] p-8 text-center shadow-sm ring-1 ring-[var(--border)] sm:p-12">
        <h1 className="mb-4 text-2xl font-bold text-[var(--foreground)] sm:text-3xl">{t('not_found')}</h1>
        <Link
          href={overviewHref}
          className="inline-flex min-h-12 items-center gap-2 text-lg font-medium text-[var(--violet)] hover:text-[var(--violet)]"
        >
          <ArrowLeft size={24} aria-hidden="true" /> {t('back_to_level')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={overviewHref}
        className="mb-6 inline-flex min-h-12 items-center gap-2 text-lg font-medium text-[var(--violet)] transition-colors hover:text-[var(--violet)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
      >
        <ArrowLeft size={24} aria-hidden="true" /> {t('back_to_level')}
      </Link>

      <div className="overflow-hidden rounded-3xl bg-[var(--surface)] shadow-xl ring-1 ring-[var(--border)]">
        {videoUrl ? (
          <VideoPlayer
            src={videoUrl}
            labels={{
              rewindAria: t('rewind_aria'),
              forwardAria: t('forward_aria'),
              playAria: t('play_aria'),
              pauseAria: t('pause_aria'),
              speedAria: t('speed_aria', { speed: '{speed}' }),
            }}
          />
        ) : (
          <div className="relative flex aspect-video items-center justify-center bg-black">
            <div className="p-6 text-center sm:p-8">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-yellow-500/20">
                <Play className="h-12 w-12 text-yellow-500" aria-hidden="true" />
              </div>
              <h2 className="mb-4 text-2xl font-bold text-white sm:text-3xl">{t('in_preparation')}</h2>
              <p className="text-lg text-[var(--muted)] sm:text-xl">{t('in_preparation_hint')}</p>
            </div>
          </div>
        )}

        <div className="p-6 sm:p-10">
          <div className="mb-2 text-lg font-bold text-[var(--violet)]">
            {t('lesson_label', { lesson: stripLessonPrefix(videoLesson) })}
          </div>
          <h1 className="mb-4 break-words text-2xl font-extrabold text-[var(--foreground)] sm:text-4xl">
            {videoTitle}
          </h1>
          {videoDescription ? (
            <p className="text-lg leading-relaxed break-words text-[var(--muted)] sm:text-xl">
              {videoDescription}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
