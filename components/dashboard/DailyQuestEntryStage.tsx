'use client'

import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'

/**
 * Bühne der Deutschreise-Karte: Zeigerlicht und Tiefe am Desktop, Ruhe
 * außerhalb des Sichtfelds und ein Zünden erst, wenn die Karte zu sehen ist.
 * Alles hier ist Zugabe — ohne JavaScript und unter „weniger Bewegung"
 * bleibt die Karte vollständig (siehe DailyQuestEntry.module.css).
 */
export default function DailyQuestEntryStage(props: ComponentPropsWithoutRef<'section'>) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const stage = ref.current
    if (!stage || typeof window.matchMedia !== 'function' || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Liegt die Karte beim Laden unter dem Falz, wartet die Flamme mit dem Zünden.
    let first = true
    const observer = new IntersectionObserver(([entry]) => {
      const live = entry.isIntersecting
      stage.dataset.live = String(live)
      stage.querySelectorAll<SVGSVGElement>('svg[data-flame]').forEach(svg => live ? svg.unpauseAnimations?.() : svg.pauseAnimations?.())
      if (first && !live) stage.dataset.ignite = 'wait'
      else if (stage.dataset.ignite === 'wait' && entry.intersectionRatio >= 0.4) stage.dataset.ignite = 'go'
      first = false
    }, { threshold: [0, 0.4] })
    observer.observe(stage)

    let frame = 0
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
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
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (fine) { stage.addEventListener('pointermove', move); stage.addEventListener('pointerleave', leave) }
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame)
      stage.removeEventListener('pointermove', move); stage.removeEventListener('pointerleave', leave)
    }
  }, [])

  return <section ref={ref} {...props} />
}
