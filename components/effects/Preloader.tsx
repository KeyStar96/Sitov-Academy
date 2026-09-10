'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { gsap } from '@/lib/gsap'

/** A short, once-per-session brand introduction. Real loading never depends on it. */
export default function Preloader({ label, name, descriptor }: { label: string; name: string; descriptor: string }) {
  const [complete, setComplete] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  useEffect(() => {
    const finish = () => { setComplete(true); window.dispatchEvent(new Event('preloader-complete')) }
    let seen = false
    try { seen = sessionStorage.getItem('sitov-intro-seen') === '1'; sessionStorage.setItem('sitov-intro-seen', '1') } catch { /* Private browsing still permits a short introduction. */ }
    if (seen || !/^\/(de|en|ru|uk|tr)\/?$/.test(pathname) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }
    const context = gsap.context(() => {
      gsap.timeline({ onComplete: finish })
        .fromTo('.academy-preloader-line', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .07, ease: 'power3.out' })
        .to(root.current, { opacity: 0, duration: .32, ease: 'power2.out' }, .62)
    }, root)
    const safety = window.setTimeout(finish, 1500)
    return () => { context.revert(); window.clearTimeout(safety) }
  }, [pathname])
  if (complete || !/^\/(de|en|ru|uk|tr)\/?$/.test(pathname)) return null
  return <div ref={root} className="academy-preloader" role="status" aria-label={label}><div><p className="academy-preloader-line academy-preloader-name">{name}</p><p className="academy-preloader-line academy-preloader-descriptor">{descriptor}</p><span className="academy-preloader-rule" aria-hidden="true" /></div></div>
}
