'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { ArrowUpRight, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion, useMotionTemplate, useMotionValue } from 'framer-motion'
import { cn } from '@/lib/utils'

type Props = {
  eyebrow?: string
  title: string
  description: string
  ctaLabel: string
  href: string
  icon?: LucideIcon
  className?: string
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export default function PremiumCtaCard({ eyebrow, title, description, ctaLabel, href, icon: Icon, className }: Props) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  // Spotlight folgt dem Cursor (nur Desktop/Maus, dezent).
  const mx = useMotionValue(50)
  const my = useMotionValue(50)
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${mx}% ${my}%, var(--accent-soft), transparent 60%)`

  const onMove = (e: React.MouseEvent) => {
    if (reduced || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set(((e.clientX - r.left) / r.width) * 100)
    my.set(((e.clientY - r.top) / r.height) * 100)
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      className={cn('premium-cta', className)}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      whileHover={reduced ? undefined : { y: -4 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <motion.span aria-hidden className="premium-cta-spotlight" style={reduced ? undefined : { background: spotlight }} />
      <div className="premium-cta-body">
        {eyebrow && (
          <p className="academy-eyebrow"><span className="academy-status-dot" aria-hidden />{eyebrow}</p>
        )}
        <h2 className="premium-cta-title">{title}</h2>
        <p className="premium-cta-text">{description}</p>
        <motion.div
          className="premium-cta-actions"
          whileHover={reduced ? undefined : { scale: 1.03 }}
          whileTap={reduced ? undefined : { scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          <Link href={href} className="academy-button academy-button-primary premium-cta-button">
            {Icon && <Icon size={20} aria-hidden="true" />}
            {ctaLabel}
            <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  )
}
