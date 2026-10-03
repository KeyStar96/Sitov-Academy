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
    let visible = true
    let frame = 0
    let active: HTMLElement | null = null
    const updateLive = () => { stage.dataset.sitovLive = String(visible && !document.hidden && !sitovReduced) }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updateLive()
    }, { threshold: 0 })
    observer?.observe(stage)
    updateLive()
    document.addEventListener('visibilitychange', updateLive)

    const clear = () => {
      cancelAnimationFrame(frame)
      if (active) { active.dataset.sitovPointer = 'false'; active = null }
    }
    const move = (event: PointerEvent) => {
      if (sitovReduced || event.pointerType === 'touch' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
      const surface = (event.target as HTMLElement).closest<HTMLElement>('[data-sitov-surface]')
      if (!surface || !stage.contains(surface) || surface.getAttribute('aria-disabled') === 'true') { clear(); return }
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
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', updateLive)
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerleave', clear)
      clear()
    }
  }, [sitovReduced])

  return <div ref={sitovRef} {...props} />
}
