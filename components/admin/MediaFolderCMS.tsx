'use client'

import { useState } from 'react'
import { getMediaFolders, saveMediaFolder } from '@/app/actions/media'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { mediaCopy } from '@/lib/media-i18n'
import type { MediaFolder } from '@/lib/media'
import MediaFolders from '@/components/dashboard/MediaFolders'
import MediaUpload from './MediaUpload'

export default function MediaFolderCMS({ initial, lang }: { initial: MediaFolder[]; lang: string }) {
  const t = mediaCopy(lang)
  const [folders, setFolders] = useState(initial)
  const [selected, setSelected] = useState(initial[0]?.folder_id ?? '')
  const empty = { title: '', level: 'A1.1', sort_order: 0, folder_id: undefined as string | undefined }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<'saved' | 'failed' | null>(null)
  const folder = folders.find(item => item.folder_id === selected)
  async function refresh() {
    const result = await getMediaFolders()
    if (!result.success) throw new Error('load_failed')
    setFolders(result.data)
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setNotice(null)
    try {
      const result = await saveMediaFolder(form)
      if (!result.success) throw new Error('save_failed')
      await refresh(); setSelected(result.data.folder_id); setForm(empty); setNotice('saved')
    } catch { setNotice('failed') } finally { setBusy(false) }
  }
  const field = 'min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3'
  return <div className="grid items-start gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]"><aside className="min-w-0 space-y-6">
    <label className="block space-y-2"><span>{t.selectFolder}</span><select className={field} value={selected} onChange={event => setSelected(event.target.value)}><option value="">{t.selectFolder}</option>{folders.map(item => <option key={item.folder_id} value={item.folder_id}>{item.level} · {item.title}</option>)}</select></label>
    {folder && <button onClick={() => setForm({ folder_id: folder.folder_id, title: folder.title, level: folder.level, sort_order: folder.sort_order })} className={`${field} text-left`}>{t.edit}</button>}
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-[var(--border)] p-5"><h2 className="text-lg font-semibold">{form.folder_id ? t.edit : t.newFolder}</h2>
      <label className="block space-y-2"><span>{t.name}</span><input required maxLength={180} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className={field} /></label>
      <label className="block space-y-2"><span>{t.level}</span><select disabled={!!form.folder_id} value={form.level} onChange={event => setForm({ ...form, level: event.target.value })} className={field}>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
      <label className="block space-y-2"><span>{t.order}</span><input type="number" min={0} max={100000} required value={form.sort_order} onChange={event => setForm({ ...form, sort_order: Number(event.target.value) })} className={field} /></label>
      <button disabled={busy} className="min-h-12 rounded-lg bg-[var(--accent-strong)] px-5 font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-strong-hover)]">{t.save}</button>
      {form.folder_id && <button type="button" onClick={() => setForm(empty)} className="ml-3 min-h-12 px-3">{t.newFolder}</button>}
      <p role={notice === 'failed' ? 'alert' : 'status'} className="min-h-6 text-sm">{notice ? t[notice] : ''}</p>
    </form>
  </aside><div className="min-w-0 space-y-6">{folder ? <><MediaUpload key={folder.folder_id} folder={folder} lang={lang} onSaved={refresh} /><MediaFolders folders={[folder]} lang={lang} onVisibilityChanged={refresh} /></> : <p>{t.noFolders}</p>}</div></div>
}
