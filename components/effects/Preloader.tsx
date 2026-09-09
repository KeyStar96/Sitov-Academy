'use client'

import { useEffect, useRef, useState } from 'react'
import { gsap } from '@/lib/gsap'

function padProgress(value: number): string {
  return String(Math.round(value)).padStart(3, '0')
}

/**
 * Cinematic first-load curtain. GSAP timeline, then a dual-panel wipe.
 * Respects stored light/dark theme, `prefers-reduced-motion`, and iOS safe areas.
 */
export default function Preloader() {
  const [isComplete, setIsComplete] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelTopRef = useRef<HTMLDivElement>(null)
  const panelBottomRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const sitovRef = useRef<HTMLSpanElement>(null)
  const languageRef = useRef<HTMLSpanElement>(null)
  const academyRef = useRef<HTMLSpanElement>(null)
  const barFillRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const giantRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const metaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    document.body.style.overflow = 'hidden'

    const finish = (): void => {
      setIsComplete(true)
      document.body.style.overflow = ''
      window.dispatchEvent(new Event('preloader-complete'))
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      const timer = window.setTimeout(finish, 350)
      return () => {
        window.clearTimeout(timer)
        document.body.style.overflow = ''
      }
    }

    const counter = { val: 0 }
    const ctx = gsap.context(() => {
      gsap.set([sitovRef.current, languageRef.current, academyRef.current], { yPercent: 120 })
      gsap.set([counterRef.current, metaRef.current], { opacity: 0, y: 12 })
      gsap.set(barFillRef.current, { scaleX: 0, transformOrigin: 'left center' })
      gsap.set(glowRef.current, { opacity: 0.18, scale: 0.82 })

      const tl = gsap.timeline({ onComplete: finish })

      tl.to([sitovRef.current, languageRef.current, academyRef.current], {
        yPercent: 0,
        duration: 1.05,
        ease: 'power4.out',
        stagger: 0.08,
      }, 0.12)

      tl.to([counterRef.current, metaRef.current], {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
      }, 0.28)

      tl.to(counter, {
        val: 100,
        duration: 1.85,
        ease: 'power2.inOut',
        onUpdate: () => {
          const n = Math.round(counter.val)
          const label = padProgress(n)
          if (counterRef.current) counterRef.current.textContent = label
          if (giantRef.current) giantRef.current.textContent = label
          if (barFillRef.current) gsap.set(barFillRef.current, { scaleX: n / 100 })
          if (glowRef.current) {
            gsap.set(glowRef.current, {
              opacity: 0.18 + n / 280,
              scale: 0.82 + n / 450,
            })
          }
          root.setAttribute('aria-valuenow', String(n))
        },
      }, 0)

      tl.to(contentRef.current, {
        opacity: 0,
        y: -18,
        duration: 0.42,
        ease: 'power2.in',
      }, 2.12)

      tl.to(panelTopRef.current, {
        yPercent: -102,
        duration: 0.92,
        ease: 'power4.inOut',
      }, 2.22)

      tl.to(panelBottomRef.current, {
        yPercent: 102,
        duration: 0.92,
        ease: 'power4.inOut',
      }, 2.22)
    }, root)

    return () => {
      ctx.revert()
      document.body.style.overflow = ''
    }
  }, [])

  if (isComplete) return null

  return (
    <div
      ref={rootRef}
      role="progressbar"
      aria-valuemin={0}
      aria-valuenow={0}
      aria-valuemax={100}
      aria-label="Sitov Academy"
      className="fixed inset-0 z-[999999] overflow-hidden touch-none bg-[#FCF4E6] dark:bg-[#050505]"
    >
      <div
        ref={panelTopRef}
        className="absolute inset-x-0 top-0 z-0 h-[52%] bg-[#FCF4E6] dark:bg-[#050505] will-change-transform"
      />
      <div
        ref={panelBottomRef}
        className="absolute inset-x-0 bottom-0 z-0 h-[52%] bg-[#FCF4E6] dark:bg-[#050505] will-change-transform"
      />

      <div
        ref={contentRef}
        className="relative z-10 flex min-h-[100dvh] w-full flex-col items-center justify-center px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      >
        <div
          ref={glowRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[42%] h-[min(70vw,28rem)] w-[min(70vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,92,0,0.18)_0%,transparent_68%)] blur-2xl will-change-transform dark:bg-[radial-gradient(circle,rgba(255,92,0,0.28)_0%,transparent_68%)]"
        />

        <div
          aria-hidden="true"
          className="bg-noise-paper pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply dark:opacity-[0.12] dark:mix-blend-overlay"
        />

        <div
          ref={giantRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-[18%] select-none text-center font-sans text-[min(38vw,12rem)] font-bold leading-none tracking-tighter text-[#2D3436]/[0.08] tabular-nums sm:top-[14%] dark:text-[#E2D7CE]/[0.07]"
        >
          000
        </div>
        <h1 className="flex flex-col items-center text-center">
          <span className="block overflow-hidden pt-[0.08em] pb-[0.22em]">
            <span
              ref={sitovRef}
              className="block text-[2.5rem] font-bold leading-none tracking-tight text-[#2D3436] sm:text-6xl md:text-8xl dark:text-[#E2D7CE]"
            >
              Sitov
            </span>
          </span>
          <span className="block overflow-hidden pt-[0.08em] pb-[0.22em]">
            <span
              ref={languageRef}
              className="block text-[2.5rem] font-bold leading-none tracking-tight text-[#2D3436] sm:text-6xl md:text-8xl dark:text-[#E2D7CE]"
            >
              Language
            </span>
          </span>
          <span className="block overflow-hidden pt-[0.08em] pb-[0.22em]">
            <span
              ref={academyRef}
              className="block text-[2.5rem] font-bold leading-none tracking-tight text-[#FF5C00] sm:text-6xl md:text-8xl"
            >
              Academy
            </span>
          </span>
        </h1>

        <div className="mt-8 flex w-full max-w-[16rem] flex-col items-center gap-3 sm:mt-10 sm:max-w-xs">
          <div className="h-px w-full overflow-hidden bg-[#2D3436]/15 dark:bg-[#E2D7CE]/15">
            <div
              ref={barFillRef}
              className="h-full w-full origin-left bg-[#FF5C00] will-change-transform"
            />
          </div>
          <span
            ref={counterRef}
            className="text-sm font-semibold tabular-nums tracking-[0.28em] text-[#FF5C00] sm:text-base"
          >
            000
          </span>
        </div>

        <div
          ref={metaRef}
          className="pointer-events-none absolute inset-x-6 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex items-end justify-between text-[0.65rem] font-medium uppercase tracking-[0.28em] text-[#2D3436]/45 sm:inset-x-10 sm:text-[0.7rem] dark:text-[#E2D7CE]/45"
        >
          <span>Hannover</span>
          <span className="h-1.5 w-1.5 rounded-full bg-[#FF5C00]" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
