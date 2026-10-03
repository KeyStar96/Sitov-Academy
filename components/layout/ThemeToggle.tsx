'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Contrast, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { EASE_OUT_SOFT, useReducedMotionSafe } from '@/lib/motion'
import styles from './SitovAppearance.module.css'
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
  const reduced = useReducedMotionSafe()
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
      const height = Math.min(Math.max(panel.current.scrollHeight, panel.current.offsetHeight), viewportHeight - (viewportWidth <= 640 ? 24 : 32))
      if (viewportWidth <= 640) {
        setPosition({ left: viewportLeft + 12, top: viewportTop + viewportHeight - height - 12, maxHeight: viewportHeight - 24, visibility: 'visible' })
        return
      }
      const left = Math.max(viewportLeft + 16, Math.min(anchor.right - width, viewportLeft + viewportWidth - width - 16))
      const below = anchor.bottom + 8
      const top = below + height <= viewportTop + viewportHeight - 16
        ? below : Math.max(viewportTop + 16, Math.min(anchor.top - height - 8, viewportTop + viewportHeight - height - 16))
      setPosition({ left, top, maxHeight: viewportTop + viewportHeight - top - 16, visibility: 'visible' })
    }
    place()
    const resize = new ResizeObserver(place)
    if (panel.current) resize.observe(panel.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      resize.disconnect()
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
      {open && createPortal(<motion.div ref={panel} id={id} role="dialog" aria-labelledby={`${id}-title`} className={`academy-appearance-panel fixed z-[1000] ${styles.panel}`} style={position}
        initial={reduced ? false : { opacity: 0, y: 14, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: reduced ? 0 : .32, ease: EASE_OUT_SOFT }}>
        <div className={styles.panelHead}>
          <span className={styles.panelMark} aria-hidden="true"><Contrast size={21} /></span>
          <h2 id={`${id}-title`}>{copy.title}</h2>
          <button type="button" className={`academy-icon-button ${styles.close}`} aria-label={copy.close} onClick={close}><X size={20} aria-hidden="true" /></button>
        </div>
        <AppearanceOptions lightLabel={lightLabel} darkLabel={darkLabel} />
      </motion.div>, document.body)}
    </div>
  )
}
