'use client'

import { useState } from 'react'
import { updateStudentRole, updateStudentAllowedLevels } from '@/app/actions/admin'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { Loader2 } from 'lucide-react'
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
  const selected = students.find(student => student.id === selectedId) ?? null

  const handleRoleChange = async (id: string, newRole: string) => {
    if (id === currentUserId && newRole === 'student') {
      setHasError(true)
      setMessage(t('role_self_denied'))
      return
    }
    setLoadingId(id)
    const res = await updateStudentRole(id, newRole)
    if (res.success === true) {
      setStudents(students.map(student => student.id === id ? { ...student, role: newRole } : student))
      setHasError(false)
      setMessage(null)
    } else {
      setHasError(true)
      setMessage(t('role_change_failed'))
    }
    setLoadingId(null)
  }

  const handleLevelToggle = async (id: string, level: string) => {
    const student = students.find(item => item.id === id)
    if (!student) return
    const current = student.allowed_levels ?? []
    const nextLevels = current.includes(level) ? current.filter(item => item !== level) : [...current, level]
    setLoadingId(id)
    const res = await updateStudentAllowedLevels(id, nextLevels)
    if (res.success) {
      setStudents(students.map(item => item.id === id ? { ...item, allowed_levels: res.allowedLevels ?? nextLevels } : item))
      setHasError(false)
      setMessage(null)
    } else {
      setHasError(true)
      setMessage(t('levels_save_failed'))
    }
    setLoadingId(null)
  }

  const handleResetProgress = async (id: string, level: string) => {
    if (!confirm(t('reset_confirm', { level }))) return
    setLoadingId(id)
    const { resetStudentProgress } = await import('@/app/actions/admin')
    const res = await resetStudentProgress(id, level)
    if (res.success) {
      setHasError(false)
      setMessage(t('reset_success', { level }))
    } else {
      setHasError(true)
      setMessage(t('reset_failed'))
    }
    setLoadingId(null)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className={`min-h-6 px-4 pt-4 text-sm ${hasError ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-300'}`} role={hasError ? 'alert' : 'status'} aria-live={hasError ? 'assertive' : 'polite'}>
        {message}
      </div>
      <div className="space-y-4 p-4 lg:hidden">
        {students.map(student => {
          const name = student.name || t('unknown_name')
          const board = getBoard(student.id)
          const notePreview = displayBlackboardNote(board.noteText)
          return (
            <article key={student.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedId(student.id)}
                aria-label={t('open_details_aria', { name })}
                className="min-h-12 w-full rounded-xl text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
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
                progressData={progressData[student.id] || {}}
                onRoleChange={handleRoleChange}
                onLevelToggle={handleLevelToggle}
                onResetLevelChange={level => setResetLevel({ ...resetLevel, [student.id]: level })}
                onResetProgress={handleResetProgress}
                onOpen={() => setSelectedId(student.id)}
              />
            </article>
          )
        })}
        {students.length === 0 && <p className="p-6 text-center text-slate-500">{t('empty_students')}</p>}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_name_email')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_registered')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_progress')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_levels')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('blackboard_title')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_role')}</th>
              <th className="border-b border-slate-200 p-4 font-bold dark:border-slate-800">{t('col_actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {students.map(student => {
              const name = student.name || t('unknown_name')
              return (
                <tr key={student.id} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/20">
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => setSelectedId(student.id)}
                      aria-label={t('open_details_aria', { name })}
                      className="min-h-12 rounded-xl text-left focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00]"
                    >
                      <div className="font-bold text-slate-900 dark:text-white">{name}</div>
                      <div className="text-sm text-slate-500">{student.email}</div>
                    </button>
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {student.created_at ? new Date(student.created_at).toLocaleDateString(lang) : '—'}
                  </td>
                  <td className="p-4">
                    <ProgressBadges progress={progressData[student.id] || {}} emptyLabel={t('no_progress')} />
                  </td>
                  <td className="p-4">
                    <LevelToggles
                      student={student}
                      loading={loadingId === student.id}
                      onToggle={handleLevelToggle}
                    />
                  </td>
                  <td className="min-w-[16rem] p-4">
                    {selectedId !== student.id && (
                      <BlackboardEditor studentId={student.id} studentName={name} compact />
                    )}
                  </td>
                  <td className="p-4">
                    <RoleSelect
                      student={student}
                      currentUserId={currentUserId}
                      currentUserRole={currentUserRole}
                      loading={loadingId === student.id}
                      onChange={handleRoleChange}
                    />
                  </td>
                  <td className="p-4">
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
            {students.length === 0 && (
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
  student, loading, onToggle,
}: {
  student: AdminStudentRow
  loading: boolean
  onToggle: (id: string, level: string) => void
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
    <div className="flex max-w-[220px] flex-wrap gap-1.5">
      {ACCESS_LEVELS.map(level => {
        const isOn = allowed.includes(level)
        return (
          <button
            key={level}
            type="button"
            role="checkbox"
            aria-checked={isOn}
            aria-label={t('level_toggle_aria', { level, name, action: isOn ? t('level_revoke') : t('level_grant') })}
            disabled={loading}
            onClick={() => onToggle(student.id, level)}
            className={`min-h-12 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors focus:outline-none focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#FF5C00] disabled:cursor-not-allowed disabled:opacity-50 ${
              isOn
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {isOn ? '✓ ' : ''}{level}
          </button>
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
  onRoleChange, onLevelToggle, onResetLevelChange, onResetProgress, onOpen,
}: {
  student: AdminStudentRow
  currentUserId?: string
  currentUserRole?: string
  loadingId: string | null
  resetLevel: string
  progressData: Record<string, number>
  onRoleChange: (id: string, role: string) => void
  onLevelToggle: (id: string, level: string) => void
  onResetLevelChange: (level: string) => void
  onResetProgress: (id: string, level: string) => void
  onOpen: () => void
}) {
  const t = useAdminTranslator()
  return (
    <div className="mt-4 space-y-3">
      <ProgressBadges progress={progressData} emptyLabel={t('no_progress')} />
      <LevelToggles student={student} loading={loadingId === student.id} onToggle={onLevelToggle} />
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
