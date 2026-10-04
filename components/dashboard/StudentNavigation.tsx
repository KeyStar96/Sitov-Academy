'use client'

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { CalendarDays, GraduationCap, House, LifeBuoy, Mail, Map, MessageCircle, Phone, Send } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import PressableCard from '@/components/motion/PressableCard'
import SlidingPill from '@/components/motion/SlidingPill'
import NewBadge from '@/components/motion/NewBadge'
import { levelHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { supportChannels, type SupportLabels } from '@/lib/support-channels'
import { getDailyQuestCopy } from '@/lib/daily-quest-i18n'

const CHANNEL_ICONS = { whatsapp: MessageCircle, phone: Phone, telegram: Send, email: Mail } as const

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

/** Directional hysteresis keeps the bars still through small thumb movements. */
export function decideTabbar({ focusInBar, keyboard, scrollY = 0, scrollDistance = 0, previous = 'visible' }: {
  focusInBar: boolean
  keyboard: boolean
  scrollY?: number
  scrollDistance?: number
  previous?: TabbarState
}): TabbarState {
  if (focusInBar) return 'visible'
  if (keyboard) return 'hidden'
  if (scrollY <= 24) return 'visible'
  if (scrollDistance <= -12) return 'visible'
  if (scrollY > 96 && scrollDistance >= 16) return 'hidden'
  return previous
}

/**
 * Shared primary navigation in the desktop header and floating mobile dock.
 * jedes Symbol mit Wort darunter, der aktive Bereich mit gleitender Pille.
 *
 * „Lernen" führt zum zuletzt gelernten Niveau (`get_last_active_level`, vom
 * Layout übergeben); in einem Niveau zu dessen Übersicht. Nur wenn die
 * Abfrage scheitert, führt der Reiter zum ersten freigeschalteten Niveau.
 * „Hilfe" öffnet die Kontaktwege als Blatt.
 *
 * Runterscrollen macht Platz, Hochscrollen zeigt beide Navigationsleisten. Der Zustand steht als `data-tabbar` am Wurzelelement; die
 * CSS-Variable `--st-tabbar-visible` richtet alles aus, was über der Leiste
 * schwebt (z. B. das Aufnahme-Dock). Bei einer Bildschirmtastatur macht nur
 * die mobile Leiste Platz, bis das Eingabefeld verlassen wird.
 */
export default function StudentNavigation({ lang, firstLevel, levels, supportLabels, lastActiveLevel, learnNew = false, sitovPathname }: {
  lang: string
  firstLevel: string | null
  /** Freigeschaltete Niveaus — nur diese darf „Lernen" ansteuern. */
  levels: string[]
  supportLabels: SupportLabels
  /** Ergebnis von `get_last_active_level`; `undefined`, wenn die Abfrage scheiterte. */
  lastActiveLevel?: string | null
  /** In irgendeinem freigeschalteten Niveau ist etwas neu (Phase 6.1): Punkt am Reiter „Lernen". */
  learnNew?: boolean
  sitovPathname?: string
}) {
  const t = studentTranslator(lang)
  const sitovCurrentPath = usePathname() ?? ''
  const pathname = sitovPathname ?? sitovCurrentPath
  const group = useId()
  const nav = useRef<HTMLElement>(null)
  const sitovKeyboardNavigation = useRef(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [sitovTabbar, setSitovTabbar] = useState({ pathname, state: 'visible' as TabbarState })
  // A newly opened learner route begins with its navigation available.
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
    let frame = 0
    let lastY = Math.max(0, window.scrollY)
    let distance = 0
    let scrollState: TabbarState = 'visible'
    const decide = () => {
      frame = 0
      // Clamp Safari's elastic overscroll so bouncing at the page end cannot
      // look like an intentional change in scroll direction.
      const scrolling = document.scrollingElement ?? document.documentElement
      const maxY = Math.max(0, scrolling.scrollHeight - window.innerHeight)
      const y = Math.max(0, maxY > 0 ? Math.min(window.scrollY, maxY) : window.scrollY)
      const delta = y - lastY
      if (delta) distance = Math.sign(delta) === Math.sign(distance) ? distance + delta : delta
      if (y <= 24) distance = 0
      lastY = y
      scrollState = decideTabbar({ focusInBar: false, keyboard: false, scrollY: y, scrollDistance: distance, previous: scrollState })
      const focused = document.activeElement
      const root = nav.current?.closest<HTMLElement>('.academy-student-shell')
      const focusInNavigation = !!nav.current?.contains(focused)
        || !!root?.querySelector('.st-mode-dock')?.contains(focused)
      const next = decideTabbar({
        // Tapping a persistent Link leaves browser focus on it after a route
        // change. Only keyboard focus holds the bars open while scrolling.
        focusInBar: sitovKeyboardNavigation.current && focusInNavigation,
        keyboard: keyboardOpen(),
        scrollY: y,
        previous: scrollState,
      })
      setSitovTabbar(current => current.pathname === pathname && current.state === next
        ? current : { pathname, state: next })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(decide) }
    const pointer = () => { sitovKeyboardNavigation.current = false; schedule() }
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      sitovKeyboardNavigation.current = true
      scrollState = 'visible'
      distance = 0
      schedule()
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('keydown', key, true)
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('keydown', key, true)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('focusout', schedule)
    }
  }, [pathname])

  const rpcLevel = lastActiveLevel && levels.includes(lastActiveLevel) ? lastActiveLevel : null
  const learnLevel = (currentLevel && levels.includes(currentLevel) ? currentLevel : null)
    ?? rpcLevel ?? firstLevel
  const tabs = [
    { id: 'home', label: t('nav_home'), icon: House, href: base, active: pathname === base || pathname === `${base}/` },
    { id: 'learn', label: t('nav_learn'), icon: GraduationCap, href: learnLevel ? levelHref(lang, learnLevel) : base, active: !!currentLevel, fresh: learnNew },
    { id: 'journey', label: getDailyQuestCopy(lang).navJourney, icon: Map, href: `${base}/daily-quest`, active: pathname.startsWith(`${base}/daily-quest`) },
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
