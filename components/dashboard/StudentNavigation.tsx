'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { CalendarDays, GraduationCap, House, LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import LearningHelpEntries from '@/components/dashboard/LearningHelpEntries'
import PressableCard from '@/components/motion/PressableCard'
import SlidingPill from '@/components/motion/SlidingPill'
import { dashboardHomeTranslator } from '@/lib/dashboard-home-i18n'
import { levelHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { supportChannels, type SupportLabels } from '@/lib/support-channels'

const LAST_LEVEL_KEY = 'sitov:last-level'
const CHANNEL_ICONS = { whatsapp: MessageCircle, phone: Phone, telegram: Send, email: Mail } as const
/** D8: erst ab dieser Scrolltiefe reagieren … */
export const TABBAR_MIN_DEPTH = 56
/** … und erst nach so viel Bewegung in eine Richtung. */
export const TABBAR_MIN_TRAVEL = 8

function readLastLevel(): string | null {
  try { return window.localStorage.getItem(LAST_LEVEL_KEY) } catch { return null }
}

/** Eine Bildschirmtastatur ist offen: Eingabefeld mit Fokus auf einem Touch-Gerät. */
function keyboardOpen(): boolean {
  const element = document.activeElement
  if (!(element instanceof HTMLElement)) return false
  const editable = element.isContentEditable
    || element.matches('textarea, select, input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="reset"]):not([type="range"]):not([type="file"])')
  if (!editable) return false
  const viewport = window.visualViewport
  const shrunk = !!viewport && viewport.height < window.innerHeight * 0.8
  return shrunk || window.matchMedia?.('(pointer: coarse)').matches === true
}

export type TabbarState = 'visible' | 'hidden'

/**
 * Entscheidet, ob die Leiste sichtbar ist (D8). Vorrang, von oben nach unten:
 * Fokus in der Leiste → sichtbar; offene Bildschirmtastatur → verborgen
 * (Platz für die Eingabe); offenes Blatt/Dialog → sichtbar; ganz oben oder am
 * Seitenende → sichtbar; sonst folgt sie der Scrollrichtung, sobald man
 * mindestens 8 px in eine Richtung gescrollt hat. `null`: nichts ändern.
 */
export function decideTabbar({ focusInBar, keyboard, dialog, y, viewport, height, travel, direction }: {
  focusInBar: boolean
  keyboard: boolean
  dialog: boolean
  y: number
  viewport: number
  height: number
  /** Strecke seit dem letzten Richtungswechsel. */
  travel: number
  direction: -1 | 0 | 1
}): TabbarState | null {
  if (focusInBar) return 'visible'
  if (keyboard) return 'hidden'
  if (dialog) return 'visible'
  if (y <= TABBAR_MIN_DEPTH || y + viewport >= height - TABBAR_MIN_TRAVEL) return 'visible'
  if (travel < TABBAR_MIN_TRAVEL || direction === 0) return null
  return direction > 0 ? 'hidden' : 'visible'
}

/**
 * Feste App-Leiste unten auf dem Handy: Start · Lernen · Kalender · Hilfe —
 * jedes Symbol mit Wort darunter, der aktive Bereich mit gleitender Pille.
 *
 * „Lernen" führt zum zuletzt gelernten Niveau (`get_last_active_level`, vom
 * Layout übergeben); in einem Niveau zu dessen Übersicht. Nur wenn die
 * Abfrage scheitert, hilft der Browser-Speicher aus, sonst das erste
 * freigeschaltete Niveau. „Hilfe" öffnet die Kontaktwege als Blatt.
 *
 * Beim Runterscrollen macht die Leiste Platz, beim Hochscrollen kommt sie
 * zurück. Der Zustand steht als `data-tabbar` am Wurzelelement; die
 * CSS-Variable `--st-tabbar-visible` richtet alles aus, was über der Leiste
 * schwebt (z. B. das Aufnahme-Dock). Ab Tablet-Breite übernimmt die Kopfzeile.
 */
export default function StudentNavigation({ lang, firstLevel, levels, supportLabels, lastActiveLevel }: {
  lang: string
  firstLevel: string | null
  /** Freigeschaltete Niveaus — nur diese darf „Lernen" ansteuern. */
  levels: string[]
  supportLabels: SupportLabels
  /** Ergebnis von `get_last_active_level`; `undefined`, wenn die Abfrage scheiterte. */
  lastActiveLevel?: string | null
}) {
  const t = studentTranslator(lang)
  const home = dashboardHomeTranslator(lang)
  const pathname = usePathname() ?? ''
  const group = useId()
  const nav = useRef<HTMLElement>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpOpenRef = useRef(helpOpen)
  helpOpenRef.current = helpOpen
  const [storedLevel, setStoredLevel] = useState<string | null>(null)
  const [tabbar, setTabbar] = useState<TabbarState>('visible')
  const base = `/${lang}/dashboard`
  const levelMatch = pathname.match(/\/dashboard\/level\/([^/]+)/)
  const currentLevel = levelMatch ? decodeURIComponent(levelMatch[1]) : null
  const rpcFailed = lastActiveLevel === undefined

  useEffect(() => {
    if (currentLevel && levels.includes(currentLevel)) {
      // Nur noch Rückfall für den Fall, dass die Datenbankabfrage scheitert.
      try { window.localStorage.setItem(LAST_LEVEL_KEY, currentLevel) } catch { /* nur Bequemlichkeit */ }
      setStoredLevel(currentLevel)
      return
    }
    if (!rpcFailed) return
    const stored = readLastLevel()
    setStoredLevel(stored && levels.includes(stored) ? stored : null)
  }, [currentLevel, levels, rpcFailed])

  useEffect(() => {
    const root = nav.current?.closest<HTMLElement>('.academy-student-shell')
    if (root) root.dataset.tabbar = tabbar
  }, [tabbar])

  useEffect(() => {
    let lastY = window.scrollY
    let anchor = lastY
    let direction: -1 | 0 | 1 = 0
    let frame = 0
    const decide = () => {
      frame = 0
      const y = Math.max(0, window.scrollY)
      const step = Math.sign(y - lastY) as -1 | 0 | 1
      if (step !== 0 && step !== direction) { direction = step; anchor = lastY }
      lastY = y
      const next = decideTabbar({
        focusInBar: !!nav.current?.contains(document.activeElement),
        keyboard: keyboardOpen(),
        dialog: helpOpenRef.current || !!document.querySelector('[role="dialog"][aria-modal="true"]'),
        y, viewport: window.innerHeight, height: document.documentElement.scrollHeight,
        travel: Math.abs(y - anchor), direction,
      })
      if (next) setTabbar(next)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(decide) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('focusout', schedule)
    }
  }, [])

  // Ein Seitenwechsel beginnt oben — dort ist die Leiste immer sichtbar.
  useEffect(() => { setTabbar('visible') }, [pathname])
  useEffect(() => { if (helpOpen) setTabbar('visible') }, [helpOpen])

  const rpcLevel = lastActiveLevel && levels.includes(lastActiveLevel) ? lastActiveLevel : null
  const learnLevel = (currentLevel && levels.includes(currentLevel) ? currentLevel : null)
    ?? (rpcFailed ? storedLevel : rpcLevel) ?? firstLevel
  const tabs = [
    { id: 'home', label: t('nav_home'), icon: House, href: base, active: pathname === base || pathname === `${base}/` },
    { id: 'learn', label: t('nav_learn'), icon: GraduationCap, href: learnLevel ? levelHref(lang, learnLevel) : base, active: !!currentLevel },
    { id: 'calendar', label: t('nav_calendar'), icon: CalendarDays, href: `${base}/calendar`, active: pathname.startsWith(`${base}/calendar`) },
  ]

  return (
    <>
      <nav ref={nav} aria-label={t('nav_label')} className="st-tabbar" data-state={tabbar}>
        <ul className="st-tabbar__list">
          {tabs.map(tab => (
            <li key={tab.id} className="st-tabbar__item">
              <PressableCard href={tab.href} aria-current={tab.active ? 'page' : undefined} className="st-tabbar__link">
                {tab.active && <SlidingPill group={`tabbar-${group}`} className="st-tabbar__pill" />}
                <tab.icon size={24} aria-hidden="true" className="st-tabbar__icon" />
                <span className="st-tabbar__label">{tab.label}</span>
              </PressableCard>
            </li>
          ))}
          <li className="st-tabbar__item">
            <PressableCard onClick={() => setHelpOpen(true)} aria-haspopup="dialog" aria-expanded={helpOpen} className="st-tabbar__link">
              <LifeBuoy size={24} aria-hidden="true" className="st-tabbar__icon" />
              <span className="st-tabbar__label">{t('nav_help')}</span>
            </PressableCard>
          </li>
        </ul>
      </nav>
      <BottomSheet open={helpOpen} onClose={() => setHelpOpen(false)} title={t('help_title')} closeLabel={t('close')}
        icon={<LifeBuoy size={24} />} description={home('support_intro')}>
        <ul className="grid gap-3">
          {supportChannels(supportLabels).map((channel, index) => {
            const Icon = CHANNEL_ICONS[channel.kind]
            return (
              <li key={channel.kind} className="st-rise" style={{ '--i': index } as CSSProperties}>
                <a href={channel.href} {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="st-help-link st-press" data-kind={channel.kind}>
                  <span className="st-help-link__icon" aria-hidden="true"><Icon size={24} /></span>
                  <span className="min-w-0 break-words">{channel.label}</span>
                </a>
              </li>
            )
          })}
        </ul>
        <LearningHelpEntries lang={lang} />
      </BottomSheet>
    </>
  )
}
