import { LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { dashboardHomeTranslator } from '@/lib/dashboard-home-i18n'
import { supportChannels, type SupportLabels } from '@/lib/support-channels'

export type { SupportLabels }

const ICONS = { whatsapp: MessageCircle, phone: Phone, telegram: Send, email: Mail } as const

/**
 * Schnellhilfe für ältere Nutzer: gut sichtbare, selbsterklärende Kontaktwege.
 * Nutzt dieselben echten Kanäle wie der globale Support-Button (`SupportNode`).
 */
export default function SupportWidget({ lang, labels, className = '' }: {
  lang: string
  labels: SupportLabels
  className?: string
}) {
  const t = dashboardHomeTranslator(lang)
  const channels = supportChannels(labels).map(channel => ({ ...channel, icon: ICONS[channel.kind] }))
  return (
    <section aria-labelledby="dashboard-support-title" className={`sl-glass flex min-w-0 flex-col rounded-3xl p-6 sm:p-7 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="sl-icon-tile h-12 w-12">
          <LifeBuoy size={24} aria-hidden="true" />
        </span>
        <h2 id="dashboard-support-title" className="text-xl font-bold text-[var(--foreground)]">{t('support_title')}</h2>
      </div>
      <p className="mt-3 text-base leading-relaxed text-[var(--muted)]">{t('support_intro')}</p>
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {channels.map(channel => (
          <li key={channel.href}>
            <a
              href={channel.href}
              {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="sl-card flex min-h-14 w-full items-center gap-3 px-4 py-3 pl-5 text-lg font-semibold text-[var(--foreground)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
            >
              <channel.icon size={22} aria-hidden="true" className="shrink-0 text-[var(--accent-text)]" />
              <span className="min-w-0 break-words">{channel.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
