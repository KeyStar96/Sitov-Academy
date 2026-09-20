import MediaAssetViewer from './MediaAssetViewer'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, Play, Video } from 'lucide-react'
import { createVideoTranslator, type VideoTranslations } from '@/lib/videos-i18n'
import { learningResourceUrl, youtubeWatchUrl, type VideoRecord } from '@/lib/video-links'

interface Props { videos: VideoRecord[]; lang: string; level: string; translations: VideoTranslations; failed?: boolean }

export default function VideoLibrary({ videos, lang, level, translations, failed = false }: Props) {
  const t = createVideoTranslator(translations)
  const levelHref = `/${lang}/dashboard/level/${encodeURIComponent(level)}`
  const uploads = videos.filter(video => video.is_active && video.storage_path && video.file_size)
  const links = videos.flatMap(video => {
    const url = video.is_active && !video.storage_path ? learningResourceUrl(video.source_url) : null
    return url ? [{ ...video, url }] : []
  })
  return <div className="mx-auto max-w-5xl space-y-8 text-[var(--foreground)]">
    {!failed && uploads.length > 0 && <section className="grid gap-4 md:grid-cols-2">{uploads.map(video => <MediaAssetViewer key={video.id} lang={lang} asset={{ id: video.id, title: video.title, path: video.storage_path!, bytes: video.file_size!, mime: video.storage_path!.endsWith('.webm') ? 'video/webm' : 'video/mp4', kind: 'videos' }} />)}</section>}
    {failed ? <p role="alert" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">{t('error_description')}</p> : links.length ? <section className="space-y-3">
      {links.map((video, index) => <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={t('open_external_aria', { title: video.title })}
        className="group flex min-h-24 items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--violet)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--violet)] sm:gap-6 sm:p-6">
        <span className="hidden text-xl font-medium tabular-nums text-[var(--muted)] sm:block">{String(index + 1).padStart(2, '0')}</span>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--violet)]"><Play size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="text-base font-medium text-[var(--muted)]">{video.level} · {youtubeWatchUrl(video.url) ? 'YouTube' : new URL(video.url).hostname}</p><h2 className="mt-1 break-words text-lg font-semibold">{video.title}</h2>{video.description && <p className="mt-2 break-words text-base leading-relaxed text-[var(--muted)]">{video.description}</p>}<span className="mt-3 inline-flex min-h-12 items-center gap-2 text-base font-semibold text-[var(--violet)]">{t(youtubeWatchUrl(video.url) ? 'watch_youtube' : 'watch_resource')}<ArrowUpRight size={16} aria-hidden="true" /></span></div>
      </a>)}
    </section> : uploads.length ? null : <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--muted)]"><Video size={25} aria-hidden="true" /></div>
      <p className="mt-7 text-base font-semibold tracking-widest text-[var(--muted)] uppercase">{t('in_preparation')}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">{t('empty_internal')}</h2>
      <p className="mt-4 max-w-xl leading-relaxed text-[var(--muted)]">{t('empty_internal_hint')}</p>
      <Link href={`${levelHref}/vocabulary`} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-5 text-base font-semibold"><BookOpen size={18} aria-hidden="true" />{t('continue_vocabulary')}</Link>
    </section>}
    {links.length > 0 && <p className="max-w-2xl text-base leading-relaxed text-[var(--muted)]">{t('external_privacy')}</p>}
  </div>
}
