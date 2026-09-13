'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Keep drafts mounted between visits while the native dialog owns modal focus. */
export default function PersistentDialog({ open, title, closeLabel, onClose, onOpen, dismissible = true, children }: {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  onOpen?: () => void
  dismissible?: boolean
  children: ReactNode
}) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted || !open) return
    const dialog = dialogRef.current
    if (!dialog) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    titleRef.current?.focus({ preventScroll: true })
    onOpen?.()
    return () => {
      dialog.querySelectorAll('audio').forEach(audio => audio.pause())
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [mounted, open, onOpen])
  if (!mounted) return null
  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-modal="true" data-lenis-prevent
      onCancel={event => { event.preventDefault(); if (dismissible) onClose() }}
      className="m-auto h-[min(52rem,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] w-[calc(100%_-_1rem)] max-w-3xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-black/60">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 sm:px-6">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="min-w-0 break-words text-xl font-bold focus:outline-none sm:text-2xl">{title}</h2>
          <button type="button" disabled={!dismissible} onClick={onClose} aria-label={closeLabel}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--border)] hover:bg-[var(--surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)] disabled:opacity-50">
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>, document.body,
  )
}
