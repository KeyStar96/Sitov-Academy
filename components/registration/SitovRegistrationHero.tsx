import { ArrowUpRight, CalendarDays, Check, MapPin, Monitor, Sparkles } from 'lucide-react'
import { formatMonth, type FlowCopy } from './registration-copy'

/** Code-native motion graphics keep the first question fast and readable. */
export default function SitovRegistrationHero({ copy, trial, monthIso, lang }: {
  copy: FlowCopy; trial: boolean; monthIso: string; lang: string
}) {
  const hero = copy.hero
  return (
    <section className="sitov-registration-hero" aria-label={hero.kicker}>
      <div className="sitov-registration-hero__content">
        <p className="sitov-registration-hero__eyebrow"><span aria-hidden="true" />{hero.kicker}</p>
        <p className="sitov-registration-hero__title">
          <span>{trial ? hero.trial_lead : hero.title_lead}</span>
          <span className="sitov-registration-hero__accent">{trial ? hero.trial_accent : hero.title_accent}<Sparkles aria-hidden="true" /></span>
        </p>
        <p className="sitov-registration-hero__description">{trial ? hero.trial_description : hero.description}</p>
        <div className="sitov-registration-hero__formats">
          <span><MapPin size={17} aria-hidden="true" />{copy.card.presence}</span>
          <span><Monitor size={17} aria-hidden="true" />{copy.card.online}</span>
        </div>
      </div>
      <div className="sitov-registration-art" aria-hidden="true">
        <div className="sitov-registration-art__orbit sitov-registration-art__orbit--outer" />
        <div className="sitov-registration-art__orbit sitov-registration-art__orbit--inner" />
        <span className="sitov-registration-art__spark"><Sparkles size={24} /></span>
        <div className="sitov-registration-art__word">Hallo!<span>Deutsch.</span></div>
        <div className="sitov-registration-art__calendar">
          <div className="sitov-registration-art__calendar-top"><CalendarDays size={18} /><span>{formatMonth(monthIso, lang)}</span><ArrowUpRight size={18} /></div>
          <div className="sitov-registration-art__calendar-grid">
            {Array.from({ length: 21 }, (_, index) => <span key={index} data-lesson={[2, 9, 16].includes(index) || undefined}>{index + 1}{[2, 9, 16].includes(index) && <Check size={12} />}</span>)}
          </div>
          <div className="sitov-registration-art__calendar-foot"><span /><span /><span /></div>
        </div>
        <div className="sitov-registration-art__audio"><span /><span /><span /><span /><span /><span /><span /></div>
        <div className="sitov-registration-art__ticket"><span>Sitov Academy</span><strong>Deutsch</strong><ArrowUpRight size={24} /><span className="sitov-registration-art__ticket-rule" /></div>
      </div>
    </section>
  )
}
