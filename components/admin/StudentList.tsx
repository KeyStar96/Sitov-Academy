'use client'

import { useState } from 'react'
import { updateStudentRole, updateStudentAllowedLevels } from '@/app/actions/admin'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import { Loader2 } from 'lucide-react'

type Profile = {
  id: string
  name: string | null
  email: string
  role: string | null
  allowed_levels: string[] | null
  created_at: string | null
}

export default function StudentList({ 
  initialStudents, 
  currentUserId,
  currentUserRole,
  progressData = {}
}: { 
  initialStudents: Profile[], 
  currentUserId?: string,
  currentUserRole?: string,
  progressData?: Record<string, Record<string, number>>
}) {
  const [students, setStudents] = useState<Profile[]>(initialStudents)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [resetLevel, setResetLevel] = useState<Record<string, string>>({})

  const handleRoleChange = async (id: string, newRole: string) => {
    if (id === currentUserId && newRole === 'student') {
      alert('Du kannst dir nicht selbst die Admin/Teacher-Rechte entziehen!')
      return
    }
    
    setLoadingId(id)
    const res = await updateStudentRole(id, newRole)
    if (res.success === true) {
      setStudents(students.map(s => s.id === id ? { ...s, role: newRole } : s))
    } else {
      alert('Fehler beim Ändern der Rolle: ' + res.error)
    }
    setLoadingId(null)
  }

  // Freigabe eines einzelnen Sprachniveaus umschalten und sofort speichern.
  const handleLevelToggle = async (id: string, level: string) => {
    const student = students.find(s => s.id === id)
    if (!student) return

    const current = student.allowed_levels ?? []
    const nextLevels = current.includes(level)
      ? current.filter(l => l !== level)
      : [...current, level]

    setLoadingId(id)
    const res = await updateStudentAllowedLevels(id, nextLevels)
    if (res.success) {
      setStudents(students.map(s => s.id === id ? { ...s, allowed_levels: res.allowedLevels ?? nextLevels } : s))
    } else {
      alert('Fehler beim Speichern der Freigaben: ' + res.error)
    }
    setLoadingId(null)
  }

  const handleResetProgress = async (id: string, level: string) => {
    if (!confirm(`Möchtest du den Fortschritt für Level ${level} wirklich unwiderruflich löschen?`)) return
    
    setLoadingId(id)
    const { resetStudentProgress } = await import('@/app/actions/admin')
    const res = await resetStudentProgress(id, level)
    if (res.success) {
      alert(`Fortschritt für ${level} wurde zurückgesetzt! (Seite neu laden für aktuelles Dashboard)`)
    } else {
      alert('Fehler: ' + res.error)
    }
    setLoadingId(null)
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm">
              <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-800">Name & Email</th>
              <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-800">Registriert am</th>
              <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-800">Fortschritt</th>
              <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-800">Freigegebene Sprachniveaus</th>
              <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-800">Rolle</th>
              <th className="p-4 font-bold border-b border-slate-200 dark:border-slate-800">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {students.map((student) => {
              const isFullAccess = student.role === 'admin' || student.role === 'teacher'
              const allowed = student.allowed_levels ?? []
              return (
              <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-slate-900 dark:text-white">{student.name || 'Unbekannt'}</div>
                  <div className="text-sm text-slate-500">{student.email}</div>
                </td>
                <td className="p-4 text-sm text-slate-500">
                  {student.created_at ? new Date(student.created_at).toLocaleDateString('de-DE') : '—'}
                </td>
                <td className="p-4">
                  {(() => {
                    const p = progressData[student.id] || {}
                    const activeLevels = Object.entries(p).filter(([, val]) => val > 0).sort((a, b) => a[0].localeCompare(b[0]))
                    if (activeLevels.length === 0) return <span className="text-slate-400 text-xs italic">Noch kein Fortschritt</span>
                    return (
                      <div className="flex flex-wrap gap-1.5 max-w-[140px]">
                        {activeLevels.map(([level, val]) => (
                          <span key={level} className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-[#FF5C00] dark:bg-[#FF5C00]/20 border border-orange-200 dark:border-[#FF5C00]/30 shadow-sm">
                            {level}: {val}%
                          </span>
                        ))}
                      </div>
                    )
                  })()}
                </td>
                <td className="p-4">
                  {isFullAccess ? (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
                      Vollzugriff (Rolle)
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                      {ACCESS_LEVELS.map((level) => {
                        const isOn = allowed.includes(level)
                        return (
                          <button
                            key={level}
                            type="button"
                            role="checkbox"
                            aria-checked={isOn}
                            aria-label={`Sprachniveau ${level} für ${student.name || student.email} ${isOn ? 'entziehen' : 'freischalten'}`}
                            disabled={loadingId === student.id}
                            onClick={() => handleLevelToggle(student.id, level)}
                            className={`min-h-9 rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FF5C00] disabled:opacity-50 disabled:cursor-not-allowed ${
                              isOn
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                          >
                            {isOn ? '✓ ' : ''}{level}
                          </button>
                        )
                      })}
                      {loadingId === student.id && (
                        <span className="inline-flex items-center text-slate-400"><Loader2 size={14} className="animate-spin" /></span>
                      )}
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="relative inline-block w-32">
                    <select
                      value={student.role ?? 'student'}
                      onChange={(e) => handleRoleChange(student.id, e.target.value)}
                      disabled={loadingId === student.id || student.id === currentUserId || currentUserRole !== 'admin'}
                      className={`appearance-none w-full px-3 py-1.5 pr-8 rounded-lg text-sm font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FF5C00] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        student.role === 'teacher' || student.role === 'admin'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
                          : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      {(student.role === 'admin' || currentUserRole === 'admin') && <option value="admin">Admin</option>}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                      {loadingId === student.id ? <Loader2 size={14} className="animate-spin" /> : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <select 
                      className="px-2 py-1.5 rounded-lg text-sm font-bold border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#FF5C00]"
                      value={resetLevel[student.id] || 'A1.1'}
                      onChange={(e) => setResetLevel({ ...resetLevel, [student.id]: e.target.value })}
                      disabled={loadingId === student.id}
                    >
                      {ACCESS_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => handleResetProgress(student.id, resetLevel[student.id] || 'A1.1')}
                      disabled={loadingId === student.id}
                      className="px-2 py-1.5 text-xs font-bold bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400 transition-colors"
                      title="Fortschritt löschen"
                    >
                      Reset
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Keine Nutzer gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
