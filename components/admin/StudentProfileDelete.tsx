'use client'

import { useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteStudentProfile } from '@/app/actions/admin'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { interpolate } from '@/lib/i18n-runtime'
import { studentsAdminCopy } from '@/lib/students-admin-i18n'
import { dashboardPanel as panel } from './TeacherDashboardShared'
import { adminButton } from './ui'

/**
 * Lernplattform-Profil eines Schülers löschen (Schüler-Detailseite, Überblick).
 * Steht bewusst ganz unten und nur auf der Detailseite – nicht in der Liste,
 * wo ein Tipp daneben reicht. Der Dialog nennt, was gelöscht wird und was in
 * der Verwaltung bleibt, und verlangt eine angehakte Bestätigung.
 */
export default function StudentProfileDelete({ studentId, name, lang }: { studentId: string; name: string; lang: string }) {
  const s = studentsAdminCopy(lang)
  const router = useRouter()
  const titleId = useId()
  const lock = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmDelete() {
    if (lock.current) return
    lock.current = true
    setPending(true)
    setError(null)
    let leaving = false
    try {
      const result = await deleteStudentProfile({ studentId, confirmation: 'DELETE_STUDENT_PROFILE' })
      // Already deleted by a colleague: the list is the right place either way.
      if (result.success === false && result.reason !== 'not_found') {
        setError(result.reason === 'conflict' ? s.deleteProfileConflict
          : result.reason === 'not_authorized' || result.reason === 'not_authenticated' ? s.deleteProfileNotAllowed : s.deleteProfileFailed)
        return
      }
      leaving = true
      // No name in the address: the list confirms with a neutral message.
      router.replace(`/${lang}/admin/students?deleted=1`)
    } catch {
      setError(s.deleteProfileFailed)
    } finally {
      lock.current = false
      // Stay busy until the list has replaced this page.
      if (!leaving) setPending(false)
    }
  }

  return (
    <section className={panel} aria-labelledby={titleId}>
      <h2 id={titleId} className="text-sm font-semibold">{s.deleteProfileTitle}</h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">{s.deleteProfileIntro}</p>
      <button ref={trigger} type="button" className={adminButton('danger', 'md', 'mt-4 w-full sm:w-auto')} disabled={pending} aria-haspopup="dialog"
        onClick={() => { setError(null); setOpen(true) }}>
        <Trash2 size={16} aria-hidden="true" />{s.deleteProfileButton}
      </button>
      {open && (
        <ConfirmDialog title={interpolate(s.deleteProfileDialogTitle, { name })} description={s.deleteProfileDialogText}
          acknowledgeLabel={s.deleteProfileAcknowledge} cancelLabel={s.deleteProfileCancel} confirmLabel={s.deleteProfileButton}
          pendingLabel={s.deleteProfilePending} pending={pending} error={error} returnFocus={trigger}
          onConfirm={() => { void confirmDelete() }} onClose={() => { if (!pending) setOpen(false) }}>
          <p className="text-[var(--muted)]">{s.deleteProfileKept}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
