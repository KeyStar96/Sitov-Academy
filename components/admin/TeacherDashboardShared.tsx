import { teacherDashboardT, teacherAttentionLabel } from '@/lib/teacher-dashboard-i18n'
import { teacherDistribution, type TeacherPhases } from '@/lib/teacher-dashboard-contract'
import { phaseBarClasses } from '@/lib/vocabulary-ui'

export const dashboardControl = 'min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--foreground)]'
export const dashboardButton = 'inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2 text-base font-semibold hover:border-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)] disabled:opacity-50'
export const dashboardPanel = 'min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6'
export function studyTime(seconds: number, lang: string) { return teacherDashboardT(lang)('minutes', { count: Math.round(seconds / 60) }) }
export function displayDate(value: string | null, lang: string) { return value ? new Date(value).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }) : teacherDashboardT(lang)('never') }
export function AttentionReasons({ reasons, lang }: { reasons: string[]; lang: string }) {
  const t = teacherDashboardT(lang)
  return reasons.length ? <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-[var(--foreground)]"><p className="font-bold">{t('attention')}</p><ul className="mt-1 list-inside list-disc space-y-1">{reasons.map(reason => <li key={reason}>{teacherAttentionLabel(lang, reason)}</li>)}</ul></div> : <span>{t('noAttention')}</span>
}
export function MiniPhases({ phases, lang }: { phases: TeacherPhases; lang: string }) {
  const t = teacherDashboardT(lang)
  const { buckets, totalInBox } = teacherDistribution(phases)
  const label = buckets.map(bucket => `${bucket.key === 'learned' ? t('learned') : t('phase', { phase: bucket.key })}: ${bucket.count}`).join(' · ')
  return <div aria-label={label} role="img" className="min-w-20"><div className="flex h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]" aria-hidden="true">{buckets.map(bucket => <span key={bucket.key} className={phaseBarClasses(bucket.key).bar} style={{ width: `${totalInBox ? bucket.count / totalInBox * 100 : 0}%` }} />)}</div><p className="mt-2 text-base tabular-nums" aria-hidden="true">{buckets.map(bucket => bucket.count).join(' / ')}</p></div>
}

export function berlinDate(value: string): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) }
