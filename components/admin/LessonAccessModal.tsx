'use client'

import { useState, useEffect } from 'react'
import { getAvailableLessons, updateStudentTrainerAccess } from '@/app/actions/admin'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import type { Trainer, AccessLevel, TrainerAccessRule } from '@/lib/access/levels'
import type { AccessUnit } from '@/lib/access/units'

/** The content selection occupies the existing student dialog, without a second overlay. */
export default function LessonAccessModal({ studentId, level, trainer, rule, onClose, onSave, onBusyChange }: {
  studentId: string
  level: AccessLevel
  trainer: Trainer
  rule?: TrainerAccessRule
  onClose: () => void
  onSave: (allowedLessons: string[] | null) => void
  onBusyChange: (busy: boolean) => void
}) {
  const t = useAdminTranslator()
  const [lessons, setLessons] = useState<AccessUnit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState<string[] | null>(rule?.unit_ids ?? null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadFailed(false)
    const load = async () => {
      try {
        const result = await getAvailableLessons(level, trainer)
        if (!active) return
        if (!result.success) { setLoadFailed(true); return }
        setLessons(result.lessons)
        const availableIds = new Set(result.lessons.map(lesson => lesson.id))
        setSelected(current => current === null ? null : current.filter(id => availableIds.has(id)))
      } catch {
        if (active) setLoadFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [level, trainer, attempt])

  const handleSave = async () => {
    if (saving || loading || loadFailed) return
    setSaving(true)
    onBusyChange(true)
    setSaveFailed(false)
    try {
      const result = await updateStudentTrainerAccess({
        userId: studentId, level, trainer, enabled: rule?.enabled ?? true, allowedLessons: selected,
      })
      if (result.success) onSave(selected)
      else setSaveFailed(true)
    } catch {
      setSaveFailed(true)
    } finally {
      setSaving(false)
      onBusyChange(false)
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6" data-lenis-prevent>
        <button type="button" onClick={onClose} disabled={saving} className="mb-4 flex min-h-12 items-center gap-2 rounded-lg px-2 text-base font-semibold hover:bg-[var(--surface-muted)] disabled:opacity-50">
          <ArrowLeft size={20} aria-hidden="true" />{t('access_back')}
        </button>
        {loading ? (
          <div role="status" aria-label={t('loading')} className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin" aria-hidden="true" /></div>
        ) : loadFailed ? (
          <div role="alert" className="rounded-xl border border-[var(--border)] p-5">
            <p>{t('access_load_failed')}</p>
            <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 min-h-12 rounded-lg border border-[var(--border)] px-4 font-semibold">{t('access_retry')}</button>
          </div>
        ) : lessons.length === 0 ? (
          <p className="rounded-xl border border-[var(--border)] px-4 py-10 text-center text-[var(--muted)]">{t('no_lessons_found')}</p>
        ) : (
          <fieldset disabled={saving} className="space-y-4">
            <legend className="sr-only">{t(trainer === 'pronunciation' ? 'pronunciation_access_title' : 'lesson_access_title')}</legend>
            <label className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <input type="checkbox" checked={selected === null} onChange={event => setSelected(event.target.checked ? null : lessons.map(lesson => lesson.id))} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
              <span className="font-semibold">{t('access_all_units')}</span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-base text-[var(--muted)]">{t('access_selected_units', { count: selected === null ? lessons.length : lessons.filter(lesson => selected.includes(lesson.id)).length })}</p>
              <button type="button" onClick={() => setSelected([])} className="min-h-12 rounded-lg border border-[var(--border)] px-4 text-base font-semibold hover:bg-[var(--surface-muted)]">{t('select_none')}</button>
            </div>
            <div className="space-y-2">
              {lessons.map(lesson => (
                <label key={lesson.id} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--surface-muted)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--violet)]">
                  <input type="checkbox" checked={selected === null || selected.includes(lesson.id)} onChange={() => setSelected(current => current === null ? lessons.filter(item => item.id !== lesson.id).map(item => item.id) : current.includes(lesson.id) ? current.filter(id => id !== lesson.id) : [...current, lesson.id])} className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]" />
                  <span className="min-w-0 break-words text-base font-medium">{lesson.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {saveFailed && <p role="alert" className="mt-4 text-base text-red-700 dark:text-red-300">{t('save_failed')}</p>}
      </div>
      <footer className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--border)] px-5 py-4 sm:px-6">
        <button type="button" onClick={onClose} disabled={saving} className="min-h-12 rounded-xl border border-[var(--border)] px-5 font-semibold disabled:opacity-50">{t('cancel')}</button>
        <button type="button" onClick={handleSave} disabled={saving || loading || loadFailed || lessons.length === 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 font-bold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">
          {saving && <Loader2 size={20} className="animate-spin" aria-hidden="true" />}{t('save')}
        </button>
      </footer>
    </>
  )
}
