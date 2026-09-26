'use client'

import { useRef, useState } from 'react'
import { getLooseMediaLinks, getMediaFolders, saveMediaFolder } from '@/app/actions/media'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { mediaCopy } from '@/lib/media-i18n'
import type { LooseMediaLink, MediaFolder, MediaLink } from '@/lib/media'
import MediaFolders from '@/components/dashboard/MediaFolders'
import MediaUpload from './MediaUpload'
import MediaLinkForm, { type EditedMediaLink } from './MediaLinkForm'
import MediaLinkCard from './MediaLinkCard'

export default function MediaFolderCMS({ initial, initialLooseLinks = [], lang }: { initial: MediaFolder[]; initialLooseLinks?: LooseMediaLink[]; lang: string }) {
  const t = mediaCopy(lang)
  const [folders, setFolders] = useState(initial)
  const [looseLinks, setLooseLinks] = useState(initialLooseLinks)
  const [selected, setSelected] = useState(initial[0]?.folder_id ?? '')
  const empty = { title: '', level: 'A1.1', sort_order: 0, folder_id: undefined as string | undefined }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<'saved' | 'failed' | null>(null)
  const [editingLink, setEditingLink] = useState<EditedMediaLink | null>(null)
  const addRef = useRef<HTMLElement>(null)
  const folder = folders.find(item => item.folder_id === selected)
  async function refresh() {
    const [result, loose] = await Promise.all([getMediaFolders(), getLooseMediaLinks()])
    if (!result.success) throw new Error('load_failed')
    setFolders(result.data)
    if (loose.success) setLooseLinks(loose.data)
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
  function editLink(link: MediaLink, folderId: string | null) {
    setEditingLink({ link, folderId })
    // Das Formular lebt im gewählten Ordner; ohne Auswahl den Zielordner vorwählen.
    if (!folder) setSelected(folderId ?? folders[0]?.folder_id ?? '')
    addRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
  async function linkSaved() {
    await refresh()
    // Ein verschobener Link soll dort sichtbar sein, wo er jetzt liegt.
    setEditingLink(null)
  }
  const field = 'min-h-12 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3'
  return <div className="space-y-8"><div className="grid items-start gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]"><div className="min-w-0 space-y-6">
    <label className="block space-y-2"><span>{t.selectFolder}</span><select className={field} value={selected} onChange={event => setSelected(event.target.value)}><option value="">{t.selectFolder}</option>{folders.map(item => <option key={item.folder_id} value={item.folder_id}>{item.level} · {item.title}</option>)}</select></label>
    {folder && <button onClick={() => setForm({ folder_id: folder.folder_id, title: folder.title, level: folder.level, sort_order: folder.sort_order })} className={`${field} text-left`}>{t.edit}</button>}
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-[var(--border)] p-5"><h2 className="text-lg font-semibold">{form.folder_id ? t.edit : t.newFolder}</h2>
      <label className="block space-y-2"><span>{t.name}</span><input required maxLength={180} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className={field} /></label>
      <label className="block space-y-2"><span>{t.level}</span><select disabled={!!form.folder_id} value={form.level} onChange={event => setForm({ ...form, level: event.target.value })} className={field}>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
      <label className="block space-y-2"><span>{t.order}</span><input type="number" min={0} max={100000} required value={form.sort_order} onChange={event => setForm({ ...form, sort_order: Number(event.target.value) })} className={field} /></label>
      {form.folder_id && <button type="button" onClick={() => setForm(empty)} className="mr-3 min-h-12 rounded-lg border border-[var(--border)] px-3">{t.newFolder}</button>}
      <button disabled={busy} className="min-h-12 rounded-lg bg-[var(--accent-strong)] px-5 font-semibold text-[var(--accent-foreground)] hover:bg-[var(--accent-strong-hover)]">{t.save}</button>
      <p role={notice === 'failed' ? 'alert' : 'status'} className="min-h-6 text-sm">{notice ? t[notice] : ''}</p>
    </form>
  </div><div className="min-w-0 space-y-6">{folder ? <>
    <section ref={addRef} aria-labelledby="media-add-title" className="scroll-mt-24 space-y-3">
      <h2 id="media-add-title" className="text-lg font-semibold">{t.addContent} <span className="font-normal text-[var(--muted)]">· {folder.level} · {folder.title}</span></h2>
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        <MediaUpload key={folder.folder_id} folder={folder} lang={lang} onSaved={refresh} />
        <MediaLinkForm folders={folders} folderId={folder.folder_id} editing={editingLink} lang={lang} onSaved={linkSaved} onCancel={() => setEditingLink(null)} />
      </div>
    </section>
    <MediaFolders folders={[folder]} lang={lang} onVisibilityChanged={refresh} onEditLink={editLink} />
  </> : <p>{t.noFolders}</p>}</div></div>
  {looseLinks.length > 0 && <section aria-labelledby="media-loose-links" className="space-y-3 rounded-2xl border border-dashed border-[var(--border)] p-4 sm:p-6">
    <h2 id="media-loose-links" className="text-xl font-semibold">{t.looseLinks}</h2>
    <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{t.looseHint}</p>
    <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">{looseLinks.map(link => <MediaLinkCard key={link.id} link={link} level={link.level} lang={lang} onEdit={() => editLink(link, null)} onChanged={refresh} />)}</div>
  </section>}
  </div>
}
