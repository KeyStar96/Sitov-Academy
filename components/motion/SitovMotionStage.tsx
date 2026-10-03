'use client'

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { useReducedMotionSafe } from '@/lib/motion'

/** Shares the trainer lighting while suspending decorative motion offscreen. */
export default function SitovMotionStage(props: ComponentPropsWithoutRef<'div'>) {
  const sitovRef = useRef<HTMLDivElement>(null)
  const sitovReduced = useReducedMotionSafe()

  useEffect(() => {
    const stage = sitovRef.current
    if (!stage) return
    let visible = typeof IntersectionObserver === 'undefined'
    let frame = 0
    let active: HTMLElement | null = null
    const clear = () => {
      cancelAnimationFrame(frame)
      if (active) { active.dataset.sitovPointer = 'false'; active = null }
    }
    const updateLive = () => {
      const live = visible && !document.hidden && !sitovReduced
      stage.dataset.sitovLive = String(live)
      if (!live) clear()
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updateLive()
    }, { threshold: 0 })
    observer?.observe(stage)
    updateLive()
    document.addEventListener('visibilitychange', updateLive)

    const move = (event: PointerEvent) => {
      if (!visible || document.hidden || sitovReduced || event.pointerType === 'touch' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) { clear(); return }
      const surface = (event.target as Element).closest<HTMLElement>('[data-sitov-surface]')
      if (!surface || surface.closest('[data-sitov-motion-stage]') !== stage || surface.getAttribute('aria-disabled') === 'true' || surface.matches(':disabled')) { clear(); return }
      if (surface !== active) { clear(); active = surface }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = surface.getBoundingClientRect()
        surface.style.setProperty('--sitov-light-x', `${((event.clientX - box.left) / box.width * 100).toFixed(1)}%`)
        surface.style.setProperty('--sitov-light-y', `${((event.clientY - box.top) / box.height * 100).toFixed(1)}%`)
        surface.dataset.sitovPointer = 'true'
      })
    }
    stage.addEventListener('pointermove', move)
    stage.addEventListener('pointerleave', clear)
    stage.addEventListener('pointercancel', clear)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', updateLive)
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerleave', clear)
      stage.removeEventListener('pointercancel', clear)
      clear()
    }
  }, [sitovReduced])

  return <div ref={sitovRef} {...props} data-sitov-motion-stage="" data-sitov-live="false" />
}
