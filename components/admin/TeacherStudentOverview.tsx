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
import { AttentionReasons, MiniPhases, displayDate, studyTime, dashboardControl as control, dashboardButton as button, dashboardPanel as panel } from './TeacherDashboardShared'

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
  return <div className="space-y-5">
    <AttentionReasons reasons={student.attentionReasons} lang={lang} />
    <section className={panel}><h2 className="text-xl font-semibold">{t('overview')}</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <div key={label}><dt className="text-base text-[var(--muted)]">{label}</dt><dd className="mt-1 break-words text-xl font-semibold">{value}</dd></div>)}</dl><p className="mt-4 text-base text-[var(--muted)]">{t('timeHint')}</p></section>
    <div className="grid gap-5 md:grid-cols-2"><section className={panel}><h2 className="mb-4 text-xl font-semibold">{t('phases')}</h2><MiniPhases phases={student.phases} lang={lang} /></section><section className={panel}><h2 className="mb-4 text-xl font-semibold">{t('completedPaths')}</h2>{student.completedPathsByLevel.length ? <dl className="grid grid-cols-2 gap-4">{student.completedPathsByLevel.map(item => <div key={item.level}><dt>{item.level}</dt><dd className="text-xl font-bold">{item.completed}/{item.total}</dd></div>)}</dl> : <p>{t('empty')}</p>}</section></div>
    <section className={panel}><h2 className="mb-4 text-xl font-semibold">{t('selectLevels')}</h2>
      {current.role !== 'student' ? <p>{admin('full_access')}</p> : <><fieldset disabled={Boolean(access.loadingId) || roleBusy}><legend className="sr-only">{t('selectLevels')}</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{ACCESS_LEVELS.map(level => <label key={level} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] px-4"><input type="checkbox" className="h-5 w-5 accent-[var(--accent)]" checked={levels.includes(level)} onChange={event => setLevels(current => event.target.checked ? [...current, level] : current.filter(item => item !== level))} />{level}</label>)}</div><div className="mt-4 flex flex-wrap justify-end gap-3"><button type="button" className={button} onClick={() => setLevels([...ACCESS_LEVELS])}>{t('selectAll')}</button><button type="button" className={`${button} bg-[var(--accent-strong)] text-[var(--accent-foreground)]`} onClick={async () => { setStatus(null); if (await access.saveLevels(student.id, levels)) { setStatus(t('saved')); router.refresh() } }}>{t('saveLevels')}</button></div></fieldset><button type="button" className={`${button} mt-4`} disabled={Boolean(access.loadingId) || roleBusy} aria-label={admin('access_manage_aria', { name })} onClick={() => { access.setMessage(null); access.setAccessStudentId(student.id) }}>{admin('access_manage')}</button></>}
    </section>
    <section className={`${panel} grid gap-5 sm:grid-cols-2`}><label className="font-semibold">{admin('col_role')}<select className={`${control} mt-2`} value={current.role ?? 'student'} onChange={event => void setRole(event.target.value)} disabled={roleBusy || Boolean(access.loadingId) || currentUserRole !== 'admin' || currentUserId === student.id}>{(['student', 'teacher', 'admin'] as const).map(role => <option key={role} value={role}>{admin(`role_${role}`)}</option>)}</select></label>{current.role === 'student' && <div><label className="font-semibold">{admin('col_progress')}<select className={`${control} mt-2`} value={resetLevel} onChange={event => setResetLevel(event.target.value)} disabled={roleBusy || Boolean(access.loadingId)}>{ACCESS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label><button type="button" className={`${button} mt-2 w-full`} disabled={roleBusy || Boolean(access.loadingId)} onClick={() => void resetProgress()} aria-label={admin('reset_aria', { name, level: resetLevel })}>{admin('reset')}</button></div>}</section>
    {!access.accessStudent && access.message && <p role={access.hasError ? 'alert' : 'status'}>{access.message}</p>}{status && <p role="status">{status}</p>}
    {access.accessStudent && <StudentAccessModal student={access.accessStudent} loading={Boolean(access.loadingId)} message={access.message} hasError={access.hasError} onClose={() => { setLevels(access.students[0].allowed_levels); access.setAccessStudentId(null) }} onLevelToggle={access.handleLevelToggle} onTrainerToggle={access.handleTrainerToggle} onLessonsUpdate={access.handleLessonsUpdate} />}
  </div>
}
