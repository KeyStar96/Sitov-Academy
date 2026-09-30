'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { interveneTeacherPath } from '@/app/actions/teacher-dashboard'
import type { TeacherDetailData, TeacherIntervention } from '@/lib/teacher-dashboard-contract'
import { teacherDashboardT, teacherDashboardError } from '@/lib/teacher-dashboard-i18n'
import AdminDialog from './AdminDialog'
import { displayDate, dashboardPanel as panel } from './TeacherDashboardShared'
import { Badge, adminButton } from './ui'

/** Answer payloads come from server assessment; this formats them without scoring. */
export function teacherAnswerText(value: unknown, prompt?: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(item => teacherAnswerText(item)).join(' · ')
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>
    const snapshot = prompt && typeof prompt === 'object' ? prompt as Record<string, unknown> : {}
    const content = snapshot.content && typeof snapshot.content === 'object' ? snapshot.content as Record<string, unknown> : snapshot
    if (typeof object.index === 'number' && Array.isArray(content.options) && typeof content.options[object.index] === 'string') return content.options[object.index]
    if (Array.isArray(object.indices) && Array.isArray(content.parts)) {
      const parts = content.parts
      return object.indices.map(index => typeof index === 'number' && typeof parts[index] === 'string' ? parts[index] : String(index)).join(' ')
    }
    for (const key of ['text', 'correct_answer', 'question', 'prompt', 'source']) if (typeof object[key] === 'string') return object[key]
    if (object.text_before !== undefined || object.text_after !== undefined) return `${String(object.text_before ?? '')} … ${String(object.text_after ?? '')}`
    if (object.content !== undefined) return teacherAnswerText(object.content)
    if (Array.isArray(object.parts)) return object.parts.join(' · ')
    if (typeof object.instruction === 'string') return object.instruction
    if (object.index !== undefined) return String(Number(object.index) + 1)
    if (Array.isArray(object.indices)) return object.indices.map(index => Number(index) + 1).join(' → ')
    return JSON.stringify(object)
  }
  return String(value)
}
function gradedCorrect(value: unknown): boolean | null {
  if (!value || typeof value !== 'object') return null
  const result = value as Record<string, unknown>
  if (typeof result.correct === 'boolean') return result.correct
  return null
}
export default function TeacherStudentPath({ data, studentId, studentName, lang, canIntervene = true }: {
  data: TeacherDetailData['path']; studentId: string; studentName: string; lang: string; canIntervene?: boolean
}) {
  const t = teacherDashboardT(lang), router = useRouter()
  const [pending, setPending] = useState<(TeacherIntervention & { title: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const lock = useRef(false)
  const choose = (unitId: string, title: string, action: TeacherIntervention['action'], nodeId: string | null = null) => {
    if (lock.current) return
    setError(null); setSuccess(false)
    setPending({ studentId, unitId, action, nodeId, requestId: crypto.randomUUID(), title })
  }
  const confirm = async () => {
    if (!pending || lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try {
      const { title: _title, ...input } = pending
      const result = await interveneTeacherPath(input)
      if (result.error) { setError(teacherDashboardError(lang, result.error)); return }
      setPending(null); setSuccess(true); router.refresh()
    } catch { setError(teacherDashboardError(lang, 'request_failed')) }
    finally { lock.current = false; setBusy(false) }
  }
  const button = adminButton('secondary', 'sm')
  const primary = adminButton('primary', 'sm')
  return <div className="min-w-0 space-y-4 sm:space-y-5">
    {success && <p role="status" className="rounded-xl bg-[var(--admin-success-soft)] px-4 py-3 text-sm font-medium text-[var(--success)]">{t('interventionDone')}</p>}
    {data.paths.length === 0 && <p className={`${panel} text-sm text-[var(--muted)]`}>{t('empty')}</p>}
    {data.paths.map(path => <section key={path.id} data-testid={`teacher-path-${path.id}`} className={panel}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h2 className="break-words text-[0.9375rem] font-semibold">{path.level} · {path.title}</h2><Badge tone={path.completed ? 'success' : path.available ? 'info' : 'neutral'} className="mt-1.5">{t(path.completed ? 'completed' : path.available ? 'available' : 'locked')}</Badge></div>{canIntervene && <div className="flex flex-col gap-2 sm:flex-row"><button type="button" disabled={busy} className={button} onClick={() => choose(path.id, path.title, 'reset_path')}>{t('reset_path')}</button><button type="button" disabled={busy} className={primary} onClick={() => choose(path.id, path.title, 'unlock')}>{t('unlock')}</button></div>}</header>
      <ol className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{path.nodes.map(node => <li key={node.id} className={`min-w-0 rounded-lg border border-[var(--admin-line)] p-3 ${node.available ? 'bg-[var(--surface)]' : 'bg-[var(--surface-muted)]'}`}><div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-sm font-semibold">{node.title}</h3><p role="img" className="shrink-0 text-sm text-[var(--accent-text)]" aria-label={t('stars', { count: node.stars })}><span aria-hidden="true">{'★'.repeat(node.stars)}{'☆'.repeat(3 - node.stars)}</span></p></div><p className="mt-1 text-xs text-[var(--muted)]">{t(node.status === 'completed' ? 'completed' : node.status === 'in_progress' ? 'in_progress' : node.available ? 'available' : 'locked')}</p>{canIntervene && node.kind === 'test' && <button type="button" disabled={busy} className={`${button} mt-3 w-full`} onClick={() => choose(path.id, `${path.title} · ${node.title}`, 'reset_test', node.id)}>{t('reset_test')}</button>}</li>)}</ol>
    </section>)}
    <section className={panel}><h2 className="mb-3 text-sm font-semibold">{t('attempts')}</h2>{data.attempts.length === 0 ? <p className="text-sm text-[var(--muted)]">{t('empty')}</p> : <div className="space-y-2">{data.attempts.map(attempt => <details key={attempt.id} data-testid={`teacher-attempt-${attempt.id}`} className="rounded-lg border border-[var(--admin-line)]"><summary className="flex min-h-12 cursor-pointer items-center break-words px-4 py-2 text-sm font-medium">{attempt.title} · {attempt.percentage == null ? t('pending') : `${attempt.percentage}%`} · {displayDate(attempt.completedAt ?? attempt.createdAt, lang)}{!attempt.isActive && ` · ${t('archived')}`}</summary><ol className="space-y-3 border-t border-[var(--admin-line)] p-4 text-sm">{attempt.answers.map(answer => <li key={answer.exerciseId} className="min-w-0 space-y-1.5 break-words rounded-lg bg-[var(--surface-muted)] p-3"><p className="font-semibold">{answer.position}. {teacherAnswerText(answer.prompt)}</p><p><strong>{t('answer')}:</strong> {teacherAnswerText(answer.answer, answer.prompt)}</p><p>{t(gradedCorrect(answer.result) === null ? 'pending' : gradedCorrect(answer.result) ? 'correct' : 'incorrect')}</p>{answer.solution != null && <p><strong>{t('solution')}:</strong> {teacherAnswerText(answer.solution)}</p>}</li>)}</ol></details>)}</div>}</section>
    <section className={panel}><h2 className="mb-3 text-sm font-semibold">{t('audit')}</h2>{data.interventions.length === 0 ? <p className="text-sm text-[var(--muted)]">{t('empty')}</p> : <ol className="divide-y divide-[var(--admin-line)] text-sm">{data.interventions.map(item => <li key={item.id} className="break-words py-2.5 first:pt-0 last:pb-0"><p className="font-semibold">{t(item.action)} · {data.paths.find(path => path.id === item.unitId)?.title ?? item.unitId}</p>{item.nodeId && <p>{data.paths.flatMap(path => path.nodes).find(node => node.id === item.nodeId)?.title ?? item.nodeId}</p>}<p>{displayDate(item.createdAt, lang)} · {t('actor')}: {item.createdBy}</p></li>)}</ol>}</section>
    {pending && <AdminDialog title={t(pending.action)} subtitle={t('confirmIntervention', { action: t(pending.action), name: studentName, path: pending.title })} onClose={() => { if (!lock.current) setPending(null) }} dismissible={!busy}><div className="space-y-5 overflow-y-auto p-4 sm:p-6"><p className="text-sm leading-relaxed">{t(pending.action === 'unlock' ? 'unlockHint' : 'resetHint')}</p>{error && <p role="alert" className="rounded-lg bg-[var(--admin-danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}<div className="flex gap-3 sm:justify-end"><button type="button" className={adminButton('secondary', 'md', 'flex-1 sm:flex-none')} disabled={busy} onClick={() => setPending(null)}>{t('cancel')}</button><button type="button" className={adminButton('primary', 'md', 'flex-1 sm:flex-none')} disabled={busy} onClick={() => void confirm()}>{t(busy ? 'saving' : 'confirm')}</button></div></div></AdminDialog>}
  </div>
}
