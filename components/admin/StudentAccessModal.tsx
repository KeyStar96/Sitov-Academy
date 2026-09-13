'use client'

import { useState } from 'react'
import { Loader2, Lock, LockOpen, SlidersHorizontal } from 'lucide-react'
import { ACCESS_LEVELS, TRAINERS, hasConfiguredTrainerAccess, type Trainer, type AccessLevel } from '@/lib/access/levels'
import type { AdminStudentRow } from '@/lib/types/admin-staff'
import { useAdminTranslator } from './AdminI18nProvider'
import AdminDialog from './AdminDialog'
import LessonAccessModal from './LessonAccessModal'

export default function StudentAccessModal({ student, loading, message, hasError, onClose, onLevelToggle, onTrainerToggle, onLessonsUpdate }: {
  student: AdminStudentRow
  loading: boolean
  message: string | null
  hasError: boolean
  onClose: () => void
  onLevelToggle: (id: string, level: AccessLevel) => void
  onTrainerToggle: (id: string, level: AccessLevel, trainer: Trainer) => void
  onLessonsUpdate: (id: string, level: AccessLevel, trainer: Trainer, lessons: string[] | null) => void
}) {
  const t = useAdminTranslator()
  const [level, setLevel] = useState<AccessLevel>(ACCESS_LEVELS.find(item => student.allowed_levels?.includes(item)) ?? ACCESS_LEVELS[0])
  const [trainer, setTrainer] = useState<Trainer | null>(null)
  const [savingLessons, setSavingLessons] = useState(false)
  const name = student.person?.display_name || student.person?.email || t('unknown_name')
  const levelEnabled = student.allowed_levels?.includes(level) ?? false
  const busy = loading || savingLessons

  return (
    <AdminDialog
      title={trainer ? t(trainer === 'pronunciation' ? 'pronunciation_access_title' : 'lesson_access_title') : t('trainer_access_title')}
      subtitle={trainer ? `${name} · ${level} · ${t(`trainer_${trainer}`)}` : name}
      onClose={onClose}
      dismissible={!busy}
    >
      {trainer ? (
        <LessonAccessModal
          key={`${level}-${trainer}`}
          studentId={student.id}
          level={level}
          trainer={trainer}
          rule={student.trainer_grants?.find(rule => rule.level === level && rule.trainer === trainer)}
          onClose={() => setTrainer(null)}
          onSave={lessons => { onLessonsUpdate(student.id, level, trainer, lessons); setTrainer(null) }}
          onBusyChange={setSavingLessons}
        />
      ) : (
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6" data-lenis-prevent>
          <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
            <label className="min-w-40 flex-1 text-base font-semibold">
              <span className="mb-2 block">{t('access_level_select')}</span>
              <select value={level} disabled={busy} onChange={event => setLevel(event.target.value as AccessLevel)} className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-base text-[var(--foreground)]">
                {ACCESS_LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button type="button" role="checkbox" aria-checked={levelEnabled} aria-label={t('level_toggle_aria', { level, name, action: levelEnabled ? t('level_revoke') : t('level_grant') })} disabled={busy} onClick={() => onLevelToggle(student.id, level)} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base font-semibold disabled:opacity-50">
              {levelEnabled ? <LockOpen size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}{level} · {t(levelEnabled ? 'level_revoke' : 'level_grant')}
            </button>
          </div>
          {!levelEnabled && <p className="text-base text-[var(--muted)]">{t('trainer_level_required')}</p>}
          <fieldset disabled={busy || !levelEnabled} className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-3 text-base font-bold">{t('trainer_access_level', { level })}</legend>
            {TRAINERS.map(item => {
              const enabled = hasConfiguredTrainerAccess(student, level, item)
              const allowedLessons = student.trainer_grants?.find(rule => rule.level === level && rule.trainer === item)?.unit_ids
              const restricted = allowedLessons !== undefined && allowedLessons !== null
              return (
                <div key={item} className="flex flex-col rounded-2xl border border-[var(--border)] p-3">
                  <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg px-1 text-base font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--violet)]">
                    <input type="checkbox" checked={enabled} onChange={() => onTrainerToggle(student.id, level, item)} aria-label={`${name} · ${level} · ${t(`trainer_${item}`)}`} className="h-5 w-5 shrink-0 accent-[var(--accent)]" />
                    <span className="min-w-0 flex-1">{t(`trainer_${item}`)}</span>
                    {enabled ? <LockOpen size={18} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
                  </label>
                  {item !== 'videos' && (
                    <>
                      <p className="mb-2 px-1 text-sm leading-relaxed text-[var(--muted)]">{restricted ? t('access_selected_units', { count: allowedLessons.length }) : t('access_all_units')}</p>
                      <button type="button" disabled={!enabled || busy} onClick={() => setTrainer(item)} className="mt-auto flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 text-base font-semibold hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--muted)]">
                        <SlidersHorizontal size={18} aria-hidden="true" />{t(item === 'pronunciation' ? 'pronunciation_access_button' : 'restrict_lessons')}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </fieldset>
          <p className="flex min-h-6 items-center gap-2 text-sm text-[var(--muted)]" role="status">{loading && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}{t('access_saved_automatically')}</p>
          {message && <p role={hasError ? 'alert' : 'status'} className={`text-base ${hasError ? 'text-red-700 dark:text-red-300' : 'text-[var(--foreground)]'}`}>{message}</p>}
        </div>
      )}
    </AdminDialog>
  )
}
