'use client'

import { useRef, useState } from 'react'
import { updateStudentRole, updateStudentAllowedLevels, updateStudentTrainerAccess } from '@/app/actions/admin'
import { ACCESS_LEVELS, hasConfiguredTrainerAccess, type Trainer, type AccessLevel } from '@/lib/access/levels'
import { Loader2, SlidersHorizontal } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { useBlackboard } from './BlackboardProvider'
import StudentDetailModal from './StudentDetailModal'
import StudentAccessModal from './StudentAccessModal'
import { displayBlackboardNote } from '@/lib/types/teacher-notes'
import type { AdminStudentRow } from '@/lib/types/admin-staff'
import { profileRoleSchema } from '@/lib/types/backend'

export default function StudentList({
  initialStudents,
  currentUserId,
  currentUserRole,
  progressData = {},
  lang,
}: {
  initialStudents: AdminStudentRow[]
  currentUserId?: string
  currentUserRole?: string
  progressData?: Record<string, Record<string, number>>
  lang: string
}) {
  const t = useAdminTranslator()
  const { getBoard } = useBlackboard()
  const [students, setStudents] = useState<AdminStudentRow[]>(initialStudents)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [resetLevel, setResetLevel] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const mutationLock = useRef(false)
  const [search, setSearch] = useState('')
  const [visibleProgress, setVisibleProgress] = useState(progressData)

  const [accessStudentId, setAccessStudentId] = useState<string | null>(null)
  const accessStudent = students.find(student => student.id === accessStudentId) ?? null

  const filteredStudents = students.filter(student => `${student.person?.display_name ?? ''} ${student.person?.email ?? ''}`.toLocaleLowerCase(lang).includes(search.toLocaleLowerCase(lang).trim()))
  const selected = students.find(student => student.id === selectedId) ?? null

  const handleRoleChange = async (id: string, newRole: string) => {
    const parsedRole = profileRoleSchema.safeParse(newRole)
    if (!parsedRole.success || mutationLock.current) return
    if (id === currentUserId && newRole === 'student') {
      setHasError(true)
      setMessage(t('role_self_denied'))
      return
    }
    mutationLock.current = true
    const previous = students
    setStudents(current => current.map(student => student.id === id ? { ...student, role: parsedRole.data } : student))
    setLoadingId(id)
    try {
      const result = await updateStudentRole(id, newRole)
      if (result.success !== true) throw new Error('role_change_failed')
      setHasError(false)
      setMessage(null)
    } catch {
      setStudents(previous)
      setHasError(true)
      setMessage(t('role_change_failed'))
    } finally { mutationLock.current = false; setLoadingId(null) }
  }

  const handleLevelToggle = async (id: string, level: string) => {
    if (mutationLock.current) return
    const student = students.find(item => item.id === id)
    if (!student) return
    mutationLock.current = true
    const previous = students
    const current = student.allowed_levels ?? []
    const nextLevels = current.includes(level) ? current.filter(item => item !== level) : [...current, level]
    setStudents(rows => rows.map(item => item.id === id ? { ...item, allowed_levels: nextLevels } : item))
    setLoadingId(id)
    try {
      const result = await updateStudentAllowedLevels(id, nextLevels)
      if (result.success !== true) throw new Error('levels_save_failed')
      setStudents(rows => rows.map(item => item.id === id ? { ...item, allowed_levels: result.allowedLevels ?? nextLevels } : item))
      setHasError(false)
      setMessage(null)
    } catch {
      setStudents(previous)
      setHasError(true)
      setMessage(t('levels_save_failed'))
    } finally { mutationLock.current = false; setLoadingId(null) }
  }

  const handleTrainerToggle = async (id: string, level: AccessLevel, trainer: Trainer) => {
    if (mutationLock.current) return
    const student = students.find(item => item.id === id)
    if (!student || !student.allowed_levels?.includes(level)) return
    mutationLock.current = true
    const previous = students
    const enabled = !hasConfiguredTrainerAccess(student, level, trainer)
    const previousRule = student.trainer_grants?.find(rule => rule.level === level && rule.trainer === trainer)
    const rules = [...(student.trainer_grants ?? []).filter(rule => rule.level !== level || rule.trainer !== trainer), { ...previousRule, level, trainer, enabled }]
    setStudents(rows => rows.map(item => item.id === id ? { ...item, trainer_grants: rules } : item))
    setLoadingId(id)
    try {
      const result = await updateStudentTrainerAccess({ userId: id, level, trainer, enabled })
      if (!result.success) throw new Error('trainer_save_failed')
      setHasError(false)
      setMessage(null)
    } catch {
      setStudents(previous)
      setHasError(true)
      setMessage(t('trainer_save_failed'))
    } finally { mutationLock.current = false; setLoadingId(null) }
  }

  const handleAllowedLessonsUpdate = (id: string, level: AccessLevel, trainer: Trainer, allowedLessons: string[] | null) => {
    const student = students.find(item => item.id === id)
    if (!student) return
    const rules = [...(student.trainer_grants ?? []).filter(rule => rule.level !== level || rule.trainer !== trainer)]

    const oldRule = student.trainer_grants?.find(rule => rule.level === level && rule.trainer === trainer)
    rules.push({ level, trainer, enabled: oldRule?.enabled ?? true, unit_ids: allowedLessons })

    setStudents(rows => rows.map(item => item.id === id ? { ...item, trainer_grants: rules } : item))
  }

  const handleResetProgress = async (id: string, level: string) => {
    if (mutationLock.current || !confirm(t('reset_confirm', { level }))) return
    mutationLock.current = true
    const previous = visibleProgress
    setVisibleProgress(current => ({ ...current, [id]: { ...current[id], [level]: 0 } }))
    setLoadingId(id)
    try {
      const { resetStudentProgress } = await import('@/app/actions/admin')
      const result = await resetStudentProgress(id, level)
      if (result.success !== true) throw new Error('reset_failed')
      setHasError(false)
      setMessage(t('reset_success', { level }))
    } catch {
      setVisibleProgress(previous)
      setHasError(true)
      setMessage(t('reset_failed'))
    } finally { mutationLock.current = false; setLoadingId(null) }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
      <div className="border-b border-[var(--border)] p-4">
        <label className="block text-base font-medium"><span className="mb-2 block">{t('grid_search_label')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('grid_search_placeholder')} className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3" /></label>
        <p className="mt-2 text-sm text-[var(--muted)]" role="status">{t('grid_result_count', { count: filteredStudents.length, total: students.length })}</p>
      </div>
      {!accessStudent && message && <p className={`px-4 py-3 text-base ${hasError ? 'text-red-700 dark:text-red-300' : 'text-[var(--foreground)]'}`} role={hasError ? 'alert' : 'status'}>{message}</p>}
      <table className="block w-full table-fixed border-collapse text-left lg:table">
        <thead className="hidden border-b border-[var(--border)] bg-[var(--surface-muted)] text-sm text-[var(--muted)] lg:table-header-group">
          <tr>{(['col_name_email', 'col_registered', 'col_progress', 'trainer_access_title', 'blackboard_title', 'col_actions'] as const).map(key => <th scope="col" key={key} className="p-4 font-semibold">{t(key)}</th>)}</tr>
        </thead>
        <tbody className="block divide-y divide-[var(--border)] lg:table-row-group">
          {filteredStudents.map(student => {
            const name = student.person?.display_name || t('unknown_name')
            const notePreview = displayBlackboardNote(getBoard(student.id).noteText)
            const fullAccess = student.role === 'teacher' || student.role === 'admin'
            return (
              <tr key={student.id} className="grid min-w-0 grid-cols-1 gap-3 p-4 align-top sm:grid-cols-2 lg:table-row lg:p-0">
                <td className="min-w-0 lg:p-4"><button type="button" onClick={() => setSelectedId(student.id)} aria-label={t('open_details_aria', { name })} className="min-h-12 w-full min-w-0 rounded-lg text-left"><span className="block break-words text-base font-bold">{name}</span><span className="mt-1 block break-all text-sm text-[var(--muted)]">{student.person?.email}</span></button></td>
                <td className="text-sm text-[var(--muted)] lg:p-4">{student.created_at ? new Date(student.created_at).toLocaleDateString(lang) : '—'}</td>
                <td className="lg:p-4"><ProgressBadges progress={visibleProgress[student.id] || {}} emptyLabel={t('no_progress')} /></td>
                <td className="lg:p-4">
                  {fullAccess ? <p className="text-sm font-semibold">{t('full_access')}</p> : <>
                    <p className="mb-2 text-sm text-[var(--muted)]">{student.allowed_levels?.length ? ACCESS_LEVELS.filter(level => student.allowed_levels?.includes(level)).join(' · ') : t('access_none')}</p>
                    <button type="button" onClick={() => { setMessage(null); setAccessStudentId(student.id) }} aria-label={t('access_manage_aria', { name })} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-base font-semibold hover:bg-[var(--surface-muted)]"><SlidersHorizontal size={18} aria-hidden="true" />{t('access_manage')}</button>
                  </>}
                </td>
                <td className="min-w-0 lg:p-4"><button type="button" onClick={() => setSelectedId(student.id)} className="min-h-12 w-full rounded-lg text-left text-sm"><span className="block font-semibold">{t('grid_open_notes')}</span>{notePreview && <span className="mt-1 line-clamp-2 break-words text-[var(--muted)]">{notePreview}</span>}</button></td>
                <td className="lg:p-4"><button type="button" onClick={() => setSelectedId(student.id)} className="min-h-12 w-full rounded-xl border border-[var(--border)] px-3 text-base font-semibold hover:bg-[var(--surface-muted)]">{t('open_details')}</button></td>
              </tr>
            )
          })}
          {filteredStudents.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-[var(--muted)]">{t('empty_students')}</td></tr>}
        </tbody>
      </table>
      {selected && <StudentDetailModal student={selected} onClose={() => setSelectedId(null)}>
        <div className="mt-6 grid gap-5 border-t border-[var(--border)] pt-5 sm:grid-cols-2">
          <section><h3 className="mb-3 text-base font-bold">{t('col_role')}</h3><RoleSelect student={selected} currentUserId={currentUserId} currentUserRole={currentUserRole} loading={loadingId === selected.id} onChange={handleRoleChange} /></section>
          <section><h3 className="mb-3 text-base font-bold">{t('col_progress')}</h3><ResetControls student={selected} level={resetLevel[selected.id] || 'A1.1'} loading={loadingId === selected.id} onLevelChange={value => setResetLevel({ ...resetLevel, [selected.id]: value })} onReset={handleResetProgress} /></section>
        </div>
        {message && <p className="mt-4 text-base" role={hasError ? 'alert' : 'status'}>{message}</p>}
      </StudentDetailModal>}
      {accessStudent && <StudentAccessModal key={accessStudent.id} student={accessStudent} loading={loadingId === accessStudent.id} message={message} hasError={hasError} onClose={() => setAccessStudentId(null)} onLevelToggle={handleLevelToggle} onTrainerToggle={handleTrainerToggle} onLessonsUpdate={handleAllowedLessonsUpdate} />}
    </div>
  )
}

function ProgressBadges({ progress, emptyLabel }: { progress: Record<string, number>; emptyLabel: string }) {
  const activeLevels = Object.entries(progress).filter(([, value]) => value > 0).sort((left, right) => left[0].localeCompare(right[0]))
  if (activeLevels.length === 0) return <span className="text-sm text-[var(--muted)]">{emptyLabel}</span>
  return <div className="flex flex-wrap gap-2">{activeLevels.map(([level, value]) => <span key={level} className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-sm font-semibold">{level}: {value}%</span>)}</div>
}

function RoleSelect({
  student, currentUserId, currentUserRole, loading, onChange,
}: {
  student: AdminStudentRow
  currentUserId?: string
  currentUserRole?: string
  loading: boolean
  onChange: (id: string, role: string) => void
}) {
  const t = useAdminTranslator()
  return (
    <div className="relative inline-block w-32">
      <select
        value={student.role ?? 'student'}
        onChange={event => onChange(student.id, event.target.value)}
        disabled={loading || student.id === currentUserId || currentUserRole !== 'admin'}
        aria-label={t('col_role')}
        className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 pr-8 text-base font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] disabled:cursor-default disabled:bg-[var(--surface-muted)]"
      >
        <option value="student">{t('role_student')}</option>
        <option value="teacher">{t('role_teacher')}</option>
        {(student.role === 'admin' || currentUserRole === 'admin') && <option value="admin">{t('role_admin')}</option>}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[var(--muted)]">
        {loading ? <Loader2 size={14} className="animate-spin" /> : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        )}
      </div>
    </div>
  )
}

function ResetControls({
  student, level, loading, onLevelChange, onReset,
}: {
  student: AdminStudentRow
  level: string
  loading: boolean
  onLevelChange: (level: string) => void
  onReset: (id: string, level: string) => void
}) {
  const t = useAdminTranslator()
  const name = student.person?.display_name || t('unknown_name')
  return (
    <div className="flex flex-col gap-2">
      <select
        className="h-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-base font-semibold text-[var(--foreground)] focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] "
        value={level}
        onChange={event => onLevelChange(event.target.value)}
        disabled={loading}
        aria-label={t('col_progress')}
      >
        {ACCESS_LEVELS.map(item => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => onReset(student.id, level)}
        disabled={loading}
        className="inline-flex h-12 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-base font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
        aria-label={t('reset_aria', { name, level })}
      >
        {t('reset')}
      </button>
    </div>
  )
}
