'use client'

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { useReducedMotionSafe } from '@/lib/motion'

/** Pointer lighting, visible-only motion and an ignition on first arrival. */
export default function DailyQuestEntryStage(props: ComponentPropsWithoutRef<'section'> & { 'data-enabled'?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const sitovReduced = useReducedMotionSafe()
  const sitovEnabled = props['data-enabled'] !== false

  useEffect(() => {
    const stage = ref.current
    if (!stage) return
    let first = true
    let visible = true
    let frame = 0
    const updateLive = () => {
      const live = visible && !document.hidden && !sitovReduced && sitovEnabled
      stage.dataset.live = String(live)
      if (!sitovEnabled) stage.dataset.ignite = 'go'
      stage.querySelectorAll<SVGSVGElement>('svg[data-flame]').forEach(svg => live ? svg.unpauseAnimations?.() : svg.pauseAnimations?.())
    }
    if (stage.dataset.enabled === 'false' || (sitovReduced && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) stage.dataset.ignite = 'go'
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updateLive()
      if (!sitovReduced && first && !visible && stage.dataset.ignite !== 'go') stage.dataset.ignite = 'wait'
      else if (stage.dataset.ignite === 'wait' && entry.intersectionRatio >= 0.4) stage.dataset.ignite = 'go'
      first = false
    }, { threshold: [0, 0.4] })
    observer?.observe(stage)
    updateLive()
    document.addEventListener('visibilitychange', updateLive)

    const move = (event: PointerEvent) => {
      if (sitovReduced || stage.dataset.enabled === 'false' || event.pointerType === 'touch') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = stage.getBoundingClientRect()
        const x = (event.clientX - box.left) / box.width
        const y = (event.clientY - box.top) / box.height
        stage.style.setProperty('--sitov-mx', `${(x * 100).toFixed(1)}%`)
        stage.style.setProperty('--sitov-my', `${(y * 100).toFixed(1)}%`)
        stage.style.setProperty('--sitov-px', (x * 2 - 1).toFixed(3))
        stage.style.setProperty('--sitov-py', (y * 2 - 1).toFixed(3))
        stage.dataset.pointer = 'true'
      })
    }
    const leave = () => {
      cancelAnimationFrame(frame)
      stage.dataset.pointer = 'false'
      stage.style.setProperty('--sitov-px', '0')
      stage.style.setProperty('--sitov-py', '0')
    }
    if (!sitovReduced && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      stage.addEventListener('pointermove', move)
      stage.addEventListener('pointerleave', leave)
    }
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', updateLive)
      stage.removeEventListener('pointermove', move)
      stage.removeEventListener('pointerleave', leave)
      leave()
    }
  }, [sitovReduced, sitovEnabled])

  return <section ref={ref} {...props} />
}
