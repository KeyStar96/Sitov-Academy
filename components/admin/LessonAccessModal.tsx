'use client'

import { useState, useEffect } from 'react'
import { getAvailableLessons, updateStudentTrainerAccess } from '@/app/actions/admin'
import { Loader2, X } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import type { Trainer, AccessLevel, TrainerAccessRule } from '@/lib/access/levels'

export default function LessonAccessModal({
  studentId,
  studentName,
  level,
  trainer,
  rule,
  onClose,
  onSave,
}: {
  studentId: string
  studentName: string
  level: AccessLevel
  trainer: Trainer
  rule?: TrainerAccessRule
  onClose: () => void
  onSave: (allowedLessons: string[] | null) => void
}) {
  const t = useAdminTranslator()
  const [lessons, setLessons] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // null means "all allowed"
  const [selected, setSelected] = useState<string[] | null>(rule?.allowed_lessons ?? null)

  useEffect(() => {
    getAvailableLessons(level, trainer).then(data => {
      setLessons(data)
      setLoading(false)
    })
  }, [level, trainer])

  const handleToggle = (lesson: string) => {
    if (selected === null) {
      // If "all" was selected, now we unselect this one, meaning we select all OTHERS
      setSelected(lessons.filter(l => l !== lesson))
    } else {
      if (selected.includes(lesson)) {
        setSelected(selected.filter(l => l !== lesson))
      } else {
        setSelected([...selected, lesson])
      }
    }
  }

  const handleSelectAll = () => {
    setSelected(null)
  }

  const handleSelectNone = () => {
    setSelected([])
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await updateStudentTrainerAccess({
        userId: studentId,
        level,
        trainer,
        enabled: rule?.enabled ?? true,
        allowedLessons: selected,
      })
      if (result.success) {
        onSave(selected)
      } else {
        alert(t('save_failed'))
      }
    } catch {
      alert(t('save_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--foreground)]">{t('lesson_access_title')}</h2>
            <p className="text-sm text-[var(--muted)]">{studentName} · {level} · {t(`trainer_${trainer}`)}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"><X size={20} /></button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="animate-spin text-[var(--muted)]" />
            </div>
          ) : lessons.length === 0 ? (
            <p className="text-center text-[var(--muted)]">{t('no_lessons_found')}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 pb-2">
                <button onClick={handleSelectAll} className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--border)]">{t('select_all')}</button>
                <button onClick={handleSelectNone} className="rounded-md bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--border)]">{t('select_none')}</button>
              </div>
              
              <div className="space-y-1">
                {lessons.map(lesson => {
                  const isChecked = selected === null || selected.includes(lesson)
                  return (
                    <label key={lesson} className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] p-3 hover:border-[var(--accent)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[var(--violet)]">
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => handleToggle(lesson)} 
                        className="h-5 w-5 rounded border-slate-300 accent-[var(--accent)]" 
                      />
                      <span className="font-medium text-[var(--foreground)]">{lesson}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <footer className="border-t border-[var(--border)] p-4">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 font-bold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {t('save')}
          </button>
        </footer>
      </div>
    </div>
  )
}
