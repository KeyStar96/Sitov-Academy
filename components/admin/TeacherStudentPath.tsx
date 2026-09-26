'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { interveneTeacherPath } from '@/app/actions/teacher-dashboard'
import type { TeacherDetailData, TeacherIntervention } from '@/lib/teacher-dashboard-contract'
import { teacherDashboardT, teacherDashboardError } from '@/lib/teacher-dashboard-i18n'
import AdminDialog from './AdminDialog'
import { displayDate, dashboardButton as button, dashboardPanel as panel } from './TeacherDashboardShared'

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
  return <div className="space-y-6">
    {success && <p role="status" className={panel}>{t('interventionDone')}</p>}
    {data.paths.length === 0 && <p>{t('empty')}</p>}
    {data.paths.map(path => <section key={path.id} data-testid={`teacher-path-${path.id}`} className={panel}>
      <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{path.level} · {path.title}</h2><p className="mt-1 text-base">{t(path.completed ? 'completed' : path.available ? 'available' : 'locked')}</p></div>{canIntervene && <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} className={button} onClick={() => choose(path.id, path.title, 'reset_path')}>{t('reset_path')}</button><button type="button" disabled={busy} className={`${button} bg-[var(--accent-strong)] text-[var(--accent-foreground)]`} onClick={() => choose(path.id, path.title, 'unlock')}>{t('unlock')}</button></div>}</header>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{path.nodes.map(node => <li key={node.id} className={`min-w-0 rounded-2xl border p-4 ${node.available ? 'border-[var(--border)] bg-[var(--mode-path-surface)]' : 'border-[var(--border)] bg-[var(--surface-muted)]'}`}><h3 className="break-words text-lg font-bold">{node.title}</h3><p className="mt-2 text-base">{t(node.status === 'completed' ? 'completed' : node.status === 'in_progress' ? 'in_progress' : node.available ? 'available' : 'locked')}</p><p role="img" className="my-2 text-xl text-[var(--foreground)]" aria-label={t('stars', { count: node.stars })}><span aria-hidden="true">{'★'.repeat(node.stars)}{'☆'.repeat(3 - node.stars)}</span></p>{canIntervene && node.kind === 'test' && <button type="button" disabled={busy} className={`${button} w-full`} onClick={() => choose(path.id, `${path.title} · ${node.title}`, 'reset_test', node.id)}>{t('reset_test')}</button>}</li>)}</ol>
    </section>)}
    <section className={panel}><h2 className="mb-4 text-xl font-bold">{t('attempts')}</h2>{data.attempts.length === 0 ? <p>{t('empty')}</p> : <div className="space-y-4">{data.attempts.map(attempt => <details key={attempt.id} data-testid={`teacher-attempt-${attempt.id}`} className="rounded-xl border border-[var(--border)]"><summary className="min-h-12 cursor-pointer break-words p-4 text-lg font-semibold">{attempt.title} · {attempt.percentage == null ? t('pending') : `${attempt.percentage}%`} · {displayDate(attempt.completedAt ?? attempt.createdAt, lang)}{!attempt.isActive && ` · ${t('archived')}`}</summary><ol className="space-y-4 border-t border-[var(--border)] p-4">{attempt.answers.map(answer => <li key={answer.exerciseId} className="min-w-0 space-y-2 break-words rounded-xl bg-[var(--surface-muted)] p-4"><p className="text-lg font-semibold">{answer.position}. {teacherAnswerText(answer.prompt)}</p><p><strong>{t('answer')}:</strong> {teacherAnswerText(answer.answer, answer.prompt)}</p><p>{t(gradedCorrect(answer.result) === null ? 'pending' : gradedCorrect(answer.result) ? 'correct' : 'incorrect')}</p>{answer.solution != null && <p><strong>{t('solution')}:</strong> {teacherAnswerText(answer.solution)}</p>}</li>)}</ol></details>)}</div>}</section>
    <section className={panel}><h2 className="mb-4 text-xl font-bold">{t('audit')}</h2>{data.interventions.length === 0 ? <p>{t('empty')}</p> : <ol className="space-y-4">{data.interventions.map(item => <li key={item.id} className="break-words border-b border-[var(--border)] pb-3"><p className="font-semibold">{t(item.action)} · {data.paths.find(path => path.id === item.unitId)?.title ?? item.unitId}</p>{item.nodeId && <p>{data.paths.flatMap(path => path.nodes).find(node => node.id === item.nodeId)?.title ?? item.nodeId}</p>}<p>{displayDate(item.createdAt, lang)} · {t('actor')}: {item.createdBy}</p></li>)}</ol>}</section>
    {pending && <AdminDialog title={t(pending.action)} subtitle={t('confirmIntervention', { action: t(pending.action), name: studentName, path: pending.title })} onClose={() => { if (!lock.current) setPending(null) }} dismissible={!busy}><div className="space-y-5 overflow-y-auto p-5"><p className="text-base leading-relaxed">{t(pending.action === 'unlock' ? 'unlockHint' : 'resetHint')}</p>{error && <p role="alert">{error}</p>}<div className="flex flex-wrap justify-end gap-3"><button type="button" className={button} disabled={busy} onClick={() => setPending(null)}>{t('cancel')}</button><button type="button" className={`${button} bg-[var(--accent-strong)] text-[var(--accent-foreground)]`} disabled={busy} onClick={() => void confirm()}>{t(busy ? 'saving' : 'confirm')}</button></div></div></AdminDialog>}
  </div>
}
