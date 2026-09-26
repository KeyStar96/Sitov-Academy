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
import { AttentionReasons, MiniPhases, displayDate, berlinDate, studyTime, dashboardControl as control, dashboardButton as button } from './TeacherDashboardShared'

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
  const admin = useAdminTranslator(), t = teacherDashboardT(lang)
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
  const rangeControl = (label: string, min: keyof typeof emptyFilters, max: keyof typeof emptyFilters) => <fieldset className="min-w-0"><legend className="mb-2 font-semibold">{label}</legend><div className="grid grid-cols-2 gap-2"><label>{t('minimum')}<input type="number" min="0" value={filters[min]} onChange={event => update(min, event.target.value)} aria-label={`${label} · ${t('minimum')}`} className={control} /></label><label>{t('maximum')}<input type="number" min="0" value={filters[max]} onChange={event => update(max, event.target.value)} aria-label={`${label} · ${t('maximum')}`} className={control} /></label></div></fieldset>
  const cell = (row: Row, key: typeof metrics[number]) => {
    if (key === 'lastActive') return displayDate(row.lastActiveAt ?? null, lang)
    if (key === 'time7') return row.learningSeconds7d === undefined ? '—' : studyTime(row.learningSeconds7d, lang)
    if (key === 'position') return row.pathPosition ? `${row.currentLevel ?? ''} · ${row.pathPosition.title} · ${row.pathPosition.completedNodes}/${row.pathPosition.totalNodes}` : '—'
    if (key === 'lastTest') return row.lastTest?.percentage == null ? '—' : `${row.lastTest.percentage}%`
    if (key === 'due') return row.dueCards ?? '—'
    if (key === 'phases') return row.phases ? <MiniPhases phases={row.phases} lang={lang} /> : '—'
    return <AttentionReasons reasons={row.attentionReasons ?? []} lang={lang} />
  }
  return <div className="min-w-0 space-y-4 text-base text-[var(--foreground)]">
    <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <label className="block font-semibold"><span className="mb-2 block">{admin('grid_search_label')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} className={control} placeholder={admin('grid_search_placeholder')} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label>{t('sort')}<select value={sort} onChange={event => setSort(event.target.value as SortKey)} className={control}>{sortKeys.map(key => <option key={key} value={key}>{sortLabel(key)}</option>)}</select></label><label>{t('direction')}<select value={descending ? 'desc' : 'asc'} onChange={event => setDescending(event.target.value === 'desc')} className={control}><option value="asc">{t('ascending')}</option><option value="desc">{t('descending')}</option></select></label></div>
      <details><summary className={`${button} cursor-pointer`}>{t('filters')}</summary><div className="mt-4 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
        <fieldset><legend className="mb-2 font-semibold">{t('lastActive')}</legend><label>{t('after')}<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} aria-label={`${t('lastActive')} · ${t('after')}`} className={control} /></label><label>{t('before')}<input type="date" value={filters.until} onChange={event => update('until', event.target.value)} aria-label={`${t('lastActive')} · ${t('before')}`} className={control} /></label></fieldset>
        {rangeControl(t('time7'), 'timeMin', 'timeMax')}{rangeControl(t('lastTest'), 'testMin', 'testMax')}{rangeControl(t('due'), 'dueMin', 'dueMax')}
        <label>{t('position')}<input value={filters.path} onChange={event => update('path', event.target.value)} className={control} /></label>
        <label>{t('attention')}<select value={filters.attention} onChange={event => update('attention', event.target.value)} className={control}><option value="">{t('all')}</option><option value="any">{t('attention')}</option><option value="none">{t('noAttention')}</option>{[...new Set(access.students.flatMap(row => row.attentionReasons ?? []))].map(reason => <option key={reason} value={reason}>{teacherAttentionLabel(lang, reason)}</option>)}</select></label>
        <label>{admin('trainer_access_title')}<select value={filters.level} onChange={event => update('level', event.target.value)} className={control}><option value="">{t('all')}</option>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
        <div><label>{t('phases')}<select value={filters.phase} onChange={event => update('phase', event.target.value)} className={control}>{['1', '2', '3', '4', '5', '6', 'learned'].map(phase => <option key={phase} value={phase}>{phase === 'learned' ? t('learned') : t('phase', { phase })}</option>)}</select></label>{rangeControl(t('phases'), 'phaseMin', 'phaseMax')}</div>
      </div><button type="button" onClick={() => { setSearch(''); setFilters(emptyFilters) }} className={`${button} mt-4`}>{t('clear')}</button></details>
      <p role="status">{admin('grid_result_count', { count: sorted.length, total: access.students.length })}</p>
    </div>
    <table className="block w-full table-fixed border-collapse text-left 2xl:table"><thead className="hidden 2xl:table-header-group"><tr>{(['name', ...metrics] as const).map(key => <th key={key} scope="col" className="p-2 align-top font-semibold" aria-sort={sort === key ? descending ? 'descending' : 'ascending' : undefined}><button className="min-h-12 w-full break-words rounded-lg text-left" onClick={() => { setSort(key); setDescending(sort === key ? !descending : false) }}>{t(key)}</button></th>)}<th scope="col" className="p-2" aria-sort={sort === 'access' ? descending ? 'descending' : 'ascending' : undefined}><button type="button" className="min-h-12 rounded-lg text-left" onClick={() => { setSort('access'); setDescending(sort === 'access' ? !descending : false) }}>{admin('trainer_access_title')}</button></th></tr></thead>
      <tbody className="block space-y-4 2xl:table-row-group 2xl:space-y-0">{sorted.map(row => {
        const name = row.person?.display_name || admin('unknown_name')
        return <tr key={row.id} data-testid={`teacher-student-${row.id}`} className="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 2xl:table-row 2xl:rounded-none 2xl:p-0">
          <td className="min-w-0 align-top 2xl:p-2"><Link href={`/${lang}/admin/students/${row.id}`} aria-label={admin('open_details_aria', { name })} className="block min-h-12 break-words rounded-lg py-2 font-bold underline decoration-[var(--border)] underline-offset-4">{name}<span className="mt-1 block break-all font-normal">{row.person?.email}</span></Link></td>
          {metrics.map(key => <td key={key} className="min-w-0 break-words align-top 2xl:p-2"><span className="mb-1 block font-semibold 2xl:sr-only">{t(key)}</span>{cell(row, key)}</td>)}
          <td className="min-w-0 align-top 2xl:p-2">{row.role === 'teacher' || row.role === 'admin' ? <p>{admin('full_access')}</p> : <><p className="mb-2">{row.allowed_levels?.join(' · ') || admin('access_none')}</p><button type="button" onClick={() => { access.setMessage(null); access.setAccessStudentId(row.id) }} aria-label={admin('access_manage_aria', { name })} className={`${button} w-full`}>{admin('access_manage')}</button></>}</td>
        </tr>
      })}{sorted.length === 0 && <tr><td colSpan={9} className="block p-8 text-center 2xl:table-cell">{admin('empty_students')}</td></tr>}</tbody>
    </table>
    {access.accessStudent && <StudentAccessModal key={access.accessStudent.id} student={access.accessStudent} loading={access.loadingId === access.accessStudent.id} message={access.message} hasError={access.hasError} onClose={() => access.setAccessStudentId(null)} onLevelToggle={access.handleLevelToggle} onTrainerToggle={access.handleTrainerToggle} onLessonsUpdate={access.handleLessonsUpdate} />}
  </div>
}
