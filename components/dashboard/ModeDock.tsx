'use client'

import { useEffect, useId, useState } from 'react'
import { usePathname } from 'next/navigation'
import { BookOpen, Clapperboard, Lock, Mic, Route } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import SlidingPill from '@/components/motion/SlidingPill'
import NewBadge from '@/components/motion/NewBadge'
import CountUp from '@/components/motion/CountUp'
import { modeFromPathname, modeHref, type LearningMode } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'

export type ModeLock = 'language' | 'teacher' | null

export interface ModeDockEntry {
  mode: LearningMode
  lock: ModeLock
  /** Zahl am Reiter: fällige Karten (Vokabeln) oder ungelesene Antworten (Aussprache). */
  count?: number
  /** „Neu"-Kennzeichen; gefüllt ab Phase 6 (gesehen-Quittung). */
  fresh?: boolean
}

const ICONS = { vocabulary: BookOpen, path: Route, pronunciation: Mic, media: Clapperboard } as const
const LABELS = { vocabulary: 'area_vocabulary', path: 'area_path', pronunciation: 'area_pronunciation', media: 'area_media' } as const
const COUNT_TEXT = { vocabulary: 'status_vocab_due', pronunciation: 'status_pron_unread' } as const

/**
 * Modus-Dock (D6): Vokabeln · Lernpfad · Aussprache · Mediathek — immer
 * gleichwertig oben unter dem Seitenkopf, mit Symbol und Wort.
 *
 * Jeder Modus ist ein Link; der aktive trägt `aria-current="page"` und die
 * wandernde Pille. Gesperrte Modi bleiben sichtbar: Schloss statt Symbol,
 * der Grund steht im zugänglichen Namen (und als Tooltip), der Link führt zur
 * Erklärung (Freischaltung durch die Lehrkraft bzw. Lernsprache wählen) —
 * nie in eine gesperrte Aufgabe. Die Ziele kommen aus `lib/mode-targets.ts`.
 */
export default function ModeDock({ lang, level, entries }: {
  lang: string
  level: string
  entries: ModeDockEntry[]
}) {
  const t = studentTranslator(lang)
  const pathname = usePathname() ?? ''
  const active = modeFromPathname(pathname)
  const group = useId()
  const top = useStickyTop()

  return (
    <nav aria-label={t('mode_dock_label', { level })} className="st-mode-dock" style={top === null ? undefined : { top }}>
      <ul className="st-mode-dock__list">
        {entries.map(entry => {
          const Icon = entry.lock ? Lock : ICONS[entry.mode]
          const current = entry.mode === active
          const countKey = entry.mode === 'vocabulary' || entry.mode === 'pronunciation' ? COUNT_TEXT[entry.mode] : null
          const count = !entry.lock && countKey && entry.count ? entry.count : 0
          const status = entry.lock === 'language' ? t('mode_locked_language')
            : entry.lock === 'teacher' ? t('mode_locked')
              : count && countKey ? t.count(countKey, count) : null
          return (
            <li key={entry.mode} className="st-mode-dock__item">
              <PressableCard href={modeHref(lang, level, entry.mode)} className="st-mode-dock__link"
                aria-current={current ? 'page' : undefined} data-mode={entry.mode} data-locked={entry.lock ?? undefined}
                // Der Name beginnt mit dem sichtbaren Wort (WCAG 2.5.3) und nennt Zahl bzw. Sperrgrund.
                aria-label={status ? `${t(LABELS[entry.mode])}, ${status}` : undefined}
                title={entry.lock ? status ?? undefined : undefined}>
                {current && <SlidingPill group={`mode-dock-${group}`} className="st-mode-dock__pill" />}
                <span className="st-mode-dock__icon" aria-hidden="true"><Icon size={22} /></span>
                <span className="st-mode-dock__label">{t(LABELS[entry.mode])}</span>
                {count > 0 && <span className="st-mode-dock__count" aria-hidden="true"><CountUp value={count} cap={999} /></span>}
                {entry.fresh && !entry.lock && <NewBadge variant="dot" label={t('media_new')} className="st-mode-dock__new" />}
              </PressableCard>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** Klebt direkt unter dem (unterschiedlich hohen) Seitenkopf. */
function useStickyTop(): number | null {
  const [top, setTop] = useState<number | null>(null)
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.academy-student-header')
    if (!header) return
    const update = () => setTop(Math.round(header.getBoundingClientRect().height))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  return top
}
