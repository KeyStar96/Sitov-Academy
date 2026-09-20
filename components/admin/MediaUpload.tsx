'use client'

import { useEffect, useRef, useState } from 'react'
import type { Upload } from 'tus-js-client'
import { createClient } from '@/utils/supabase/client'
import { completeMediaUpload } from '@/app/actions/media'
import { mediaFileSchema, type MediaFolder } from '@/lib/media'
import { createMediaUpload, readUploadTicket, uploadTicketKey } from '@/lib/media-upload'
import { mediaCopy } from '@/lib/media-i18n'

export default function MediaUpload({ folder, lang, onSaved }: { folder: MediaFolder; lang: string; onSaved: () => Promise<void> }) {
  const t = mediaCopy(lang)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [state, setState] = useState<'idle' | 'uploading' | 'paused' | 'finalizing' | 'saved' | 'failed' | 'invalid'>('idle')
  const [progress, setProgress] = useState(0)
  const uploader = useRef<Upload | null>(null)
  const mounted = useRef(true)
  const busy = useRef(false)
  const attempt = useRef(0)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; attempt.current++; void uploader.current?.abort().catch(() => {}) } }, [])
  const active = state === 'uploading' || state === 'finalizing'
  async function start() {
    if (!file || busy.current) return
    const generation = ++attempt.current
    const current = () => mounted.current && attempt.current === generation
    busy.current = true; setState('uploading')
    try {
      mediaFileSchema.parse({ name: file.name, size: file.size, type: file.type })
      const { data, error } = await createClient().auth.getSession()
      if (!current()) return
      if (error || !data.session) throw new Error('not_authenticated')
      const userId = data.session.user.id
      const key = uploadTicketKey(userId, folder.folder_id, file)
      const ticket = readUploadTicket(key, title.trim())
      const complete = async () => {
        try {
          // Persist transfer completion even if the component was just closed:
          // retry publication without uploading an already completed object.
          ticket.completed = true; localStorage.setItem(key, JSON.stringify(ticket))
          if (!current()) return
          setProgress(100); setState('finalizing')
          const result = await completeMediaUpload({ asset_id: ticket.assetId, folder_id: folder.folder_id, title: ticket.title, file: { name: file.name, size: file.size, type: file.type } })
          if (!result.success) throw new Error('save_failed')
          localStorage.removeItem(key)
          if (current()) { setState('saved'); await onSaved() }
        } catch { if (current()) setState('failed') } finally { if (current()) busy.current = false }
      }
      if (ticket.completed) { await complete(); return }
      const next = await createMediaUpload(file, folder, ticket, userId, {
        onProgress: value => { if (current()) setProgress(value) },
        onSuccess: () => { void complete() },
        onError: () => { if (current()) { busy.current = false; setState('failed') } },
      })
      if (current()) { uploader.current = next; next.start() }
      else await next.abort()
    } catch { if (current()) { busy.current = false; setState('failed') } }
  }
  async function pause() {
    // Invalidate pending session/fingerprint work as well as active requests.
    attempt.current++; busy.current = false
    const previous = uploader.current; uploader.current = null
    setState('paused')
    try { await previous?.abort() } catch { if (mounted.current) setState('failed') }
  }
  return <form onSubmit={event => { event.preventDefault(); void start() }} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
    <h3 className="text-lg font-semibold">{t.upload}</h3>
    <p id={`upload-hint-${folder.folder_id}`} className="text-sm leading-relaxed text-[var(--muted)]">{t.hint}</p>
    <label className="block space-y-2"><span>{t.choose}</span><input className="block min-h-12 w-full max-w-full rounded-lg border border-[var(--border)] p-2" type="file" accept=".mp4,.webm,.pdf,.pptx,.key" disabled={active} aria-describedby={`upload-hint-${folder.folder_id}`} onChange={event => {
      const selected = event.target.files?.[0] ?? null
      const parsed = selected && mediaFileSchema.safeParse({ name: selected.name, size: selected.size, type: selected.type })
      setFile(parsed && parsed.success ? selected : null); setProgress(0); setState(selected && !parsed?.success ? 'invalid' : 'idle')
      setTitle(selected ? (selected.name.replace(/\.[^.]+$/, '') || selected.name).slice(0, 180) : '')
    }} /></label>
    {file && /\.(mp4|webm)$/i.test(file.name) && <label className="block space-y-2"><span>{t.fileTitle}</span><input required maxLength={180} disabled={active || state === 'paused'} value={title} onChange={event => setTitle(event.target.value)} className="min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3" /></label>}
    <progress aria-label={t.uploading} value={progress} max={100} className="h-3 w-full accent-[var(--accent)]" />
    <p role={state === 'failed' || state === 'invalid' ? 'alert' : 'status'} aria-live="polite" className="min-h-6 text-sm">{state === 'idle' ? '' : t[state]} {state === 'uploading' || state === 'paused' ? `${progress}%` : ''}</p>
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={!file || !title.trim() || active || state === 'saved'} className="min-h-12 rounded-lg bg-[var(--accent)] px-5 font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] disabled:opacity-60">{state === 'failed' ? t.retry : state === 'paused' ? t.resume : t.start}</button>
    {state === 'uploading' && <button type="button" onClick={() => void pause()} className="min-h-12 rounded-lg border border-[var(--border)] px-5">{t.pause}</button>}</div>
  </form>
}
