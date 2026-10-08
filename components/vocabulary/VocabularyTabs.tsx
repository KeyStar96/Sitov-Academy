'use client'

import { usePathname } from 'next/navigation'
import { Archive, ListChecks, Target } from 'lucide-react'
import SitovTrainerTabs from '@/components/motion/SitovTrainerTabs'
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
  const box = modeHref(lang, level, 'vocabulary')
  const lessons = lessonsHref(lang, level)
  const focus = focusHref(lang, level)
  const at = (href: string) => decodeURIComponent(pathname.replace(/\/$/, '')) === decodeURIComponent(href)
  if (!at(box) && !at(lessons) && !at(focus)) return null
  const tabs = [
    { id: 'box', href: box, label: t('vocab_tab_box'), icon: Archive, selected: at(box) },
    { id: 'lessons', href: lessons, label: t('vocab_tab_lessons'), icon: ListChecks, selected: at(lessons) },
    { id: 'focus', href: focus, label: t('vocab_tab_focus'), icon: Target, selected: at(focus) },
  ]
  return (
    <SitovTrainerTabs label={t('vocab_tabs_label')} mode="vocabulary" items={tabs} />
  )
}
