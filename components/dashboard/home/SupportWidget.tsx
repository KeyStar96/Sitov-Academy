import { ChevronRight, LifeBuoy, Mail, MessageCircle, Phone, Send } from 'lucide-react'
import { dashboardHomeTranslator } from '@/lib/dashboard-home-i18n'
import { supportChannels, type SupportLabels } from '@/lib/support-channels'
import SitovMotionStage from '@/components/motion/SitovMotionStage'
import SitovSupportArt from './SitovSupportArt'
import styles from './SitovLevelSupport.module.css'

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
    <SitovMotionStage className={styles.sitovStage}>
      <section aria-labelledby="dashboard-support-title" className={`sl-glass ${styles.sitovSupport} ${className}`} data-sitov-surface="">
        <span className={styles.sitovAtmosphere} aria-hidden="true"><span className={styles.sitovPointerLight} /><span className={styles.sitovRim} /></span>
        <div className={styles.sitovSupportHeader}>
          <div className={styles.sitovSupportTitle}>
            <span className={styles.sitovSupportIcon}>
              <LifeBuoy size={24} aria-hidden="true" />
            </span>
            <h2 id="dashboard-support-title" className="text-xl font-bold text-[var(--foreground)]">{t('support_title')}</h2>
          </div>
          <SitovSupportArt />
        </div>
        <ul className={styles.sitovContacts}>
          {channels.map(channel => (
            <li key={channel.href}>
              <a
                href={channel.href}
                {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={styles.sitovContact}
                data-channel={channel.kind}
                data-sitov-surface=""
              >
                <span className={styles.sitovContactIcon} aria-hidden="true"><channel.icon size={22} /></span>
                <span className="min-w-0 break-words">{channel.label}</span>
                <ChevronRight size={18} className={styles.sitovContactArrow} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </SitovMotionStage>
  )
}
