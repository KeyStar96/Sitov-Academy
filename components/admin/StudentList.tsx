'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { useAdminTranslator } from './AdminI18nProvider'
import StudentAccessModal from './StudentAccessModal'
import type { AdminStudentRow } from '@/lib/types/admin-staff'
import type { TeacherStudent } from '@/lib/teacher-dashboard-contract'
import { teacherDashboardT, teacherAttentionLabel, type TeacherCopyKey } from '@/lib/teacher-dashboard-i18n'
import { useStudentAccess } from './useStudentAccess'
import { AttentionReasons, MiniPhases, displayDate, berlinDate, studyTime, dashboardControl as control } from './TeacherDashboardShared'
import { Badge, adminButton, adminFocus, adminLabel } from './ui'
import { studentsAdminCopy } from '@/lib/students-admin-i18n'
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react'

type Row = AdminStudentRow & Partial<Omit<TeacherStudent, keyof AdminStudentRow>>
const metrics = ['lastActive', 'time7', 'position', 'lastTest', 'due', 'phases', 'attention'] as const
const sortKeys = ['name', ...metrics, 'access', '1', '2', '3', '4', '5', '6', 'learned'] as const
type SortKey = typeof sortKeys[number]
const emptyFilters = { from: '', until: '', timeMin: '', timeMax: '', testMin: '', testMax: '', dueMin: '', dueMax: '', path: '', attention: '', level: '', phase: '1', phaseMin: '', phaseMax: '' }
function sortValue(row: Row, key: SortKey): string | number {
  if (key === 'name') return `${row.person?.display_name ?? ''} ${row.person?.email ?? ''}`
  if (key === 'access') return (row.allowed_levels ?? []).join(' ')
  if (key === 'lastActive') return row.lastActiveAt ? new Date(row.lastActiveAt).getTime() : -1
  if (key === 'time7') return row.learningSeconds7d ?? -1
  if (key === 'position') return row.pathPosition ? `${row.currentLevel} ${row.pathPosition.title} ${String(row.pathPosition.completedNodes).padStart(4, '0')}` : ''
  if (key === 'lastTest') return row.lastTest?.percentage ?? -1
  if (key === 'due') return row.dueCards ?? -1
  if (key === 'attention') return (row.attentionReasons ?? []).join(' ')
  if (key === 'phases') return Object.values(row.phases ?? {}).reduce((sum: number, item) => sum + item, 0)
  return row.phases?.[key] ?? -1
}
function inRange(value: number | null | undefined, minimum: string, maximum: string) {
  return (!minimum && !maximum) || (value !== null && value !== undefined && (!minimum || value >= Number(minimum)) && (!maximum || value <= Number(maximum)))
}
export default function StudentList({ initialStudents, lang }: {
  initialStudents: Row[]; currentUserId?: string; currentUserRole?: string; progressData?: Record<string, Record<string, number>>; lang: string
}) {
  const admin = useAdminTranslator(), t = teacherDashboardT(lang), s = studentsAdminCopy(lang)
  const access = useStudentAccess(initialStudents)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('name')
  const [descending, setDescending] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const update = (key: keyof typeof emptyFilters, value: string) => setFilters(current => ({ ...current, [key]: value }))
  const sorted = access.students.filter(row => {
    const name = `${row.person?.display_name ?? ''} ${row.person?.email ?? ''}`.toLocaleLowerCase(lang)
    const active = row.lastActiveAt ? berlinDate(row.lastActiveAt) : null
    return name.includes(search.trim().toLocaleLowerCase(lang))
      && (!filters.from || Boolean(active && active >= filters.from)) && (!filters.until || Boolean(active && active <= filters.until))
      && inRange(row.learningSeconds7d === undefined ? undefined : row.learningSeconds7d / 60, filters.timeMin, filters.timeMax)
      && inRange(row.lastTest?.percentage, filters.testMin, filters.testMax) && inRange(row.dueCards, filters.dueMin, filters.dueMax)
      && (!filters.path || `${row.currentLevel ?? ''} ${row.pathPosition?.title ?? ''} ${row.pathPosition?.completedNodes ?? ''}/${row.pathPosition?.totalNodes ?? ''}`.toLocaleLowerCase(lang).includes(filters.path.toLocaleLowerCase(lang)))
      && (!filters.attention || (filters.attention === 'none' ? !row.attentionReasons?.length : filters.attention === 'any' ? Boolean(row.attentionReasons?.length) : row.attentionReasons?.includes(filters.attention)))
      && (!filters.level || row.allowed_levels?.includes(filters.level))
      && inRange(row.phases?.[filters.phase as keyof NonNullable<Row['phases']>], filters.phaseMin, filters.phaseMax)
  }).sort((left, right) => {
    const a = sortValue(left, sort), b = sortValue(right, sort)
    const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), lang, { numeric: true })
    return (descending ? -comparison : comparison) || left.id.localeCompare(right.id)
  })
  const sortLabel = (key: SortKey) => key === 'access' ? admin('trainer_access_title') : /^[1-6]$/.test(key) ? t('phase', { phase: key }) : t(key as TeacherCopyKey)
  const rangeControl = (label: string, min: keyof typeof emptyFilters, max: keyof typeof emptyFilters) => <fieldset className="min-w-0"><legend className={adminLabel}>{label}</legend><div className="grid grid-cols-2 gap-2"><label className="min-w-0"><span className="mb-1 block text-xs text-[var(--muted)]">{t('minimum')}</span><input type="number" inputMode="numeric" min="0" value={filters[min]} onChange={event => update(min, event.target.value)} aria-label={`${label} · ${t('minimum')}`} className={control} /></label><label className="min-w-0"><span className="mb-1 block text-xs text-[var(--muted)]">{t('maximum')}</span><input type="number" inputMode="numeric" min="0" value={filters[max]} onChange={event => update(max, event.target.value)} aria-label={`${label} · ${t('maximum')}`} className={control} /></label></div></fieldset>
  const cell = (row: Row, key: typeof metrics[number]) => {
    if (key === 'lastActive') return displayDate(row.lastActiveAt ?? null, lang)
    if (key === 'time7') return row.learningSeconds7d === undefined ? '—' : studyTime(row.learningSeconds7d, lang)
    if (key === 'position') return row.pathPosition ? `${row.currentLevel ?? ''} · ${row.pathPosition.title} · ${row.pathPosition.completedNodes}/${row.pathPosition.totalNodes}` : '—'
    if (key === 'lastTest') return row.lastTest?.percentage == null ? '—' : `${row.lastTest.percentage}%`
    if (key === 'due') return row.dueCards ?? '—'
    if (key === 'phases') return row.phases ? <MiniPhases phases={row.phases} lang={lang} /> : '—'
    return <AttentionReasons reasons={row.attentionReasons ?? []} lang={lang} compact />
  }
  const activeFilters = Object.entries(filters).filter(([key, value]) => key !== 'phase' && value !== '').length
  const wide = new Set<typeof metrics[number]>(['position', 'phases', 'attention'])
  return <div className="min-w-0 space-y-4 text-[var(--foreground)]">
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">{admin('grid_search_label')}</span>
        <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input type="search" value={search} onChange={event => setSearch(event.target.value)} className={`${control} pl-9`} placeholder={admin('grid_search_placeholder')} aria-label={admin('grid_search_label')} />
      </label>
      <details className="group overflow-hidden rounded-xl border border-[var(--admin-line)] bg-[var(--surface)]">
        <summary className={`flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold ${adminFocus}`}>
          <SlidersHorizontal size={16} aria-hidden="true" className="text-[var(--muted)]" />
          <span className="flex-1">{s.filtersAndSort}</span>
          {activeFilters > 0 && <Badge tone="accent">{activeFilters}</Badge>}
          <ChevronDown size={16} aria-hidden="true" className="text-[var(--muted)] transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-5 border-t border-[var(--admin-line)] p-4">
          <div className="grid gap-3 sm:grid-cols-2"><label className="min-w-0"><span className={adminLabel}>{t('sort')}</span><select value={sort} onChange={event => setSort(event.target.value as SortKey)} className={control}>{sortKeys.map(key => <option key={key} value={key}>{sortLabel(key)}</option>)}</select></label><label className="min-w-0"><span className={adminLabel}>{t('direction')}</span><select value={descending ? 'desc' : 'asc'} onChange={event => setDescending(event.target.value === 'desc')} className={control}><option value="asc">{t('ascending')}</option><option value="desc">{t('descending')}</option></select></label></div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('filters')}</p>
          <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
            <fieldset className="min-w-0"><legend className={adminLabel}>{t('lastActive')}</legend><div className="grid grid-cols-2 gap-2"><label className="min-w-0"><span className="mb-1 block text-xs text-[var(--muted)]">{t('after')}</span><input type="date" value={filters.from} onChange={event => update('from', event.target.value)} aria-label={`${t('lastActive')} · ${t('after')}`} className={control} /></label><label className="min-w-0"><span className="mb-1 block text-xs text-[var(--muted)]">{t('before')}</span><input type="date" value={filters.until} onChange={event => update('until', event.target.value)} aria-label={`${t('lastActive')} · ${t('before')}`} className={control} /></label></div></fieldset>
            {rangeControl(t('time7'), 'timeMin', 'timeMax')}{rangeControl(t('lastTest'), 'testMin', 'testMax')}{rangeControl(t('due'), 'dueMin', 'dueMax')}
            <label className="min-w-0"><span className={adminLabel}>{t('position')}</span><input value={filters.path} onChange={event => update('path', event.target.value)} className={control} /></label>
            <label className="min-w-0"><span className={adminLabel}>{t('attention')}</span><select value={filters.attention} onChange={event => update('attention', event.target.value)} className={control}><option value="">{t('all')}</option><option value="any">{t('attention')}</option><option value="none">{t('noAttention')}</option>{[...new Set(access.students.flatMap(row => row.attentionReasons ?? []))].map(reason => <option key={reason} value={reason}>{teacherAttentionLabel(lang, reason)}</option>)}</select></label>
            <label className="min-w-0"><span className={adminLabel}>{admin('trainer_access_title')}</span><select value={filters.level} onChange={event => update('level', event.target.value)} className={control}><option value="">{t('all')}</option>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
            <div className="min-w-0 space-y-3"><label className="block"><span className={adminLabel}>{t('phases')}</span><select value={filters.phase} onChange={event => update('phase', event.target.value)} className={control}>{['1', '2', '3', '4', '5', '6', 'learned'].map(phase => <option key={phase} value={phase}>{phase === 'learned' ? t('learned') : t('phase', { phase })}</option>)}</select></label>{rangeControl(t('phases'), 'phaseMin', 'phaseMax')}</div>
          </div>
          <div className="flex justify-end"><button type="button" onClick={() => { setSearch(''); setFilters(emptyFilters) }} className={adminButton('secondary', 'sm')}>{t('clear')}</button></div>
        </div>
      </details>
      <p role="status" className="text-sm text-[var(--muted)]">{admin('grid_result_count', { count: sorted.length, total: access.students.length })}</p>
    </div>
    <table className="block w-full border-collapse text-left text-sm 2xl:table 2xl:table-fixed 2xl:overflow-hidden 2xl:rounded-xl 2xl:border 2xl:border-[var(--admin-line)] 2xl:bg-[var(--surface)]">
      <caption className="sr-only">{admin('students_title')}</caption>
      <thead className="hidden border-b border-[var(--admin-line)] bg-[var(--surface-muted)] 2xl:table-header-group"><tr>{(['name', ...metrics] as const).map(key => <th key={key} scope="col" className="px-3 py-2 align-bottom text-xs font-semibold text-[var(--muted)]" aria-sort={sort === key ? descending ? 'descending' : 'ascending' : undefined}><button type="button" className={`-mx-1 min-h-10 w-full break-words rounded-md px-1 text-left ${adminFocus} ${sort === key ? 'text-[var(--foreground)]' : ''}`} onClick={() => { setSort(key); setDescending(sort === key ? !descending : false) }}>{t(key)}{sort === key && <span aria-hidden="true"> {descending ? '↓' : '↑'}</span>}</button></th>)}<th scope="col" className="px-3 py-2 align-bottom text-xs font-semibold text-[var(--muted)]" aria-sort={sort === 'access' ? descending ? 'descending' : 'ascending' : undefined}><button type="button" className={`-mx-1 min-h-10 rounded-md px-1 text-left ${adminFocus}`} onClick={() => { setSort('access'); setDescending(sort === 'access' ? !descending : false) }}>{admin('trainer_access_title')}</button></th></tr></thead>
      <tbody className="block space-y-3 2xl:table-row-group 2xl:space-y-0 2xl:divide-y 2xl:divide-[var(--admin-line)]">{sorted.map(row => {
        const name = row.person?.display_name || admin('unknown_name')
        const staff = row.role === 'teacher' || row.role === 'admin'
        const levels = row.allowed_levels ?? []
        return <tr key={row.id} data-testid={`teacher-student-${row.id}`} className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] p-4 sm:grid-cols-3 2xl:table-row 2xl:rounded-none 2xl:border-0 2xl:p-0">
          <td className="col-span-2 min-w-0 align-top sm:col-span-3 2xl:px-3 2xl:py-3">
            <Link href={`/${lang}/admin/students/${row.id}`} aria-label={admin('open_details_aria', { name })} className={`-m-1 block rounded-md p-1 ${adminFocus}`}><span className="block break-words text-[0.9375rem] font-semibold underline-offset-4 hover:underline">{name}</span><span className="mt-0.5 block break-all text-xs text-[var(--muted)]">{row.person?.email}</span></Link>
          </td>
          {metrics.map(key => <td key={key} className={`min-w-0 break-words align-top text-sm 2xl:px-3 2xl:py-3 ${wide.has(key) ? 'col-span-2 sm:col-span-3' : ''}`}><span className="mb-0.5 block text-xs text-[var(--muted)] 2xl:sr-only">{t(key)}</span>{cell(row, key)}</td>)}
          <td className="col-span-2 min-w-0 align-top sm:col-span-3 2xl:px-3 2xl:py-3">
            {staff ? <Badge tone="info">{admin('full_access')}</Badge> : <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between 2xl:flex-col 2xl:items-stretch">
              <div className="flex flex-wrap gap-1.5">{levels.length ? levels.map(level => <Badge key={level} tone="neutral" className="tabular-nums">{level}</Badge>) : <Link href={`/${lang}/admin/new-students`} className={`rounded-md ${adminFocus}`}><Badge tone="warning">{s.noLevel} · {s.noLevelAction}</Badge></Link>}</div>
              <button type="button" onClick={() => { access.setMessage(null); access.setAccessStudentId(row.id) }} aria-label={admin('access_manage_aria', { name })} className={adminButton('secondary', 'sm', 'w-full sm:w-auto 2xl:w-full')}>{admin('access_manage')}</button>
            </div>}
          </td>
        </tr>
      })}{sorted.length === 0 && <tr className="block rounded-xl border border-[var(--admin-line)] bg-[var(--surface)] 2xl:table-row"><td colSpan={9} className="block p-8 text-center text-sm text-[var(--muted)] 2xl:table-cell">{admin('empty_students')}</td></tr>}</tbody>
    </table>
    {access.accessStudent && <StudentAccessModal key={access.accessStudent.id} student={access.accessStudent} loading={access.loadingId === access.accessStudent.id} message={access.message} hasError={access.hasError} onClose={() => access.setAccessStudentId(null)} onLevelToggle={access.handleLevelToggle} onTrainerToggle={access.handleTrainerToggle} onLessonsUpdate={access.handleLessonsUpdate} />}
  </div>
}
