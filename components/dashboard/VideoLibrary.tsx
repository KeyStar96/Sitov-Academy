'use client'

import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, Clapperboard, FileText, Globe, Play } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import MediaAssetViewer from './MediaAssetViewer'
import { createVideoTranslator, type VideoTranslations } from '@/lib/videos-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { formatCalendarDate } from '@/lib/profile-course-calendar'
import type { MediaAsset } from '@/lib/media'
import { youtubeWatchUrl } from '@/lib/video-links'
import type { LibraryGroup, LibraryLink } from '@/lib/media-library'

const PROGRESS_KEY = 'sitov:media-progress'
const FRESH_DAYS = 14

type Progress = Record<string, { t: number; d: number; at: number }>

function readProgress(): Progress {
  try { return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}') as Progress } catch { return {} }
}
function writeProgress(progress: Progress) {
  try { window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)) } catch { /* nur Bequemlichkeit */ }
}
function isFresh(date: string | null | undefined) {
  return !!date && Date.now() - Date.parse(date) < FRESH_DAYS * 86_400_000
}
/** Pro Medium ein ruhiger, gleichbleibender Farbton für die Vorschau. */
function hue(id: string) {
  let value = 0
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) % 360
  return value
}
function fileBadge(asset: MediaAsset) {
  const extension = asset.path.split('.').pop()?.toUpperCase() ?? ''
  return extension === 'PDF' || extension === 'PPTX' || extension === 'KEY' ? extension : asset.mime === 'application/pdf' ? 'PDF' : extension
}

/**
 * Die Mediathek: Videos und Unterlagen aus dem Unterricht an einem Ort, nach
 * Unterrichtsordnern sortiert. Videos zeigen eine große Vorschau mit Play-
 * Knopf und merken sich (nur in diesem Browser), wo man aufgehört hat —
 * daraus entsteht oben „Weiterschauen". Unterlagen erscheinen als Seite.
 */
