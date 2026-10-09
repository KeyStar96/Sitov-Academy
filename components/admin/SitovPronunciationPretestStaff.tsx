'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import SitovPretestPublication, { type SitovPublishedPretest } from './SitovPretestPublication'
import SitovPretestDraftEditor, { type SitovSavedDraft } from './SitovPretestDraftEditor'
import { getSitovPronunciationPretestStaff } from '@/app/actions/sitov-pronunciation-pretest'
import SitovTrainerHelp from '@/components/motion/SitovTrainerHelp'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import PressableCard from '@/components/motion/PressableCard'
import { sitovPronunciationPretestAttemptResponseSchema, sitovPronunciationPretestTaskSchema, sitovPronunciationPretestPoolSchema } from '@/lib/sitov-pronunciation-pretest-contract'
import { toUiLocale } from '@/lib/locale-routing'
import { sitovPretestStaffCopy, sitovPretestEditorCopy, sitovPretestPublicationCopy, sitovStaffText } from '@/lib/sitov-pronunciation-pretest-staff-i18n'
import styles from './SitovPronunciationPretestStaff.module.css'

export interface SitovPretestStaffTarget { textId: string; level: string; title: string; textVersion: string }
interface Props { targets: readonly SitovPretestStaffTarget[]; levels: readonly string[]; lang: string; studentId?: string; accountId: string; initialLevel?: string }
const version = z.string().regex(/^[a-f0-9]{64}$/)
const staffDataSchema = z.object({
  definitions: z.array(z.object({ id: z.uuid(), text_id: z.uuid(), text_version: version, test_version: version, definition: z.record(z.string(), z.unknown()), active: z.boolean(), created_at: z.iso.datetime({ offset: true }) }).strict()),
  attempts: z.array(sitovPronunciationPretestAttemptResponseSchema),
}).strict()
type StaffData = z.infer<typeof staffDataSchema>

/** Private unknown definition fields never reach the rendered preview. */
function safePreview(raw: Record<string, unknown>) {
  if (!Array.isArray(raw.tasks) || !Array.isArray(raw.competencies)) return null
  const projected = raw.tasks.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const row = value as Record<string, unknown>
    const task = sitovPronunciationPretestTaskSchema.safeParse({ id: row.id, competencyId: row.competencyId, kind: row.kind, promptDe: row.promptDe,
      fragmentDe: row.fragmentDe ?? null, options: Array.isArray(row.options) ? row.options.map(option => {
        if (!option || typeof option !== 'object' || Array.isArray(option)) return null
        const item = option as Record<string, unknown>; return { id: item.id, textDe: item.textDe }
      }) : null })
    return task.success && typeof row.correctOptionId === 'string' && task.data.options.some(option => option.id === row.correctOptionId)
      ? { ...task.data, correctOptionId: row.correctOptionId } : null
  })
  if (projected.some(task => !task)) return null
  const tasks = projected.filter((task): task is NonNullable<typeof task> => Boolean(task))
  const competencies = raw.competencies.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const row = value as Record<string, unknown>; return { id: row.id, itemsPerAttempt: row.itemsPerAttempt }
  })
  const pool = sitovPronunciationPretestPoolSchema.safeParse({ policyId: raw.policyId, competencies, tasks: tasks.map(task => ({ id: task.id, competencyId: task.competencyId, kind: task.kind, promptDe: task.promptDe, fragmentDe: task.fragmentDe, options: task.options })) })
  return pool.success ? { tasks, competencies: pool.data.competencies } : null
}

export default function SitovPronunciationPretestStaff(props: Props) {
  return <SitovStaffSelection key={`${props.accountId}:${props.studentId ?? 'all'}:${props.lang}`} {...props} />
}

function SitovStaffSelection({ targets, levels, lang, studentId, accountId, initialLevel }: Props) {
  const copy = sitovPretestStaffCopy(lang)
  const options = [...new Set(levels)]
  const [level, setLevel] = useState(initialLevel && options.includes(initialLevel) ? initialLevel : options[0] ?? '')
  const [textId, setTextId] = useState('')
  const available = targets.filter(target => target.level === level && z.uuid().safeParse(target.textId).success && version.safeParse(target.textVersion).success)
  const target = available.find(row => row.textId === textId) ?? available[0]
  const id = useId()
  return <SitovMotionStage className={styles.sitovWindow} lang={toUiLocale(lang)} role="region" aria-labelledby={id}>
    <h2 id={id}>{copy.title}</h2>
    <p>{copy.readonly}</p>
    <div className={styles.sitovFilters}>
      <label>{copy.level}<select value={level} onChange={event => { setLevel(event.target.value); setTextId('') }}>
        {options.map(value => <option key={value} value={value}>{value}</option>)}
      </select></label>
      {target && <label>{copy.text}<select value={target.textId} onChange={event => setTextId(event.target.value)}>
        {available.map(row => <option key={row.textId} value={row.textId} lang="de" translate="no">{row.title}</option>)}
      </select></label>}
    </div>
    {target ? <SitovStaffText key={`${accountId}:${studentId}:${lang}:${level}:${target.textId}:${target.textVersion}`} target={target} lang={lang} studentId={studentId} accountId={accountId} />
      : <p role="status">{copy.noTexts}</p>}
    <section aria-label={copy.helpTitle}><SitovTrainerHelp title={copy.help}><h3>{copy.helpTitle}</h3><p>{copy.helpBody}</p><p>{copy.history}</p></SitovTrainerHelp></section>
  </SitovMotionStage>
}

