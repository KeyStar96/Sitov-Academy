'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Contrast, X } from 'lucide-react'
import AppearanceOptions from './AppearanceOptions'
import { useAppearanceCopy } from './AppearanceProvider'

/** One compact entry point for light, dark and the independent contrast preference. */
export default function ThemeToggle({ lightLabel, darkLabel, label }: {
  lightLabel: string
  darkLabel: string
  /** Sichtbares Wort unter dem Symbol (Kopfzeile der Lernplattform); ohne bleibt es ein reines Symbol. */
  label?: string
}) {
  const copy = useAppearanceCopy()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()

  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      if (!wrapper.current || !panel.current || !trigger.current) return
      const anchor = trigger.current.getBoundingClientRect()
      const width = panel.current.getBoundingClientRect().width
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportWidth = viewport?.width ?? window.innerWidth
      const viewportHeight = viewport?.height ?? window.innerHeight
      const height = Math.min(panel.current.scrollHeight, viewportHeight - 32)
      const left = Math.max(viewportLeft + 16, Math.min(anchor.right - width, viewportLeft + viewportWidth - width - 16))
      const below = anchor.bottom + 8
      const top = below + height <= viewportTop + viewportHeight - 16
        ? below : Math.max(viewportTop + 16, Math.min(anchor.top - height - 8, viewportTop + viewportHeight - height - 16))
      setPosition({ left, top, maxHeight: viewportTop + viewportHeight - top - 16, visibility: 'visible' })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (open && position.visibility === 'visible') panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true })
  }, [open, position.visibility])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open])

  return (
    <div ref={wrapper} className="academy-appearance relative shrink-0" onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close() }
    }} onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !panel.current?.contains(event.relatedTarget)) setOpen(false)
    }}>
      <button ref={trigger} type="button" onClick={() => setOpen(value => !value)} className={label ? 'st-toolbar-button st-press' : 'academy-icon-button'} aria-label={copy.title} title={copy.title} aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined}>
        <Contrast className="h-5 w-5" aria-hidden="true" />
        {label && <span aria-hidden="true">{label}</span>}
      </button>
      {/* A body portal escapes the mobile menu's scrolling/clipping container. */}
      {open && createPortal(<div ref={panel} id={id} role="dialog" aria-labelledby={`${id}-title`} className="academy-appearance-panel fixed z-[1000] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] shadow-xl [overflow-wrap:break-word]" style={position}>
        <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
          <h2 id={`${id}-title`} className="min-w-0 text-lg font-bold leading-snug">{copy.title}</h2>
          <button type="button" className="academy-icon-button shrink-0" aria-label={copy.close} onClick={close}><X size={20} aria-hidden="true" /></button>
        </div>
        <AppearanceOptions lightLabel={lightLabel} darkLabel={darkLabel} />
      </div>, document.body)}
    </div>
  )
}
