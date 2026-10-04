'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  BookOpen, CalendarDays, ChevronRight, Clapperboard, ClipboardCheck, File, GraduationCap, House, ListChecks, Map, Mic, Route, UserRound, Waypoints,
} from 'lucide-react'
import { buildBreadcrumbs, type CrumbKind } from '@/lib/breadcrumbs'
import { createDashboardTranslator, type DashboardTranslations } from '@/lib/dashboard-i18n'
import { EASE_OUT_SOFT, MOTION, STAGGER, STAGGER_LIMIT, useIsHydrating, useReducedMotionSafe } from '@/lib/motion'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'

const ICONS: Record<CrumbKind, typeof House> = {
  home: House, level: GraduationCap, vocabulary: BookOpen, path: Route, pronunciation: Mic, media: Clapperboard, verbs: Waypoints,
  lessons: ListChecks, calendar: CalendarDays, profile: UserRound, exam: ClipboardCheck, page: File,
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
  sitovPathname,
}: {
  lang: string
  translations: DashboardTranslations
  breadcrumbLabel?: string
  /** Development previews use the same shell with a synthetic learner route. */
  sitovPathname?: string
}) {
  const sitovCurrentPath = usePathname() ?? ''
  const pathname = sitovPathname ?? sitovCurrentPath
  const t = createDashboardTranslator(translations)
  const s = studentTranslator(lang)
  const crumbs = buildBreadcrumbs(pathname, lang, t, s('media_video')).map(crumb =>
    crumb.href.endsWith('/daily-quest') ? { ...crumb, name: getDailyQuestCopy(lang).navJourney } : crumb)
  const reduced = useReducedMotionSafe()
  const hydrating = useIsHydrating()
  const list = useRef<HTMLOListElement>(null)
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
          const Icon = crumb.href.endsWith('/daily-quest') ? Map : ICONS[crumb.kind]
          // Stable href keys preserve existing crumbs; Framer applies initial
          // only to newly mounted items after a route change.
          const entering = !hydrating && !reduced
          const content = <><Icon size={18} aria-hidden="true" className="st-crumb__icon" /><span className="st-crumb__text">{crumb.name}</span></>
          return (
            <motion.li key={crumb.href} className="st-crumbs__item" data-kind={crumb.kind}
              initial={entering ? { opacity: 0, x: -8 } : false} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: MOTION.base, ease: EASE_OUT_SOFT, delay: entering ? Math.min(index, STAGGER_LIMIT - 1) * STAGGER : 0 }}>
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