export default function VideoLibrary({ groups = [], links = [], lang, level, translations, failed = false }: {
  groups?: LibraryGroup[]
  links?: LibraryLink[]
  lang: string
  level: string
  translations: VideoTranslations
  failed?: boolean
}) {
  const t = createVideoTranslator(translations)
  const s = studentTranslator(lang)
  const [progress, setProgress] = useState<Progress>({})
  const [open, setOpen] = useState<MediaAsset | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => { setProgress(readProgress()) }, [])

  const levelHref = `/${lang}/dashboard/level/${encodeURIComponent(level)}`
  const assets = groups.flatMap(group => group.assets)
  const continueWatching = assets
    .filter(asset => asset.kind === 'videos' && progress[asset.id] && progress[asset.id].t > 5 && progress[asset.id].t < progress[asset.id].d - 10)
    .sort((a, b) => progress[b.id].at - progress[a.id].at).slice(0, 3)
  const videos = assets.filter(asset => asset.kind === 'videos').length + links.length
  const documents = assets.filter(asset => asset.kind === 'presentations').length

  const track = useCallback((id: string, seconds: number, duration: number) => {
    if (!Number.isFinite(duration) || duration <= 0) return
    setProgress(previous => {
      const last = previous[id]
      // Nur alle paar Sekunden speichern — das Video meldet sich viermal pro Sekunde.
      if (last && Math.abs(last.t - seconds) < 4) return previous
      const next = { ...previous, [id]: { t: seconds, d: duration, at: Date.now() } }
      writeProgress(next)
      return next
    })
  }, [])

  function show(asset: MediaAsset) { setOpen(asset); setSheetOpen(true) }

  const tile = (asset: MediaAsset, index: number) => {
    const watched = progress[asset.id]
    const share = watched && watched.d > 0 ? Math.min(1, watched.t / watched.d) : 0
    const isVideo = asset.kind === 'videos'
    return (
      <li key={asset.id} className="st-rise" style={{ '--i': Math.min(index, 8) } as CSSProperties}>
        <button type="button" onClick={() => show(asset)} aria-haspopup="dialog" className="st-media st-press" data-kind={isVideo ? 'video' : 'document'}>
          {isVideo ? (
            <span className="st-media__poster" style={{ '--st-hue': hue(asset.id) } as CSSProperties} aria-hidden="true">
              <Clapperboard size={26} className="st-media__glyph" />
              <span className="st-media__play"><Play size={24} fill="currentColor" /></span>
              {share > 0 && <span className="st-media__watched"><span style={{ width: `${share * 100}%` }} /></span>}
            </span>
          ) : (
            <span className="st-media__paper" aria-hidden="true">
              <span className="st-media__sheet"><span /><span /><span /><span /></span>
              <span className="st-media__badge">{fileBadge(asset)}</span>
            </span>
          )}
          <span className="st-media__body">
            <span className="st-media__kind">
              {isVideo ? s('media_video') : s('media_document')}
              {isFresh(asset.createdAt) && <span className="st-media__new">{s('media_new')}</span>}
            </span>
            <span className="st-media__title">{asset.title}</span>
          </span>
        </button>
      </li>
    )
  }

  if (failed) return <p role="alert" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">{t('error_description')}</p>

  return (
    <div className="mx-auto max-w-6xl space-y-8 text-[var(--foreground)]">
      <header className="st-path-hero sl-glass sl-hero">
        <div className="relative">
          <p className="st-eyebrow !mt-0">{s('areas_level', { level })}</p>
          <h1 className="st-path-hero__title mt-1">{s('media_title')}</h1>
          <p className="st-path-hero__text">{s('media_intro')}</p>
          {(videos > 0 || documents > 0) && <p className="st-path-hero__count">{s('media_count', { videos, documents })}</p>}
        </div>
      </header>

      {continueWatching.length > 0 && (
        <section aria-labelledby="media-continue">
          <h2 id="media-continue" className="st-section-title mb-3">{s('media_continue')}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {continueWatching.map(asset => {
              const watched = progress[asset.id]
              return (
                <li key={asset.id}>
                  <button type="button" onClick={() => show(asset)} aria-haspopup="dialog" className="st-continue st-press">
                    <span className="st-continue__poster" style={{ '--st-hue': hue(asset.id) } as CSSProperties} aria-hidden="true"><Play size={22} fill="currentColor" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="st-media__title">{asset.title}</span>
                      <span className="st-continue__left">{s('media_left', { minutes: Math.max(1, Math.round((watched.d - watched.t) / 60)) })}</span>
                      <span className="st-media__watched st-media__watched--inline"><span style={{ width: `${(watched.t / watched.d) * 100}%` }} /></span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {groups.filter(group => group.assets.length > 0).map(group => (
        <section key={group.id} aria-labelledby={`media-group-${group.id}`}>
          <div className="st-section-head !mb-3">
            <div>
              <h2 id={`media-group-${group.id}`} className="st-section-title">{group.title}</h2>
              {group.createdAt && <p className="st-section-sub">{s('media_added', { date: formatCalendarDate(group.createdAt.slice(0, 10), lang, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>}
            </div>
          </div>
          <ul className="st-media-grid">{group.assets.map(tile)}</ul>
        </section>
      ))}

      {links.length > 0 && (
        <section aria-labelledby="media-links">
          <h2 id="media-links" className="st-section-title mb-3">{s('media_links')}</h2>
          <ul className="st-media-grid">
            {links.map((link, index) => {
              const host = youtubeWatchUrl(link.url) ? 'YouTube' : new URL(link.url).hostname
              return (
                <li key={link.id} className="st-rise" style={{ '--i': Math.min(index, 8) } as CSSProperties}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={t('open_external_aria', { title: link.title })} className="st-media st-press" data-kind="link">
                    <span className="st-media__poster" style={{ '--st-hue': hue(link.id) } as CSSProperties} aria-hidden="true">
                      <Globe size={26} className="st-media__glyph" />
                      <span className="st-media__play"><Play size={24} fill="currentColor" /></span>
                    </span>
                    <span className="st-media__body">
                      <span className="st-media__kind">{host}<ArrowUpRight size={15} aria-hidden="true" /></span>
                      <span className="st-media__title">{link.title}</span>
                      {link.description && <span className="st-media__description">{link.description}</span>}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--muted)]">{t('external_privacy')}</p>
        </section>
      )}

      {assets.length === 0 && links.length === 0 && (
        <section className="st-empty st-empty--hero">
          <Clapperboard className="mx-auto text-[var(--muted)]" size={34} aria-hidden="true" />
          <h2>{t('in_preparation')}</h2>
          <p>{s('media_empty')}</p>
          <Link href={`${levelHref}/vocabulary`} className="st-button st-button--soft st-press mt-6"><BookOpen size={18} aria-hidden="true" />{t('continue_vocabulary')}</Link>
        </section>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={open?.title ?? ''} closeLabel={s('close')} wide
        icon={open?.kind === 'videos' ? <Play size={22} /> : <FileText size={22} />}
        description={open ? `${open.kind === 'videos' ? s('media_video') : `${s('media_document')} · ${fileBadge(open)}`} · ${(open.bytes / 1024 / 1024).toFixed(1)} MiB` : undefined}>
        {open && sheetOpen && (
          <MediaAssetViewer key={open.id} asset={open} lang={lang} bare
            autoOpen={open.kind === 'videos' || open.mime === 'application/pdf'}
            startAt={progress[open.id] && progress[open.id].t < progress[open.id].d - 10 ? progress[open.id].t : 0}
            onTime={(seconds, duration) => track(open.id, seconds, duration)} />
        )}
      </BottomSheet>
    </div>
  )
}
