'use client'

import { useId } from 'react'
import { usePathname } from 'next/navigation'
import { Archive, ListChecks } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import SlidingPill from '@/components/motion/SlidingPill'
import { lessonsHref, modeHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'

/**
 * Die zwei Ansichten im Modus Vokabeln: Lernbox (üben) und Lektionen
 * (auswählen, was in die Lernbox kommt). Nur auf diesen beiden Seiten
 * sichtbar — Einstufung und Lernrunde füllen den ganzen Bildschirm.
 */
export default function VocabularyTabs({ lang, level }: { lang: string; level: string }) {
  const t = studentTranslator(lang)
  const pathname = usePathname() ?? ''
  const group = useId()
  const box = modeHref(lang, level, 'vocabulary')
  const lessons = lessonsHref(lang, level)
  const at = (href: string) => decodeURIComponent(pathname.replace(/\/$/, '')) === decodeURIComponent(href)
  if (!at(box) && !at(lessons)) return null
  const tabs = [
    { href: box, label: t('vocab_tab_box'), icon: Archive },
    { href: lessons, label: t('vocab_tab_lessons'), icon: ListChecks },
  ]
  return (
    <nav aria-label={t('vocab_tabs_label')} className="st-subnav">
      {tabs.map(tab => {
        const current = at(tab.href)
        return (
          <PressableCard key={tab.href} href={tab.href} className="st-subnav__link" aria-current={current ? 'page' : undefined}>
            {current && <SlidingPill group={`vocab-tabs-${group}`} className="st-subnav__pill" />}
            <tab.icon size={20} aria-hidden="true" />
            <span>{tab.label}</span>
          </PressableCard>
        )
      })}
    </nav>
  )
}
