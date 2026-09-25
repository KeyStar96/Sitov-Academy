'use client'

import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { MOTION, PRESS_SCALE, useReducedMotionSafe } from '@/lib/motion'

const MotionLink = motion.create(Link)

type LinkProps = Omit<ComponentProps<typeof Link>, 'children' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'>
type ButtonProps = Omit<ComponentProps<'button'>, 'children' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart'>

/**
 * Karte oder Knopf, der beim Drücken spürbar nachgibt (Skalierung 0,97, D5).
 *
 * Mit `href` ein Link, sonst ein Knopf. Das Element bleibt immer dasselbe —
 * unter „weniger Bewegung" entfällt nur die Bewegung, nie der Inhalt oder
 * die Bedienung. Tastatur und Screenreader sehen einen gewöhnlichen Link
 * bzw. Knopf.
 */
export default function PressableCard(props: ({ href: LinkProps['href'] } & LinkProps | { href?: undefined } & ButtonProps) & { children: ReactNode }) {
  const reduced = useReducedMotionSafe()
  const press = reduced ? undefined : { scale: PRESS_SCALE }
  const transition = { duration: reduced ? 0 : MOTION.fast }
  if (props.href !== undefined) {
    const { children, ...rest } = props as LinkProps & { children: ReactNode }
    return <MotionLink {...rest} whileTap={press} transition={transition} data-pressable="">{children}</MotionLink>
  }
  const { children, type = 'button', ...rest } = props as ButtonProps & { children: ReactNode }
  return <motion.button {...rest} type={type} whileTap={press} transition={transition} data-pressable="">{children}</motion.button>
}
