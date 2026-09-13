'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, Loader2, Pencil, Plus } from 'lucide-react'
import { savePronunciationPrompt, type SavePronunciationPromptInput } from '@/app/actions/pronunciation'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import type { PronunciationPrompt } from '@/lib/pronunciation-prompts'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'

export default function PronunciationCMS({ prompts, translations }: { prompts: PronunciationPrompt[]; translations: PronunciationTranslations }) {
 const t = createPronunciationTranslator(translations)
 const router = useRouter()
 const [level, setLevel] = useState<string>('A1.1')
 const [form, setForm] = useState<SavePronunciationPromptInput | null>(null)
 const [busy, setBusy] = useState(false)
 const [notice, setNotice] = useState<'saved' | 'error' | null>(null)
 const visible = prompts.filter((prompt) => prompt.level === level)
 const field = 'mt-2 min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base'
 const button = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold disabled:opacity-50'
 async function save() {
  if (!form || busy) return
  setBusy(true); setNotice(null)
  try {
   const result = await savePronunciationPrompt(form)
   if (!result.success) { setNotice('error'); return }
   setForm(null); setNotice('saved'); router.refresh()
  } catch (error) { console.error('Saving pronunciation form failed', error); setNotice('error') } finally { setBusy(false) }
 }
 return <section className="space-y-6 text-[var(--foreground)]"><header className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><h1 className="text-3xl font-semibold tracking-tight">{t('cms_title')}</h1><p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{t('cms_hint')}</p></div><button className={`${button} bg-[var(--accent)] text-[var(--accent-foreground)]`} onClick={() => { setNotice(null); setForm({ level, title:'', text:'', focus:'', isActive:true }) }}><Plus size={20}/>{t('cms_add')}</button></header>
 <label className="block max-w-xs text-sm font-semibold">{t('cms_level_label')}<select className={field} value={level} onChange={(event) => setLevel(event.target.value)}>{ACCESS_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
 {notice && <p role="status" className={notice === 'error' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}>{t(notice === 'error' ? 'cms_error' : 'cms_saved')}</p>}
 {form && <form onSubmit={(event) => { event.preventDefault(); void save() }} className="space-y-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"><h2 className="text-xl font-semibold">{t(form.id ? 'cms_edit' : 'cms_add')}</h2><div className="grid gap-5 sm:grid-cols-[1fr_150px]"><label className="text-sm font-semibold">{t('cms_title_label')}<input required minLength={3} maxLength={120} className={field} value={form.title} onChange={(event) => setForm({ ...form, title:event.target.value })}/></label><label className="text-sm font-semibold">{t('cms_level_label')}<select className={field} value={form.level} onChange={(event) => setForm({ ...form, level:event.target.value })}>{ACCESS_LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><label className="block text-sm font-semibold">{t('cms_text_label')}<textarea lang="de" required minLength={80} maxLength={3000} rows={8} className={`${field} leading-relaxed`} value={form.text} onChange={(event) => setForm({ ...form, text:event.target.value })}/><span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">{form.text.length} / 3000</span></label><label className="block text-sm font-semibold">{t('cms_focus_label')}<input maxLength={200} className={field} value={form.focus} onChange={(event) => setForm({ ...form, focus:event.target.value })}/></label><label className="flex min-h-12 cursor-pointer items-center gap-3 text-base"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive:event.target.checked })} className="h-6 w-6 accent-[var(--accent)]"/>{t('cms_active_label')}</label><div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className={`${button} bg-[var(--accent)] text-[var(--accent-foreground)]`}>{busy && <Loader2 className="animate-spin" size={18}/>} {t('cms_save')}</button><button type="button" disabled={busy} className={button} onClick={() => setForm(null)}>{t('cms_cancel')}</button></div></form>}
 <div className="grid gap-4 lg:grid-cols-2">{visible.length ? visible.map((prompt) => <article key={prompt.id} className="flex min-w-0 flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5"><div className="mb-3 flex items-center justify-between gap-3"><BookOpen size={22} className="text-[var(--accent)]"/><span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--muted)]">{prompt.isActive ? t('cms_active_label') : t('cms_archive')}</span></div><h2 className="text-lg font-semibold">{prompt.title ?? prompt.sentenceDe.slice(0,70)}</h2><p lang="de" className="mt-3 line-clamp-3 text-base leading-relaxed text-[var(--muted)]">{prompt.sentenceDe}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="text-xs text-[var(--muted)]">{t('words', { count: prompt.sentenceDe.split(/\s+/).length })}</span><button className={button} onClick={() => { setNotice(null); setForm({ id:prompt.id, level:prompt.level ?? level, lesson:prompt.lesson, title:prompt.title ?? '', text:prompt.sentenceDe, focus:prompt.focus ?? '', isActive:prompt.isActive ?? true }); window.scrollTo({ top:0, behavior:'smooth' }) }}><Pencil size={16}/>{t('cms_edit')}</button></div></article>) : <p className="rounded-3xl border border-dashed border-[var(--border)] p-8 text-center text-[var(--muted)] lg:col-span-2">{t('cms_empty')}</p>}</div></section>
}
