'use client'

import { cloneElement, useCallback, useEffect, useRef, useState, type ReactElement, type PointerEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionValue, type AnimationPlaybackControls } from 'framer-motion'
import { ArrowLeft, ArrowRight, MoveHorizontal } from 'lucide-react'
import { useReducedMotionSafe } from '@/lib/motion'
import { getSitovTrainerCarouselCopy } from '@/lib/sitov-trainer-carousel-i18n'
import type { LearningMode } from '@/lib/mode-targets'
import styles from './SitovTrainerCarousel.module.css'

export interface SitovTrainerSlide {
  id: LearningMode
  label: string
  locked: boolean
  card: ReactElement<{ tabIndex?: number }>
}

function sitovIndex(position: number, count: number) { return ((position % count) + count) % count }

function SitovDepthSlide({ item, index, count, rotation, radius, active, select, copy }: {
  item: SitovTrainerSlide; index: number; count: number; rotation: MotionValue<number>; radius: number
  active: boolean; select: () => void; copy: ReturnType<typeof getSitovTrainerCarouselCopy>
}) {
  const sitovAngle = (value: number) => (value + index * 360 / count) * Math.PI / 180
  const x = useTransform(rotation, value => Math.sin(sitovAngle(value)) * radius)
  const z = useTransform(rotation, value => (Math.cos(sitovAngle(value)) - 1) * 180)
  const y = useTransform(rotation, value => (Math.cos(sitovAngle(value)) - 1) * 70)
  const rotateY = useTransform(rotation, value => -Math.sin(sitovAngle(value)) * 30)
  const opacity = useTransform(rotation, value => .24 + Math.pow((Math.cos(sitovAngle(value)) + 1) / 2, 2) * .76)
  const selectRear = (event: MouseEvent<HTMLLIElement>) => {
    if (active) return
    event.preventDefault()
    event.stopPropagation()
    select()
  }
  return <motion.li className={styles.sitovSlide} style={{ x, y, z, rotateY, opacity }} data-sitov-active={active ? 'true' : 'false'} data-sitov-mode={item.id}
    aria-hidden={active ? undefined : true} aria-roledescription={copy.slide} aria-label={copy.position.replace('{trainer}', item.label).replace('{current}', String(index + 1)).replace('{total}', String(count))}
    onClickCapture={selectRear}>
    {cloneElement(item.card, { tabIndex: active && !item.locked ? 0 : -1 })}
  </motion.li>
}

