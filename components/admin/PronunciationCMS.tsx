'use client'
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlignLeft, Archive, ArrowRight, Eye, Loader2, Mic, Pencil, Plus, Quote, RotateCcw } from 'lucide-react'
import { savePronunciationPrompt, type SavePronunciationPromptInput } from '@/app/actions/pronunciation'
import { ACCESS_LEVELS, isAccessLevel } from '@/lib/access/levels'
import { countWords, pronunciationTextKind, type PronunciationPrompt } from '@/lib/pronunciation-prompts'
import { createPronunciationTranslator, type PronunciationTranslations } from '@/lib/pronunciation-i18n'
import { adminButton, adminChip, adminInput } from './ui'
import { preparedAudioAuthorHint } from '@/lib/audio/preparation-i18n'

const LEVELS = [...ACCESS_LEVELS, 'B2', 'C1', 'C2']
type View = 'visible' | 'archived'

/**
 * Lesetexte des Aussprache-Trainers. Alles auf dieser Seite gehört genau zu
 * diesem Trainer; getrennt wird nach Sichtbarkeit (was Schüler sehen vs.
 * Archiv) und innerhalb davon nach Lesetexten und Einzelsätzen.
 */
export default function PronunciationCMS({ prompts, translations, lang, initialLevel }: { prompts: PronunciationPrompt[]; translations: PronunciationTranslations; lang: string; initialLevel?: string }) {
 const t = createPronunciationTranslator(translations)
 const router = useRouter()
 const formRef = useRef<HTMLFormElement>(null)
 const [level, setLevel] = useState<string>(initialLevel && LEVELS.includes(initialLevel) ? initialLevel : 'A1.1')
 const [view, setView] = useState<View>('visible')
 const [form, setForm] = useState<SavePronunciationPromptInput | null>(null)
 const [busy, setBusy] = useState<string | null>(null)
 const [notice, setNotice] = useState<'saved' | 'missing_audio' | 'error' | null>(null)
 const counts = useMemo(() => new Map(LEVELS.map(value => {
  const inLevel = prompts.filter(prompt => prompt.level === value)
  const visible = inLevel.filter(prompt => prompt.isActive).length
  return [value, { visible, archived: inLevel.length - visible }]
 })), [prompts])
 const inView = prompts.filter(prompt => prompt.level === level && !!prompt.isActive === (view === 'visible'))
  .sort((a, b) => a.sortOrder - b.sortOrder || (a.title ?? '').localeCompare(b.title ?? '', 'de'))
 const groups = (['text', 'sentence'] as const).map(kind => ({ kind, items: inView.filter(prompt => pronunciationTextKind(prompt.sentenceDe) === kind) })).filter(group => group.items.length > 0)
 const field = `mt-1.5 ${adminInput}`
 const button = adminButton('secondary', 'sm')
 const chip = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium'

 async function persist(input: SavePronunciationPromptInput, key: string) {
  if (busy) return false
  setBusy(key); setNotice(null)
  try {
   const result = await savePronunciationPrompt(input)
   if (!result.success) { setNotice(result.reason === 'missing_audio' ? 'missing_audio' : 'error'); return false }
   setNotice('saved'); router.refresh(); return true
  } catch { console.error('Saving pronunciation form failed'); setNotice('error'); return false } finally { setBusy(null) }
 }
 async function save() {
  if (form && await persist(form, 'form')) setForm(null)
 }
 function edit(prompt: PronunciationPrompt) {
  setNotice(null)
  setForm({ id: prompt.id, level: prompt.level ?? level, title: prompt.title ?? '', text: prompt.sentenceDe, focus: prompt.focus ?? '', isActive: prompt.isActive ?? true })
  requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
 }
 function toggle(prompt: PronunciationPrompt) {
  void persist({ id: prompt.id, level: prompt.level ?? level, title: prompt.title ?? prompt.sentenceDe.slice(0, 120), text: prompt.sentenceDe, focus: prompt.focus ?? '', isActive: !prompt.isActive }, prompt.id)
 }

 return <section className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
  <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
   <div className="min-w-0 max-w-3xl">
    <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"><Mic size={13} aria-hidden="true" />{t('cms_trainer_badge')}</p>
    <h1 className="break-words text-[1.375rem] font-semibold leading-tight tracking-tight sm:text-2xl">{t('cms_title')}</h1>
    <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{t('cms_hint')}</p>
   </div>
   <button className={adminButton('primary', 'md', 'w-full shrink-0 sm:w-auto')} onClick={() => { setNotice(null); setForm({ level, title: '', text: '', focus: '', isActive: isAccessLevel(level) }); requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })) }}><Plus size={17} aria-hidden="true" />{t('cms_add')}</button>
  </header>

  <div className="flex flex-col gap-3 rounded-xl bg-[var(--admin-info-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
   <p className="max-w-3xl text-sm leading-relaxed">{t('cms_scope')}</p>
   <div className="flex shrink-0 flex-wrap gap-2">
    <Link href={`/${lang}/admin/content/vocabulary`} className={button}>{t('cms_scope_vocabulary')}<ArrowRight size={16} aria-hidden="true" /></Link>
    <Link href={`/${lang}/admin/content/exercises`} className={button}>{t('cms_scope_grammar')}<ArrowRight size={16} aria-hidden="true" /></Link>
   </div>
  </div>

  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
   <label className="block w-full text-sm font-medium sm:max-w-xs">{t('cms_level_label')}<select className={field} value={level} onChange={event => setLevel(event.target.value)}>{LEVELS.map(value => <option key={value} value={value}>{t('cms_level_summary', { level: value, visible: counts.get(value)!.visible, archived: counts.get(value)!.archived })}</option>)}</select></label>
   <div role="group" aria-label={t('cms_view_label')} className="flex flex-wrap gap-2">
    {(['visible', 'archived'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={adminChip(view === value)}>
     {value === 'visible' ? <Eye size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}{t(value === 'visible' ? 'cms_tab_visible' : 'cms_tab_archived')}
     <span className="tabular-nums">({counts.get(level)![value]})</span>
    </button>)}
   </div>
  </div>

  {notice && <p role={notice === 'saved' ? 'status' : 'alert'} className={`text-sm font-medium ${notice !== 'saved' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>{notice === 'missing_audio' ? preparedAudioAuthorHint(lang) : t(notice === 'error' ? 'cms_error' : 'cms_saved')}</p>}

  {form && <form ref={formRef} onSubmit={(event) => { event.preventDefault(); void save() }} className="scroll-mt-28 space-y-5 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:p-5"><h2 className="text-sm font-semibold">{t(form.id ? 'cms_edit' : 'cms_add')}</h2><div className="grid gap-5 sm:grid-cols-[1fr_150px]"><label className="text-sm font-medium">{t('cms_title_label')}<input required minLength={3} maxLength={120} className={field} value={form.title} onChange={(event) => setForm({ ...form, title:event.target.value })}/></label><label className="text-sm font-medium">{t('cms_level_label')}<select className={field} value={form.level} onChange={(event) => setForm({ ...form, level:event.target.value, isActive: isAccessLevel(event.target.value) && form.isActive })}>{LEVELS.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><label className="block text-sm font-medium">{t('cms_text_label')}<textarea lang="de" required minLength={1} maxLength={3000} rows={8} className={`${field} leading-relaxed`} value={form.text} onChange={(event) => setForm({ ...form, text:event.target.value })}/><span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">{form.text.length} / 3000</span></label><label className="block text-sm font-medium">{t('cms_focus_label')}<input maxLength={200} className={field} value={form.focus} onChange={(event) => setForm({ ...form, focus:event.target.value })}/></label><label className="flex min-h-12 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" disabled={!isAccessLevel(form.level)} checked={form.isActive} onChange={(event) => setForm({ ...form, isActive:event.target.checked })} className="h-5 w-5 accent-[var(--accent-strong)]"/>{t('cms_active_label')}</label><div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={!!busy} className={adminButton('secondary')} onClick={() => setForm(null)}>{t('cms_cancel')}</button><button type="submit" disabled={!!busy} className={adminButton('primary')}>{busy === 'form' && <Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true"/>}{t('cms_save')}</button></div></form>}

  <p className="text-sm leading-relaxed text-[var(--muted)]">{t(view === 'visible' ? 'cms_visible_hint' : 'cms_archived_hint')}</p>

  {groups.length ? groups.map(group => <section key={group.kind} aria-labelledby={`reading-${group.kind}`} className="space-y-3">
   <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
    <h2 id={`reading-${group.kind}`} className="text-sm font-semibold">{t(group.kind === 'text' ? 'cms_kind_texts' : 'cms_kind_sentences')} <span className="font-normal text-[var(--muted)] tabular-nums">({group.items.length})</span></h2>
    <p className="text-sm text-[var(--muted)]">{t(group.kind === 'text' ? 'cms_kind_texts_hint' : 'cms_kind_sentences_hint')}</p>
   </div>
   <div className="grid gap-3 lg:grid-cols-2">{group.items.map(prompt => {
    const title = prompt.title ?? prompt.sentenceDe.slice(0, 70)
    const publishable = isAccessLevel(prompt.level ?? '')
    return <article key={prompt.id} className="flex min-w-0 flex-col rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4">
     <div className="mb-3 flex flex-wrap items-center gap-2">
      <span className={`${chip} bg-[var(--surface-muted)] text-[var(--foreground)]`}>{group.kind === 'text' ? <AlignLeft size={14} aria-hidden="true" /> : <Quote size={14} aria-hidden="true" />}{t(group.kind === 'text' ? 'cms_kind_text' : 'cms_kind_sentence')}</span>
      <span className={`${chip} ml-auto border border-[var(--admin-line-strong)] text-[var(--muted)]`}><span aria-hidden="true" className={`h-2 w-2 rounded-full ${prompt.isActive ? 'bg-[var(--success)]' : 'bg-[var(--muted)]'}`} />{t(prompt.isActive ? 'cms_status_visible' : 'cms_status_archived')}</span>
     </div>
     <h3 className="break-words text-[0.9375rem] font-semibold">{title}</h3>
     {prompt.focus && <p className="mt-1 text-sm text-[var(--muted)]">{t('prompt_focus', { focus: prompt.focus })}</p>}
     {prompt.sentenceDe.trim() !== title.trim() && <p lang="de" className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">{prompt.sentenceDe}</p>}
     <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
      <span className="text-xs text-[var(--muted)]">{t('words', { count: countWords(prompt.sentenceDe) })}</span>
      <div className="ml-auto flex flex-wrap gap-2">
       {prompt.isActive || publishable
        ? <button type="button" disabled={!!busy} className={button} onClick={() => toggle(prompt)} aria-label={`${t(prompt.isActive ? 'cms_archive' : 'cms_restore')}: ${title}`}>{busy === prompt.id ? <Loader2 className="animate-spin motion-reduce:animate-none" size={16} aria-hidden="true" /> : prompt.isActive ? <Archive size={16} aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}{t(prompt.isActive ? 'cms_archive' : 'cms_restore')}</button>
        : <span className="self-center text-xs text-[var(--muted)]">{t('cms_not_publishable')}</span>}
       <button type="button" disabled={!!busy} className={button} onClick={() => edit(prompt)} aria-label={`${t('cms_edit')}: ${title}`}><Pencil size={16} aria-hidden="true" />{t('cms_edit')}</button>
      </div>
     </div>
    </article>
   })}</div>
  </section>) : <p className="rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">{t(view === 'visible' ? 'cms_empty_visible' : 'cms_empty_archived')}</p>}
 </section>
}
