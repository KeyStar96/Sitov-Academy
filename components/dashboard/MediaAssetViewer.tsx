'use client'

import { useEffect, useRef, useState } from 'react'
import type { MediaAsset } from '@/lib/media'
import { mediaCopy } from '@/lib/media-i18n'

export default function MediaAssetViewer({ asset, lang, allowVideoDownload = false }: { asset: MediaAsset; lang: string; allowVideoDownload?: boolean }) {
  const t = mediaCopy(lang)
  const canDownload = asset.kind !== 'videos' || allowVideoDownload
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const position = useRef(0)
  const resume = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const viewing = useRef(false)
  function close() { viewing.current = false; generation.current++; setUrl(null); if (timer.current) clearTimeout(timer.current) }
  useEffect(() => () => { viewing.current = false; generation.current++; if (timer.current) clearTimeout(timer.current) }, [])
  async function open(download = false) {
    if (download && !canDownload) return
    if (inFlight.current) {
      if (!download && viewing.current) timer.current = setTimeout(() => { void open() }, 3000)
      return
    }
    inFlight.current = true
    const id = ++generation.current
    setBusy(true); setError(false)
    try {
      const response = await fetch('/api/course-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: asset.path, download }), cache: 'no-store' })
      if (!response.ok) throw new Error('not_available')
      const result = await response.json()
      if (typeof result.url !== 'string' || id !== generation.current) return
      if (download) {
        const a = document.createElement('a'); a.href = result.url; a.download = asset.title; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove()
      } else {
        viewing.current = true
        position.current = video.current?.currentTime ?? 0
        resume.current = !!video.current && !video.current.paused
        setUrl(result.url)
        if (timer.current) clearTimeout(timer.current)
        // Reauthorize an open player periodically; revocation stops the viewer.
        timer.current = setTimeout(() => { void open() }, 45000)
      }
    } catch { if (id === generation.current) { close(); video.current?.pause(); setError(true) } }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <article className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
    <h4 className="break-words font-semibold">{asset.title}</h4>
    <p className="text-sm text-[var(--muted)]">{(asset.bytes / 1024 / 1024).toFixed(1)} MiB</p>
    <div className="flex flex-wrap gap-2">{(asset.kind === 'videos' || asset.mime === 'application/pdf') && <button disabled={busy} onClick={() => url ? close() : void open()} className="min-h-12 rounded-lg border border-[var(--border)] px-4">{url ? t.close : t.open}</button>}
      {canDownload && <button disabled={busy} onClick={() => void open(true)} className="min-h-12 rounded-lg border border-[var(--border)] px-4">{t.download}</button>}</div>
    {busy && <p role="status">{t.loading}</p>}{error && <p role="alert">{t.accessFailed}</p>}
    {url && (asset.kind === 'videos' ? <video ref={video} controls controlsList={canDownload ? undefined : 'nodownload'} onContextMenu={canDownload ? undefined : event => event.preventDefault()} playsInline preload="metadata" src={url} aria-label={asset.title} className="aspect-video w-full rounded-lg bg-black" onLoadedMetadata={() => { if (video.current) { video.current.currentTime = position.current; if (resume.current) void video.current.play().catch(() => {}) } }} onError={() => { close(); setError(true) }} />
      : <iframe title={asset.title} src={url} className="h-[65vh] w-full rounded-lg border border-[var(--border)]" />)}
  </article>
}
