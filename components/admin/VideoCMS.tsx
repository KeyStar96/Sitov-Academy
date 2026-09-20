'use client'

import { useRef, useState } from 'react'
import VideoVisibilityToggle from './VideoVisibilityToggle'
import { addVideo, updateVideo, deleteVideo } from '@/app/actions/cms'
import { ArrowUpRight, Check, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { createVideoTranslator, type VideoTranslations } from '@/lib/videos-i18n'
import { learningResourceUrl, type VideoRecord, type VideoWriteInput } from '@/lib/video-links'

const empty: VideoWriteInput = { level: 'A1.1', title: '', description: '', source_url: '', is_active: false }
const fieldClass = 'min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--canvas)] px-4 py-3 text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--violet)]'
interface Props { initialData: VideoRecord[]; translations?: VideoTranslations; lang?: string }

export default function VideoCMS({ initialData, translations = {}, lang = 'de' }: Props) {
  const t = createVideoTranslator(translations)
  const [items, setItems] = useState(initialData)
  const [form, setForm] = useState<VideoWriteInput>(empty)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<'cms_saved' | 'cms_failed' | null>(null)
  const [search, setSearch] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const visible = items.filter(item => `${item.level} ${item.title}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy('save'); setNotice(null)
    try {
      const result = editing ? await updateVideo(editing, form) : await addVideo(form)
      if (!result.success || !result.data) throw new Error('save_failed')
      const saved = result.data
      setItems(previous => editing ? previous.map(item => item.id === editing ? saved : item) : [saved, ...previous])
      setForm(empty); setEditing(null); setNotice('cms_saved')
    } catch { setNotice('cms_failed') } finally { setBusy(null) }
  }
  async function remove(id: string) {
    if (busy || !window.confirm(t('cms_confirm_delete'))) return
    setBusy(id); setNotice(null)
    try {
      const result = await deleteVideo(id)
      if (!result.success) throw new Error('delete_failed')
      setItems(previous => previous.filter(item => item.id !== id))
      if (editing === id) { setEditing(null); setForm(empty) }
    } catch { setNotice('cms_failed') } finally { setBusy(null) }
  }
  function edit(item: VideoRecord) {
    setEditing(item.id); setNotice(null)
    setForm({ level: item.level, title: item.title, description: item.description ?? '', source_url: item.source_url ?? '', is_active: item.is_active, folder_id: item.folder_id, storage_path: item.storage_path, file_size: item.file_size })
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    formRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
  }
  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,.8fr)]">
    <section className="min-w-0 space-y-4">
      <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4"><Search size={18} className="shrink-0 text-[var(--muted)]" aria-hidden="true" /><input className="min-h-12 min-w-0 flex-1 bg-transparent outline-none" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('cms_search')} aria-label={t('cms_search')} /></label>
      {visible.map(item => <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]"><span className="rounded-full border border-[var(--border)] px-2 py-1 font-semibold">{item.level}</span></div>
        <h2 className="mt-3 break-words text-lg font-semibold">{item.title}</h2>
        {item.description && <p className="mt-2 break-words text-sm text-[var(--muted)]">{item.description}</p>}
        <VideoVisibilityToggle id={item.id} title={item.title} isActive={item.is_active} lang={lang} onChanged={value => setItems(previous => previous.map(video => video.id === item.id ? { ...video, is_active: value } : video))} />
        {!item.is_active && <p className="mt-3 text-sm text-[var(--muted)]">{t('cms_draft')}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={!!busy} onClick={() => edit(item)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm disabled:opacity-50"><Pencil size={16} aria-hidden="true" />{t('cms_edit')}</button>
          {learningResourceUrl(item.source_url) && <a href={learningResourceUrl(item.source_url)!} target="_blank" rel="noopener noreferrer" aria-label={`${t('cms_open')}: ${item.title}`} className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border)]"><ArrowUpRight size={18} aria-hidden="true" /></a>}
          <button type="button" disabled={!!busy} onClick={() => void remove(item.id)} aria-label={`${t('cms_delete')}: ${item.title}`} className="ml-auto inline-flex h-12 w-12 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-muted)] disabled:opacity-50">{busy === item.id ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Trash2 size={18} aria-hidden="true" />}</button>
        </div>
      </article>)}
      {!visible.length && <p className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-[var(--muted)]">{t('cms_empty')}</p>}
    </section>
    <form ref={formRef} onSubmit={save} className="space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Plus size={20} aria-hidden="true" />{t(editing ? 'cms_edit' : 'cms_new')}</h2>
      <label className="block space-y-2 text-sm font-medium"><span>{t('cms_title_field')}</span><input required maxLength={180} className={fieldClass} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
      <label className="block space-y-2 text-sm font-medium"><span>{t('cms_level')}</span><select className={fieldClass} value={form.level} onChange={event => setForm({ ...form, level: event.target.value })}>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
      <label className="block space-y-2 text-sm font-medium"><span>{t('cms_url')}</span><input required={form.is_active && !form.storage_path} type="url" className={fieldClass} placeholder="https://www.youtube.com/watch?v=…" value={form.source_url} onChange={event => setForm({ ...form, source_url: event.target.value })} /></label>
      <label className="flex min-h-12 items-center gap-3 text-base font-medium"><input type="checkbox" checked={form.is_active} onChange={event => setForm({ ...form, is_active: event.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />{t('cms_active')}</label>
      <label className="block space-y-2 text-sm font-medium"><span>{t('cms_description')}</span><textarea rows={3} maxLength={1200} className={fieldClass} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <div className="flex flex-wrap gap-3"><button disabled={!!busy} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 font-semibold text-[var(--accent-foreground)] disabled:opacity-50">{busy === 'save' ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}{t('cms_save')}</button>{editing && <button type="button" disabled={!!busy} onClick={() => { setEditing(null); setForm(empty) }} className="min-h-12 rounded-xl border border-[var(--border)] px-4">{t('cms_cancel')}</button>}</div>
      <p role="status" aria-live="polite" className="text-sm text-[var(--muted)]">{notice ? t(notice) : ''}</p>
    </form>
  </div>
}