function SitovStaffText({ target, studentId, lang, accountId }: { target: SitovPretestStaffTarget; studentId?: string; lang: string; accountId: string }) {
  const copy = sitovPretestStaffCopy(lang)
  const router = useRouter()
  const [publishedId, setPublishedId] = useState('')
  const publishedRef = useRef<HTMLParagraphElement>(null)
  const [savedId, setSavedId] = useState('')
  const savedRef = useRef<HTMLParagraphElement>(null)
  const [state, setState] = useState<'loading' | 'failed' | 'ready'>('loading')
  const [data, setData] = useState<StaffData | null>(null)
  const [definitionId, setDefinitionId] = useState('')
  const [newCurrent, setNewCurrent] = useState(false)
  const [reload, setReload] = useState(0)
  const generation = useRef(0)
  useEffect(() => {
    const request = ++generation.current
    async function load() {
      try {
        const response = await getSitovPronunciationPretestStaff({ textId: target.textId, studentId: studentId ?? null })
        if (generation.current !== request) return
        if (response.ok === false) { setState('failed'); return }
        const parsed = staffDataSchema.safeParse(response.data)
        if (!parsed.success || parsed.data.definitions.some(row => row.text_id !== target.textId) || parsed.data.attempts.some(row => row.attempt.textId !== target.textId)
          || new Set(parsed.data.definitions.map(row => row.id)).size !== parsed.data.definitions.length
          || new Set(parsed.data.attempts.map(row => row.attempt.id)).size !== parsed.data.attempts.length) { setState('failed'); return }
        setData(parsed.data); setState('ready')
      } catch { if (generation.current === request) setState('failed') }
    }
    void load()
    return () => { generation.current = request + 1 }
  }, [target.textId, studentId, reload])
  useEffect(() => { if (savedId) savedRef.current?.focus({ preventScroll: true }) }, [savedId])
  useEffect(() => { if (publishedId) publishedRef.current?.focus({ preventScroll: true }) }, [publishedId])
  function retry() { setData(null); setState('loading'); setReload(value => value + 1) }
  if (state === 'loading') return <>{publishedId && <p ref={publishedRef} tabIndex={-1} role="status">{sitovPretestPublicationCopy(lang).published}</p>}<p role="status">{copy.loading}</p></>
  if (state === 'failed') return <div role="alert"><p>{copy.failed}</p><PressableCard onClick={retry}>{copy.retry}</PressableCard></div>
  if (!data) return null
  const activeDefinition = data.definitions.find(row => row.active)
  const current = data.definitions.find(row => row.active && row.text_version === target.textVersion)
  const sorted = [...data.definitions].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || ((b.created_at.match(/\.(\d+)/)?.[1] ?? '').padEnd(9, '0').slice(3, 9)).localeCompare((a.created_at.match(/\.(\d+)/)?.[1] ?? '').padEnd(9, '0').slice(3, 9)) || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0))
  const selected = newCurrent ? undefined : data.definitions.find(row => row.id === definitionId) ?? current ?? sorted[0]
  const preview = selected ? safePreview(selected.definition) : null
  function acceptSaved(saved: SitovSavedDraft) {
    setData(previous => previous && { ...previous, definitions: [...previous.definitions.filter(row => row.id !== saved.id), saved] })
    setNewCurrent(false); setPublishedId(''); setDefinitionId(saved.id); setSavedId(saved.id)
  }
  function acceptPublished(ack: SitovPublishedPretest) { setPublishedId(ack.definitionId); setDefinitionId(ack.definitionId); setSavedId(''); retry(); router.refresh() }
  const attempts = [...data.attempts].sort((a, b) => Date.parse(b.attempt.updatedAt) - Date.parse(a.attempt.updatedAt))
  function timestamp(value: string) { return new Intl.DateTimeFormat(toUiLocale(lang), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(value)) }
  return <div className={styles.sitovContent}>
    <h3 lang="de" translate="no">{target.title}</h3>
    {selected ? <>
      <label>{copy.definition}<select value={selected.id} onChange={event => { setNewCurrent(false); setPublishedId(''); setDefinitionId(event.target.value) }}>
        {sorted.map(row => <option key={row.id} value={row.id}>{row.test_version.slice(0, 12)} · {row.active ? row.text_version === target.textVersion ? copy.current : copy.outdated : copy.inactive}</option>)}
      </select></label>
      <div className={styles.sitovVersionState}><strong>{selected.active ? selected.text_version === target.textVersion ? copy.current : copy.outdated : copy.inactive}</strong>
        <details><summary>{copy.version}</summary><dl><dt>{copy.textVersion}</dt><dd><code>{selected.text_version}</code></dd><dt>{copy.testVersion}</dt><dd><code>{selected.test_version}</code></dd></dl></details>
      </div>
      {preview ? <section aria-label={copy.questions}>
        {preview.competencies.map((core, coreIndex) => <section key={core.id} className={styles.sitovCompetency}>
          <h4>{sitovStaffText(copy.competency, { number: coreIndex + 1 })}</h4>
          <ol>{preview.tasks.filter(task => task.competencyId === core.id).map((task, questionIndex) => <li key={task.id}>
            <details><summary>{sitovStaffText(copy.question, { number: questionIndex + 1 })}: <span lang="de" translate="no">{task.promptDe}</span></summary>
              {task.fragmentDe && <p lang="de" translate="no">{task.fragmentDe}</p>}
              <ul>{task.options.map(option => <li key={option.id}><span lang="de" translate="no">{option.textDe}</span>{option.id === task.correctOptionId && <strong className={styles.sitovSolution}>{copy.solution}</strong>}</li>)}</ul>
            </details>
          </li>)}</ol>
        </section>)}
      </section> : <p role="status">{copy.invalid}</p>}
    </> : <p role="status">{copy.noDefinitions}</p>}
    <PressableCard onClick={() => { setNewCurrent(true); setPublishedId(''); setSavedId('') }}>{sitovPretestEditorCopy(lang).newCurrent}</PressableCard>
    {savedId && <p ref={savedRef} tabIndex={-1} role="status">{sitovPretestEditorCopy(lang).saved}</p>}
    <SitovPretestDraftEditor key={`${target.textId}:${target.textVersion}:${lang}:${selected?.id ?? 'new'}:${sorted[0]?.id ?? 'none'}`} textId={target.textId} textVersion={target.textVersion} sourceVersion={selected?.text_version} definition={selected?.definition} baseDefinitionId={sorted[0]?.id ?? null} lang={lang} onSaved={acceptSaved} onReload={() => { router.refresh(); retry() }} />
    {publishedId && <p ref={publishedRef} tabIndex={-1} role="status">{sitovPretestPublicationCopy(lang).published}</p>}
    <SitovPretestPublication scopeKey={`${accountId}:${studentId ?? 'all'}`} textId={target.textId} textVersion={target.textVersion} definition={selected} latestDefinitionId={sorted[0]?.id ?? null} baseActiveDefinitionId={activeDefinition?.id ?? null} lang={lang} onPublished={acceptPublished} onReload={() => { router.refresh(); retry() }} />
    <section aria-label={copy.results}><h3>{copy.results} <span>({attempts.length})</span></h3>
      {!attempts.length ? <p>{copy.noResults}</p> : <ol className={styles.sitovResults}>{attempts.slice(0, 20).map(row => {
        const isCurrent = current && row.attempt.textVersion === current.text_version && row.attempt.testVersion === current.test_version && row.attempt.status !== 'outdated'
        return <li key={row.attempt.id}>
          <strong>{row.attempt.status === 'passed' ? copy.passed : row.attempt.status === 'failed' ? copy.notPassed : row.attempt.status === 'outdated' ? copy.outdated : copy.inProgress}</strong>
          <span>{isCurrent ? copy.current : copy.outdated}</span>
          <p>{'result' in row && row.result ? sitovStaffText(copy.score, { correct: row.result.correct, total: row.result.total }) : sitovStaffText(copy.answered, { count: row.attempt.answeredCount, total: row.attempt.totalCount })}</p>
          <time dateTime={row.attempt.updatedAt}>{timestamp(row.attempt.updatedAt)}</time>
        </li>
      })}</ol>}
      {attempts.length > 20 && <p>{copy.limited}</p>}
    </section>
  </div>
}
