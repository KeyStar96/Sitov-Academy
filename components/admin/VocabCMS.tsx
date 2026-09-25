'use client'

import { useMemo, useRef, useState, type FormEvent } from 'react'
import { addVocab, deleteVocab, updateVocab } from '@/app/actions/cms'
import { Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import type { VocabularyCardRow } from '@/lib/types/vocabulary'
import { emptyVocabForm, vocabToForm, vocabWriteSchema, type VocabWriteInput } from '@/lib/types/vocabulary-admin'
import { useAdminTranslator } from './AdminI18nProvider'
import { cn } from '@/lib/utils'

const fieldClass = 'min-h-11 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'
const buttonClass = 'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 text-sm font-medium disabled:opacity-50'
const translationFields = ['translation_ru', 'translation_en', 'translation_uk', 'translation_tr'] as const
const sentenceFields = ['context_sentence_de', 'context_sentence_ru', 'context_sentence_en', 'context_sentence_uk', 'context_sentence_tr'] as const
const levels = ['A1.1', 'A1.2', 'A2.1', 'A2.2', 'B1.1', 'B1.2'] as const
const pageSize = 30

export default function VocabCMS({ initialData }: { initialData: VocabularyCardRow[] }) {
  const t = useAdminTranslator()
  const [items, setItems] = useState(initialData)
  const [form, setForm] = useState<VocabWriteInput>(emptyVocabForm)
  const [targetFormInput, setTargetFormInput] = useState('')
  const [alternativeInput, setAlternativeInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const mutationLock = useRef(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [message, setMessage] = useState<'cms_saved' | 'cms_deleted' | 'cms_save_failed' | 'cms_delete_failed' | 'cms_invalid' | null>(null)
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState('all')
  const [page, setPage] = useState(0)
  const editorRef = useRef<HTMLFormElement>(null)
  const filtered = useMemo(() => items.filter(item => (level === 'all' || item.level === level) && `${item.word_de} ${item.lesson} ${item.translation_ru ?? ''} ${item.translation_en ?? ''} ${item.translation_uk ?? ''} ${item.translation_tr ?? ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim())), [items, level, search])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const visibleItems = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  function setField<K extends keyof VocabWriteInput>(key: K, value: VocabWriteInput[K]) { setForm(previous => ({ ...previous, [key]: value })) }
  function openEditor(item?: VocabularyCardRow) {
    setForm(item ? vocabToForm(item) : emptyVocabForm())
    setTargetFormInput((item?.target_form ?? []).join('\n'))
    setAlternativeInput((item?.alternative_answers_de ?? []).join('\n'))
    setEditingId(item?.id ?? null)
    setEditorOpen(true)
    setMessage(null)
    requestAnimationFrame(() => { editorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); editorRef.current?.querySelector<HTMLInputElement>('input[name="word_de"]')?.focus({ preventScroll: true }) })
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutationLock.current) return
    const lines = (value: string) => value.split('\n').map(line => line.trim()).filter(Boolean)
    const parsed = vocabWriteSchema.safeParse({ ...form, target_form: lines(targetFormInput), alternative_answers_de: lines(alternativeInput) })
    if (!parsed.success) { setMessage('cms_invalid'); return }
    mutationLock.current = true
    setPending(true)
    setMessage(null)
    const previousItems = items
    const existing = items.find(item => item.id === editingId)
    const optimisticId = editingId ?? crypto.randomUUID()
    const optimistic: VocabularyCardRow = { id: optimisticId, created_at: new Date().toISOString(), image_url: null, audio_url: null, is_hard_for_ru: false, is_hard_for_tr: false, ...existing, ...parsed.data, article: parsed.data.article === 'none' ? null : parsed.data.article }
    setItems(previous => editingId ? previous.map(item => item.id === editingId ? optimistic : item) : [optimistic, ...previous])
    try {
      const result = editingId ? await updateVocab(editingId, parsed.data) : await addVocab(parsed.data)
      if (result.success === false) throw new Error(result.error)
      setItems(previous => previous.map(item => item.id === optimisticId ? result.data : item))
      setMessage('cms_saved')
      setEditorOpen(false)
      setEditingId(null)
      setForm(emptyVocabForm())
    } catch { setItems(previousItems); setMessage('cms_save_failed') }
    finally { mutationLock.current = false; setPending(false) }
  }
  async function handleDelete(id: string) {
    if (mutationLock.current) return
    mutationLock.current = true
    setPending(true)
    setMessage(null)
    const previousItems = items
    setItems(previous => previous.filter(item => item.id !== id))
    setDeleteId(null)
    try {
      const result = await deleteVocab(id)
      if (result.success === false) throw new Error(result.error)
      if (editingId === id) { setEditingId(null); setEditorOpen(false); setForm(emptyVocabForm()) }
      setMessage('cms_deleted')
    } catch { setItems(previousItems); setMessage('cms_delete_failed') }
    finally { mutationLock.current = false; setPending(false) }
  }
  return <div className="min-w-0 space-y-4 text-[var(--foreground)]">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">{t('cms_count', { count: items.length })}</p><button type="button" onClick={() => openEditor()} disabled={pending} className={`${buttonClass} bg-[var(--foreground)] text-[var(--surface)]`}><Plus size={17} aria-hidden="true" />{t('cms_new')}</button></div>
    <p role="status" aria-live="polite" className={`min-h-6 text-sm ${message?.includes('failed') || message === 'cms_invalid' ? 'text-red-700 dark:text-red-300' : 'text-[var(--muted)]'}`}>{pending ? t('cms_saving') : message ? t(message) : ''}</p>
    {editorOpen && <form ref={editorRef} onSubmit={handleSubmit} className="scroll-mt-4 space-y-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-semibold">{t(editingId ? 'cms_edit_title' : 'cms_new')}</h2><button type="button" onClick={() => setEditorOpen(false)} disabled={pending} className={buttonClass}><X size={16} aria-hidden="true" />{t('cms_cancel')}</button></div>
      <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">{t('cms_word_details')}</legend>
        <label className="min-w-0 text-sm"><span className="mb-1.5 block font-medium">{t('cms_word_de')}</span><input name="word_de" required maxLength={300} value={form.word_de} onChange={event => setField('word_de', event.target.value)} className={fieldClass} /></label>
        <label className="min-w-0 text-sm"><span className="mb-1.5 block font-medium">{t('cms_level')}</span><select value={form.level} onChange={event => setField('level', event.target.value as VocabWriteInput['level'])} className={fieldClass}>{levels.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="min-w-0 text-sm"><span className="mb-1.5 block font-medium">{t('cms_lesson')}</span><input required maxLength={120} value={form.lesson} onChange={event => setField('lesson', event.target.value)} className={fieldClass} /></label>
        <label className="min-w-0 text-sm"><span className="mb-1.5 block font-medium">{t('cms_article')}</span><select value={form.article} onChange={event => setField('article', event.target.value as VocabWriteInput['article'])} className={fieldClass}><option value="none">{t('cms_no_article')}</option>{(['der', 'die', 'das'] as const).map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="min-w-0 text-sm"><span className="mb-1.5 block font-medium">{t('cms_plural')}</span><input maxLength={500} value={form.plural} onChange={event => setField('plural', event.target.value)} className={fieldClass} /></label>
        {translationFields.map(field => <label key={field} className="min-w-0 text-sm"><span className="mb-1.5 block font-medium">{t(`cms_${field}`)}</span><input maxLength={500} value={form[field]} onChange={event => setField(field, event.target.value)} className={fieldClass} /></label>)}
      </fieldset>
      <fieldset disabled={pending} className="space-y-3 border-t border-[var(--border)] pt-4"><legend className="px-1 text-sm font-semibold">{t('cms_context_title')}</legend><p className="text-sm leading-relaxed text-[var(--muted)]">{t('cms_context_hint')}</p><div className="grid min-w-0 gap-3 md:grid-cols-2">{sentenceFields.map(field => <label key={field} className={`min-w-0 text-sm ${field === 'context_sentence_de' ? 'md:col-span-2' : ''}`}><span className="mb-1.5 block font-medium">{t(`cms_${field}`)}</span><textarea rows={2} maxLength={1000} value={form[field]} onChange={event => setField(field, event.target.value)} className={`${fieldClass} resize-y`} /></label>)}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="min-w-0 text-base"><label htmlFor="vocab-target-form" className="mb-1.5 block font-medium">{t('cms_target_form')}</label><textarea id="vocab-target-form" rows={2} maxLength={1451} value={targetFormInput} onChange={event => setTargetFormInput(event.target.value)} aria-describedby="vocab-target-form-hint" className={cn(fieldClass, 'min-h-12 resize-y text-base')} /><span id="vocab-target-form-hint" className="mt-1 block text-base text-[var(--muted)]">{t('cms_target_form_hint')}</span></div>
          <div className="min-w-0 text-base"><label htmlFor="vocab-alternative-answers" className="mb-1.5 block font-medium">{t('cms_alternative_answers')}</label><textarea id="vocab-alternative-answers" rows={2} maxLength={20019} value={alternativeInput} onChange={event => setAlternativeInput(event.target.value)} aria-describedby="vocab-alternatives-hint" className={cn(fieldClass, 'min-h-12 resize-y text-base')} /><span id="vocab-alternatives-hint" className="mt-1 block text-base text-[var(--muted)]">{t('cms_alternative_answers_hint')}</span></div>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[var(--border)] p-3 text-sm font-medium"><input type="checkbox" checked={form.sentence_practice} onChange={event => setField('sentence_practice', event.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />{t('cms_sentence_practice')}</label>
      </fieldset>
      <button type="submit" disabled={pending} className={`${buttonClass} w-full bg-[var(--foreground)] text-[var(--surface)] sm:w-auto`}>{pending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}{t('cms_save')}</button>
    </form>}
    <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="grid min-w-0 gap-3 border-b border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><label className="min-w-0 text-sm font-medium"><span className="mb-1.5 block">{t('cms_search')}</span><span className="relative block"><Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-[var(--muted)]" aria-hidden="true" /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} className={`${fieldClass} pl-9`} /></span></label><label className="min-w-0 text-sm font-medium"><span className="mb-1.5 block">{t('cms_level')}</span><select value={level} onChange={event => { setLevel(event.target.value); setPage(0) }} className={fieldClass}><option value="all">{t('cms_all_levels')}</option>{levels.map(value => <option key={value}>{value}</option>)}</select></label></div>
      <table className="block w-full table-fixed text-left text-sm md:table"><caption className="sr-only">{t('cms_title')}</caption><thead className="hidden border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)] md:table-header-group"><tr>{(['cms_word_de', 'cms_lesson', 'cms_translations', 'col_actions'] as const).map(key => <th key={key} scope="col" className="px-4 py-3 font-medium">{t(key)}</th>)}</tr></thead><tbody className="block divide-y divide-[var(--border)] md:table-row-group">{visibleItems.map(item => <tr key={item.id} className="grid min-w-0 gap-3 p-4 align-top sm:grid-cols-2 md:table-row md:p-0"><td className="min-w-0 break-words md:p-4"><span className="mr-2 rounded bg-[var(--surface-muted)] px-1.5 py-1 text-xs font-medium">{item.level}</span><span className="font-semibold">{item.article && item.article !== 'none' ? `${item.article} ` : ''}{item.word_de}</span>{item.context_sentence_de && <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{item.context_sentence_de}</p>}{item.sentence_practice && <p className="mt-2 text-xs font-medium">{t('cms_sentence_enabled')}</p>}</td><td className="min-w-0 break-words text-[var(--muted)] md:p-4">{item.lesson}</td><td className="min-w-0 break-words text-xs leading-relaxed text-[var(--muted)] md:p-4">{translationFields.map(field => item[field] ? <p key={field}>{item[field]}</p> : null)}</td><td className="min-w-0 md:p-4"><div className="flex flex-wrap gap-2">{deleteId === item.id ? <><p className="w-full text-xs text-red-700 dark:text-red-300">{t('cms_delete_confirm', { word: item.word_de })}</p><button type="button" onClick={() => setDeleteId(null)} className={buttonClass}>{t('cms_cancel')}</button><button type="button" onClick={() => handleDelete(item.id)} disabled={pending} className={`${buttonClass} bg-[var(--accent-strong)] text-[var(--accent-foreground)]`}>{t('cms_delete_final')}</button></> : <><button type="button" onClick={() => setDeleteId(item.id)} disabled={pending} className={`${buttonClass} text-red-700 dark:text-red-300`}><Trash2 size={15} aria-hidden="true" />{t('cms_delete')}</button><button type="button" onClick={() => openEditor(item)} disabled={pending} className={buttonClass}><Pencil size={15} aria-hidden="true" />{t('cms_edit')}</button></>}</div></td></tr>)}</tbody></table>
      {visibleItems.length === 0 && <p className="p-8 text-center text-sm text-[var(--muted)]">{t('grid_no_results')}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] p-3"><p className="text-xs text-[var(--muted)]" role="status">{t('cms_page', { page: currentPage + 1, pages, count: filtered.length })}</p><div className="flex gap-2"><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} className={buttonClass}><ChevronLeft size={17} aria-hidden="true" /><span>{t('cms_previous')}</span></button><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pages - 1} className={buttonClass}><span>{t('cms_next')}</span><ChevronRight size={17} aria-hidden="true" /></button></div></div>
    </section>
  </div>
}
