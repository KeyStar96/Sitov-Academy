import { ArrowRight, BookOpen, Clapperboard, Mic, Route } from 'lucide-react'
import PressableCard from '@/components/motion/PressableCard'
import type { LearningMode } from '@/lib/mode-targets'
import { studentTranslator } from '@/lib/student-ui-i18n'

const ICONS = { vocabulary: BookOpen, path: Route, pronunciation: Mic, media: Clapperboard } as const

export interface ResumeTarget {
  /** Modus des Ziels (Kennfarbe und Symbol). */
  mode: LearningMode
  href: string
  /** „Vokabeln · Lektion 3" — nur, wenn es eine letzte Stelle gibt. */
  place: string | null
  /** Was dort wartet, z. B. „12 Karten warten in der Lernbox". */
  hint: string | null
  /** `true`: Es gibt eine frühere Lernhandlung in diesem Niveau. */
  resumes: boolean
}

/**
 * Oben auf der Niveau-Seite: „Weiter, wo du aufgehört hast" — der zuletzt
 * genutzte Modus und die letzte Stelle (aus `get_last_active_level`) und
 * genau ein großer Knopf dorthin. Ohne frühere Lernhandlung schlägt die
 * Karte den ersten sinnvollen Schritt vor.
 */
export default function ResumeCard({ lang, level, title, description, target }: {
  lang: string
  level: string
  title: string
  description: string
  target: ResumeTarget | null
}) {
  const t = studentTranslator(lang)
  const Icon = target ? ICONS[target.mode] : null
  return (
    <section className="st-resume sl-glass sl-hero st-rise" aria-labelledby="resume-title">
      <div className="relative">
        <p className="st-eyebrow !mt-0">{t('areas_level', { level })}</p>
        <p className="st-resume__level">{title}</p>
        {description && <p className="st-resume__level-text">{description}</p>}
        <h2 id="resume-title" className="st-resume__title">{t(target && !target.resumes ? 'continue_start_title' : 'continue_title')}</h2>
        {target && target.place && Icon && (
          <p className="st-resume__place">
            <span className="st-resume__place-icon" data-mode={target.mode} aria-hidden="true"><Icon size={22} /></span>
            <span className="min-w-0">{t('continue_last', { place: target.place })}</span>
          </p>
        )}
        {target ? (
          <PressableCard href={target.href} className="st-cta">
            <span className="st-cta__text">
              <span className="st-cta__label">{t(target.resumes ? 'continue_action' : 'continue_start_action')}</span>
              {target.hint && <span className="st-cta__hint">{target.hint}</span>}
            </span>
            <span className="st-cta__arrow" aria-hidden="true"><ArrowRight size={24} /></span>
          </PressableCard>
        ) : <p className="st-resume__none">{t('continue_none')}</p>}
      </div>
    </section>
  )
}
