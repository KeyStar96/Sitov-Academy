'use client'

import SitovMarketingLanguageSwitcher from '@/components/layout/SitovMarketingLanguageSwitcher'

/**
 * Sichtbare Sprachwahl auf Anmelden/Registrieren: Die Seitensprache wird bei
 * der Registrierung als Oberflächensprache gespeichert — wer auf der falschen
 * Sprache landet, soll sie vorher umstellen können, statt den Browser
 * übersetzen zu lassen.
 */
export default function AuthLanguageSelect({ lang, label }: { lang: string; label: string }) {
  return <SitovMarketingLanguageSwitcher current={lang} label={label} />
}
