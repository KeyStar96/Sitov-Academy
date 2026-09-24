'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react'
import { resetUserProgress } from '@/app/actions/resetUserProgress'
import { announceLearningReset } from '@/lib/learning-reset-events'

export interface ProfileProgressResetTranslations {
  title: string
  description: string
  scope: string
  button: string
  dialog_title: string
  dialog_description: string
  cancel: string
  confirm: string
  pending: string
  pending_description: string
  success: string
  error: string
  not_authenticated: string
  reset_in_progress: string
}

export default function ProfileProgressReset({ translations: t, userId }: {
  translations: ProfileProgressResetTranslations
  userId: string
}) {
  const router = useRouter()
  const titleId = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const inFlight = useRef(false)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)

  function closeDialog() {
    if (!inFlight.current) setOpen(false)
  }

  async function confirmReset() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      const result = await resetUserProgress({ confirmation: 'RESET_LEARNING_DATA' })
      if (result.success === false) {
        setError(result.reason === 'not_authenticated' ? t.not_authenticated
          : result.reason === 'reset_in_progress' ? t.reset_in_progress : t.error)
        return
      }
      announceLearningReset(userId)
      setCompleted(true)
      setOpen(false)
      try { router.refresh() }
      catch { /* A refresh failure cannot undo the completed server action. */ }
    } catch {
      setError(t.error)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-3xl border border-red-300 bg-[var(--surface)] p-4 dark:border-red-900 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
          <RotateCcw size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold text-[var(--foreground)]">{t.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t.description}</p>
        </div>
      </div>
      <button ref={trigger} type="button" disabled={pending} aria-haspopup="dialog"
        onClick={() => { setOpen(true); setError(null); setCompleted(false) }}
        className="mt-5 flex min-h-12 w-full min-w-12 items-center justify-center rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-center text-base font-semibold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950">
        {t.button}
      </button>
      {completed && <p role="status" className="mt-4 text-sm leading-relaxed text-emerald-800 dark:text-emerald-300">{t.success}</p>}
      {open && <ResetConfirmationDialog translations={t} trigger={trigger} pending={pending} error={error}
        onClose={closeDialog} onConfirm={() => { void confirmReset() }} />}
    </section>
  )
}

function ResetConfirmationDialog({ translations: t, trigger, pending, error, onClose, onConfirm }: {
  translations: ProfileProgressResetTranslations
  trigger: RefObject<HTMLButtonElement | null>
  pending: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const statusId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    cancel.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      trigger.current?.focus({ preventScroll: true })
    }
  }, [trigger])

  useEffect(() => {
    if (pending) dialog.current?.focus({ preventScroll: true })
  }, [pending])

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') { event.preventDefault(); if (!pending) onClose(); return }
    if (event.key !== 'Tab') return
    const element = dialog.current
    const controls = element?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
    if (!controls?.length) {
      event.preventDefault()
      element?.focus({ preventScroll: true })
      return
    }
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <dialog ref={dialog} tabIndex={-1} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
      aria-busy={pending} onKeyDown={trapFocus}
      onCancel={event => { event.preventDefault(); if (!pending) onClose() }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-top,0px)_-_env(safe-area-inset-bottom,0px))] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-red-300 bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-2xl outline-none backdrop:bg-black/55 dark:border-red-900 sm:p-7">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
        <AlertTriangle size={25} aria-hidden="true" />
      </span>
      <h2 id={titleId} className="text-2xl font-bold tracking-tight">{t.dialog_title}</h2>
      <p id={descriptionId} className="mt-4 text-base leading-relaxed text-[var(--muted)]">{t.dialog_description}</p>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{t.scope}</p>
      {pending && <div role="status" id={statusId} className="mt-5 rounded-2xl bg-[var(--canvas)] p-4 text-sm leading-relaxed">
        <p className="flex items-center gap-3 font-semibold"><Loader2 size={19} className="shrink-0 animate-spin" aria-hidden="true" />{t.pending}</p>
        <p className="mt-2 text-[var(--muted)]">{t.pending_description}</p>
      </div>}
      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-relaxed text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
      <div className="mt-7 flex flex-col gap-3">
        <button ref={cancel} type="button" disabled={pending} onClick={onClose}
          className="min-h-12 min-w-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-base font-semibold text-[var(--foreground)] hover:bg-[var(--canvas)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--violet)] disabled:opacity-50">
          {t.cancel}
        </button>
        <button type="button" disabled={pending} onClick={onConfirm} aria-describedby={pending ? statusId : undefined}
          className="min-h-12 min-w-12 rounded-xl bg-red-700 px-5 py-3 text-base font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600 disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700">
          {t.confirm}
        </button>
      </div>
    </dialog>,
    document.body,
  )
}
