'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './SitovHomepageMotion.module.css'

/** Decorative motion shares one observer and sleeps outside the viewport. */
export default function SitovHomepageMotion({ children }: { children: ReactNode }) {
  const sitovRoot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = sitovRoot.current
    if (!root) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sections = [...root.querySelectorAll<HTMLElement>('[data-sitov-home-motion]')]
    const visible = new Set<Element>()
    const update = () => {
      for (const section of sections) {
        const live = visible.has(section) && !document.hidden && !preference.matches
        section.style.setProperty('--sitov-motion-play-state', live ? 'running' : 'paused')
        section.dataset.sitovMotionLive = String(live)
      }
    }
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }
      update()
    }, { threshold: 0.01 })
    for (const section of sections) {
      if (observer) observer.observe(section)
      else visible.add(section)
    }
    update()
    preference.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer?.disconnect()
      preference.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return <div ref={sitovRoot} className={`academy-home ${styles.home}`}>{children}</div>
}
