'use client'

import { useMemo, useRef, useState, type FormEvent } from 'react'
import { BookOpenCheck, CheckCircle2, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { saveGrammarExercise, removeGrammarExercise } from '@/app/actions/grammar-cms'
import { grammarWriteSchema, normalizeGrammarAnswer, type GrammarExerciseRow } from '@/lib/grammar-validation'
import { parseFillInBlankContent, parseMultipleChoiceContent, readTargetForms } from '@/lib/types/exercise'
import { grammarTranslator } from '@/lib/grammar-i18n'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import type { Json } from '@/supabase/database.types'
import styles from '@/components/exercises/GrammarStudio.module.css'

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

  return <section className={styles.shell}>
    <header className={styles.hero}>
      <div><span className={styles.eyebrow}><BookOpenCheck size={17} aria-hidden="true" />{g('total')}</span><h1 className={styles.title}>{g('adminTitle')}</h1><p className={styles.subtitle}>{g('adminSubtitle')}</p></div>
      <button type="button" disabled={busy} onClick={() => openEditor()} className="academy-button academy-button-primary"><Plus size={19} aria-hidden="true" />{g('newExercise')}</button>
    </header>
    {message && <p role={message === 'invalid' || message === 'failed' ? 'alert' : 'status'} className={`${styles.notice} rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]`}><CheckCircle2 size={18} aria-hidden="true" />{g(message)}</p>}
    {editor && <form onSubmit={handleSave} ref={editorRef} className={styles.editor}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{g(editor.id ? 'editExercise' : 'newExercise')}</h2><button type="button" disabled={busy} onClick={() => setEditor(null)} className="academy-button academy-button-secondary"><X size={17} aria-hidden="true" />{g('cancel')}</button></div>
      <div className={styles.editorGrid}>
        <label className={styles.field}>{g('level', { level: '' })}<select value={editor.level} onChange={event => set('level', event.target.value)}>{ACCESS_LEVELS.map(value => <option key={value}>{value}</option>)}</select></label>
        <label className={styles.field}>{g('type')}<select value={editor.type} onChange={event => set('type', event.target.value)}><option value="fill_in_blank">{g('fill')}</option><option value="multiple_choice">{g('choice')}</option></select></label>
        <label className={styles.field}>{g('lesson')}<input required maxLength={120} value={editor.lesson} onChange={event => set('lesson', event.target.value)} /></label>
        <label className={styles.field}>{g('topic')}<input required maxLength={160} value={editor.topic} onChange={event => set('topic', event.target.value)} /></label>
        <label className={`${styles.field} ${styles.wide}`}>{g('instruction')}<input maxLength={500} value={editor.instruction} onChange={event => set('instruction', event.target.value)} /></label>
        <label className={`${styles.field} ${styles.wide}`}>{g('targetForms')}<textarea required rows={2} value={editor.targetForms} onChange={event => set('targetForms', event.target.value)} /></label>
        <p className={`${styles.wide} text-[var(--muted)]`}>{g('targetFormsHelp')}</p>
        {(['de', 'en', 'ru', 'uk', 'tr'] as const).map(locale => <label key={locale} className={`${styles.field} ${styles.wide}`}>{g('translationPrompt', { language: locale.toUpperCase() })}<textarea rows={2} maxLength={2000} value={editor.translationPrompts[locale] ?? ''} onChange={event => setEditor(previous => previous ? { ...previous, translationPrompts: { ...previous.translationPrompts, [locale]: event.target.value } } : previous)} /></label>)}
        {editor.type === 'fill_in_blank' ? <>
          <label className={styles.field}>{g('before')}<textarea maxLength={2000} rows={3} value={editor.textBefore} onChange={event => set('textBefore', event.target.value)} /></label>
          <label className={styles.field}>{g('after')}<textarea maxLength={2000} rows={3} value={editor.textAfter} onChange={event => set('textAfter', event.target.value)} /></label>
        </> : <label className={`${styles.field} ${styles.wide}`}>{g('question')}<textarea required maxLength={4000} rows={3} value={editor.question} onChange={event => set('question', event.target.value)} /></label>}
        {editor.type === 'fill_in_blank' && <>
          <label className={`${styles.field} ${styles.wide}`}>{g('alternativeAnswers')}<textarea rows={3} value={editor.acceptedAnswers} onChange={event => set('acceptedAnswers', event.target.value)} /></label>
          <label className={`${styles.field} ${styles.wide}`}>Lücken-Hinweis (z.B. (morgen / arbeiten / müssen))<input maxLength={100} value={editor.gapHint} onChange={event => set('gapHint', event.target.value)} /></label>
        </>}
        <label className={styles.field}>{g('answer')}<input required maxLength={1000} value={editor.answer} onChange={event => set('answer', event.target.value)} /></label>
        <label className={styles.field}>{g('options')}<textarea required rows={3} value={editor.options} onChange={event => set('options', event.target.value)} /></label>
        <label className={`${styles.field} ${styles.wide}`}>{g('hint')}<textarea rows={2} maxLength={2000} value={editor.hint} onChange={event => set('hint', event.target.value)} /></label>
        <label className={`${styles.field} ${styles.wide}`}>{g('audio')}<input type="url" value={editor.audio} onChange={event => set('audio', event.target.value)} /></label>
        <label className={styles.field}>{g('ruHint')}<textarea rows={2} maxLength={2000} value={editor.hintRu} onChange={event => set('hintRu', event.target.value)} /></label>
        <label className={styles.field}>{g('trHint')}<textarea rows={2} maxLength={2000} value={editor.hintTr} onChange={event => set('hintTr', event.target.value)} /></label>
      </div>
      <div className={styles.preview}><span className={styles.eyebrow}>{g('preview')}</span><p className="mt-2 text-lg">{editor.translationPrompts[lang]?.trim() || (editor.type === 'fill_in_blank' ? <>{editor.textBefore}<strong className="text-[var(--violet)]">[{editor.answer || '…'}]</strong>{editor.textAfter}</> : editor.question)}{editor.targetForms.trim() && <span lang="de"> [{editor.targetForms.split('\n').map(value => value.trim()).filter(Boolean).join(', ')}]</span>}</p></div>
      <button type="submit" disabled={busy} className="academy-button academy-button-primary">{busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}{g('save')}</button>
    </form>}
    <div className={styles.sectionHeading}>
      <h2>{g('manageCount', { count: filtered.length })}</h2>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <label className="relative block"><span className="sr-only">{g('search')}</span><Search size={17} className="pointer-events-none absolute left-3 top-4 text-[var(--muted)]" aria-hidden="true" /><input type="search" className={`${styles.search} !pl-10`} value={query} placeholder={g('search')} onChange={event => { setQuery(event.target.value); setPage(1) }} /></label>
        <label className={styles.field}><span className="sr-only">{g('allLevels')}</span><select value={level} onChange={event => { setLevel(event.target.value); setPage(1) }}><option value="">{g('allLevels')}</option>{ACCESS_LEVELS.map(value => <option key={value}>{value}</option>)}</select></label>
      </div>
    </div>
    <div className={styles.list}>
      {filtered.slice(0, page * 30).map(row => <article key={row.id} className={styles.listCard}>
        <div className={styles.listContent}><span className={styles.badge}>{row.level} · {row.type === 'fill_in_blank' ? g('fill') : g('choice')}</span>{(row.content_status === 'incomplete' || !readTargetForms(row.content)) && <span className="ml-2 inline-block rounded-full bg-[var(--warning)] px-3 py-1 text-sm font-semibold text-[var(--warning-foreground)]">{g('incomplete')}</span>}<h3 className="mt-3">{row.topic} <span className="font-normal text-[var(--muted)]">· {row.lesson}</span></h3><p>{previewFor(row)}</p>
          {deleteId === row.id && <div role="alert" className="mt-3 rounded-xl border border-[var(--border)] p-3"><p>{g('deleteQuestion')}</p><div className={styles.actions}><button type="button" disabled={busy} onClick={() => setDeleteId(null)} className="academy-button academy-button-secondary">{g('cancel')}</button><button type="button" disabled={busy} onClick={() => handleDelete(row.id)} className="academy-button academy-button-primary">{busy && <Loader2 size={17} className="animate-spin" aria-hidden="true" />}{g('deleteConfirm')}</button></div></div>}
        </div>
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => setDeleteId(row.id)} className="academy-button academy-button-secondary" aria-label={`${g('remove')}: ${row.topic}`}><Trash2 size={17} aria-hidden="true" /></button><button type="button" onClick={() => openEditor(row)} disabled={busy || !['fill_in_blank', 'multiple_choice'].includes(row.type)} className="academy-button academy-button-secondary" aria-label={`${g('edit')}: ${row.topic}`}><Pencil size={17} aria-hidden="true" /><span className="sr-only lg:not-sr-only">{g('edit')}</span></button></div>
      </article>)}
      {filtered.length === 0 && <div className={styles.empty}><BookOpenCheck size={34} className="mx-auto text-[var(--violet)]" aria-hidden="true" /><p>{items.length ? g('noResults') : g('empty')}</p></div>}
    </div>
    {filtered.length > page * 30 && <button type="button" onClick={() => setPage(previous => previous + 1)} className="academy-button academy-button-secondary mt-4">{g('manageCount', { count: Math.min(30, filtered.length - page * 30) })}<Plus size={18} aria-hidden="true" /></button>}
  </section>
}
