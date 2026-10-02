'use client'

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import DialogActions from '@/components/ui/DialogActions'

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'

/**
 * Sicherheitsabfrage vor einer Aktion, die sich nicht rückgängig machen lässt.
 *
 * Ein natives modales `<dialog>`: Es liegt auch über einem bereits geöffneten
 * Dialog (z. B. dem Gespräch), hält den Tastaturfokus und gibt ihn danach an
 * den Auslöser zurück. Der Fokus startet auf „Abbrechen“; die endgültige Aktion
 * steht zuletzt (R15) und lässt sich optional erst nach einer ausdrücklichen
 * Bestätigung (`acknowledgeLabel`) auslösen. Nur Theme-Tokens – damit passt der
 * Dialog in Lernraum und Lehrer-Dashboard, hell, dunkel und in hohem Kontrast.
 */
export default function ConfirmDialog({
  title, description, children, cancelLabel, confirmLabel, pendingLabel, acknowledgeLabel, pending = false, error, returnFocus, onConfirm, onClose,
}: {
  title: string
  description: string
  /** Zusätzliche Erklärung, z. B. was gelöscht wird und was erhalten bleibt. */
  children?: ReactNode
  cancelLabel: string
  confirmLabel: string
  pendingLabel?: string
  /** Text einer Checkbox, die vor der endgültigen Aktion angehakt werden muss. */
  acknowledgeLabel?: string
  pending?: boolean
  error?: string | null
  /** Auslöser, der den Fokus zurückerhält. Safari fokussiert angeklickte Buttons nicht von selbst. */
  returnFocus?: RefObject<HTMLElement | null>
  onConfirm: () => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const statusId = useId()
  const [acknowledged, setAcknowledged] = useState(false)

  // Rendered only after a click, never during server rendering: `document` is available.
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    // The trigger exists before this dialog does; Safari just does not focus it on click.
    const opener = returnFocus?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    cancel.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      document.body.style.overflow = previousOverflow
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [returnFocus])
  // Disabled buttons cannot hold focus; keep it inside the dialog while the action runs.
  useEffect(() => { if (pending) dialog.current?.focus({ preventScroll: true }) }, [pending])

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const element = dialog.current
    const controls = element?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
    if (!controls?.length) { event.preventDefault(); element?.focus({ preventScroll: true }); return }
    const first = controls[0], last = controls[controls.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) { event.preventDefault(); first.focus() }
  }

  return createPortal(
    <dialog ref={dialog} tabIndex={-1} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={pending}
      data-lenis-prevent onKeyDown={trapFocus} onCancel={event => { event.preventDefault(); if (!pending) onClose() }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-top,0px)_-_env(safe-area-inset-bottom,0px))] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-2xl outline-none backdrop:bg-black/55 sm:p-6">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--danger)_12%,var(--surface))] text-[var(--danger)]">
        <AlertTriangle size={24} aria-hidden="true" />
      </span>
      <h2 id={titleId} className="break-words text-xl font-bold leading-snug tracking-tight">{title}</h2>
      <p id={descriptionId} className="mt-3 text-base leading-relaxed text-[var(--muted)]">{description}</p>
      {children && <div className="mt-4 text-base leading-relaxed">{children}</div>}
      {acknowledgeLabel && (
        <label className="mt-5 flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] p-3 text-base leading-snug has-[:checked]:border-[var(--danger)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
          <input type="checkbox" checked={acknowledged} disabled={pending} onChange={event => setAcknowledged(event.target.checked)}
            className={`mt-0.5 h-6 w-6 shrink-0 accent-[var(--danger)] ${focusRing}`} />
          <span>{acknowledgeLabel}</span>
        </label>
      )}
      {pending && pendingLabel && (
        <p role="status" id={statusId} className="mt-5 flex items-center gap-3 rounded-xl bg-[var(--surface-muted)] p-3 text-base font-semibold">
          <Loader2 size={20} className="shrink-0 animate-spin" aria-hidden="true" />{pendingLabel}
        </p>
      )}
      {error && <p role="alert" className="mt-5 rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] p-3 text-base leading-relaxed text-[var(--danger)]">{error}</p>}
      <DialogActions className="mt-6"
        secondary={
          <button ref={cancel} type="button" disabled={pending} onClick={onClose}
            className={`min-h-12 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] disabled:opacity-50 ${focusRing}`}>
            {cancelLabel}
          </button>
        }
        primary={
          <button type="button" disabled={pending || (Boolean(acknowledgeLabel) && !acknowledged)} onClick={onConfirm}
            aria-describedby={pending && pendingLabel ? statusId : undefined}
            className={`min-h-12 rounded-xl bg-[var(--danger)] px-4 py-3 text-base font-semibold text-[var(--surface)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}>
            {confirmLabel}
          </button>
        } />
    </dialog>,
    document.body,
  )
}
