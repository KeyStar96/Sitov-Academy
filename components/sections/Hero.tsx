'use client'

import { useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react'
import { gsap, useGSAP } from '@/lib/gsap'
import type { getDictionary } from '@/lib/dictionary'
import styles from './HeroBrain.module.css'

const NeuralBrain = dynamic(() => import('@/components/effects/NeuralBrain'), { ssr: false })
type Dictionary = Awaited<ReturnType<typeof getDictionary>>

export default function Hero({ dictionary, lang = 'de' }: { dictionary: Dictionary; lang?: string }) {
  const container = useRef<HTMLElement>(null)
  const copy = dictionary.academy
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo('.hero-reveal', { y: 18, opacity: .25 }, { y: 0, opacity: 1, duration: .8, stagger: .09, ease: 'power3.out', clearProps: 'all' })
  }, { scope: container })

  return <section ref={container} id="hero" className="academy-hero academy-container">
    <div className="academy-hero-copy">
      <p className="academy-eyebrow hero-reveal"><span className="academy-status-dot" />{copy.hero_eyebrow}</p>
      <h1 className="hero-reveal">{copy.hero_title}<br /><span>{copy.hero_highlight}</span></h1>
      <p className="academy-hero-description hero-reveal">{copy.hero_description}</p>
      <div className="academy-hero-actions hero-reveal">
        <Link href="#courses" className="academy-button academy-button-primary">{copy.hero_primary}<ArrowUpRight size={20} aria-hidden="true" /></Link>
        <Link href={`/${lang}/dashboard`} className="academy-button academy-button-outline">{copy.hero_secondary}<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      <div className="academy-hero-footnote hero-reveal"><span>A1—B1</span><span aria-hidden="true">·</span><span>{dictionary.header.banner.location}</span></div>
    </div>
    <figure className={styles.card} data-neural-brain-panel>
      <div className={styles.heading}><span className="academy-eyebrow">{copy.learn_tag}</span><Sparkles size={18} aria-hidden="true" /></div>
      <div className={styles.scene} data-neural-brain-scene>
        <div className={styles.canvas}><NeuralBrain /></div>
        <div className={styles.orbit} aria-hidden="true" />
      </div>
      <figcaption className={styles.caption} data-neural-brain-caption><p>{copy.brain_caption}</p><span>{copy.brain_note}</span></figcaption>
    </figure>
  </section>
}
