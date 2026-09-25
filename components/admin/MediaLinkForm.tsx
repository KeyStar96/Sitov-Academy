'use client'

import { useEffect, useId, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { saveMediaLink } from '@/app/actions/media'
import { mediaCopy } from '@/lib/media-i18n'
import { learningResourceUrl } from '@/lib/video-links'
import type { MediaFolder, MediaLink } from '@/lib/media'

export interface EditedMediaLink { link: MediaLink; folderId: string | null }

/**
 * YouTube-, Video- und Website-Links für einen Lernmedien-Ordner. Ersetzt die
 * frühere eigene Video-Verwaltung: Das Niveau folgt dem gewählten Ordner.
 */
export default function MediaLinkForm({ folders, folderId, editing, lang, onSaved, onCancel }: {
  folders: MediaFolder[]
  folderId: string
  editing: EditedMediaLink | null
  lang: string
  onSaved: () => Promise<void>
  onCancel: () => void
}) {
  const t = mediaCopy(lang)
  const id = useId()
  const blank = { folder_id: folderId, title: '', url: '', description: '', is_active: true }
  const [form, setForm] = useState(blank)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed' | 'invalid'>('idle')
  const editingId = editing?.link.id

  useEffect(() => {
    if (!editing) { setForm({ ...blank }); return }
    setForm({ folder_id: editing.folderId ?? folderId, title: editing.link.title, url: editing.link.url, description: editing.link.description ?? '', is_active: editing.link.isActive })
    setState('idle')
    // Nur beim Wechsel des bearbeiteten Links neu befüllen, nicht bei jedem Re-Render.
  }, [editingId])
  useEffect(() => { if (!editing) setForm(previous => ({ ...previous, folder_id: folderId })) }, [folderId, editing])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (state === 'saving') return
    if (!learningResourceUrl(form.url)) { setState('invalid'); return }
    setState('saving')
    try {
      const result = await saveMediaLink({ ...form, ...(editing ? { video_id: editing.link.id } : {}) })
      if (!result.success) throw new Error('save_failed')
      if (!editing) setForm({ ...blank, folder_id: form.folder_id })
      await onSaved()
      setState('saved')
    } catch { setState('failed') }
  }

  const field = 'min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3'
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5">
    <h3 className="flex items-center gap-2 text-lg font-semibold"><Link2 size={20} aria-hidden="true" />{editing ? t.linkEdit : t.addLink}</h3>
    <label className="block space-y-2"><span>{t.linkUrl}</span><input required type="url" inputMode="url" maxLength={2000} placeholder="https://www.youtube.com/watch?v=…" aria-describedby={`${id}-hint`} value={form.url} onChange={event => { setForm({ ...form, url: event.target.value }); if (state === 'invalid') setState('idle') }} className={field} /></label>
    <p id={`${id}-hint`} className="text-sm leading-relaxed text-[var(--muted)]">{t.linkUrlHint}</p>
    <label className="block space-y-2"><span>{t.linkTitle}</span><input required minLength={2} maxLength={180} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className={field} /></label>
    <label className="block space-y-2"><span>{t.linkDescription}</span><textarea rows={2} maxLength={1200} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className={`${field} py-2`} /></label>
    {(editing || folders.length > 1) && <label className="block space-y-2"><span>{t.linkFolder}</span><select required value={form.folder_id} onChange={event => setForm({ ...form, folder_id: event.target.value })} className={field}>{folders.map(folder => <option key={folder.folder_id} value={folder.folder_id}>{folder.level} · {folder.title}</option>)}</select></label>}
    <label className="flex min-h-12 items-center gap-3"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />{t.linkVisible}</label>
    <p role={state === 'failed' || state === 'invalid' ? 'alert' : 'status'} aria-live="polite" className="min-h-6 text-sm">{state === 'invalid' ? t.linkInvalid : state === 'saved' ? t.saved : state === 'failed' ? t.failed : ''}</p>
    <div className="flex flex-wrap gap-3">
      {editing && <button type="button" onClick={onCancel} className="min-h-12 rounded-lg border border-[var(--border)] px-5">{t.cancel}</button>}
      <button type="submit" disabled={state === 'saving'} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[var(--accent-strong)] px-5 font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-strong-hover)] disabled:opacity-60">{state === 'saving' && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}{t.linkSave}</button>
    </div>
  </form>
}
