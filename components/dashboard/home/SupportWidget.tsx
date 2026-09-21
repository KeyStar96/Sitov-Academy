import { LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { dashboardHomeTranslator } from '@/lib/dashboard-home-i18n'

export interface SupportLabels {
  whatsapp: string
  phone: string
  phoneLabel: string
  telegram: string
  email: string
  emailLabel: string
}

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
  const channels = [
    { href: 'https://wa.me/491714758620', label: labels.whatsapp, icon: MessageCircle, external: true },
    { href: `tel:${labels.phone.replace(/\s/g, '')}`, label: labels.phoneLabel, icon: Phone, external: false },
    { href: 'https://t.me/Sprachschule_Anastasia', label: labels.telegram, icon: Send, external: true },
    { href: `mailto:${labels.email}`, label: labels.emailLabel, icon: Mail, external: false },
  ]
  return (
    <section aria-labelledby="dashboard-support-title" className={`flex min-w-0 flex-col rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-md sm:p-7 ${className}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--violet)]">
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
              className="flex min-h-14 w-full min-w-0 items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-lg font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--violet)] hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[var(--violet)]"
            >
              <channel.icon size={22} aria-hidden="true" className="shrink-0 text-[var(--violet)]" />
              <span className="min-w-0 break-words">{channel.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
