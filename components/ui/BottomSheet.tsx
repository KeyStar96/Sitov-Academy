'use client'

import { useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'framer-motion'
import { X } from 'lucide-react'
import { useScrollLock } from '@/components/ui/useScrollLock'
import { cn } from '@/lib/utils'

/** Ab so vielen Pixeln Zug nach unten (oder entsprechendem Schwung) schließt das Blatt. */
const DISMISS_OFFSET = 110
const DISMISS_VELOCITY = 600
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Blatt von unten wie in einer App — das gemeinsame Muster hinter dem
 * Lernbox-Inspektor, jetzt für Stationen, Hilfe, Abmelden und Mediathek.
 *
 * Telefon: fährt von unten herein, am Griff nach unten wegziehbar, nur der
 * Inhalt scrollt. Ab 640 px: mittig schwebender Dialog. Hängt per Portal am
 * `<body>`, weil Glasflächen mit `backdrop-filter` sonst Bezugsrahmen für
 * `position: fixed` wären. Escape schließt, der Fokus kehrt zurück.
 */
export default function BottomSheet({ open, onClose, title, description, icon, children, footer, closeLabel, dismissible = true, wide = false, className }: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  closeLabel: string
  /** Solange etwas gespeichert wird, bleibt das Blatt offen. */
  dismissible?: boolean
  /** Breiter Dialog auf großen Bildschirmen (z. B. für Videos). */
  wide?: boolean
  className?: string
}) {
  const reduced = useReducedMotion() ?? false
  const [mounted, setMounted] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  const titleId = useId()
  const close = useRef(onClose)
  close.current = onClose
  useScrollLock(open)

  useEffect(() => {
    setMounted(true)
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(min-width: 640px)')
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement
    const frame = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && dismissible) close.current() }
    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [open, dismissible])

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (desktop || !dismissible || (event.target instanceof Element && event.target.closest('button, a, input, select, textarea'))) return
    drag.start(event)
  }
  function endDrag(_: unknown, info: PanInfo) {
    if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) onClose()
  }

  if (!mounted) return null
  const hidden = reduced ? { opacity: 0 } : desktop ? { opacity: 0, scale: 0.94, y: 16 } : { y: '100%' }
  const shown = reduced ? { opacity: 1 } : desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="sheet" className="st-sheet-layer">
          <motion.div aria-hidden="true" className="st-sheet-backdrop" onClick={() => { if (dismissible) onClose() }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} />
          <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            className={cn('st-sheet', wide && 'st-sheet--wide', className)}
            initial={hidden} animate={shown} exit={hidden}
            transition={reduced ? { duration: 0.15 } : { type: 'spring', damping: 34, stiffness: 360, mass: 0.9 }}
            drag={desktop || !dismissible ? false : 'y'} dragControls={drag} dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} onDragEnd={endDrag}>
            <div className="st-sheet__head" onPointerDown={startDrag}>
              <span aria-hidden="true" className="st-sheet__grip" />
              <div className="st-sheet__title-row">
                {icon && <span className="st-sheet__icon" aria-hidden="true">{icon}</span>}
                <div className="min-w-0 flex-1">
                  <h2 id={titleId} className="st-sheet__title">{title}</h2>
                  {description && <div className="st-sheet__description">{description}</div>}
                </div>
                <motion.button type="button" onClick={onClose} disabled={!dismissible} className="st-sheet__close"
                  whileTap={reduced ? undefined : { scale: 0.9 }} transition={{ duration: 0.15, ease: EASE }}>
                  <X size={22} aria-hidden="true" /><span className="sr-only">{closeLabel}</span>
                </motion.button>
              </div>
            </div>
            {children && <div className="st-sheet__body" data-lenis-prevent>{children}</div>}
            {footer && <div className="st-sheet__foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
