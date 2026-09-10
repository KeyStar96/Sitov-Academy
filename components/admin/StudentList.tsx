'use client'

import { useRef, useState } from 'react'
import { updateStudentRole, updateStudentAllowedLevels, updateStudentTrainerAccess } from '@/app/actions/admin'
import { ACCESS_LEVELS, TRAINERS, hasTrainerAccess, type Trainer, type AccessLevel } from '@/lib/access/levels'
import { Loader2, Lock, LockOpen } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { useBlackboard } from './BlackboardProvider'
import BlackboardEditor from './BlackboardEditor'
import StudentDetailModal from './StudentDetailModal'
import { displayBlackboardNote } from '@/lib/types/teacher-notes'
import type { AdminStudentRow } from '@/lib/types/admin-staff'

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
  const filteredStudents = students.filter(student => `${student.name ?? ''} ${student.email}`.toLocaleLowerCase(lang).includes(search.toLocaleLowerCase(lang).trim()))
  const selected = students.find(student => student.id === selectedId) ?? null

  const handleRoleChange = async (id: string, newRole: string) => {
    if (mutationLock.current) return
    if (id === currentUserId && newRole === 'student') {
      setHasError(true)
      setMessage(t('role_self_denied'))
      return
    }
    mutationLock.current = true
    const previous = students
    setStudents(current => current.map(student => student.id === id ? { ...student, role: newRole } : student))
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
    const enabled = !hasTrainerAccess(student, level, trainer)
    const rules = [...(student.student_trainer_access ?? []).filter(rule => rule.level !== level || rule.trainer !== trainer), { level, trainer, enabled }]
    setStudents(rows => rows.map(item => item.id === id ? { ...item, student_trainer_access: rules } : item))
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
    <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] p-3"><label className="block text-sm font-medium text-[var(--foreground)]"><span className="mb-1.5 block">{t('grid_search_label')}</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('grid_search_placeholder')} className="min-h-11 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3" /></label><p className="mt-2 text-xs text-[var(--muted)]" role="status">{t('grid_result_count', { count: filteredStudents.length, total: students.length })}</p></div>
      <div className={`min-h-6 px-4 pt-4 text-sm ${hasError ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}`} role={hasError ? 'alert' : 'status'} aria-live={hasError ? 'assertive' : 'polite'}>
        {message}
      </div>
      <div className="space-y-3 p-3 lg:hidden">
        {filteredStudents.map(student => {
          const name = student.name || t('unknown_name')
          const board = getBoard(student.id)
          const notePreview = displayBlackboardNote(board.noteText)
          return (
            <article key={student.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedId(student.id)}
                aria-label={t('open_details_aria', { name })}
                className="min-h-11 w-full rounded-md text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
              >
                <p className="font-bold text-slate-900 dark:text-white">{name}</p>
                <p className="break-words text-sm text-slate-500">{student.email}</p>
              </button>
              <p className="mt-2 text-sm text-slate-500">
                {t('col_discount')}: {board.discount}{t('blackboard_discount_suffix')}
              </p>
              {notePreview ? <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{notePreview}</p> : null}
              {selectedId !== student.id && (
                <div className="mt-3">
                  <BlackboardEditor studentId={student.id} studentName={name} compact />
                </div>
              )}
              <StudentAdminControls
                student={student}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                loadingId={loadingId}
                resetLevel={resetLevel[student.id] || 'A1.1'}
                progressData={visibleProgress[student.id] || {}}
                onRoleChange={handleRoleChange}
                onLevelToggle={handleLevelToggle}
                onTrainerToggle={handleTrainerToggle}
                onResetLevelChange={level => setResetLevel({ ...resetLevel, [student.id]: level })}
                onResetProgress={handleResetProgress}
                onOpen={() => setSelectedId(student.id)}
              />
            </article>
          )
        })}
        {filteredStudents.length === 0 && <p className="p-6 text-center text-slate-500">{t('empty_students')}</p>}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <th className="border-b border-slate-200 p-3 font-bold dark:border-slate-800">{t('col_name_email')}</th>
              <th className="border-b border-slate-200 p-3 font-bold dark:border-slate-800">{t('col_registered')}</th>
              <th className="border-b border-slate-200 p-3 font-bold dark:border-slate-800">{t('col_progress')}</th>
              <th className="border-b border-slate-200 p-3 font-bold dark:border-slate-800">{t('col_levels')}</th>
              <th className="border-b border-slate-200 p-3 font-bold dark:border-slate-800">{t('blackboard_title')}</th>
              <th className="border-b border-slate-200 p-3 font-bold dark:border-slate-800">{t('col_role')}</th>
              <th className="border-b border-slate-200 p-3 font-bold dark:border-slate-800">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredStudents.map(student => {
              const name = student.name || t('unknown_name')
              return (
                <tr key={student.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/20">
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(student.id)}
                      aria-label={t('open_details_aria', { name })}
                      className="min-h-11 rounded-md text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">{name}</div>
                      <div className="text-sm text-slate-500">{student.email}</div>
                    </button>
                  </td>
                  <td className="p-3 text-sm text-slate-500">
                    {student.created_at ? new Date(student.created_at).toLocaleDateString(lang) : '—'}
                  </td>
                  <td className="p-3">
                    <ProgressBadges progress={visibleProgress[student.id] || {}} emptyLabel={t('no_progress')} />
                  </td>
                  <td className="p-3">
                    <LevelToggles
                      student={student}
                      loading={loadingId === student.id}
                      onToggle={handleLevelToggle}
                      onTrainerToggle={handleTrainerToggle}
                    />
                  </td>
                  <td className="min-w-[16rem] p-3">
                    {selectedId !== student.id && (
                      <BlackboardEditor studentId={student.id} studentName={name} compact />
                    )}
                  </td>
                  <td className="p-3">
                    <RoleSelect
                      student={student}
                      currentUserId={currentUserId}
                      currentUserRole={currentUserRole}
                      loading={loadingId === student.id}
                      onChange={handleRoleChange}
                    />
                  </td>
                  <td className="p-3">
                    <ResetControls
                      student={student}
                      level={resetLevel[student.id] || 'A1.1'}
                      loading={loadingId === student.id}
                      onLevelChange={value => setResetLevel({ ...resetLevel, [student.id]: value })}
                      onReset={handleResetProgress}
                      onOpen={() => setSelectedId(student.id)}
                    />
                  </td>
                </tr>
              )
            })}
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">{t('empty_students')}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && <StudentDetailModal student={selected} onClose={() => setSelectedId(null)} />}
    </div>
  )
}

