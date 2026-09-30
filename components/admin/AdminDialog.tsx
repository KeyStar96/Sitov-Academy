'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useAdminTranslator } from './AdminI18nProvider'
import { adminButton } from './ui'

/**
 * Native modal semantics keep keyboard focus and scrolling inside the editor.
 * Smartphone: Vollbild-Blatt mit Safe-Area-Abständen; ab `sm` ein zentrierter
 * Dialog im sachlichen Admin-Stil.
 */
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
      className="admin-shell m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-[var(--surface)] p-0 text-[var(--foreground)] backdrop:bg-black/50 sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%_-_3rem)] sm:max-w-2xl sm:rounded-xl sm:border sm:border-[var(--admin-line)] sm:shadow-[var(--shadow-lg)]"
    >
      <div className="flex h-full flex-col pb-[env(safe-area-inset-bottom)] sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:pb-0">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--admin-line)] py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:py-4 sm:pl-6 sm:pr-4">
          <div className="min-w-0 pt-1.5">
            <h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-base font-semibold leading-snug focus:outline-none sm:text-lg">{title}</h2>
            {subtitle && <p id={`${titleId}-subtitle`} className="mt-0.5 break-words text-sm text-[var(--muted)]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={!dismissible} aria-label={t('dialog_close')} className={adminButton('ghost', 'icon')}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  )
}
