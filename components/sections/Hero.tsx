'use client'

import { useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react'
import { gsap, useGSAP } from '@/lib/gsap'
import type { getDictionary } from '@/lib/dictionary'
import styles from './HeroBrain.module.css'
import BetaBadge from '@/components/ui/BetaBadge'

const NeuralBrain = dynamic(() => import('@/components/effects/NeuralBrain'), { ssr: false })
type Dictionary = Awaited<ReturnType<typeof getDictionary>>

export default function Hero({ dictionary, lang = 'de' }: { dictionary: Dictionary; lang?: string }) {
  const container = useRef<HTMLElement>(null)
  const copy = dictionary.academy
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo('.hero-reveal', { y: 22, opacity: .25 }, { y: 0, opacity: 1, duration: .85, stagger: .085, ease: 'power3.out', clearProps: 'all' })
      gsap.fromTo('.hero-visual', { y: 28, opacity: .3, scale: .97 }, { y: 0, opacity: 1, scale: 1, duration: 1.15, delay: .15, ease: 'power3.out', clearProps: 'all' })
    })
    return () => media.revert()
  }, { scope: container })

  return <section ref={container} id="hero" className="academy-hero academy-container">
    <div className="academy-hero-copy">
      <p className="academy-eyebrow hero-reveal"><span className="academy-status-dot" />{copy.hero_eyebrow}</p>
      <h1 className="hero-reveal">{copy.hero_title}<br /><span>{copy.hero_highlight}</span></h1>
      <p className="academy-hero-description hero-reveal">{copy.hero_description}</p>
      <div className="academy-hero-actions hero-reveal">
        <Link href={`/${lang}/dashboard`} className="academy-button academy-button-outline">{copy.hero_secondary}<BetaBadge label={copy.beta_label} hint={copy.beta_hint} /><ArrowRight size={18} aria-hidden="true" /></Link>
        <Link href="#courses" className="academy-button academy-button-primary">{copy.hero_primary}<ArrowUpRight size={20} aria-hidden="true" /></Link>
      </div>
      <div className="academy-hero-footnote hero-reveal"><span>{copy.hero_level_range}</span><span aria-hidden="true">·</span><span>{dictionary.header.banner.location}</span></div>
    </div>
    <figure className={`${styles.card} hero-visual`} data-neural-brain-panel data-sitov-home-motion>
      <div className={styles.heading}><span className="academy-eyebrow">{copy.learn_tag}</span><Sparkles size={18} aria-hidden="true" /></div>
      <div className={styles.scene} data-neural-brain-scene>
        <svg className={styles.orbits} viewBox="0 0 560 380" fill="none" aria-hidden="true" focusable="false">
          <g transform="rotate(-22 280 190)">
            <ellipse className={styles.orbitTrack} cx="280" cy="190" rx="224" ry="126" />
            <ellipse className={styles.orbitTrail} cx="280" cy="190" rx="224" ry="126" pathLength="100" />
          </g>
          <g transform="rotate(28 280 190)">
            <ellipse className={styles.orbitTrackSecondary} cx="280" cy="190" rx="205" ry="133" />
            <ellipse className={styles.orbitTrailSecondary} cx="280" cy="190" rx="205" ry="133" pathLength="100" />
          </g>
        </svg>
        <div className={styles.canvas}><NeuralBrain /></div>
        <div className={styles.words} aria-hidden="true">
          <span className={styles.word}>Hallo.</span>
          <span className={styles.word}>Danke.</span>
          <span className={styles.word}>Zusammen.</span>
        </div>
      </div>
      <figcaption className={styles.caption} data-neural-brain-caption><div className={styles.captionSignal} aria-hidden="true"><i /><i /><i /><i /><i /></div><p>{copy.brain_caption}</p><span>{copy.brain_note}</span></figcaption>
    </figure>
  </section>
}