function ProgressBadges({ progress, emptyLabel }: { progress: Record<string, number>; emptyLabel: string }) {
  const activeLevels = Object.entries(progress).filter(([, value]) => value > 0).sort((left, right) => left[0].localeCompare(right[0]))
  if (activeLevels.length === 0) return <span className="text-xs italic text-slate-400">{emptyLabel}</span>
  return (
    <div className="flex max-w-[140px] flex-wrap gap-1.5">
      {activeLevels.map(([level, value]) => (
        <span key={level} className="rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-xs font-bold text-[#FF5C00] shadow-sm dark:border-[#FF5C00]/30 dark:bg-[#FF5C00]/20">
          {level}: {value}%
        </span>
      ))}
    </div>
  )
}

function LevelToggles({
  student, loading, onToggle, onTrainerToggle,
}: {
  student: AdminStudentRow
  loading: boolean
  onToggle: (id: string, level: string) => void
  onTrainerToggle: (id: string, level: AccessLevel, trainer: Trainer) => void
}) {
  const t = useAdminTranslator()
  const isFullAccess = student.role === 'admin' || student.role === 'teacher'
  const allowed = student.allowed_levels ?? []
  const name = student.name || student.email
  if (isFullAccess) {
    return (
      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
        {t('full_access')}
      </span>
    )
  }
  return (
    <div className="min-w-[220px] max-w-sm space-y-2">
      <p className="text-sm font-semibold text-[var(--foreground)]">{t('trainer_access_title')}</p>
      {ACCESS_LEVELS.map(level => {
        const isOn = allowed.includes(level)
        return (
          <details key={level} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
            <summary className="min-h-12 cursor-pointer content-center px-2 font-semibold text-[var(--foreground)]">{level} · {isOn ? `${TRAINERS.filter(trainer => hasTrainerAccess(student, level, trainer)).length}/4` : t('trainer_disabled')}</summary>
          <button
            type="button"
            role="checkbox"
            aria-checked={isOn}
            aria-label={t('level_toggle_aria', { level, name, action: isOn ? t('level_revoke') : t('level_grant') })}
            disabled={loading}
            onClick={() => onToggle(student.id, level)}
            className={`min-h-12 rounded-lg px-2.5 py-1 text-base font-semibold transition-colors focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] disabled:cursor-not-allowed disabled:opacity-50 ${
              isOn
                ? 'border border-[var(--accent)] bg-[var(--surface-muted)] text-[var(--foreground)]'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--accent)]'
            }`}
          >
            {isOn ? '✓ ' : ''}{level} · {isOn ? t('level_revoke') : t('level_grant')}
          </button>
          <fieldset className="mt-3 space-y-1" disabled={loading || !isOn}>
            <legend className="mb-2 text-sm font-semibold text-[var(--foreground)]">{t('trainer_access_level', { level })}</legend>
            {!isOn && <p className="text-sm text-[var(--muted)]">{t('trainer_level_required')}</p>}
            {TRAINERS.map(trainer => {
              const enabled = hasTrainerAccess(student, level, trainer)
              return <label key={trainer} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-[var(--foreground)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--violet)]">
                <input type="checkbox" checked={enabled} onChange={() => onTrainerToggle(student.id, level, trainer)} aria-label={`${name} · ${level} · ${t(`trainer_${trainer}`)}`} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                <span className="flex-1">{t(`trainer_${trainer}`)}</span>
                {enabled ? <LockOpen size={18} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
              </label>
            })}
          </fieldset>
          </details>
        )
      })}
      {loading && <span className="inline-flex items-center text-slate-400"><Loader2 size={14} className="animate-spin" /></span>}
    </div>
  )
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
        className={`h-12 w-full cursor-pointer appearance-none rounded-lg border px-3 py-1.5 pr-8 text-sm font-bold focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] disabled:cursor-not-allowed disabled:opacity-50 ${
          student.role === 'teacher' || student.role === 'admin'
            ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400'
            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
        }`}
      >
        <option value="student">{t('role_student')}</option>
        <option value="teacher">{t('role_teacher')}</option>
        {(student.role === 'admin' || currentUserRole === 'admin') && <option value="admin">{t('role_admin')}</option>}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        {loading ? <Loader2 size={14} className="animate-spin" /> : (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        )}
      </div>
    </div>
  )
}

