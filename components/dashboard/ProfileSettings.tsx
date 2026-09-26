'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, CalendarDays, ChevronRight, Contrast, Languages, TriangleAlert, UserRound } from 'lucide-react'
import { studentTranslator } from '@/lib/student-ui-i18n'

export type SettingsSectionId = 'details' | 'language' | 'appearance' | 'courses'

const ICONS = { details: UserRound, language: Languages, appearance: Contrast, courses: CalendarDays } as const
/** Alte Sprunglinks (z. B. „Sprache im Profil auswählen") öffnen direkt den passenden Bereich. */
const HASHES: Record<string, SettingsSectionId> = { '#language-settings': 'language', '#details': 'details', '#appearance': 'appearance', '#courses': 'courses' }
const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Einstellungen wie auf dem Telefon gewohnt: klare Kacheln, ein Tipp öffnet
 * den Bereich, „Alle Einstellungen" (oder die Zurück-Geste) führt zurück.
 * Das Zurücksetzen des Lernstands steht getrennt ganz unten in „Vorsicht".
 */
export default function ProfileSettings({ lang, sections, danger, notice }: {
  lang: string
  sections: { id: SettingsSectionId; title: string; hint: string; content: ReactNode }[]
  danger: ReactNode
  notice?: ReactNode
}) {
  const s = studentTranslator(lang)
  const reduced = useReducedMotion() ?? false
  const [open, setOpen] = useState<SettingsSectionId | null>(null)

  useEffect(() => {
    const sync = () => setOpen(HASHES[window.location.hash] ?? null)
    sync()
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])

  function show(id: SettingsSectionId) {
    const hash = Object.entries(HASHES).find(([, value]) => value === id)?.[0] ?? ''
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
    setOpen(id)
    window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' })
  }
  function back() {
    if (window.location.hash) window.history.back()
    else setOpen(null)
  }

  const current = sections.find(section => section.id === open)

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 [overflow-wrap:break-word]">
      <AnimatePresence mode="wait" initial={false}>
        {!current ? (
          <motion.div key="tiles" initial={reduced ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: -24 }} transition={{ duration: 0.26, ease: EASE }}>
            <h1 className="st-path-hero__title">{s('settings_title')}</h1>
            {notice && <div className="mt-4 text-base leading-relaxed text-[var(--foreground)]">{notice}</div>}
            <ul className="st-settings mt-5">
              {sections.map((section, index) => {
                const Icon = ICONS[section.id]
                return (
                  <li key={section.id} className="st-rise" style={{ '--i': index } as CSSProperties}>
                    <button type="button" onClick={() => show(section.id)} className="st-setting st-press" data-section={section.id}>
                      <span className="st-setting__icon" aria-hidden="true"><Icon size={26} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="st-setting__title">{section.title}</span>
                        <span className="st-setting__hint">{section.hint}</span>
                      </span>
                      <ChevronRight size={22} aria-hidden="true" className="st-setting__chevron" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.div key={current.id} initial={reduced ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: 24 }} transition={{ duration: 0.26, ease: EASE }} className="space-y-5">
            <button type="button" onClick={back} className="st-back-pill st-press !max-w-none">
              <ArrowLeft size={20} aria-hidden="true" />{s('settings_back')}
            </button>
            <div id={current.id === 'language' ? undefined : current.id}>{current.content}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {!current && (
        <section aria-labelledby="settings-danger" className="st-danger st-rise" style={{ '--i': sections.length + 1 } as CSSProperties}>
          <h2 id="settings-danger" className="st-danger__title"><TriangleAlert size={22} aria-hidden="true" />{s('settings_danger')}</h2>
          <p className="st-danger__hint">{s('settings_danger_hint')}</p>
          <div className="mt-4">{danger}</div>
        </section>
      )}
    </div>
  )
}
