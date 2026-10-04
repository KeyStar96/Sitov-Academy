'use client'

import { useId } from 'react'
import { usePathname } from 'next/navigation'
import { Archive, ListChecks, Target } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import SlidingPill from '@/components/motion/SlidingPill'
import { focusHref, lessonsHref, modeHref } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'

/**
 * Die drei Ansichten im Modus Vokabeln: Lernbox (üben), Lektionen
 * (auswählen, was in die Lernbox kommt) und Problemwörter (Schwachstellen
 * gezielt trainieren, Phase 11.3). Nur auf diesen Seiten sichtbar —
 * Einstufung und Lernrunde füllen den ganzen Bildschirm.
 */
export default function VocabularyTabs({ lang, level, sitovPreviewPathname }: { lang: string; level: string; sitovPreviewPathname?: string }) {
  const t = studentTranslator(lang)
  const currentPathname = usePathname() ?? ''
  const pathname = sitovPreviewPathname ?? currentPathname
  const group = useId()
  const box = modeHref(lang, level, 'vocabulary')
  const lessons = lessonsHref(lang, level)
  const focus = focusHref(lang, level)
  const at = (href: string) => decodeURIComponent(pathname.replace(/\/$/, '')) === decodeURIComponent(href)
  if (!at(box) && !at(lessons) && !at(focus)) return null
  const tabs = [
    { href: box, label: t('vocab_tab_box'), icon: Archive },
    { href: lessons, label: t('vocab_tab_lessons'), icon: ListChecks },
    { href: focus, label: t('vocab_tab_focus'), icon: Target },
  ]
  return (
    <nav aria-label={t('vocab_tabs_label')} className="st-subnav" data-count={tabs.length} data-sitov-vocabulary-tabs>
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
