'use client'

import { useState } from 'react'
import { ArrowUpRight, Globe, Loader2, Pencil, Trash2, Video } from 'lucide-react'
import { deleteMediaLink } from '@/app/actions/media'
import { mediaCopy } from '@/lib/media-i18n'
import { youtubeWatchUrl } from '@/lib/video-links'
import type { MediaLink } from '@/lib/media'
import VideoVisibilityToggle from './VideoVisibilityToggle'

function hostOf(url: string, website: string) {
  if (youtubeWatchUrl(url)) return 'YouTube'
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return website }
}

/** Ein Link in den Lernmedien: öffnen, bearbeiten, sichtbar schalten, entfernen. */
export default function MediaLinkCard({ link, lang, level, onEdit, onChanged }: {
  link: MediaLink
  lang: string
  level?: string
  onEdit: () => void
  onChanged: () => Promise<void>
}) {
  const t = mediaCopy(lang)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const isYouTube = !!youtubeWatchUrl(link.url)
  const Icon = isYouTube ? Video : Globe

  async function remove() {
    if (busy || !window.confirm(t.confirmRemove)) return
    setBusy(true); setFailed(false)
    try {
      const result = await deleteMediaLink({ video_id: link.id })
      if (!result.success) throw new Error('delete_failed')
      await onChanged()
    } catch { setFailed(true) } finally { setBusy(false) }
  }

  const button = 'inline-flex min-h-12 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium disabled:opacity-50'
  return <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon size={20} /></span>
      <div className="min-w-0 flex-1">
        <h4 className="break-words font-semibold">{link.title}</h4>
        <p className="truncate text-sm text-[var(--muted)]">{level && <span className="font-semibold">{level} · </span>}{hostOf(link.url, t.website)}</p>
        {link.description && <p className="mt-1 break-words text-sm text-[var(--muted)]">{link.description}</p>}
      </div>
    </div>
    <VideoVisibilityToggle id={link.id} title={link.title} isActive={link.isActive} lang={lang} onChanged={onChanged} />
    <div className="flex flex-wrap gap-2">
      <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`${t.open}: ${link.title}`} className={button}><ArrowUpRight size={16} aria-hidden="true" />{t.open}</a>
      <button type="button" disabled={busy} onClick={() => void remove()} aria-label={`${t.remove}: ${link.title}`} className="inline-flex h-12 w-12 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)] disabled:opacity-50">{busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button>
      <button type="button" disabled={busy} onClick={onEdit} aria-label={`${t.editLink}: ${link.title}`} className={button}><Pencil size={16} aria-hidden="true" />{t.editLink}</button>
    </div>
    {failed && <p role="alert" className="text-sm">{t.failed}</p>}
  </article>
}
