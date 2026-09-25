'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BookOpen, CalendarDays, ChevronRight, Clapperboard, File, GraduationCap, House, ListChecks, Mic, Route, UserRound,
} from 'lucide-react'
import { buildBreadcrumbs, type CrumbKind } from '@/lib/breadcrumbs'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import { EASE_OUT_SOFT, MOTION, STAGGER, STAGGER_LIMIT, useIsHydrating, useReducedMotionSafe } from '@/lib/motion'
import { studentTranslator } from '@/lib/student-ui-i18n'

const ICONS: Record<CrumbKind, typeof House> = {
  home: House, level: GraduationCap, vocabulary: BookOpen, path: Route, pronunciation: Mic, media: Clapperboard,
  lessons: ListChecks, calendar: CalendarDays, profile: UserRound, page: File,
}

// Auf dem Server gibt es kein Layout; useLayoutEffect nur im Browser.
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/**
 * Brotkrumen mit vollem Pfad auf allen Breiten (D7): `Start › A1.1 ›
 * Vokabeln › Lektionen`. Vorherige Glieder sind Links, das letzte ist die
 * Seitenüberschrift mit `aria-current="page"`. Jedes Glied trägt Symbol und
 * Wort; die Trenner sind dekorativ.
 *
 * Auf dem Handy scrollt die Spur waagerecht und zeigt nach jedem Wechsel den
 * aktuellen Ort (ohne den Tastaturfokus zu verschieben). Nur neu
 * hinzukommende Glieder blenden gestaffelt ein, bleibende stehen still.
 */
export default function DashboardHeader({
  lang,
  translations,
  breadcrumbLabel,
}: {
  lang: string
  translations: DashboardTranslations
  breadcrumbLabel?: string
}) {
  const pathname = usePathname() ?? ''
  const t = createDashboardTranslator(translations)
  const s = studentTranslator(lang)
  const crumbs = buildBreadcrumbs(pathname, lang, t, s('media_video'))
  const reduced = useReducedMotionSafe()
  const hydrating = useIsHydrating()
  const list = useRef<HTMLOListElement>(null)
  const known = useRef<Set<string> | null>(null)
  if (known.current === null) known.current = new Set(crumbs.map(crumb => crumb.href))
  const firstNew = crumbs.findIndex(crumb => !known.current!.has(crumb.href))

  useEffect(() => { known.current = new Set(crumbs.map(crumb => crumb.href)) })

  useClientLayoutEffect(() => {
    const track = list.current
    if (!track || track.scrollWidth <= track.clientWidth) return
    track.scrollTo({ left: track.scrollWidth, behavior: reduced || hydrating ? 'auto' : 'smooth' })
  }, [pathname])

  if (crumbs.length === 0) return null

  return (
    <nav className="st-crumbs" aria-label={breadcrumbLabel || s('crumbs_label')}>
      <ol ref={list} className="st-crumbs__list">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          const Icon = ICONS[crumb.kind]
          const entering = !hydrating && !reduced && firstNew !== -1 && index >= firstNew
          const content = <><Icon size={18} aria-hidden="true" className="st-crumb__icon" /><span className="st-crumb__text">{crumb.name}</span></>
          return (
            <motion.li key={crumb.href} className="st-crumbs__item" data-kind={crumb.kind}
              initial={entering ? { opacity: 0, x: -8 } : false} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: MOTION.base, ease: EASE_OUT_SOFT, delay: entering ? Math.min(index - firstNew, STAGGER_LIMIT - 1) * STAGGER : 0 }}>
              {isLast
                ? <h1 aria-current="page" className="st-crumb st-crumb--current">{content}</h1>
                : <Link href={crumb.href} className="st-crumb st-press">{content}</Link>}
              {!isLast && <ChevronRight size={16} aria-hidden="true" className="st-crumbs__sep" />}
            </motion.li>
          )
        })}
      </ol>
    </nav>
  )
}
