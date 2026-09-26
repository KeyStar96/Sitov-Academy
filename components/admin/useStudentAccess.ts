'use client'
import { useRef, useState } from 'react'
import { updateStudentAllowedLevels, updateStudentTrainerAccess } from '@/app/actions/admin'
import { hasConfiguredTrainerAccess, type Trainer, type AccessLevel } from '@/lib/access/levels'
import type { AdminStudentRow } from '@/lib/types/admin-staff'
import { useAdminTranslator } from './AdminI18nProvider'

/** Serialize writes so a slower response cannot overwrite a later access decision. */
export function useStudentAccess<T extends AdminStudentRow>(initial: T[]) {
  const t = useAdminTranslator()
  const [students, setStudents] = useState(initial)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const lock = useRef(false)
  const [accessStudentId, setAccessStudentId] = useState<string | null>(null)
  const accessStudent = students.find(row => row.id === accessStudentId) ?? null
  const saveLevels = async (id: string, next: string[]) => {
    if (lock.current) return false
    lock.current = true
    const previous = students
    setStudents(rows => rows.map(row => row.id === id ? { ...row, allowed_levels: next } : row))
    setLoadingId(id); setMessage(null)
    try {
      const result = await updateStudentAllowedLevels(id, next)
      if (result.success !== true) throw new Error('levels_save_failed')
      setStudents(rows => rows.map(row => row.id === id ? { ...row, allowed_levels: result.allowedLevels ?? next } : row))
      setHasError(false)
      return true
    } catch { setStudents(previous); setHasError(true); setMessage(t('levels_save_failed')); return false }
    finally { lock.current = false; setLoadingId(null) }
  }
  const handleLevelToggle = async (id: string, level: AccessLevel) => {
    const current = students.find(row => row.id === id)?.allowed_levels ?? []
    return saveLevels(id, current.includes(level) ? current.filter(item => item !== level) : [...current, level])
  }
  const handleTrainerToggle = async (id: string, level: AccessLevel, trainer: Trainer) => {
    const student = students.find(row => row.id === id)
    if (lock.current || !student?.allowed_levels?.includes(level)) return
    lock.current = true
    const previous = students
    const enabled = !hasConfiguredTrainerAccess(student, level, trainer)
    const oldRule = student.trainer_grants?.find(rule => rule.level === level && rule.trainer === trainer)
    const rules = [...(student.trainer_grants ?? []).filter(rule => rule.level !== level || rule.trainer !== trainer), { ...oldRule, level, trainer, enabled }]
    setStudents(rows => rows.map(row => row.id === id ? { ...row, trainer_grants: rules } : row))
    setLoadingId(id); setMessage(null)
    try {
      const result = await updateStudentTrainerAccess({ userId: id, level, trainer, enabled })
      if (!result.success) throw new Error('trainer_save_failed')
      setHasError(false)
    } catch { setStudents(previous); setHasError(true); setMessage(t('trainer_save_failed')) }
    finally { lock.current = false; setLoadingId(null) }
  }
  const handleLessonsUpdate = (id: string, level: AccessLevel, trainer: Trainer, unit_ids: string[] | null) => {
    setStudents(rows => rows.map(row => {
      if (row.id !== id) return row
      const previous = row.trainer_grants?.find(rule => rule.level === level && rule.trainer === trainer)
      return { ...row, trainer_grants: [...(row.trainer_grants ?? []).filter(rule => rule.level !== level || rule.trainer !== trainer), { level, trainer, enabled: previous?.enabled ?? true, unit_ids }] }
    }))
  }
  return { students, setStudents, loadingId, message, setMessage, hasError, setHasError, accessStudent, setAccessStudentId,
    saveLevels, handleLevelToggle, handleTrainerToggle, handleLessonsUpdate }
}
