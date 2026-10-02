'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { UserRoundX } from 'lucide-react'
import { deleteOwnProfile } from '@/app/actions/profile'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export interface ProfileDeleteTranslations {
  title: string
  description: string
  button: string
  dialog_title: string
  dialog_description: string
  scope: string
  acknowledge: string
  cancel: string
  confirm: string
  pending: string
  error: string
  not_authenticated: string
  conflict: string
}

/**
 * Das eigene Lernplattform-Profil endgültig löschen. Steht im Bereich
 * „Vorsicht" unter dem Zurücksetzen des Lernstands und verlangt neben der
 * Rückfrage eine angehakte Bestätigung. Was bleibt (Buchungen, Rechnungen),
 * steht ausdrücklich im Dialog.
 */
export default function ProfileDelete({ translations: t, lang }: {
  translations: ProfileDeleteTranslations
  lang: string
}) {
  const titleId = useId()
  const inFlight = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The transition hands the redirect of a completed delete to Next.js; the busy state is kept here.
  const [, start] = useTransition()

  function fail(message: string) {
    inFlight.current = false
    setPending(false)
    setError(message)
  }
  function confirmDelete() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    start(async () => {
      try {
        // On success the action signs out and redirects to the login page; only a failure returns.
        const result = await deleteOwnProfile(lang, { confirmation: 'DELETE_LEARNING_PROFILE' })
        if (result.success === false) {
          fail(result.reason === 'not_authenticated' ? t.not_authenticated
            : result.reason === 'conflict' || result.reason === 'not_authorized' ? t.conflict : t.error)
        }
      } catch (failure) {
        // The redirect stays busy until the login page replaces this one.
        unstable_rethrow(failure)
        fail(t.error)
      }
    })
  }

  return (
    <section aria-labelledby={titleId} className="min-w-0 rounded-3xl border border-red-300 bg-[var(--surface)] p-4 dark:border-red-900 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
          <UserRoundX size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold text-[var(--foreground)]">{t.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{t.description}</p>
        </div>
      </div>
      <button ref={trigger} type="button" disabled={pending} aria-haspopup="dialog" onClick={() => { setError(null); setOpen(true) }}
        className="mt-5 flex min-h-12 w-full min-w-12 items-center justify-center rounded-xl border border-red-400 bg-red-50 px-4 py-3 text-center text-base font-semibold text-red-800 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950">
        {t.button}
      </button>
      {open && (
        <ConfirmDialog title={t.dialog_title} description={t.dialog_description} acknowledgeLabel={t.acknowledge}
          cancelLabel={t.cancel} confirmLabel={t.confirm} pendingLabel={t.pending} pending={pending} error={error} returnFocus={trigger}
          onConfirm={confirmDelete} onClose={() => { if (!pending) setOpen(false) }}>
          <p className="text-[var(--muted)]">{t.scope}</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
