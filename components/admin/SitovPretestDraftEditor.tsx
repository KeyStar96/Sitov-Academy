'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { saveSitovPronunciationPretestDraft } from '@/app/actions/sitov-pronunciation-pretest'
import { sitovPretestAuthorDefinitionSchema, sitovPretestAuthorSavedSchema, type SitovPretestAuthorSaveInput } from '@/lib/sitov-pronunciation-pretest-author-contract'
import { sitovPretestEditorCopy, sitovStaffText } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
import PressableCard from '@/components/motion/PressableCard'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import styles from './SitovPretestDraftEditor.module.css'

export type SitovSavedDraft = z.infer<typeof sitovPretestAuthorSavedSchema>
type Definition = z.infer<typeof sitovPretestAuthorDefinitionSchema>
interface Props { textId: string; textVersion: string; sourceVersion?: string; definition?: Record<string, unknown>; baseDefinitionId: string | null; lang: string; onSaved: (saved: SitovSavedDraft) => void; onReload: () => void }

/** Parent keys this editor by authenticated account, text, locale and source. */
export default function SitovPretestDraftEditor({ textId, textVersion, sourceVersion, definition, baseDefinitionId, lang, onSaved, onReload }: Props) {
  const copy = sitovPretestEditorCopy(lang)
  const initial = useMemo(() => sitovPretestAuthorDefinitionSchema.safeParse(definition), [definition])
  const [draft, setDraft] = useState<Definition | null>(initial.success ? initial.data : null)
  const [json, setJson] = useState(initial.success ? JSON.stringify(initial.data, null, 2) : '')
  const [jsonDirty, setJsonDirty] = useState(false)
  const [jsonInvalid, setJsonInvalid] = useState(false)
  const [state, setState] = useState<'idle' | 'pending' | 'uncertain' | 'conflict' | 'failed'>('idle')
  const pending = useRef(false)
  const request = useRef<SitovPretestAuthorSaveInput | null>(null)
  const live = useRef(true)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const id = useId()
  const parsed = useMemo(() => sitovPretestAuthorDefinitionSchema.safeParse(draft), [draft])
  const outdated = sourceVersion !== undefined && sourceVersion !== textVersion
  const locked = state !== 'idle' || outdated
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => { if (state !== 'idle' && state !== 'pending') statusRef.current?.focus({ preventScroll: true }) }, [state])

  function changeTask(index: number, patch: Partial<Definition['tasks'][number]>) {
    if (locked || !draft) return
    const next = { ...draft, tasks: draft.tasks.map((task, position) => position === index ? { ...task, ...patch } : task) }
    setDraft(next); setJson(JSON.stringify(next, null, 2)); setJsonInvalid(false); setJsonDirty(false)
  }
  function importJson() {
    if (locked) return
    try {
      const value = sitovPretestAuthorDefinitionSchema.safeParse(JSON.parse(json))
      if (!value.success) { setJsonInvalid(true); return }
      setDraft(value.data); setJson(JSON.stringify(value.data, null, 2)); setJsonInvalid(false); setJsonDirty(false)
    } catch { setJsonInvalid(true) }
  }
  async function save() {
    if (pending.current || outdated || (state !== 'idle' && state !== 'uncertain')) return
    if (!request.current) {
      if (!parsed.success || jsonInvalid || jsonDirty) return
      try { request.current = { textId, textVersion, baseDefinitionId, definition: parsed.data, requestId: crypto.randomUUID() } }
      catch { setState('failed'); return }
    }
    const payload = request.current
    pending.current = true; setState('pending')
    try {
      const result = await saveSitovPronunciationPretestDraft(payload)
      if (!live.current) return
      if (result.ok === false) { setState(result.retryable ? 'uncertain' : result.error === 'version_conflict' || result.error === 'request_conflict' ? 'conflict' : 'failed'); return }
      const ack = sitovPretestAuthorSavedSchema.safeParse(result.data)
      if (!ack.success || ack.data.text_id !== payload.textId || ack.data.text_version !== payload.textVersion || JSON.stringify(ack.data.definition) !== JSON.stringify(payload.definition)) { setState('uncertain'); return }
      onSaved(ack.data)
    } catch { if (live.current) setState('uncertain') }
    finally { pending.current = false }
  }
  return <SitovMotionStage className={styles.sitovEditor} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>{copy.title}</h3><p>{copy.hint}</p>
    {outdated && <p role="alert">{copy.outdated}</p>}
    {draft ? <fieldset disabled={locked} className={styles.sitovFields}><legend>{copy.questions}</legend>
      {draft.tasks.map((task, index) => <details key={task.id} open={index === 0} className={styles.sitovQuestion}>
        <summary>{sitovStaffText(copy.question, { number: index + 1 })}: <span lang="de" translate="no">{task.promptDe}</span></summary>
        <label>{copy.prompt}<textarea lang="de" translate="no" value={task.promptDe} maxLength={500} onChange={event => changeTask(index, { promptDe: event.target.value })} /></label>
        <label>{copy.fragment}<textarea lang="de" translate="no" value={task.fragmentDe ?? ''} maxLength={300} onChange={event => changeTask(index, { fragmentDe: event.target.value || null })} /></label>
        {task.options.map((option, optionIndex) => <label key={option.id}>{sitovStaffText(copy.option, { number: optionIndex + 1 })}<textarea lang="de" translate="no" value={option.textDe} maxLength={300} onChange={event => changeTask(index, { options: task.options.map(item => item.id === option.id ? { ...item, textDe: event.target.value } : item) })} /></label>)}
        <label>{copy.solution}<select value={task.correctOptionId} onChange={event => changeTask(index, { correctOptionId: event.target.value })}>{task.options.map(option => <option key={option.id} value={option.id} lang="de" translate="no">{option.textDe}</option>)}</select></label>
        <label>{copy.rationale}<textarea lang="de" translate="no" value={task.rationaleDe} maxLength={3000} onChange={event => changeTask(index, { rationaleDe: event.target.value })} /></label>
      </details>)}
    </fieldset> : <p>{copy.importNeeded}</p>}
    <details><summary>{copy.advanced}</summary><label>{copy.json}<textarea className={styles.sitovJson} lang="de" translate="no" disabled={locked} value={json} onChange={event => { setJson(event.target.value); setJsonDirty(true) }} /></label><PressableCard disabled={locked} onClick={importJson}>{copy.import}</PressableCard></details>
    {(jsonInvalid || (draft && !parsed.success)) && <p role="alert">{copy.invalid}</p>}
    {state !== 'idle' && <p ref={statusRef} tabIndex={-1} role={state === 'pending' ? 'status' : 'alert'}>{copy[state]}</p>}
    <div className={styles.sitovActions}>
      <PressableCard disabled={locked || !parsed.success || jsonInvalid || jsonDirty} aria-busy={state === 'pending'} onClick={() => void save()}>{state === 'pending' ? copy.pending : copy.save}</PressableCard>
      {state === 'uncertain' && <PressableCard onClick={() => void save()}>{copy.retry}</PressableCard>}
      {(state === 'conflict' || state === 'failed' || outdated) && <PressableCard onClick={onReload}>{copy.reload}</PressableCard>}
    </div>
    <SitovTrainerHelp title={copy.help}><p>{copy.helpBody}</p></SitovTrainerHelp>
  </SitovMotionStage>
}