/** Five equal rooms on a tilted depth ring. Gesture motion never navigates. */
export default function SitovTrainerCarousel({ items, lang, label }: { items: SitovTrainerSlide[]; lang: string; label: string }) {
  const copy = getSitovTrainerCarouselCopy(lang)
  const reduced = useReducedMotionSafe()
  const count = items.length
  const angle = 360 / count
  const sitovInitial = Math.max(0, items.findIndex(item => !item.locked))
  const [position, setPosition] = useState(sitovInitial)
  const [radius, setRadius] = useState(144)
  const [dragging, setDragging] = useState(false)
  const active = sitovIndex(position, count)
  const rotation = useMotionValue(-sitovInitial * angle)
  const scene = useRef<HTMLDivElement>(null)
  const positionRef = useRef(sitovInitial)
  const wheelDegrees = useRef(0)
  const animation = useRef<AnimationPlaybackControls | null>(null)
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClick = useRef(false)
  const focusActive = useRef(false)
  const pointer = useRef<{ id: number; startX: number; startY: number; base: number; moved: boolean } | null>(null)

  const snap = useCallback((next: number) => {
    if (wheelTimer.current) { clearTimeout(wheelTimer.current); wheelTimer.current = null }
    wheelDegrees.current = 0
    if (sitovIndex(next, count) === sitovIndex(positionRef.current, count)) focusActive.current = false
    else if (scene.current?.querySelector('[data-sitov-active="true"]')?.contains(document.activeElement)) focusActive.current = true
    positionRef.current = next
    setPosition(next)
    animation.current?.stop()
    if (reduced) rotation.set(-next * angle)
    else animation.current = animate(rotation, -next * angle, { type: 'spring', stiffness: 190, damping: 29, mass: .8, restDelta: .05, restSpeed: .1 })
  }, [angle, count, reduced, rotation])

  const show = (index: number) => snap(index + Math.round((positionRef.current - index) / count) * count)

  useEffect(() => {
    // Also stop an in-flight turn when the motion preference changes.
    animation.current?.stop()
    rotation.set(-positionRef.current * angle)
    return () => { animation.current?.stop(); if (wheelTimer.current) clearTimeout(wheelTimer.current) }
  }, [angle, reduced, rotation])

  useEffect(() => {
    const element = scene.current
    if (!element) return
    const resize = () => setRadius(Math.min(element.getBoundingClientRect().width * .44, 180))
    resize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(element)
    const wheel = (event: WheelEvent) => {
      const delta = event.shiftKey ? event.deltaX || event.deltaY : event.deltaX
      // Ordinary vertical page scrolling remains available over the ring.
      if (!delta || (!event.shiftKey && Math.abs(delta) < Math.abs(event.deltaY))) return
      event.preventDefault()
      animation.current?.stop()
      const pixels = delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1)
      if (reduced) wheelDegrees.current += pixels * .35
      else rotation.set(rotation.get() - pixels * .35)
      if (wheelTimer.current) clearTimeout(wheelTimer.current)
      wheelTimer.current = setTimeout(() => {
        const next = reduced ? positionRef.current + Math.round(wheelDegrees.current / angle) : Math.round(-rotation.get() / angle)
        wheelDegrees.current = 0
        snap(next)
      }, 150)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { observer?.disconnect(); element.removeEventListener('wheel', wheel) }
  }, [angle, reduced, rotation, snap])

  useEffect(() => {
    if (!focusActive.current) return
    focusActive.current = false
    const target = scene.current?.querySelector<HTMLAnchorElement>('[data-sitov-active="true"] a')
      ?? scene.current?.parentElement?.querySelector<HTMLButtonElement>('button[data-sitov-selected="true"]')
    target?.focus({ preventScroll: true })
  }, [active])

  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    wheelDegrees.current = 0
    if (wheelTimer.current) { clearTimeout(wheelTimer.current); wheelTimer.current = null }
    animation.current?.stop()
    pointer.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, base: rotation.get(), moved: false }
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = pointer.current
    if (!gesture || gesture.id !== event.pointerId) return
    const distance = event.clientX - gesture.startX
    if (!gesture.moved) {
      if (Math.abs(distance) < 8) return
      if (Math.abs(event.clientY - gesture.startY) > Math.abs(distance)) { pointer.current = null; snap(positionRef.current); return }
      gesture.moved = true
      setDragging(true)
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    event.preventDefault()
    if (!reduced) rotation.set(gesture.base + distance * .5)
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = pointer.current
    if (!gesture || gesture.id !== event.pointerId) return
    pointer.current = null
    setDragging(false)
    if (!gesture.moved) { snap(positionRef.current); return }
    suppressClick.current = true
    const distance = event.clientX - gesture.startX
    const start = Math.round(-gesture.base / angle)
    let next = Math.round(-rotation.get() / angle)
    if (event.type === 'pointercancel') next = positionRef.current
    else if (next === start && Math.abs(distance) > 36) next = start - Math.sign(distance)
    snap(next)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number
    if (event.key === 'ArrowRight') next = positionRef.current + 1
    else if (event.key === 'ArrowLeft') next = positionRef.current - 1
    else if (event.key === 'Home') next = Math.round(positionRef.current / count) * count
    else if (event.key === 'End') next = count - 1 + Math.round((positionRef.current - count + 1) / count) * count
    else return
    event.preventDefault()
    focusActive.current = (event.target as HTMLElement).tagName === 'A'
    snap(next)
  }

  return <div className={styles.sitovCarousel} data-area={items[active].id} role="region" aria-label={label} aria-roledescription={copy.carousel} onKeyDown={key}>
    <div ref={scene} className={styles.sitovScene} data-sitov-dragging={dragging ? 'true' : undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDragStart={event => event.preventDefault()}
      onClickCapture={event => { if (suppressClick.current) { suppressClick.current = false; if (event.detail > 0) { event.preventDefault(); event.stopPropagation() } } }}>
      <span className={styles.sitovRing} aria-hidden="true" />
      <span className={styles.sitovSpot} aria-hidden="true" />
      <ul className={styles.sitovTrack}>
        {items.map((item, index) => <SitovDepthSlide key={item.id} item={item} index={index} count={count} rotation={rotation} radius={radius} active={index === active} select={() => show(index)} copy={copy} />)}
      </ul>
    </div>
    <div className={styles.sitovControls}>
      <button type="button" className={styles.sitovArrow} aria-label={copy.previous} onClick={() => snap(positionRef.current - 1)}><ArrowLeft size={20} aria-hidden="true" /></button>
      <div className={styles.sitovDots} role="group" aria-label={copy.choose}>{items.map((item, index) => <button key={item.id} type="button" data-sitov-selected={index === active ? 'true' : undefined}
        data-area={item.id} aria-label={copy.show.replace('{trainer}', item.label)} aria-pressed={index === active} onClick={() => show(index)}><span /></button>)}</div>
      <button type="button" className={styles.sitovArrow} aria-label={copy.next} onClick={() => snap(positionRef.current + 1)}><ArrowRight size={20} aria-hidden="true" /></button>
    </div>
    <p className={styles.sitovHint}><MoveHorizontal size={15} aria-hidden="true" />{copy.hint}</p>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{copy.position.replace('{trainer}', items[active].label).replace('{current}', String(active + 1)).replace('{total}', String(count))}</span>
  </div>
}
