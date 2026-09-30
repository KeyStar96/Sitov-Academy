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
import { Card, CardHeader, EmptyState, adminButton, adminInput, adminLabel } from './ui'
import { FolderOpen, Pencil } from 'lucide-react'

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
  const field = adminInput
  return <div className="min-w-0 space-y-6"><div className="grid items-start gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]"><div className="min-w-0 space-y-4 xl:sticky xl:top-24">
    <Card as="div">
      <div className="space-y-3 p-4">
        <label className="block"><span className={adminLabel}>{t.selectFolder}</span><select className={field} value={selected} onChange={event => setSelected(event.target.value)}><option value="">{t.selectFolder}</option>{folders.map(item => <option key={item.folder_id} value={item.folder_id}>{item.level} · {item.title}</option>)}</select></label>
        {folder && <button type="button" onClick={() => setForm({ folder_id: folder.folder_id, title: folder.title, level: folder.level, sort_order: folder.sort_order })} className={adminButton('secondary', 'sm', 'w-full')}><Pencil size={15} aria-hidden="true" />{t.edit}</button>}
      </div>
    </Card>
    <form onSubmit={save} className="space-y-4 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4"><h2 className="text-sm font-semibold">{form.folder_id ? t.edit : t.newFolder}</h2>
      <label className="block"><span className={adminLabel}>{t.name}</span><input required maxLength={180} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className={field} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block min-w-0"><span className={adminLabel}>{t.level}</span><select disabled={!!form.folder_id} value={form.level} onChange={event => setForm({ ...form, level: event.target.value })} className={field}>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
        <label className="block min-w-0"><span className={adminLabel}>{t.order}</span><input type="number" inputMode="numeric" min={0} max={100000} required value={form.sort_order} onChange={event => setForm({ ...form, sort_order: Number(event.target.value) })} className={field} /></label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {form.folder_id && <button type="button" onClick={() => setForm(empty)} className={adminButton('secondary')}>{t.newFolder}</button>}
        <button disabled={busy} className={adminButton('primary')}>{t.save}</button>
      </div>
      <p role={notice === 'failed' ? 'alert' : 'status'} className={`min-h-5 text-sm ${notice === 'failed' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{notice ? t[notice] : ''}</p>
    </form>
  </div><div className="min-w-0 space-y-5">{folder ? <>
    <section ref={addRef} aria-labelledby="media-add-title" className="scroll-mt-28 space-y-3">
      <h2 id="media-add-title" className="text-sm font-semibold">{t.addContent} <span className="font-normal text-[var(--muted)]">· {folder.level} · {folder.title}</span></h2>
      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
        <MediaUpload key={folder.folder_id} folder={folder} lang={lang} onSaved={refresh} />
        <MediaLinkForm folders={folders} folderId={folder.folder_id} editing={editingLink} lang={lang} onSaved={linkSaved} onCancel={() => setEditingLink(null)} />
      </div>
    </section>
    <MediaFolders folders={[folder]} lang={lang} onVisibilityChanged={refresh} onEditLink={editLink} />
  </> : <Card><EmptyState icon={FolderOpen} title={t.noFolders} /></Card>}</div></div>
  {looseLinks.length > 0 && <Card labelledBy="media-loose-links">
    <CardHeader id="media-loose-links" title={t.looseLinks} description={t.looseHint} />
    <div className="grid gap-3 p-4 lg:grid-cols-2 2xl:grid-cols-3">{looseLinks.map(link => <MediaLinkCard key={link.id} link={link} level={link.level} lang={lang} onEdit={() => editLink(link, null)} onChanged={refresh} />)}</div>
  </Card>}
  </div>
}
