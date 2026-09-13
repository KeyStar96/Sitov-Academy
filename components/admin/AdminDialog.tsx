'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'

/** Native modal semantics keep keyboard focus and scrolling inside the editor. */
export default function AdminDialog({ title, subtitle, onClose, dismissible = true, children }: {
  title: string
  subtitle?: string
  onClose: () => void
  dismissible?: boolean
  children: ReactNode
}) {
  const t = useAdminTranslator()
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [mounted])
  useEffect(() => {
    if (mounted) titleRef.current?.focus({ preventScroll: true })
  }, [mounted, title])

  if (!mounted) return null
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? `${titleId}-subtitle` : undefined}
      aria-modal="true"
      data-lenis-prevent
      onCancel={event => { event.preventDefault(); if (dismissible) onClose() }}
      onClick={event => {
        if (event.target !== event.currentTarget || !dismissible) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-3xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-black/60"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-xl font-bold focus:outline-none sm:text-2xl">{title}</h2>
            {subtitle && <p id={`${titleId}-subtitle`} className="mt-1 break-words text-base text-[var(--muted)]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={!dismissible} aria-label={t('dialog_close')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] disabled:opacity-50">
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  )
}
