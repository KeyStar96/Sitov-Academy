/** Die echten Kontaktwege der Akademie — dieselben wie im Support-Knopf der Startseite. */
export interface SupportLabels {
  whatsapp: string
  phone: string
  phoneLabel: string
  telegram: string
  email: string
  emailLabel: string
}

export type SupportChannelKind = 'whatsapp' | 'phone' | 'telegram' | 'email'

export function supportChannels(labels: SupportLabels): { kind: SupportChannelKind; href: string; label: string; external: boolean }[] {
  return [
    { kind: 'whatsapp', href: 'https://wa.me/491714758620', label: labels.whatsapp, external: true },
    { kind: 'phone', href: `tel:${labels.phone.replace(/\s/g, '')}`, label: labels.phoneLabel, external: false },
    { kind: 'telegram', href: 'https://t.me/Sprachschule_Anastasia', label: labels.telegram, external: true },
    { kind: 'email', href: `mailto:${labels.email}`, label: labels.emailLabel, external: false },
  ]
}
