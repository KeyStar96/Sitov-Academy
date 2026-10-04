'use client'

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import styles from './SitovSelect.module.css'

export interface SitovSelectOption {
  value: string
  label: string
  disabled?: boolean
  lang?: string
  translate?: 'no' | 'yes'
}

export interface SitovSelectProps {
  id?: string
  labelId?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  value: string
  placeholder: string
  disabled?: boolean
  lang?: string
  className?: string
  options: SitovSelectOption[]
  onChange: (value: string) => void
}

/** A select-only combobox: the trigger retains focus while its listbox is open. */
export default function SitovSelect({
  id, labelId, 'aria-label': ariaLabel, 'aria-describedby': describedBy,
  'aria-invalid': invalid, value, placeholder, disabled = false, lang,
  className, options, onChange,
}: SitovSelectProps) {
  const generatedId = useId()
  const sitovId = id ?? `sitov-select-${generatedId}`
  const listboxId = `${sitovId}-listbox`
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLDivElement | null)[]>([])
  const search = useRef({ text: '', time: 0 })
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedIndex = options.findIndex(option => option.value === value)
  const selected = options[selectedIndex]
  const enabledIndices = options.flatMap((option, index) => option.disabled ? [] : [index])
  const active = enabledIndices.includes(activeIndex) ? activeIndex : enabledIndices[0] ?? -1
  const expanded = open && !disabled

  useLayoutEffect(() => {
    // A task becoming locked must also discard its previous open-menu state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (disabled) setOpen(false)
  }, [disabled])

  useLayoutEffect(() => {
    if (!expanded) return
    const button = trigger.current
    const panel = menu.current
    if (!button || !panel) return

    function position() {
      if (!button || !panel) return
      const rect = button.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportLeft = viewport?.offsetLeft ?? 0
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportWidth = viewport?.width ?? window.innerWidth
      const viewportHeight = viewport?.height ?? window.innerHeight
      const edge = 8
      const gap = 8
      const width = Math.min(Math.max(rect.width, 240), Math.max(0, viewportWidth - edge * 2))
      panel.style.width = `${width}px`
      const contentHeight = Math.min(panel.scrollHeight || options.length * 48 + 12, 320)
      const below = Math.max(0, viewportTop + viewportHeight - rect.bottom - gap - edge)
      const above = Math.max(0, rect.top - viewportTop - gap - edge)
      const placement = below >= Math.min(contentHeight, 200) || below >= above ? 'below' : 'above'
      const maxHeight = Math.min(320, placement === 'below' ? below : above)
      const height = Math.min(contentHeight, maxHeight)
      const left = Math.max(viewportLeft + edge, Math.min(rect.left, viewportLeft + viewportWidth - width - edge))
      const top = placement === 'below' ? rect.bottom + gap : rect.top - gap - height
      panel.style.left = `${left}px`
      panel.style.top = `${Math.max(viewportTop + edge, top)}px`
      panel.style.maxHeight = `${maxHeight}px`
      panel.dataset.placement = placement
      panel.style.visibility = 'visible'
    }

    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !button?.contains(event.target) && !panel?.contains(event.target)) setOpen(false)
    }

    position()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    observer?.observe(button)
    observer?.observe(panel)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    viewportListeners('addEventListener')
    document.addEventListener('pointerdown', outside, true)

    function viewportListeners(method: 'addEventListener' | 'removeEventListener') {
      window.visualViewport?.[method]('resize', position)
      window.visualViewport?.[method]('scroll', position)
    }

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      viewportListeners('removeEventListener')
      document.removeEventListener('pointerdown', outside, true)
    }
  }, [expanded, options.length])

  useLayoutEffect(() => {
    if (!expanded) return
    const panel = menu.current
    const option = optionRefs.current[active]
    if (!panel || !option) return
    // Scroll this listbox alone; scrollIntoView would move the exam page too.
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop
    else if (option.offsetTop + option.offsetHeight > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = option.offsetTop + option.offsetHeight - panel.clientHeight
    }
  }, [expanded, active])

  function show(direction: 'first' | 'last' = 'first') {
    search.current = { text: '', time: 0 }
    setActiveIndex(selectedIndex >= 0 && !selected?.disabled ? selectedIndex
      : direction === 'last' ? enabledIndices[enabledIndices.length - 1] ?? -1 : enabledIndices[0] ?? -1)
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled || disabled) return
    setOpen(false)
    trigger.current?.focus({ preventScroll: true })
    if (option.value !== value) onChange(option.value)
  }

  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'Tab') { setOpen(false); return }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (expanded) choose(active)
      else show()
      return
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      if (!expanded) {
        show(event.key === 'ArrowUp' || event.key === 'End' ? 'last' : 'first')
        if (event.key === 'Home') setActiveIndex(enabledIndices[0] ?? -1)
        if (event.key === 'End') setActiveIndex(enabledIndices[enabledIndices.length - 1] ?? -1)
        return
      }
      const current = enabledIndices.indexOf(active)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabledIndices.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + enabledIndices.length) % enabledIndices.length
      setActiveIndex(enabledIndices[next] ?? -1)
      return
    }
    if (event.key.length !== 1 || !event.key.trim()) return
    event.preventDefault()
    if (!expanded) show()
    const now = Date.now()
    const nextSearch = (now - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase()
    search.current = { text: nextSearch, time: now }
    const repeating = [...nextSearch].every(character => character === nextSearch[0])
    const query = repeating ? nextSearch[0] : nextSearch
    const start = expanded ? Math.max(0, enabledIndices.indexOf(active) + (repeating ? 1 : 0)) : 0
    const ordered = [...enabledIndices.slice(start), ...enabledIndices.slice(0, start)]
    const match = ordered.find(index => options[index].label.toLowerCase().startsWith(query))
    if (match !== undefined) setActiveIndex(match)
  }

  return <>
    <button ref={trigger} id={sitovId} type="button" role="combobox" lang={lang}
      className={[styles.sitovSelectTrigger, className].filter(Boolean).join(' ')}
      disabled={disabled} aria-labelledby={labelId}
      aria-label={ariaLabel ?? (labelId ? undefined : placeholder)} aria-describedby={describedBy}
      aria-invalid={invalid} aria-haspopup="listbox" aria-expanded={expanded}
      aria-controls={expanded ? listboxId : undefined}
      aria-activedescendant={expanded && active >= 0 ? `${sitovId}-option-${active}` : undefined}
      data-selected={Boolean(selected && value)} onKeyDown={keyboard}
      onClick={() => expanded ? setOpen(false) : show()}
      onBlur={event => {
        if (!(event.relatedTarget instanceof Node) || !menu.current?.contains(event.relatedTarget)) setOpen(false)
      }}>
      <span className={styles.sitovSelectValue} lang={selected?.lang} translate={selected?.translate} title={selected?.label ?? placeholder}>
        {selected?.label ?? placeholder}
      </span>
      <ChevronDown size={18} aria-hidden="true" className={styles.sitovSelectChevron} />
    </button>
    {expanded && createPortal(
      <div ref={menu} id={listboxId} role="listbox" lang={lang}
        aria-labelledby={labelId} aria-label={labelId ? undefined : ariaLabel ?? placeholder}
        className={styles.sitovSelectMenu} data-lenis-prevent
        onMouseDown={event => event.preventDefault()}>
        {options.map((option, index) => <div key={option.value} ref={element => { optionRefs.current[index] = element }}
          id={`${sitovId}-option-${index}`} role="option" aria-selected={option.value === value}
          aria-disabled={Boolean(option.disabled)} lang={option.lang} translate={option.translate}
          data-active={active === index} className={styles.sitovSelectOption}
          onPointerMove={() => { if (!option.disabled) setActiveIndex(index) }}
          onClick={() => choose(index)}>
          <span className={styles.sitovSelectOptionLabel}>{option.label}</span>
          <span className={styles.sitovSelectCheck} aria-hidden="true">
            {option.value === value && <Check size={18} />}
          </span>
        </div>)}
      </div>, document.body,
    )}
  </>
}
