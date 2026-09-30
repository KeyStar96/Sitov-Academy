'use client'

import { useMemo, useRef, useState, type FormEvent } from 'react'
import { BookOpenCheck, CheckCircle2, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { saveGrammarExercise, removeGrammarExercise } from '@/app/actions/grammar-cms'
import { grammarWriteSchema, normalizeGrammarAnswer, type GrammarExerciseRow } from '@/lib/grammar-validation'
import { parseFillInBlankContent, parseMultipleChoiceContent, readTargetForms } from '@/lib/types/exercise'
import { grammarTranslator } from '@/lib/grammar-i18n'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import type { Json } from '@/supabase/database.types'
import { useAdminTranslator } from './AdminI18nProvider'
import { Badge, Card, EmptyState, Notice, PageHeader, adminButton, adminInput, adminLabel } from './ui'
import { contentAdminCopy } from '@/lib/content-admin-i18n'
import { cn } from '@/lib/utils'

interface EditorState {
  id?: string
  level: string
  lesson: string
  topic: string
  type: 'fill_in_blank' | 'multiple_choice'
  textBefore: string
  textAfter: string
  question: string
  instruction: string
  answer: string
  options: string
  hint: string
  audio: string
  hintRu: string
  hintTr: string
  contentHints: Record<string, string>
  metadataHints: Record<string, string>
  acceptedAnswers: string
  gapHint: string
  targetForms: string
  translationPrompts: Record<string, string>
}
const emptyEditor = (): EditorState => ({
  level: 'A1.1', lesson: '', topic: '', type: 'fill_in_blank', textBefore: '', textAfter: '',
  question: '', instruction: '', answer: '', options: '', hint: '', audio: '', hintRu: '', hintTr: '', contentHints: {}, metadataHints: {}, acceptedAnswers: '', gapHint: '', targetForms: '', translationPrompts: {},
})
function localizedHints(value: Json | undefined): Record<string, string> {
  if (typeof value === 'string') return { de: value }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}

function editHint(current: Record<string, string>, language: string, text: string): Record<string, string> {
  const next = { ...current }
  if (text.trim()) next[language] = text.trim()
  else delete next[language]
  return next
}

function previewFor(row: GrammarExerciseRow): string {
  if (row.type === 'fill_in_blank') {
    const content = parseFillInBlankContent(row.content)
    return content ? `${content.text_before}[${content.correct_answer}]${content.text_after}` : ''
  }
  return parseMultipleChoiceContent(row.content)?.question ?? ''
}

export default function ExerciseCMS({ initialData, lang = 'de', loadFailed = false }: { initialData: GrammarExerciseRow[]; lang?: string; loadFailed?: boolean }) {
  const [items, setItems] = useState(initialData)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState('')
  const [message, setMessage] = useState<'saved' | 'deleted' | 'invalid' | 'failed' | null>(loadFailed ? 'failed' : null)
  const [page, setPage] = useState(1)
  const editorRef = useRef<HTMLFormElement>(null)
  const g = useMemo(() => grammarTranslator(lang), [lang])
  const t = useAdminTranslator()
  const copy = contentAdminCopy(lang)
  const filtered = items.filter(row => (!level || row.level === level) && `${row.topic} ${row.lesson} ${previewFor(row)}`.toLocaleLowerCase('de-DE').includes(query.toLocaleLowerCase('de-DE')))
  const set = (key: Exclude<keyof EditorState, 'contentHints' | 'metadataHints' | 'translationPrompts'>, value: string) => setEditor(previous => previous ? { ...previous, [key]: value } : previous)

  const openEditor = (row?: GrammarExerciseRow) => {
    setMessage(null)
    if (!row) setEditor({ ...emptyEditor(), level: level || 'A1.1' })
    else {
      const fill = row.type === 'fill_in_blank' ? parseFillInBlankContent(row.content) : null
      const choice = row.type === 'multiple_choice' ? parseMultipleChoiceContent(row.content) : null
      if (!fill && !choice) return

      const contentHints = localizedHints(row.type === 'fill_in_blank' ? fill?.smart_hint : choice?.explanation)
      const metadataHints = localizedHints(row.hint)
      setEditor({ id: row.id, level: row.level, lesson: row.lesson, topic: row.topic,
        type: fill ? 'fill_in_blank' : 'multiple_choice', textBefore: fill?.text_before ?? '', textAfter: fill?.text_after ?? '',
        question: choice?.question ?? '', instruction: fill?.instruction ?? choice?.instruction ?? '', answer: fill?.correct_answer ?? choice?.correct_answer ?? '',
        options: (fill?.options ?? choice?.options ?? []).join('\n'),
        hint: contentHints.de ?? '', contentHints, metadataHints,
        acceptedAnswers: (fill?.accepted_answers ?? []).filter(answer => normalizeGrammarAnswer(answer) !== normalizeGrammarAnswer(fill?.correct_answer ?? '')).join('\n'),
        gapHint: fill?.gap_hint ?? '',
        targetForms: (readTargetForms(row.content) ?? []).join('\n'),
        translationPrompts: { ...row.translation_prompt },
        audio: row.solution_audio_url ?? '',
        hintRu: metadataHints.ru ?? '',
        hintTr: metadataHints.tr ?? '',
      })
    }
    window.requestAnimationFrame(() => {
      const form = editorRef.current
      // A teacher may already have entered another field before this frame runs.
      if (!form || form.contains(document.activeElement)) return
      form.scrollIntoView({ behavior: 'smooth', block: 'start' })
      form.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    })
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editor || busy) return
    const options = editor.options.split('\n').map(value => value.trim()).filter(Boolean)

    const metadataHints = editHint(editHint(editor.metadataHints, 'ru', editor.hintRu), 'tr', editor.hintTr)
    const contentHints = editHint(editor.contentHints, 'de', editor.hint)
    const smartHintOrExplanation = Object.keys(contentHints).length ? contentHints : null
    const acceptedAnswers = editor.acceptedAnswers.split('\n').map(value => value.trim()).filter(Boolean)
    const targetForms = editor.targetForms.split('\n').map(value => value.trim()).filter(Boolean)
    const translationPrompts = Object.fromEntries(Object.entries(editor.translationPrompts)
      .flatMap(([locale, value]) => value.trim() ? [[locale, value.trim()]] : []))

    const parsed = grammarWriteSchema.safeParse({
      level: editor.level, lesson: editor.lesson, topic: editor.topic, type: editor.type,
      hint: Object.keys(metadataHints).length ? metadataHints : null, solution_audio_url: editor.audio.trim() || null,
      translation_prompt: translationPrompts,
      content: editor.type === 'fill_in_blank'
        ? { target_form: targetForms, instruction: editor.instruction, text_before: editor.textBefore, text_after: editor.textAfter, correct_answer: editor.answer, options, accepted_answers: [editor.answer, ...acceptedAnswers], gap_hint: editor.gapHint.trim() || undefined, smart_hint: smartHintOrExplanation }
        : { target_form: targetForms, instruction: editor.instruction, question: editor.question, correct_answer: editor.answer, options, explanation: smartHintOrExplanation },
    })
    if (!parsed.success) { setMessage('invalid'); return }
    setBusy(true)
    setMessage(null)
    try {
      const result = await saveGrammarExercise(parsed.data, editor.id)
      if (result.success === false) { setMessage(result.error); return }
      setItems(previous => editor.id ? previous.map(row => row.id === editor.id ? result.data : row) : [result.data, ...previous])
      setEditor(null)
      setMessage('saved')
    } catch { setMessage('failed') } finally { setBusy(false) }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    try {
      const result = await removeGrammarExercise(id)
      if (!result.success) { setMessage('failed'); return }
      setItems(previous => previous.filter(row => row.id !== id))
      setDeleteId(null)
      setMessage('deleted')
    } catch { setMessage('failed') } finally { setBusy(false) }
  }

  const field = 'block min-w-0'
  const wide = 'block min-w-0 sm:col-span-2'
  const label = (text: string) => <span className={adminLabel}>{text}</span>
  const failed = message === 'invalid' || message === 'failed'
  return <div className="min-w-0 space-y-5 text-[var(--foreground)] sm:space-y-6">
    <PageHeader eyebrow={t('group_content')} title={t('nav_learning_path')} description={copy.pathIntro}
      actions={<button type="button" disabled={busy} onClick={() => openEditor()} className={adminButton('primary')}><Plus size={17} aria-hidden="true" />{g('newExercise')}</button>} />
    {message && <Notice tone={failed ? 'danger' : 'success'} role={failed ? 'alert' : 'status'}><span className="inline-flex items-center gap-2"><CheckCircle2 size={16} aria-hidden="true" />{g(message)}</span></Notice>}
    {editor && <form onSubmit={handleSave} ref={editorRef} className="scroll-mt-24 space-y-5 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold">{g(editor.id ? 'editExercise' : 'newExercise')}</h2><button type="button" disabled={busy} onClick={() => setEditor(null)} className={adminButton('ghost', 'sm')}><X size={16} aria-hidden="true" />{g('cancel')}</button></div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className={field}>{label(g('level', { level: '' }).trim())}<select className={adminInput} value={editor.level} onChange={event => set('level', event.target.value)}>{ACCESS_LEVELS.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className={field}>{label(g('type'))}<select className={adminInput} value={editor.type} onChange={event => set('type', event.target.value)}><option value="fill_in_blank">{g('fill')}</option><option value="multiple_choice">{g('choice')}</option></select></label>
        <label className={field}>{label(g('lesson'))}<input className={adminInput} required maxLength={120} value={editor.lesson} onChange={event => set('lesson', event.target.value)} /></label>
        <label className={field}>{label(g('topic'))}<input className={adminInput} required maxLength={160} value={editor.topic} onChange={event => set('topic', event.target.value)} /></label>
        <label className={wide}>{label(g('instruction'))}<input className={adminInput} maxLength={500} value={editor.instruction} onChange={event => set('instruction', event.target.value)} /></label>
        <label className={wide}>{label(g('targetForms'))}<textarea className={cn(adminInput, 'resize-y')} required rows={2} value={editor.targetForms} onChange={event => set('targetForms', event.target.value)} /></label>
        <p className="text-sm text-[var(--muted)] sm:col-span-2">{g('targetFormsHelp')}</p>
        {(['de', 'en', 'ru', 'uk', 'tr'] as const).map(locale => <label key={locale} className={wide}>{label(g('translationPrompt', { language: locale.toUpperCase() }))}<textarea className={cn(adminInput, 'resize-y')} rows={2} maxLength={2000} value={editor.translationPrompts[locale] ?? ''} onChange={event => setEditor(previous => previous ? { ...previous, translationPrompts: { ...previous.translationPrompts, [locale]: event.target.value } } : previous)} /></label>)}
        {editor.type === 'fill_in_blank' ? <>
          <label className={field}>{label(g('before'))}<textarea className={cn(adminInput, 'resize-y')} maxLength={2000} rows={3} value={editor.textBefore} onChange={event => set('textBefore', event.target.value)} /></label>
          <label className={field}>{label(g('after'))}<textarea className={cn(adminInput, 'resize-y')} maxLength={2000} rows={3} value={editor.textAfter} onChange={event => set('textAfter', event.target.value)} /></label>
        </> : <label className={wide}>{label(g('question'))}<textarea className={cn(adminInput, 'resize-y')} required maxLength={4000} rows={3} value={editor.question} onChange={event => set('question', event.target.value)} /></label>}
        {editor.type === 'fill_in_blank' && <>
          <label className={wide}>{label(g('alternativeAnswers'))}<textarea className={cn(adminInput, 'resize-y')} rows={3} value={editor.acceptedAnswers} onChange={event => set('acceptedAnswers', event.target.value)} /></label>
          <label className={wide}>{label(copy.gapHint)}<input className={adminInput} maxLength={100} value={editor.gapHint} onChange={event => set('gapHint', event.target.value)} /></label>
        </>}
        <label className={field}>{label(g('answer'))}<input className={adminInput} required maxLength={1000} value={editor.answer} onChange={event => set('answer', event.target.value)} /></label>
        <label className={field}>{label(g('options'))}<textarea className={cn(adminInput, 'resize-y')} required rows={3} value={editor.options} onChange={event => set('options', event.target.value)} /></label>
        <label className={wide}>{label(g('hint'))}<textarea className={cn(adminInput, 'resize-y')} rows={2} maxLength={2000} value={editor.hint} onChange={event => set('hint', event.target.value)} /></label>
        <label className={wide}>{label(g('audio'))}<input className={adminInput} type="url" value={editor.audio} onChange={event => set('audio', event.target.value)} /></label>
        <label className={field}>{label(g('ruHint'))}<textarea className={cn(adminInput, 'resize-y')} rows={2} maxLength={2000} value={editor.hintRu} onChange={event => set('hintRu', event.target.value)} /></label>
        <label className={field}>{label(g('trHint'))}<textarea className={cn(adminInput, 'resize-y')} rows={2} maxLength={2000} value={editor.hintTr} onChange={event => set('hintTr', event.target.value)} /></label>
      </div>
      <div className="rounded-lg bg-[var(--surface-muted)] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{g('preview')}</p><p className="mt-2 text-base">{editor.translationPrompts[lang]?.trim() || (editor.type === 'fill_in_blank' ? <>{editor.textBefore}<strong className="text-[var(--accent-text)]">[{editor.answer || '…'}]</strong>{editor.textAfter}</> : editor.question)}{editor.targetForms.trim() && <span lang="de"> [{editor.targetForms.split('\n').map(value => value.trim()).filter(Boolean).join(', ')}]</span>}</p></div>
      <div className="flex justify-end"><button type="submit" disabled={busy} className={adminButton('primary', 'md', 'w-full sm:w-auto')}>{busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}{g('save')}</button></div>
    </form>}
    <section className="space-y-3" aria-labelledby="exercise-list-heading">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="exercise-list-heading" className="text-sm font-semibold">{g('manageCount', { count: filtered.length })}</h2>
        <div className="grid min-w-0 gap-2 sm:w-auto sm:grid-cols-[16rem_10rem]">
          <label className="relative block min-w-0"><span className="sr-only">{g('search')}</span><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" /><input type="search" className={`${adminInput} pl-9`} value={query} placeholder={g('search')} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label>
          <label className="block min-w-0"><span className="sr-only">{g('allLevels')}</span><select className={adminInput} value={level} onChange={event => { setLevel(event.target.value); setPage(1) }}><option value="">{g('allLevels')}</option>{ACCESS_LEVELS.map(value => <option key={value}>{value}</option>)}</select></label>
        </div>
      </div>
      {filtered.length === 0 ? <Card><EmptyState icon={BookOpenCheck} title={items.length ? g('noResults') : g('empty')} /></Card> : <Card as="div"><ul className="divide-y divide-[var(--admin-line)]">
        {filtered.slice(0, page * 30).map(row => <li key={row.id}><article className="flex min-w-0 items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5"><Badge tone="info">{row.level}</Badge><Badge>{row.type === 'fill_in_blank' ? g('fill') : g('choice')}</Badge>{(row.content_status === 'incomplete' || !readTargetForms(row.content)) && <Badge tone="warning">{g('incomplete')}</Badge>}</div>
            <h3 className="mt-2 break-words text-[0.9375rem] font-semibold">{row.topic} <span className="font-normal text-[var(--muted)]">· {row.lesson}</span></h3>
            <p className="mt-1 break-words text-sm text-[var(--muted)]">{previewFor(row)}</p>
            {deleteId === row.id && <div role="alert" className="mt-3 rounded-lg border border-[var(--admin-line-strong)] p-3 text-sm"><p>{g('deleteQuestion')}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" disabled={busy} onClick={() => setDeleteId(null)} className={adminButton('secondary', 'sm')}>{g('cancel')}</button><button type="button" disabled={busy} onClick={() => handleDelete(row.id)} className={adminButton('danger', 'sm')}>{busy && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{g('deleteConfirm')}</button></div></div>}
          </div>
          <div className="flex shrink-0 gap-2"><button type="button" disabled={busy} onClick={() => setDeleteId(row.id)} className={adminButton('secondary', 'icon', 'h-11 w-11')} aria-label={`${g('remove')}: ${row.topic}`}><Trash2 size={16} aria-hidden="true" /></button><button type="button" onClick={() => openEditor(row)} disabled={busy || !['fill_in_blank', 'multiple_choice'].includes(row.type)} className={adminButton('secondary', 'sm')} aria-label={`${g('edit')}: ${row.topic}`}><Pencil size={16} aria-hidden="true" /><span className="sr-only lg:not-sr-only">{g('edit')}</span></button></div>
        </article></li>)}
      </ul></Card>}
      {filtered.length > page * 30 && <button type="button" onClick={() => setPage(previous => previous + 1)} className={adminButton('secondary', 'md', 'w-full sm:w-auto')}>{g('manageCount', { count: Math.min(30, filtered.length - page * 30) })}<Plus size={16} aria-hidden="true" /></button>}
    </section>
  </div>
}
