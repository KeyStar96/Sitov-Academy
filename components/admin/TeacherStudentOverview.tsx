'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateStudentRole, resetStudentProgress } from '@/app/actions/admin'
import { ACCESS_LEVELS } from '@/lib/access/levels'
import type { TeacherStudent } from '@/lib/teacher-dashboard-contract'
import { teacherDashboardT } from '@/lib/teacher-dashboard-i18n'
import { profileRoleSchema } from '@/lib/types/backend'
import { useAdminTranslator } from './AdminI18nProvider'
import { useStudentAccess } from './useStudentAccess'
import StudentAccessModal from './StudentAccessModal'
import StudentProfileDelete from './StudentProfileDelete'
import { AttentionReasons, MiniPhases, displayDate, studyTime, dashboardControl as control, dashboardPanel as panel } from './TeacherDashboardShared'
import { adminButton, adminLabel } from './ui'
import { SlidersHorizontal } from 'lucide-react'

export default function TeacherStudentOverview({ student, lang, currentUserId, currentUserRole }: {
  student: TeacherStudent; lang: string; currentUserId: string; currentUserRole: string
}) {
  const t = teacherDashboardT(lang), admin = useAdminTranslator(), router = useRouter()
  const access = useStudentAccess([student])
  const current = access.students[0]
  const [levels, setLevels] = useState<string[]>(student.allowed_levels)
  const [roleBusy, setRoleBusy] = useState(false)
  const lock = useRef(false)
  const [resetLevel, setResetLevel] = useState<string>(ACCESS_LEVELS[0])
  const [status, setStatus] = useState<string | null>(null)
  const name = student.person?.display_name || admin('unknown_name')
  const metrics = [[t('lastActive'), displayDate(student.lastActiveAt, lang)], [t('time7'), studyTime(student.learningSeconds7d, lang)],
    [t('time30'), studyTime(student.learningSeconds30d, lang)], [t('streak'), student.streakDays], [t('level'), student.currentLevel || '—'],
    [t('position'), student.pathPosition ? `${student.pathPosition.title} · ${student.pathPosition.completedNodes}/${student.pathPosition.totalNodes}` : '—'],
    [t('lastTest'), student.lastTest?.percentage == null ? '—' : `${student.lastTest.percentage}%`], [t('due'), student.dueCards]]
  const setRole = async (value: string) => {
    const role = profileRoleSchema.safeParse(value)
    if (!role.success || lock.current || currentUserRole !== 'admin' || currentUserId === student.id) return
    lock.current = true; setRoleBusy(true); access.setMessage(null)
    try {
      const result = await updateStudentRole(student.id, role.data)
      if (!result.success) throw new Error('role_change_failed')
      access.setStudents(rows => rows.map(row => ({ ...row, role: role.data })))
      setStatus(t('saved')); router.refresh()
    } catch { access.setHasError(true); access.setMessage(admin('role_change_failed')) }
    finally { lock.current = false; setRoleBusy(false) }
  }
  const resetProgress = async () => {
    if (lock.current || !window.confirm(admin('reset_confirm', { level: resetLevel }))) return
    lock.current = true; setRoleBusy(true); access.setMessage(null)
    try {
      const result = await resetStudentProgress(student.id, resetLevel)
      if (!result.success) throw new Error('reset_failed')
      setStatus(admin('reset_success', { level: resetLevel })); router.refresh()
    } catch { access.setHasError(true); access.setMessage(admin('reset_failed')) }
    finally { lock.current = false; setRoleBusy(false) }
  }
  const sectionTitle = 'mb-3 text-sm font-semibold'
  return <div className="min-w-0 space-y-4 sm:space-y-5">
    {student.attentionReasons.length > 0 && <AttentionReasons reasons={student.attentionReasons} lang={lang} />}
    <section className={panel} aria-labelledby="student-overview-metrics">
      <h2 id="student-overview-metrics" className={sectionTitle}>{t('overview')}</h2>
      <dl className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg bg-[var(--surface-muted)] p-3"><dt className="text-xs leading-snug text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words text-[0.9375rem] font-semibold tabular-nums">{value}</dd></div>)}</dl>
      <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{t('timeHint')}</p>
    </section>
    <div className="grid gap-4 md:grid-cols-2"><section className={panel}><h2 className={sectionTitle}>{t('phases')}</h2><MiniPhases phases={student.phases} lang={lang} /></section><section className={panel}><h2 className={sectionTitle}>{t('completedPaths')}</h2>{student.completedPathsByLevel.length ? <dl className="grid grid-cols-2 gap-3 text-sm">{student.completedPathsByLevel.map(item => <div key={item.level}><dt className="text-[var(--muted)]">{item.level}</dt><dd className="text-base font-semibold tabular-nums">{item.completed}/{item.total}</dd></div>)}</dl> : <p className="text-sm text-[var(--muted)]">{t('empty')}</p>}</section></div>
    <section className={panel}><h2 className={sectionTitle}>{t('selectLevels')}</h2>
      {current.role !== 'student' ? <p className="text-sm">{admin('full_access')}</p> : <><fieldset disabled={Boolean(access.loadingId) || roleBusy}><legend className="sr-only">{t('selectLevels')}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{ACCESS_LEVELS.map(level => <label key={level} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[var(--admin-line-strong)] px-3 text-sm font-medium tabular-nums has-[:checked]:border-[var(--foreground)] has-[:checked]:bg-[var(--surface-muted)]"><input type="checkbox" className="h-5 w-5 accent-[var(--accent-strong)]" checked={levels.includes(level)} onChange={event => setLevels(current => event.target.checked ? [...current, level] : current.filter(item => item !== level))} />{level}</label>)}</div><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><button type="button" className={adminButton('secondary')} onClick={() => setLevels([...ACCESS_LEVELS])}>{t('selectAll')}</button><button type="button" className={adminButton('primary')} onClick={async () => { setStatus(null); if (await access.saveLevels(student.id, levels)) { setStatus(t('saved')); router.refresh() } }}>{t('saveLevels')}</button></div></fieldset><div className="mt-4 border-t border-[var(--admin-line)] pt-4"><button type="button" className={adminButton('secondary', 'md', 'w-full sm:w-auto')} disabled={Boolean(access.loadingId) || roleBusy} aria-label={admin('access_manage_aria', { name })} onClick={() => { access.setMessage(null); access.setAccessStudentId(student.id) }}><SlidersHorizontal size={16} aria-hidden="true" />{admin('access_manage')}</button></div></>}
    </section>
    <section className={`${panel} grid gap-5 sm:grid-cols-2`}><label className="block min-w-0"><span className={adminLabel}>{admin('col_role')}</span><select className={control} value={current.role ?? 'student'} onChange={event => void setRole(event.target.value)} disabled={roleBusy || Boolean(access.loadingId) || currentUserRole !== 'admin' || currentUserId === student.id}>{(['student', 'teacher', 'admin'] as const).map(role => <option key={role} value={role}>{admin(`role_${role}`)}</option>)}</select></label>{current.role === 'student' && <div className="min-w-0"><label className="block"><span className={adminLabel}>{admin('col_progress')}</span><select className={control} value={resetLevel} onChange={event => setResetLevel(event.target.value)} disabled={roleBusy || Boolean(access.loadingId)}>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label><button type="button" className={adminButton('danger', 'md', 'mt-2 w-full')} disabled={roleBusy || Boolean(access.loadingId)} onClick={() => void resetProgress()} aria-label={admin('reset_aria', { name, level: resetLevel })}>{admin('reset')}</button></div>}</section>
    {current.role === 'student' && <StudentProfileDelete studentId={student.id} name={name} lang={lang} />}
    {!access.accessStudent && access.message && <p role={access.hasError ? 'alert' : 'status'} className={`text-sm ${access.hasError ? 'text-[var(--danger)]' : ''}`}>{access.message}</p>}{status && <p role="status" className="text-sm text-[var(--success)]">{status}</p>}
    {access.accessStudent && <StudentAccessModal student={access.accessStudent} loading={Boolean(access.loadingId)} message={access.message} hasError={access.hasError} onClose={() => { setLevels(access.students[0].allowed_levels); access.setAccessStudentId(null) }} onLevelToggle={access.handleLevelToggle} onTrainerToggle={access.handleTrainerToggle} onLessonsUpdate={access.handleLessonsUpdate} />}
  </div>
}
