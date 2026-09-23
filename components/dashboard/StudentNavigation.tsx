'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, GraduationCap, House, LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import BottomSheet from '@/components/ui/BottomSheet'
import { dashboardHomeTranslator } from '@/lib/dashboard-home-i18n'
import { studentTranslator } from '@/lib/student-ui-i18n'
import { supportChannels, type SupportLabels } from '@/lib/support-channels'

const LAST_LEVEL_KEY = 'sitov:last-level'
const CHANNEL_ICONS = { whatsapp: MessageCircle, phone: Phone, telegram: Send, email: Mail } as const

function readLastLevel(): string | null {
  try { return window.localStorage.getItem(LAST_LEVEL_KEY) } catch { return null }
}

/**
 * Feste App-Leiste unten auf dem Handy: Start · Lernen · Kalender · Hilfe —
 * jedes Symbol mit Wort darunter, der aktive Bereich mit gleitender Pille.
 * „Lernen" führt zum zuletzt besuchten Lernweg (nur eine Bequemlichkeit im
 * Browser), sonst zum ersten freigeschalteten Niveau. „Hilfe" öffnet die
 * Kontaktwege als Blatt. Ab Tablet-Breite übernimmt die Kopfzeile.
 */
export default function StudentNavigation({ lang, firstLevel, levels, supportLabels }: {
  lang: string
  firstLevel: string | null
  /** Freigeschaltete Niveaus — nur diese darf „Lernen" ansteuern. */
  levels: string[]
  supportLabels: SupportLabels
}) {
  const t = studentTranslator(lang)
  const home = dashboardHomeTranslator(lang)
  const pathname = usePathname()
  const [helpOpen, setHelpOpen] = useState(false)
  const [lastLevel, setLastLevel] = useState<string | null>(null)
  const base = `/${lang}/dashboard`
  const levelMatch = pathname.match(/\/dashboard\/level\/([^/]+)/)
  const currentLevel = levelMatch ? decodeURIComponent(levelMatch[1]) : null

  useEffect(() => {
    if (currentLevel && levels.includes(currentLevel)) {
      try { window.localStorage.setItem(LAST_LEVEL_KEY, currentLevel) } catch { /* nur Bequemlichkeit */ }
      setLastLevel(currentLevel)
      return
    }
    const stored = readLastLevel()
    setLastLevel(stored && levels.includes(stored) ? stored : null)
  }, [currentLevel, levels])

  const learnLevel = lastLevel ?? firstLevel
  const tabs = [
    { id: 'home', label: t('nav_home'), icon: House, href: base, active: pathname === base || pathname === `${base}/` },
    { id: 'learn', label: t('nav_learn'), icon: GraduationCap, href: learnLevel ? `${base}/level/${encodeURIComponent(learnLevel)}` : base, active: !!currentLevel },
    { id: 'calendar', label: t('nav_calendar'), icon: CalendarDays, href: `${base}/calendar`, active: pathname.startsWith(`${base}/calendar`) },
  ]

  return (
    <>
      <nav aria-label={t('nav_label')} className="st-tabbar">
        <ul className="st-tabbar__list" style={{ '--st-active': Math.max(0, tabs.findIndex(tab => tab.active)) } as CSSProperties} data-has-active={tabs.some(tab => tab.active)}>
          <li aria-hidden="true" className="st-tabbar__pill" />
          {tabs.map(tab => (
            <li key={tab.id} className="st-tabbar__item">
              <Link href={tab.href} aria-current={tab.active ? 'page' : undefined} className="st-tabbar__link st-press">
                <tab.icon size={24} aria-hidden="true" className="st-tabbar__icon" />
                <span className="st-tabbar__label">{tab.label}</span>
              </Link>
            </li>
          ))}
          <li className="st-tabbar__item">
            <button type="button" onClick={() => setHelpOpen(true)} aria-haspopup="dialog" aria-expanded={helpOpen} className="st-tabbar__link st-press">
              <LifeBuoy size={24} aria-hidden="true" className="st-tabbar__icon" />
              <span className="st-tabbar__label">{t('nav_help')}</span>
            </button>
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
      </BottomSheet>
    </>
  )
}
