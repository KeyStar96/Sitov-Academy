'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { CalendarDays, GraduationCap, House, LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import PressableCard from '@/components/motion/PressableCard'
import SlidingPill from '@/components/motion/SlidingPill'
import NewBadge from '@/components/motion/NewBadge'
import { levelHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { supportChannels, type SupportLabels } from '@/lib/support-channels'

const CHANNEL_ICONS = { whatsapp: MessageCircle, phone: Phone, telegram: Send, email: Mail } as const
/** D8: erst ab dieser Scrolltiefe reagieren … */
export const TABBAR_MIN_DEPTH = 56
/** … und erst nach so viel Bewegung in eine Richtung. */
export const TABBAR_MIN_TRAVEL = 8

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
 * Tastaturfokus in der Leiste → sichtbar; offene Bildschirmtastatur → verborgen
 * (Platz für die Eingabe); offenes Blatt/Dialog → sichtbar; ganz oben →
 * sichtbar; sonst folgt sie der Scrollrichtung, sobald man
 * mindestens 8 px in eine Richtung gescrollt hat. `null`: nichts ändern.
 */
export function decideTabbar({ focusInBar, keyboard, dialog, y, travel, direction }: {
  focusInBar: boolean
  keyboard: boolean
  dialog: boolean
  y: number
  /** Strecke seit dem letzten Richtungswechsel. */
  travel: number
  direction: -1 | 0 | 1
}): TabbarState | null {
  if (focusInBar) return 'visible'
  if (keyboard) return 'hidden'
  if (dialog) return 'visible'
  if (y <= TABBAR_MIN_DEPTH) return 'visible'
  if (travel < TABBAR_MIN_TRAVEL || direction === 0) return null
  return direction > 0 ? 'hidden' : 'visible'
}

/**
 * Feste App-Leiste unten auf dem Handy: Start · Lernen · Kalender · Hilfe —
 * jedes Symbol mit Wort darunter, der aktive Bereich mit gleitender Pille.
 *
 * „Lernen" führt zum zuletzt gelernten Niveau (`get_last_active_level`, vom
 * Layout übergeben); in einem Niveau zu dessen Übersicht. Nur wenn die
 * Abfrage scheitert, führt der Reiter zum ersten freigeschalteten Niveau.
 * „Hilfe" öffnet die Kontaktwege als Blatt.
 *
 * Beim Runterscrollen macht die Leiste Platz, beim Hochscrollen kommt sie
 * zurück. Der Zustand steht als `data-tabbar` am Wurzelelement; die
 * CSS-Variable `--st-tabbar-visible` richtet alles aus, was über der Leiste
 * schwebt (z. B. das Aufnahme-Dock). Die Modus-Leiste oben (`ModeDock`) folgt
 * demselben Zustand auf allen Breiten: runter → gleitet nach oben weg, hoch →
 * kommt weich zurück. Ab Tablet-Breite übernimmt die Kopfzeile die Links.
 */
export default function StudentNavigation({ lang, firstLevel, levels, supportLabels, lastActiveLevel, learnNew = false }: {
  lang: string
  firstLevel: string | null
  /** Freigeschaltete Niveaus — nur diese darf „Lernen" ansteuern. */
  levels: string[]
  supportLabels: SupportLabels
  /** Ergebnis von `get_last_active_level`; `undefined`, wenn die Abfrage scheiterte. */
  lastActiveLevel?: string | null
  /** In irgendeinem freigeschalteten Niveau ist etwas neu (Phase 6.1): Punkt am Reiter „Lernen". */
  learnNew?: boolean
}) {
  const t = studentTranslator(lang)
  const pathname = usePathname() ?? ''
  const group = useId()
  const nav = useRef<HTMLElement>(null)
  // Ein Tippen auf „Lernen“ lässt den Link im persistenten Layout fokussiert.
  // Nur Tastaturfokus darf die Leisten beim anschließenden Scrollen festhalten.
  const sitovKeyboardNavigation = useRef(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpOpenRef = useRef(helpOpen)
  const [sitovTabbar, setSitovTabbar] = useState({ pathname, state: 'visible' as TabbarState })
  // Ein neuer Lernbereich beginnt mit sichtbaren Leisten und einer eigenen Scroll-Baseline.
  const tabbar = helpOpen || sitovTabbar.pathname !== pathname ? 'visible' : sitovTabbar.state
  const base = `/${lang}/dashboard`
  const levelMatch = pathname.match(/\/dashboard\/level\/([^/]+)/)
  const currentLevel = levelMatch ? decodeURIComponent(levelMatch[1]) : null
  useEffect(() => {
    try { window.localStorage.removeItem('sitov:last-level') } catch { /* retired unscoped fallback */ }
  }, [])

  useEffect(() => {
    const root = nav.current?.closest<HTMLElement>('.academy-student-shell')
    if (root) root.dataset.tabbar = tabbar
  }, [tabbar])

  useEffect(() => {
    // Safari kann beim elastischen Scrollen Werte außerhalb der Seite melden.
    const sitovScrollY = () => Math.min(
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
      Math.max(0, window.scrollY),
    )
    let lastY = sitovScrollY()
    let anchor = lastY
    let direction: -1 | 0 | 1 = 0
    let frame = 0
    const decide = () => {
      frame = 0
      const y = sitovScrollY()
      const step = Math.sign(y - lastY) as -1 | 0 | 1
      if (step !== 0 && step !== direction) { direction = step; anchor = lastY }
      lastY = y
      const next = decideTabbar({
        focusInBar: sitovKeyboardNavigation.current && (
          !!nav.current?.contains(document.activeElement) || !!document.activeElement?.closest('.st-mode-dock')
        ),
        keyboard: keyboardOpen(),
        dialog: helpOpenRef.current || !!document.querySelector('[role="dialog"][aria-modal="true"]'),
        y,
        // Fokus-/Resize-Ereignisse dürfen keine alte Scrollrichtung wiederholen.
        travel: Math.abs(y - anchor), direction: step === 0 ? 0 : direction,
      })
      if (next) setSitovTabbar(current => current.pathname === pathname && current.state === next
        ? current : { pathname, state: next })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(decide) }
    const pointer = () => { sitovKeyboardNavigation.current = false }
    const keyboard = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      sitovKeyboardNavigation.current = true
      schedule()
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('keydown', keyboard, true)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('focusout', schedule)
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('keydown', keyboard, true)
    }
  }, [pathname])

  useEffect(() => {
    helpOpenRef.current = helpOpen
  }, [helpOpen])

  const rpcLevel = lastActiveLevel && levels.includes(lastActiveLevel) ? lastActiveLevel : null
  const learnLevel = (currentLevel && levels.includes(currentLevel) ? currentLevel : null)
    ?? rpcLevel ?? firstLevel
  const tabs = [
    { id: 'home', label: t('nav_home'), icon: House, href: base, active: pathname === base || pathname === `${base}/` },
    { id: 'learn', label: t('nav_learn'), icon: GraduationCap, href: learnLevel ? levelHref(lang, learnLevel) : base, active: !!currentLevel, fresh: learnNew },
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
                {'fresh' in tab && tab.fresh && <NewBadge variant="dot" label={t('nav_learn_new')} className="st-tabbar__new" />}
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
        icon={<LifeBuoy size={24} />}>
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
      </BottomSheet>
    </>
  )
}
