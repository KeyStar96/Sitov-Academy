'use client'

import { openConsentSettings } from '@/lib/analytics/consent'

/** Öffnet die Einwilligungs-Einstellungen erneut (Widerruf jederzeit möglich). */
export default function ConsentSettingsButton({ label, className }: { label: string; className?: string }) {
  return <button type="button" className={className} onClick={openConsentSettings}>{label}</button>
}