function ResetControls({
  student, level, loading, onLevelChange, onReset, onOpen,
}: {
  student: AdminStudentRow
  level: string
  loading: boolean
  onLevelChange: (level: string) => void
  onReset: (id: string, level: string) => void
  onOpen: () => void
}) {
  const t = useAdminTranslator()
  const name = student.name || t('unknown_name')
  return (
    <div className="flex flex-col gap-2">
      <select
        className="h-12 rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm font-bold text-slate-600 focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
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
        className="inline-flex h-12 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
        aria-label={t('reset_aria', { name, level })}
      >
        {t('reset')}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-12 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
        aria-label={t('open_details_aria', { name })}
      >
        {t('open_details')}
      </button>
    </div>
  )
}

function StudentAdminControls({
  student, currentUserId, currentUserRole, loadingId, resetLevel, progressData,
  onRoleChange, onLevelToggle, onTrainerToggle, onResetLevelChange, onResetProgress, onOpen,
}: {
  student: AdminStudentRow
  currentUserId?: string
  currentUserRole?: string
  loadingId: string | null
  resetLevel: string
  progressData: Record<string, number>
  onRoleChange: (id: string, role: string) => void
  onLevelToggle: (id: string, level: string) => void
  onTrainerToggle: (id: string, level: AccessLevel, trainer: Trainer) => void
  onResetLevelChange: (level: string) => void
  onResetProgress: (id: string, level: string) => void
  onOpen: () => void
}) {
  const t = useAdminTranslator()
  return (
    <div className="mt-4 space-y-3">
      <ProgressBadges progress={progressData} emptyLabel={t('no_progress')} />
      <LevelToggles student={student} loading={loadingId === student.id} onToggle={onLevelToggle} onTrainerToggle={onTrainerToggle} />
      <RoleSelect
        student={student}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        loading={loadingId === student.id}
        onChange={onRoleChange}
      />
      <ResetControls
        student={student}
        level={resetLevel}
        loading={loadingId === student.id}
        onLevelChange={onResetLevelChange}
        onReset={onResetProgress}
        onOpen={onOpen}
      />
    </div>
  )
}
