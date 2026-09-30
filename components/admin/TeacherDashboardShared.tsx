import { TriangleAlert } from 'lucide-react'
import { teacherDashboardT, teacherAttentionLabel } from '@/lib/teacher-dashboard-i18n'
import { teacherDistribution, type TeacherPhases } from '@/lib/teacher-dashboard-contract'
import { phaseBarClasses } from '@/lib/vocabulary-ui'
import { adminButton, adminInput } from './ui'

/** Gemeinsame Klassen der Schüleransichten – abgeleitet aus dem Admin-UI-Kit. */
export const dashboardControl = adminInput
export const dashboardButton = adminButton('secondary', 'md')
export const dashboardPanel = 'min-w-0 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:p-5'
export function studyTime(seconds: number, lang: string) { return teacherDashboardT(lang)('minutes', { count: Math.round(seconds / 60) }) }
export function displayDate(value: string | null, lang: string) {
  if (!value) return teacherDashboardT(lang)('never')
  // ICU versions disagree on date/time joining words. Compose numeric parts so
  // the server and Safari render identical text, including Berlin's DST offset.
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23', timeZone: 'Europe/Berlin',
  }).formatToParts(new Date(value))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? ''
  const date = lang === 'en' ? `${part('month')}/${part('day')}/${part('year')}` : `${part('day')}.${part('month')}.${part('year')}`
  return `${date} · ${part('hour')}:${part('minute')}`
}
export function AttentionReasons({ reasons, lang, compact = false }: { reasons: string[]; lang: string; compact?: boolean }) {
  const t = teacherDashboardT(lang)
  if (!reasons.length) return <span className="text-sm text-[var(--muted)]">{t('noAttention')}</span>
  if (compact) {
    return <ul className="flex flex-wrap gap-1.5" aria-label={t('attention')}>{reasons.map(reason => <li key={reason}><span className="inline-flex items-center gap-1 rounded-md bg-[var(--warning)] px-2 py-0.5 text-xs font-semibold leading-5 text-[var(--warning-foreground)]"><TriangleAlert size={12} aria-hidden="true" />{teacherAttentionLabel(lang, reason)}</span></li>)}</ul>
  }
  return <div className="rounded-xl bg-[var(--warning)] px-4 py-3 text-sm text-[var(--warning-foreground)]"><p className="flex items-center gap-2 font-semibold"><TriangleAlert size={16} aria-hidden="true" />{t('attention')}</p><ul className="mt-1.5 list-inside list-disc space-y-0.5">{reasons.map(reason => <li key={reason}>{teacherAttentionLabel(lang, reason)}</li>)}</ul></div>
}
export function MiniPhases({ phases, lang }: { phases: TeacherPhases; lang: string }) {
  const t = teacherDashboardT(lang)
  const { buckets, totalInBox } = teacherDistribution(phases)
  const label = buckets.map(bucket => `${bucket.key === 'learned' ? t('learned') : t('phase', { phase: bucket.key })}: ${bucket.count}`).join(' · ')
  return <div aria-label={label} role="img" className="min-w-20"><div className="flex h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true">{buckets.map(bucket => <span key={bucket.key} className={phaseBarClasses(bucket.key).bar} style={{ width: `${totalInBox ? bucket.count / totalInBox * 100 : 0}%` }} />)}</div><p className="mt-1.5 text-xs tabular-nums text-[var(--muted)]" aria-hidden="true">{buckets.map(bucket => bucket.count).join(' / ')}</p></div>
}

export function berlinDate(value: string): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) }
