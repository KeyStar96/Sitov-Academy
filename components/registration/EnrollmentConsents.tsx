'use client'

import { useState, type CSSProperties } from 'react'
import { Check, CheckCheck, ChevronDown } from 'lucide-react'
import type { FlowCopy } from './registration-copy'

export type ConsentKey = 'privacy' | 'agb' | 'revocation' | 'videoRecording'

export interface ConsentItem { key: ConsentKey; short: string; full: string; optional?: boolean; notice?: string; link?: { href: string; label: string } }

/**
 * Each consent is a large card with one short sentence; the full legal wording
 * stays one tap away ("Mehr lesen"). The bulk button confirms required points
 * only. Recording consent always needs its own voluntary choice.
 */
export default function EnrollmentConsents({ items, values, onChange, onAcceptAll, copy }: {
  items: ConsentItem[]; values: Record<ConsentKey, boolean>
  onChange: (key: ConsentKey, value: boolean) => void; onAcceptAll: () => void; copy: FlowCopy
}) {
  const [open, setOpen] = useState<ConsentKey | null>(null)
  const allChecked = items.filter(item => !item.optional).every(item => values[item.key])
  return (
    <section className="reg-panel" aria-labelledby="reg-consents-title">
      <h2 id="reg-consents-title" className="reg-panel__title">{copy.consents.title}</h2>
      <p className="reg-panel__intro">{copy.consents.intro}</p>
      <button type="button" className="reg-button reg-button--soft reg-consents__all" onClick={onAcceptAll} disabled={allChecked}>
        <CheckCheck size={22} aria-hidden="true" />{copy.consents.accept_all}
      </button>
      <ul className="reg-consents">
        {items.map((item, index) => {
          const checked = values[item.key]
          const expanded = open === item.key
          return (
            <li key={item.key} className="reg-consent reg-enter" data-checked={checked} style={{ '--i': index } as CSSProperties}>
              <label className="reg-consent__main">
                <input id={`reg-consent-${item.key}`} type="checkbox" required={!item.optional} checked={checked} onChange={event => onChange(item.key, event.target.checked)}
                  className="reg-visually-hidden" aria-describedby={[item.notice ? `reg-consent-${item.key}-notice` : '', expanded ? `reg-consent-${item.key}-full` : ''].filter(Boolean).join(' ') || undefined} />
                <span className="reg-check" aria-hidden="true">{checked && <Check size={26} strokeWidth={3} />}</span>
                <span className="reg-consent__text">{item.short}</span>
              </label>
              {item.notice && <p id={`reg-consent-${item.key}-notice`} className="sitov-recording-consent-notice">{item.notice}</p>}
              <button type="button" className="reg-consent__more" aria-expanded={expanded} aria-controls={`reg-consent-${item.key}-full`}
                onClick={() => setOpen(expanded ? null : item.key)}>
                {expanded ? copy.consents.less : copy.consents.more}
                <ChevronDown size={20} aria-hidden="true" data-open={expanded} />
              </button>
              <div id={`reg-consent-${item.key}-full`} className="reg-consent__full" hidden={!expanded}>
                <p>{item.full}</p>
                {item.link && (
                  <a href={item.link.href} target="_blank" rel="noopener noreferrer">
                    {item.link.label} <span className="reg-visually-hidden">{copy.consents.new_tab}</span>
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
